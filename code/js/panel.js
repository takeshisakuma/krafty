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

  /* A dragged panel carries an absolute top and left, which stop being
     sensible the moment the viewport changes size. Docking devtools is the
     everyday case: the page shrinks, and a panel that was near the bottom
     ends up below the visible area, with no title bar left to grab. Pull
     everything back inside whenever the viewport changes.

     Bound once. This file is injected again on every click, so without the
     guard each run would add another listener. */
  if (!globalThis.kraftyResizeBound) {
    globalThis.kraftyResizeBound = true;

    let scheduled = 0;

    window.addEventListener("resize", () => {
      cancelAnimationFrame(scheduled);

      scheduled = requestAnimationFrame(() => {
        for (const element of document.querySelectorAll(".kraftyPanel")) {
          /* An untouched panel is still anchored by the stylesheet, which
             follows the viewport on its own. Only moved ones need help. */
          if (!(element instanceof HTMLElement) || !element.style.left) {
            continue;
          }

          const before = element.getBoundingClientRect();
          place(element, before.left, before.top);

          const after = element.getBoundingClientRect();
          positions[element.id] = { left: after.left, top: after.top };
        }
      });
    });
  }

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
   * A titled section inside a panel body.
   *
   * The stylesheet for this - `.kraftySection + .kraftySection` and
   * `.kraftySectionTitle` - was hoisted into the shared mixin the moment a
   * second panel wanted it. The DOM that produces it was not, and by the
   * third checker there were three identical copies of this function. Same
   * argument, same place.
   *
   * @param {HTMLElement} into
   * @param {string} key
   * @returns {HTMLElement}
   */
  globalThis.kraftySection = (into, key) => {
    const wrapper = document.createElement("section");
    wrapper.className = "kraftySection";

    const heading = document.createElement("h2");
    heading.className = "kraftySectionTitle";
    heading.textContent = kraftyMessage(key);
    wrapper.appendChild(heading);

    into.appendChild(wrapper);
    return wrapper;
  };

  /**
   * A label on the left and a copy-the-whole-thing button on the right, for
   * a list that is not the findings list.
   *
   * `kraftyFindings` builds the same row for its summary, but that one is
   * rewritten as findings arrive, so the two cannot be the same call. What
   * they can share is the arrangement, which is what `.kraftyChecksHead`
   * styles - two checkers had hand-rolled it identically.
   *
   * @param {HTMLElement} into
   * @param {string} labelKey
   * @param {string} copyLabel
   * @param {() => string} read
   */
  globalThis.kraftyListHead = (into, labelKey, copyLabel, read) => {
    const head = document.createElement("div");
    head.className = "kraftyChecksHead";
    into.appendChild(head);

    const label = document.createElement("div");
    label.className = "kraftyPreviewLabel";
    label.textContent = kraftyMessage(labelKey);
    head.appendChild(label);

    const copy = kraftyCopyButton(copyLabel, read);
    copy.classList.add("kraftyCopyAll");
    head.appendChild(copy);
  };

  /**
   * The findings block: a count, a button that copies the lot, and the list
   * itself. Two checkers report this way and a third would have made a third
   * copy, so it lives here rather than in whichever checker wrote it first.
   *
   * The summary is worded to claim only what was mechanically checked, and
   * every caller inherits that wording for the same reason the head checker
   * needed it: a page can pass every check that exists and still be wrong.
   *
   * Findings are appended as they are discovered, so a check that has to wait
   * for a network round trip reports through the same path.
   *
   * @param {HTMLElement} into
   * @returns {{ report: (level: "alert" | "note", key: string, substitutions?: string[]) => void, reportText: (level: "alert" | "note", text: string) => void }}
   */
  globalThis.kraftyFindings = (into) => {
    const head = document.createElement("div");
    head.className = "kraftyChecksHead";
    into.appendChild(head);

    const summary = document.createElement("div");
    summary.className = "kraftyChecksSummary";
    head.appendChild(summary);

    const list = document.createElement("ul");
    list.className = "kraftyChecks";
    into.appendChild(list);

    /* A finding usually ends up in a ticket, and a ticket wants the address
       it applies to along with every line, not one value at a time. */
    const copy = kraftyCopyButton(kraftyMessage("copyFindings"), () =>
      [
        location.href,
        ...[...list.querySelectorAll("li")].map((item) => `- ${item.textContent}`),
      ].join("\n"),
    );
    copy.classList.add("kraftyCopyAll");
    copy.hidden = true;
    head.appendChild(copy);

    let found = 0;

    const describe = () => {
      summary.textContent =
        found === 0
          ? kraftyMessage("checksClean")
          : found === 1
            ? kraftyMessage("checksCountOne")
            : kraftyMessage("checksCount", [String(found)]);
      summary.classList.toggle("kraftyChecksClean", found === 0);
      copy.hidden = found === 0;
    };

    describe();

    /**
     * @param {"alert" | "note"} level
     * @param {string} text
     */
    const reportText = (level, text) => {
      found += 1;

      const item = document.createElement("li");
      item.className = `kraftyCheck kraftyCheck-${level}`;
      item.textContent = text;
      list.appendChild(item);

      describe();
    };

    return {
      reportText,
      /* The common case: a key to look up. reportText is for a caller that
         has already resolved one, which counted messages have to do. */
      report: (level, key, substitutions) =>
        reportText(level, kraftyMessage(key, substitutions)),
    };
  };

  /**
   * Build an empty panel. Callers fill the returned body.
   *
   * `onRescan` adds a button that runs the check again.
   *
   * A checker judges the document as it stands when it runs, so anything a
   * single page app inserts afterwards is missed - the note under Known
   * limitations proposes a MutationObserver and then lists what it needs:
   * teardown, and a guard against reacting to the classes and titles the
   * checker writes itself. A button is most of that value and none of that
   * cost. Nothing to tear down, nothing to react to its own writes, no
   * checker that can loop. The panels already print the time they scanned,
   * for exactly this reason; the button belongs beside that line.
   *
   * @param {{ id: string, className: string, title: string, onClose: () => void, onRescan?: () => void }} options
   * @returns {{ panel: HTMLElement, body: HTMLElement }}
   */
  globalThis.kraftyPanel = ({ id, className, title, onClose, onRescan }) => {
    const panel = document.createElement("div");
    panel.id = id;
    panel.className = `kraftyPanel ${className}`;

    const bar = document.createElement("div");
    bar.className = "kraftyPanelBar";

    const heading = document.createElement("strong");
    heading.className = "kraftyPanelTitle";
    heading.textContent = title;
    bar.appendChild(heading);

    const controls = document.createElement("div");
    controls.className = "kraftyPanelControls";
    bar.appendChild(controls);

    if (onRescan) {
      const rescan = document.createElement("button");
      rescan.type = "button";
      rescan.className = "kraftyPanelRescan";
      rescan.textContent = "↻";
      rescan.title = kraftyMessage("panelRescan");
      rescan.addEventListener("click", onRescan);
      controls.appendChild(rescan);
    }

    const close = document.createElement("button");
    close.type = "button";
    close.className = "kraftyPanelClose";
    close.textContent = "×";
    close.title = kraftyMessage("panelClose");
    close.addEventListener("click", onClose);
    controls.appendChild(close);

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
