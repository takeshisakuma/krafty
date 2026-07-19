// @ts-check

/* Shared shell for the floating panels.

   Both panels report on the page while sitting on top of it, so whatever
   they cover is exactly what the user may need to look at. Rather than
   offer a couple of fixed corners, the title bar is a drag handle: the
   obscured content can be anywhere, and two or four preset positions would
   only move the problem around.

   Positions are remembered per panel for as long as the page is open, so
   toggling a checker off and on does not throw the panel back into the
   corner. The store lives in the content script's isolated world, not on
   the page, so nothing is left behind in the DOM. */

/* Wrapped, because the popup injects this file again on every click and a
   top level declaration would collide with the previous run. Anything that
   has to survive is hung off globalThis instead. */

(() => {
  /** @type {Record<string, { left: number, top: number }>} */
  const positions = (globalThis.kraftyPanelPositions ??= {});

  /**
   * @param {number} value
   * @param {number} lowest
   * @param {number} highest
   */
  const clamp = (value, lowest, highest) =>
    Math.min(Math.max(value, lowest), Math.max(lowest, highest));

  /**
   * Position from the top left, clearing the bottom/right anchoring the
   * stylesheet starts with. Marked important because this lands on arbitrary
   * pages, whose own CSS is not to be trusted.
   *
   * @param {HTMLElement} panel
   * @param {number} left
   * @param {number} top
   */
  const place = (panel, left, top) => {
    const style = panel.style;

    style.setProperty(
      "left",
      `${clamp(left, 0, window.innerWidth - panel.offsetWidth)}px`,
      "important",
    );
    style.setProperty(
      "top",
      `${clamp(top, 0, window.innerHeight - panel.offsetHeight)}px`,
      "important",
    );
    style.setProperty("right", "auto", "important");
    style.setProperty("bottom", "auto", "important");
  };

  /**
   * @param {HTMLElement} panel
   * @param {HTMLElement} handle
   * @param {string} id
   */
  const makeMovable = (panel, handle, id) => {
    handle.addEventListener("pointerdown", (event) => {
      /* Left button only, and never when the press started on the close
       button - that is a click, not a drag. */
      if (event.button !== 0) {
        return;
      }
      if (event.target instanceof Element && event.target.closest("button")) {
        return;
      }

      const start = panel.getBoundingClientRect();
      const grabX = event.clientX - start.left;
      const grabY = event.clientY - start.top;

      /* Capture so the drag survives the pointer crossing an iframe or
       leaving the window. */
      handle.setPointerCapture(event.pointerId);
      panel.classList.add("kraftyPanelDragging");
      event.preventDefault();

      /** @param {PointerEvent} move */
      const onMove = (move) => {
        place(panel, move.clientX - grabX, move.clientY - grabY);
      };

      const onUp = () => {
        handle.releasePointerCapture(event.pointerId);
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
        handle.removeEventListener("pointercancel", onUp);
        panel.classList.remove("kraftyPanelDragging");

        const end = panel.getBoundingClientRect();
        positions[id] = { left: end.left, top: end.top };
      };

      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp);
      handle.addEventListener("pointercancel", onUp);
    });
  };

  /**
   * @param {string} text
   * @returns {Promise<boolean>}
   */
  const copyText = async (text) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (error) {
      /* A permissions policy can refuse it even on https. Fall through. */
    }

    /* navigator.clipboard does not exist on http:// pages at all, and
       staging and intranet sites are often http. execCommand is deprecated
       but is the only thing that works there; taking a clipboardWrite
       permission to avoid it would be the worse trade for an extension that
       currently asks for none. */
    const staging = document.createElement("textarea");
    staging.value = text;
    staging.setAttribute("readonly", "");
    staging.style.cssText = "position:fixed;top:-1000px;left:0;opacity:0";
    document.body.appendChild(staging);
    staging.select();

    let copied = false;

    try {
      copied = document.execCommand("copy");
    } catch (error) {
      copied = false;
    }

    staging.remove();
    return copied;
  };

  /**
   * A button that copies whatever the callback returns. The text is read at
   * click time, so a caller can hand over a value that does not exist yet.
   *
   * @param {string} label
   * @param {() => string} read
   * @returns {HTMLButtonElement}
   */
  globalThis.kraftyCopyButton = (label, read) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "kraftyCopy";
    button.title = label;
    button.setAttribute("aria-label", label);

    const icon = document.createElement("span");
    icon.textContent = "⧉";
    button.appendChild(icon);

    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let restore;

    button.addEventListener("click", async (event) => {
      /* These sit inside a panel that drags and rows that may hold a link.
         Copying is neither. */
      event.preventDefault();
      event.stopPropagation();

      const done = await copyText(read());

      clearTimeout(restore);
      icon.textContent = done ? "✓" : "!";
      button.title = kraftyMessage(done ? "copied" : "copyFailed");
      button.classList.toggle("kraftyCopyDone", done);

      restore = setTimeout(() => {
        icon.textContent = "⧉";
        button.title = label;
        button.classList.remove("kraftyCopyDone");
      }, 1400);
    });

    return button;
  };

  /**
   * Build an empty panel. Callers fill the returned body.
   *
   * @param {{ id: string, className: string, title: string, onClose: () => void }} options
   * @returns {{ panel: HTMLElement, body: HTMLElement }}
   */
  globalThis.kraftyPanel = ({ id, className, title, onClose }) => {
    const panel = document.createElement("div");
    panel.id = id;
    panel.className = `kraftyPanel ${className}`;

    const bar = document.createElement("div");
    bar.className = "kraftyPanelBar";

    const heading = document.createElement("strong");
    heading.className = "kraftyPanelTitle";
    heading.textContent = title;
    bar.appendChild(heading);

    const close = document.createElement("button");
    close.type = "button";
    close.className = "kraftyPanelClose";
    close.textContent = "×";
    close.title = kraftyMessage("panelClose");
    close.addEventListener("click", onClose);
    bar.appendChild(close);

    panel.appendChild(bar);

    const body = document.createElement("div");
    body.className = "kraftyPanelBody";
    panel.appendChild(body);

    makeMovable(panel, bar, id);

    /* Restoring the remembered position needs the panel measured, so it has
     to wait until the caller has added it to the document. */
    const remembered = positions[id];

    if (remembered) {
      queueMicrotask(() => {
        if (panel.isConnected) {
          place(panel, remembered.left, remembered.top);
        }
      });
    }

    return { panel, body };
  };
})();
