// @ts-check

/* The same split the head checker makes, applied to the heading structure.

   What a machine can decide: more than one level-1 heading, a level skipped
   on the way down, a heading with no text, no headings at all. Those are
   reported as findings.

   What it cannot decide is whether the headings read as a sensible outline
   of the page - which is the thing a director actually checks on a delivery,
   and the reason this exists. So the headings are drawn as an indented list
   for the reader to scan, the way the head checker draws its previews.

   Nothing is written onto the page. The nest checker has to mark elements
   because a finding is only meaningful next to the element it is about; a
   heading outline is meaningful as a list, and leaving the page untouched
   means there is nothing to restore when the panel closes. */

(() => {
  const PANEL_ID = "js-kraftyHeadingInformation";
  const BODY_CLASS = "kraftyHeadingChecker";

  /* Always start from a clean slate: the previous panel must go, otherwise
     repeated runs stack duplicate elements sharing the same id. */
  document.getElementById(PANEL_ID)?.remove();

  if (!document.body) {
    return;
  }

  if (!document.body.classList.toggle(BODY_CLASS)) {
    return;
  }

  /* --- reading the document --- */

  /**
   * ARIA headings are included because a page built out of components often
   * has no h1-h6 at all, and reporting "no headings" on a page full of them
   * would be wrong in the way that costs a tool its credibility.
   *
   * @param {Element} element
   * @returns {number}
   */
  const levelOf = (element) => {
    /* aria-level wins where it is set, on a native heading as well: it is
       what assistive technology reads. */
    const declared = Number(element.getAttribute("aria-level"));

    if (Number.isInteger(declared) && declared > 0) {
      return declared;
    }

    const native = /^H([1-6])$/.exec(element.tagName);

    /* role="heading" with no aria-level is level 2 per ARIA. */
    return native ? Number(native[1]) : 2;
  };

  /**
   * The text the heading actually announces. A heading whose only content is
   * an image is not empty - the logo-as-h1 is a real and correct pattern -
   * so the alt text counts, and so does an aria-label.
   *
   * @param {Element} element
   * @returns {string}
   */
  const labelOf = (element) => {
    const text = (element.textContent ?? "").replace(/\s+/g, " ").trim();

    if (text !== "") {
      return text;
    }

    const aria = (element.getAttribute("aria-label") ?? "").trim();

    if (aria !== "") {
      return aria;
    }

    return [...element.querySelectorAll("img[alt], area[alt], input[alt]")]
      .map((image) => (image.getAttribute("alt") ?? "").trim())
      .filter(Boolean)
      .join(" ");
  };

  /**
   * Whether the heading reaches anybody. display:none and visibility:hidden
   * take an element out of the accessibility tree, as does aria-hidden, so
   * counting them would report an outline no reader ever meets.
   *
   * Visually hidden headings - clipped, offset off-screen - deliberately do
   * not match any of these. They are a legitimate pattern and belong in the
   * outline.
   *
   * @param {Element} element
   */
  const isExposed = (element) => {
    if (element.closest('[aria-hidden="true"]')) {
      return false;
    }

    return element.checkVisibility({
      contentVisibilityAuto: true,
      visibilityProperty: true,
    });
  };

  /** @type {{ level: number, tag: string, label: string, skipped: boolean }[]} */
  const outline = [];
  let hidden = 0;

  for (const element of document.body.querySelectorAll(
    'h1, h2, h3, h4, h5, h6, [role="heading" i]'
  )) {
    /* Never report the checker's own UI: the panel is built from sections
       with h2 titles, and a second run would find them. */
    if (element.closest(".kraftyPanel")) {
      continue;
    }

    if (!isExposed(element)) {
      hidden += 1;
      continue;
    }

    outline.push({
      level: levelOf(element),
      tag: element.tagName.toLowerCase(),
      label: labelOf(element),
      skipped: false,
    });
  }

  /* --- the panel --- */

  const { panel, body } = kraftyPanel({
    id: PANEL_ID,
    className: "kraftyHeadingInformation",
    title: kraftyMessage("headingPanelTitle"),
    onClose: () => {
      panel.remove();
      /* Drop the class too, or the popup would keep showing this checker as
         active with nothing on screen. */
      document.body.classList.remove(BODY_CLASS);
    },
  });

  /* --- what a machine can decide --- */

  const { report } = kraftyFindings(kraftySection(body, "sectionChecks"));

  const topLevel = outline.filter((entry) => entry.level === 1);

  if (outline.length === 0) {
    report("note", "headingNoneFound");
  } else if (topLevel.length === 0) {
    report("note", "headingNoH1");
  } else if (topLevel.length > 1) {
    /* Allowed by the spec, since the outline algorithm that was meant to
       make sense of it was removed before anything implemented it. In
       practice one h1 names the page and the rest are a mistake, so this is
       worth saying - as a note, because it can be deliberate. */
    report("note", "headingMultipleH1", [String(topLevel.length)]);
  }

  /* Only between consecutive headings. A page that opens at h2 is already
     covered by "no h1", and saying both would be the same fact twice. */
  for (let index = 1; index < outline.length; index += 1) {
    const previous = outline[index - 1];
    const current = outline[index];

    if (current.level > previous.level + 1) {
      current.skipped = true;
      report("note", "headingSkipped", [previous.tag, current.tag]);
    }
  }

  for (const entry of outline) {
    if (entry.label === "") {
      report("alert", "headingEmpty", [entry.tag]);
    }
  }

  /* --- what only a person can decide --- */

  if (outline.length > 0) {
    const reviewSection = kraftySection(body, "sectionReview");

    const note = document.createElement("p");
    note.className = "kraftyNote";
    note.textContent = kraftyMessage("headingReviewNote");
    reviewSection.appendChild(note);

    /* The indented text is the shape of the thing, so the copy keeps the
       indentation rather than flattening it into a list of tags. */
    kraftyListHead(
      reviewSection,
      "headingOutlineLabel",
      kraftyMessage("copyOutline"),
      () =>
        [
          location.href,
          ...outline.map(
            (entry) =>
              `${"  ".repeat(Math.max(entry.level - 1, 0))}${entry.tag} ${
                entry.label || kraftyMessage("valueEmpty")
              }`
          ),
        ].join("\n")
    );

    const list = document.createElement("ol");
    list.className = "kraftyOutline";

    for (const entry of outline) {
      const item = document.createElement("li");
      item.className = "kraftyOutlineItem";

      /* Indented inline rather than by a class per level, because aria-level
         is not capped at 6 and a table of six rules would quietly stop
         indenting past the last one it knew about. */
      item.style.paddingLeft = `${Math.min(Math.max(entry.level - 1, 0), 8) * 14}px`;

      if (entry.skipped) {
        item.classList.add("kraftyOutlineSkip");
      }

      const tag = document.createElement("code");
      tag.className = "kraftyOutlineLevel";
      tag.textContent = entry.tag;
      item.appendChild(tag);

      const text = document.createElement("span");

      if (entry.label === "") {
        text.className = "kraftyMissing";
        text.textContent = kraftyMessage("valueEmpty");
      } else {
        /* textContent, not insertAdjacentHTML: this comes from the page and
           must never be parsed as markup. */
        text.textContent = entry.label;
      }

      item.appendChild(text);
      list.appendChild(item);
    }

    reviewSection.appendChild(list);
  }

  if (hidden > 0) {
    const note = document.createElement("div");
    note.className = "kraftyPanelNote";
    note.textContent = kraftyCount("headingHidden", hidden);
    body.appendChild(note);
  }

  const scanned = document.createElement("div");
  scanned.className = "kraftyPanelNote";
  scanned.textContent = kraftyMessage("panelScannedAt", [
    new Date().toLocaleTimeString(),
  ]);
  body.appendChild(scanned);

  document.body.appendChild(panel);
})();
