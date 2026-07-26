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

  /* Layout that must survive on the light-DOM host. Item 24 moved paint into
     the shadow, but position / display / size still live on a page `div`,
     and a reset with !important beats the stylesheet. Same defence place()
     already uses for the drag insets. The 60px matches panel.scss:
     $panelInset + 10px. */
  /**
   * @param {HTMLElement} panel
   */
  const hardenHost = (panel) => {
    const style = panel.style;
    /** @param {string} name @param {string} value */
    const set = (name, value) => style.setProperty(name, value, "important");

    set("position", "fixed");
    set("display", "flex");
    set("flex-direction", "column");
    set("z-index", "2147483647");
    set("box-sizing", "border-box");
    set("min-width", "280px");
    set("max-width", "420px");
    set("max-height", "min(80%, calc(100% - 60px))");
  };

  /* Default corners match panel.scss's panel-place() mixin. They cannot be
     read back from getComputedStyle: :host rules lose to author styles from
     the page on the host element (outer tree wins for normal declarations),
     so a reset like `top: unset` on almost every element leaves a fixed
     panel at its static position — the end of a tall body — and locking
     that used value with !important parked panels thousands of pixels down
     the page on sites such as scalermusic.com. place() writes !important
     insets from these numbers instead. */
  const PANEL_INSET = 50;
  const PANEL_STEP = 40;

  /** @type {Record<string, { corner: "top-left" | "top-right" | "bottom-left" | "bottom-right", step: number }>} */
  const PANEL_DOCKS = {
    kraftyImageInformation: { corner: "top-left", step: 0 },
    kraftyMarkupInformation: { corner: "top-left", step: 1 },
    kraftyLeftoversInformation: { corner: "top-left", step: 2 },
    kraftyHeadingInformation: { corner: "top-right", step: 0 },
    kraftyTokenInformation: { corner: "top-right", step: 1 },
    kraftyHeadInformation: { corner: "bottom-left", step: 0 },
    kraftyNestInformation: { corner: "bottom-right", step: 0 },
    kraftyLandmarkInformation: { corner: "bottom-right", step: 1 },
  };

  /**
   * @param {HTMLElement} panel
   */
  const dockDefault = (panel) => {
    const name = [...panel.classList].find((entry) => PANEL_DOCKS[entry]);
    const dock = (name && PANEL_DOCKS[name]) || {
      corner: /** @type {const} */ ("bottom-right"),
      step: 0,
    };
    const inset = PANEL_INSET + dock.step * PANEL_STEP;
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;

    const left = dock.corner.endsWith("right")
      ? window.innerWidth - width - inset
      : inset;
    const top = dock.corner.startsWith("bottom")
      ? window.innerHeight - height - inset
      : inset;

    place(panel, left, top);
  };

  /**
   * @param {HTMLElement} panel
   * @param {HTMLElement} handle
   * @param {string} id
   */
  const makeMovable = (panel, handle, id) => {
    /* Keyboard twin of the drag: the title bar is focusable, and the arrow
       keys nudge by a step. Shift stretches the step. The audience is still
       a director with a mouse; this is the polish that keeps Escape's
       neighbours from being a dead end once focus is in the panel. */
    handle.tabIndex = 0;
    handle.title = kraftyMessage("panelMove");

    handle.addEventListener("keydown", (event) => {
      const step = event.shiftKey ? 40 : 20;
      let deltaX = 0;
      let deltaY = 0;

      if (event.key === "ArrowLeft") {
        deltaX = -step;
      } else if (event.key === "ArrowRight") {
        deltaX = step;
      } else if (event.key === "ArrowUp") {
        deltaY = -step;
      } else if (event.key === "ArrowDown") {
        deltaY = step;
      } else {
        return;
      }

      event.preventDefault();
      const box = panel.getBoundingClientRect();
      place(panel, box.left + deltaX, box.top + deltaY);
      const end = panel.getBoundingClientRect();
      positions[id] = { left: end.left, top: end.top };
    });

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

  /* Point at the flagged element on the page (item 23).

     A row shows the descriptor `locate()` builds - `a > svg`,
     `input[type="tel"]` - which is weakest for exactly the elements these
     checks flag, the ones whose whole fault is having no identifier of their
     own. Drawing a box over the real element sidesteps that: hover a row to
     preview it, click to scroll to it and pin the box. The descriptor stays,
     because it is what the copy button puts in a ticket, where there is no
     page to point at.

     The box is an overlay appended to the body, not to a panel, so it never
     moves or restyles the page element the way an `outline` on the element
     itself would, and item 24's shadow-rooted panels cannot carry it off.

     It is position:fixed at the target's getBoundingClientRect(). Document
     coordinates (absolute + scroll) stay glued to in-flow elements without
     further work, but slide off anything that rides the viewport -
     position:fixed, and sticky once it sticks. Viewport coordinates keep
     both kinds aligned; a scroll/resize listener re-places while a box is
     showing, including through scrollIntoView's smooth travel. */

  const HOVER_BOX = "js-kraftyPointerHover";
  const PIN_BOX = "js-kraftyPointerPin";

  /** @type {Element | null} */
  let hoverTarget = null;
  /** @type {Element | null} */
  let pinTarget = null;

  /**
   * Whether a target can be pointed at: it must occupy space and be painted
   * enough that a box over it would mark something the reader can see.
   *
   * Size alone is not enough. A native <select> under a custom control is
   * often opacity:0; a closed modal may stay position:fixed with opacity:0
   * while its children still report a full rectangle. Both light a red box
   * in empty-looking space. checkVisibility with checkOpacity catches them.
   *
   * Overflow clipping is the other case the alt checker already knew: a
   * carousel keeps off-screen slides in the document at real coordinates and
   * hides them only with an ancestor's overflow. A box over one of those
   * lands on whatever is on screen at those coordinates.
   *
   * @param {Element} target
   */
  const isPointable = (target) => {
    const rect = target.getBoundingClientRect();

    if (rect.width === 0 && rect.height === 0) {
      return false;
    }

    /* Same walk as altCheck's outOfSight: fully outside a clipping ancestor
       means the reader cannot see the element, even though it has a box. */
    for (
      let parent = target.parentElement;
      parent && parent !== document.body;
      parent = parent.parentElement
    ) {
      const styles = getComputedStyle(parent);
      const clipsX = styles.overflowX !== "visible";
      const clipsY = styles.overflowY !== "visible";

      if (!clipsX && !clipsY) {
        continue;
      }

      const frame = parent.getBoundingClientRect();

      if (
        clipsX &&
        (rect.right <= frame.left || rect.left >= frame.right)
      ) {
        return false;
      }

      if (
        clipsY &&
        (rect.bottom <= frame.top || rect.top >= frame.bottom)
      ) {
        return false;
      }
    }

    if (typeof target.checkVisibility === "function") {
      return target.checkVisibility({
        checkOpacity: true,
        checkVisibilityCSS: true,
      });
    }

    return true;
  };

  /**
   * @param {string} id
   * @param {string} className
   * @returns {HTMLElement}
   */
  const overlayBox = (id, className) => {
    const existing = document.getElementById(id);

    if (existing instanceof HTMLElement) {
      return existing;
    }

    const box = document.createElement("div");
    box.id = id;
    box.className = className;
    box.hidden = true;
    /* Paint is also stated here with !important: the box is a light-DOM div
       (it has to sit on the page, not in a panel shadow), so a page reset
       like `div { border: 0 !important }` would otherwise erase the outline
       the stylesheet draws. Same defence as hardenHost. */
    hardenPointerBox(box, id === PIN_BOX);
    box.style.setProperty("display", "none", "important");
    document.body.appendChild(box);
    return box;
  };

  /**
   * @param {HTMLElement} box
   * @param {boolean} pinned
   */
  const hardenPointerBox = (box, pinned) => {
    /** @param {string} name @param {string} value */
    const set = (name, value) => box.style.setProperty(name, value, "important");

    set("position", "fixed");
    set("box-sizing", "border-box");
    set("pointer-events", "none");
    set("margin", "0");
    set("padding", "0");
    set("border-style", "solid");
    set("border-color", "#f00");
    set("border-width", pinned ? "3px" : "2px");
    set("border-radius", "2px");
    set("z-index", "2147483644");
    set("opacity", "1");
    set("visibility", "visible");
    set("max-width", "none");
    set("max-height", "none");
    set("min-width", "0");
    set("min-height", "0");
    set("transform", "none");
    set("filter", "none");
    set("clip", "auto");
    set("clip-path", "none");
    set("outline", "none");
    set(
      "box-shadow",
      pinned
        ? "0 0 0 2px rgba(255, 255, 255, 0.65), 0 0 8px 2px rgba(255, 0, 0, 0.35)"
        : "0 0 0 2px rgba(255, 255, 255, 0.65)"
    );
    set("background-color", pinned ? "rgba(255, 0, 0, 0.08)" : "transparent");
  };

  /**
   * @param {HTMLElement} box
   * @param {Element} target
   */
  const placeBox = (box, target) => {
    /* Hide rather than draw over empty space when the target has collapsed
       or been painted invisible since the row was wired. */
    if (!isPointable(target)) {
      box.style.setProperty("display", "none", "important");
      box.hidden = true;
      return;
    }

    const rect = target.getBoundingClientRect();
    const pinned = box.id === PIN_BOX;

    hardenPointerBox(box, pinned);

    /* Viewport coordinates with position:fixed. Adding scroll would put a
       fixed banner's box where the document has moved on. */
    box.style.setProperty("left", `${rect.left}px`, "important");
    box.style.setProperty("top", `${rect.top}px`, "important");
    box.style.setProperty("width", `${rect.width}px`, "important");
    box.style.setProperty("height", `${rect.height}px`, "important");
    box.style.setProperty("display", "block", "important");
    box.hidden = false;
  };

  const syncPointerBoxes = () => {
    if (hoverTarget) {
      const hover = document.getElementById(HOVER_BOX);

      if (hover instanceof HTMLElement && !hover.hidden) {
        placeBox(hover, hoverTarget);
      }
    }

    if (pinTarget) {
      const pin = document.getElementById(PIN_BOX);

      if (pin instanceof HTMLElement && !pin.hidden) {
        placeBox(pin, pinTarget);
      }
    }
  };

  /* Bound once. This file is injected again on every click. */
  if (!globalThis.kraftyPointerBound) {
    globalThis.kraftyPointerBound = true;
    window.addEventListener("scroll", syncPointerBoxes, true);
    window.addEventListener("resize", syncPointerBoxes);
  }

  /**
   * Wire a findings row to the page element it names: hover previews, click
   * travels. Returns whether the row was wired. A target that is not painted
   * is left inert and marked `.kraftyInert` instead - wiring it would make
   * the row look clickable, scroll on click, and still show no useful box.
   * Aggregate findings (duplicated id, reused link text) still call this with
   * the first instance, so the count stays honest and the row stays findable.
   *
   * @param {HTMLElement} row
   * @param {Element} target
   * @returns {boolean}
   */
  globalThis.kraftyPointAt = (row, target) => {
    if (!isPointable(target)) {
      row.classList.add("kraftyInert");
      row.title = kraftyMessage("panelRowNotPainted");
      return false;
    }

    row.classList.add("kraftyLocatable");

    row.addEventListener("pointerenter", () => {
      hoverTarget = target;
      placeBox(overlayBox(HOVER_BOX, "kraftyPointerBox"), target);
    });

    row.addEventListener("pointerleave", () => {
      hoverTarget = null;
      const box = document.getElementById(HOVER_BOX);
      if (box) {
        box.style.setProperty("display", "none", "important");
        box.hidden = true;
      }
    });

    row.addEventListener("click", (event) => {
      /* A row may hold a copy button; a press on it is a copy, not a travel.
         The copy button also stops the event, so this is belt and braces. */
      if (event.target instanceof Element && event.target.closest("button, a")) {
        return;
      }

      pinTarget = target;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      placeBox(overlayBox(PIN_BOX, "kraftyPointerBox kraftyPointerPin"), target);
    });

    return true;
  };

  /* Drop both boxes. Called when a panel is (re)built or closed, so a pinned
     box does not outlive the findings it belonged to. */
  globalThis.kraftyClearPointer = () => {
    hoverTarget = null;
    pinTarget = null;
    document.getElementById(HOVER_BOX)?.remove();
    document.getElementById(PIN_BOX)?.remove();
  };

  /**
   * The tree a panel's chrome and findings live in. Item 24 moved that into
   * an open shadow root so page CSS cannot reach it; callers that already
   * hold the host ask here rather than assuming light-DOM children.
   *
   * @param {Element | null | undefined} panel
   * @returns {ShadowRoot | Element | null | undefined}
   */
  globalThis.kraftyPanelRoot = (panel) => panel?.shadowRoot ?? panel;

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

    /* Open so the popup review and the tests can still read findings. Closed
       would isolate as well, and leave the rest of the tool blind. */
    const root = panel.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = globalThis.kraftyPanelCss ?? "";
    root.appendChild(style);

    /* Paint lives on this shell, not the host. The host is still a light-DOM
       div the page can select (resets like `div { background: transparent }`
       are common); descendants inside the shadow are not. */
    const shell = document.createElement("div");
    shell.className = "kraftyPanelShell";
    root.appendChild(shell);

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

    /* Remember who had focus before the panel took it, and give it back on
       close (button or Escape → click). A missing restore is what makes
       keyboard use feel like a trap once Escape lands inside the chrome. */
    /** @type {Element | null} */
    let returnFocus = null;

    close.addEventListener("click", () => {
      const restore = returnFocus;
      onClose();

      if (restore instanceof HTMLElement && restore.isConnected) {
        restore.focus({ preventScroll: true });
      }
    });
    controls.appendChild(close);

    shell.appendChild(bar);

    const body = document.createElement("div");
    body.className = "kraftyPanelBody";
    shell.appendChild(body);

    hardenHost(panel);
    makeMovable(panel, bar, id);

    /* Restoring the remembered position needs the panel measured, so it has
       to wait until the caller has added it to the document. The same tick
       docks the default corner and moves focus into the panel. */
    const remembered = positions[id];

    queueMicrotask(() => {
      if (!panel.isConnected) {
        return;
      }

      if (remembered) {
        place(panel, remembered.left, remembered.top);
      } else {
        dockDefault(panel);
      }

      const active = document.activeElement;

      if (
        active instanceof Element &&
        active !== document.body &&
        active !== document.documentElement &&
        !panel.contains(active)
      ) {
        returnFocus = active;
      }

      close.focus({ preventScroll: true });
    });

    return { panel, body };
  };

  /* Escape closes the topmost panel. Bound once: this file is injected again
     on every click. Editable fields on the page keep Escape for themselves. */
  if (!globalThis.kraftyEscapeBound) {
    globalThis.kraftyEscapeBound = true;

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || event.defaultPrevented) {
        return;
      }

      const target = event.target;

      if (target instanceof HTMLElement) {
        const tag = target.tagName;

        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }

      const panels = document.querySelectorAll(".kraftyPanel");
      const top = panels[panels.length - 1];

      if (!(top instanceof HTMLElement)) {
        return;
      }

      const close = top.shadowRoot?.querySelector(".kraftyPanelClose");

      if (!(close instanceof HTMLElement)) {
        return;
      }

      event.preventDefault();
      close.click();
    });
  }
})();
