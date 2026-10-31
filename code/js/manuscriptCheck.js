// @ts-check

/* The page as a manuscript. One column, plain type, so the words can be
   read and copied without the layout in the way. It decides nothing: a
   header, a navigation and a footer that were on screen stay on screen,
   and which of them is "the article" is not a question this asks.

   It is not "CSS off". Turning stylesheets off reveals everything the page
   had hidden — the closed menu, the other breakpoint, the modal — and the
   result is a pile, not a manuscript. So display, visibility, opacity,
   clip and height are left alone. A box parked off to the side is marked
   so the reading skin cannot drag it back into the viewport. One that is
   merely further down the page is not: an absolutely placed button below
   the fold is still part of the text, and leaving it out of the skin keeps
   its button chrome. A fixed or sticky box that is actually on screen is
   pulled into the flow: a bar covering the words is the thing this view is
   here to get out of the way, and once it is static the skin's height rule
   collapses a full-viewport scrim to whatever text it contained. An
   invisible box keeps its position, so a hidden layer does not open a hole
   in the line. A box that paints past its own edge is marked after the skin
   is on and given height auto, so that edge does not cover the next line.
   A stage left taller than the picture inside it is brought down to that
   picture, so the spare part does not sit in the column as a blank.
   One that already clipped its contents before the skin is not marked, so
   a disclosure the page had closed stays closed. A bar the page pins on
   scroll, with a rule that beats this skin, is put back in the column
   when it pins.

   No filter or transform on <body>. That makes the body the containing
   block for every fixed panel and flings them off the screen (see
   js/brightnessCheck.js). The tool's own chrome is excluded from the skin
   for the same reason. Styles inside a shadow tree are unreachable from
   here and stay as the page drew them. */

(() => {
  const BODY_CLASS = "kraftyManuscriptChecker";
  const ROOT_CLASS = "kraftyManuscriptRoot";
  const FLOW = "data-krafty-manuscript-flow";
  const AWAY = "data-krafty-manuscript-away";
  const HOLD = "data-krafty-manuscript-hold";
  const GROW = "data-krafty-manuscript-grow";
  const FIT = "data-krafty-manuscript-fit";
  const CLIP = "data-krafty-manuscript-clip";
  const PIN = "data-krafty-manuscript-pin";

  /* The same chrome the skin's :not() list names. Marking one of these as
     flow would unfix a panel or the squint screen, which is position:fixed
     and on screen by design. */
  const CHROME = [
    "kraftyPanel",
    "kraftyAltContent",
    "kraftyAltRescan",
    "kraftyPointerBox",
    "kraftyBrightnessScreen",
    "kraftySquintScreen",
    "kraftyDummyMask",
  ];

  if (!document.body) {
    return;
  }

  const clearMarks = () => {
    for (const name of [FLOW, AWAY, HOLD, GROW, FIT, CLIP, PIN]) {
      for (const el of document.querySelectorAll(`[${name}]`)) {
        el.removeAttribute(name);
      }
    }
    document.body.classList.remove(BODY_CLASS);
    document.documentElement.classList.remove(ROOT_CLASS);
  };

  if (document.body.classList.contains(BODY_CLASS)) {
    if (typeof kraftyManuscriptUnpin === "function") {
      kraftyManuscriptUnpin();
    }

    clearMarks();
    return;
  }

  /**
   * @param {Element} el
   */
  const isChrome = (el) => CHROME.some((name) => el.classList.contains(name));

  for (const el of document.body.getElementsByTagName("*")) {
    if (isChrome(el)) {
      continue;
    }

    const cs = getComputedStyle(el);
    const positioned =
      cs.position === "fixed" ||
      cs.position === "absolute" ||
      cs.position === "sticky";

    if (!positioned) {
      continue;
    }

    const rect = el.getBoundingClientRect();
    const hasBox = rect.width > 0 && rect.height > 0;
    const onScreen =
      hasBox &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth;

    const invisible =
      cs.display === "none" ||
      cs.visibility === "hidden" ||
      cs.visibility === "collapse" ||
      cs.contentVisibility === "hidden" ||
      Number.parseFloat(cs.opacity) === 0;

    /* Off to the side, fixed or absolute: a drawer. Below the fold is not
       the same thing — an absolutely placed button further down the page
       is still part of the manuscript, and pinning it out of the skin would
       leave its button chrome on when the reader scrolls to it. A sticky
       box below the fold is already in the flow and needs no pin. */
    const offToTheSide = hasBox && (rect.right <= 0 || rect.left >= window.innerWidth);

    if (offToTheSide && cs.position !== "sticky") {
      el.setAttribute(AWAY, "");
      continue;
    }

    /* Invisible but taking a box. Pulling it into the line would leave a
       hole, because visibility:hidden and opacity:0 still occupy space. */
    if (invisible && hasBox) {
      el.setAttribute(HOLD, "");
    }

    if (invisible || !onScreen) {
      continue;
    }

    if (cs.position === "fixed" || cs.position === "sticky") {
      el.setAttribute(FLOW, "");
    }
  }

  /* Remember a box that already hid its overflow, before the column exists.
     The column will make a one-line bar taller than that bar; that new
     overflow should open. An accordion that was already closed should not. */
  for (const el of document.body.getElementsByTagName("*")) {
    if (isChrome(el)) {
      continue;
    }

    if (el.clientHeight > 0 && el.scrollHeight > el.clientHeight + 16) {
      el.setAttribute(CLIP, "");
    }
  }

  document.body.classList.add(BODY_CLASS);
  document.documentElement.classList.add(ROOT_CLASS);

  /* Measured after the skin is on: the column is what makes a bar's content
     taller than the bar. A fixed height with overflow still visible then
     paints that content across the next line — the title picture, the link
     under an icon. A bar that clips, but only became too short because of
     this column, opens the same way. Height stays untouched on a box that
     already clipped before the skin, so a closed disclosure stays closed. */
  const spilling = new Set();

  for (const el of document.body.getElementsByTagName("*")) {
    if (isChrome(el) || el.hasAttribute(AWAY) || el.hasAttribute(HOLD)) {
      continue;
    }

    if (el.closest(`[${AWAY}]`) || el.closest("details:not([open])")) {
      continue;
    }

    const style = getComputedStyle(el);

    if (
      style.display === "none" ||
      style.position === "fixed" ||
      style.position === "absolute"
    ) {
      continue;
    }

    const rect = el.getBoundingClientRect();

    if (rect.width < 1 && rect.height < 1) {
      continue;
    }

    let parent = el.parentElement;

    while (parent && parent !== document.body) {
      const parentStyle = getComputedStyle(parent);
      const overflow = parentStyle.overflowY;
      const alreadyClipped = parent.hasAttribute(CLIP);
      const opens =
        overflow === "visible" ||
        ((overflow === "hidden" ||
          overflow === "clip" ||
          overflow === "auto" ||
          overflow === "scroll") &&
          parent.clientHeight > 0 &&
          !alreadyClipped);

      if (opens && parentStyle.display !== "none") {
        const box = parent.getBoundingClientRect();

        if (rect.bottom > box.bottom + 1 || rect.top < box.top - 1) {
          spilling.add(parent);
        }
      }

      parent = parent.parentElement;
    }
  }

  for (const el of spilling) {
    el.setAttribute(GROW, "");
  }

  /* A stage sized for a full-bleed picture keeps that height after the
     picture has been fitted to the column, and the spare part is blank.
     Height auto brings the box down to the content. A box shorter than its
     content is left, so this does not open a disclosure. */
  const fitting = new Set();

  for (const el of document.body.getElementsByTagName("*")) {
    if (
      el === document.body ||
      isChrome(el) ||
      el.hasAttribute(AWAY) ||
      el.hasAttribute(HOLD)
    ) {
      continue;
    }

    if (el.closest(`[${AWAY}]`) || el.closest("details:not([open])")) {
      continue;
    }

    const style = getComputedStyle(el);

    if (
      style.display === "none" ||
      style.position === "fixed" ||
      style.position === "absolute"
    ) {
      continue;
    }

    const box = el.getBoundingClientRect();

    if (box.height < 48) {
      continue;
    }

    const padBottom = Number.parseFloat(style.paddingBottom) || 0;
    const limit = box.bottom - padBottom;
    let lowest = box.top;
    let found = false;

    for (const child of el.children) {
      const childStyle = getComputedStyle(child);

      if (
        childStyle.display === "none" ||
        childStyle.position === "absolute" ||
        childStyle.position === "fixed"
      ) {
        continue;
      }

      const childBox = child.getBoundingClientRect();

      if (childBox.width < 1 && childBox.height < 1) {
        continue;
      }

      found = true;
      const marginBottom = Number.parseFloat(childStyle.marginBottom) || 0;
      const edge = childBox.bottom + marginBottom;

      if (edge > lowest) {
        lowest = edge;
      }
    }

    if (found && limit - lowest > 48) {
      fitting.add(el);
    }
  }

  for (const el of fitting) {
    el.setAttribute(FIT, "");
  }

  /* A bar can pin itself on scroll with an id rule that beats the
     stylesheet, and then it paints over the words. An inline position
     wins that fight. Re-check when the page changes the bar, including
     after a scroll. A drawer marked away is left where the page put it. */
  /**
   * @param {Element} el
   */
  const pin = (el) => {
    if (!(el instanceof HTMLElement) || isChrome(el)) {
      return;
    }

    if (el.hasAttribute(HOLD) || el.hasAttribute(AWAY) || el.closest(`[${AWAY}]`)) {
      return;
    }

    const pos = getComputedStyle(el).position;

    if (pos !== "fixed" && pos !== "sticky") {
      return;
    }

    el.style.setProperty("position", "static", "important");
    el.style.setProperty("inset", "auto", "important");
    el.style.setProperty("transform", "none", "important");
    el.setAttribute(PIN, "");
  };

  for (const el of document.body.getElementsByTagName("*")) {
    pin(el);
  }

  /** @type {number} */
  let pinTimer = 0;
  const schedulePin = () => {
    window.clearTimeout(pinTimer);
    pinTimer = window.setTimeout(() => {
      for (const el of document.body.getElementsByTagName("*")) {
        pin(el);
      }
    }, 50);
  };
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.target instanceof Element) {
        pin(record.target);
      }
    }
  });

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ["class", "style"],
    subtree: true,
  });
  window.addEventListener("scroll", schedulePin, true);

  kraftyManuscriptUnpin = () => {
    observer.disconnect();
    window.removeEventListener("scroll", schedulePin, true);
    window.clearTimeout(pinTimer);

    for (const el of document.querySelectorAll(`[${PIN}]`)) {
      if (!(el instanceof HTMLElement)) {
        continue;
      }

      el.style.removeProperty("position");
      el.style.removeProperty("inset");
      el.style.removeProperty("transform");
      el.removeAttribute(PIN);
    }

    kraftyManuscriptUnpin = undefined;
  };
})();
