// @ts-check

/* The drawn size of buttons and links, and nothing about whether that size
   is a failure. 24 CSS pixels is the length a reader can hold the number
   against; the spacing around a control can still make a smaller one fine,
   and this does not measure that spacing. An inline link in a sentence is
   left out: its box is the line, and listing every one would be the page's
   prose reported back as a finding.

   The number on the row is the measurement. The judgement is the reader's. */

(() => {
  const PANEL_ID = "js-kraftyTargetInformation";
  const BODY_CLASS = "kraftyTargetChecker";
  const MIN_SIDE = 24;

  document.getElementById(PANEL_ID)?.remove();

  if (!document.body) {
    return;
  }

  if (!document.body.classList.toggle(BODY_CLASS)) {
    kraftyClearPointer();
    return;
  }

  /* Buttons and links, native and by role, plus the input types that are
     buttons. Checkboxes and text fields are the browser's own controls and
     are not part of this list. */
  const TARGETS = [
    "a[href]",
    "area[href]",
    "button",
    "input[type='button' i]",
    "input[type='submit' i]",
    "input[type='reset' i]",
    "input[type='image' i]",
    "[role='button' i]",
    "[role='link' i]",
  ].join(", ");

  /**
   * @param {Element} element
   */
  const isOurs = (element) => {
    /** @type {Element | null} */
    let node = element;

    while (node && node !== document.body) {
      for (const value of node.classList) {
        if (value.startsWith("krafty")) {
          return true;
        }
      }

      node = node.parentElement;
    }

    return false;
  };

  /**
   * A link whose box is the line of text it sits in. A button in a sentence
   * is still a button. A link that is the only thing in its parent is a
   * control, not a word in a sentence.
   *
   * @param {Element} element
   */
  const inSentence = (element) => {
    const role = (element.getAttribute("role") ?? "")
      .trim()
      .toLowerCase()
      .split(/\s+/)[0];
    const link =
      element.localName === "a" ||
      element.localName === "area" ||
      role === "link";

    if (!link || getComputedStyle(element).display !== "inline") {
      return false;
    }

    const parent = element.parentElement;

    if (!parent) {
      return false;
    }

    const own = (element.textContent ?? "").replace(/\s+/g, " ").trim();
    const all = (parent.textContent ?? "").replace(/\s+/g, " ").trim();

    return all.length > own.length;
  };

  /**
   * Something to find the control again. The box on the page is the sure
   * way; this is what a copied row still has once the page is gone.
   *
   * @param {Element} element
   */
  const labelOf = (element) => {
    if (element.id !== "") {
      return `${element.localName}#${element.id}`;
    }

    const named = (element.getAttribute("aria-label") ?? "").trim();
    const text = (element.textContent ?? "").replace(/\s+/g, " ").trim();
    const shown = (named || text).slice(0, 40);

    if (shown !== "") {
      return `${element.localName} "${shown}"`;
    }

    const href = element.getAttribute("href");

    if (href) {
      return `${element.localName}[href="${href}"]`;
    }

    return element.localName;
  };

  /**
   * @param {number} value
   */
  const px = (value) => {
    const rounded = Math.round(value * 10) / 10;

    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  };

  const run = () => {
    document.getElementById(PANEL_ID)?.remove();
    kraftyClearPointer();

    /** @type {{ element: Element, width: number, height: number }[]} */
    const small = [];

    for (const element of document.body.querySelectorAll(TARGETS)) {
      if (isOurs(element) || inSentence(element)) {
        continue;
      }

      /* An image-map area often has no box. There is nothing to measure,
         and a zero is not a size. */
      if (
        !element.checkVisibility({
          contentVisibilityAuto: true,
          visibilityProperty: true,
          opacityProperty: true,
        })
      ) {
        continue;
      }

      const box = element.getBoundingClientRect();

      if (box.width <= 0 || box.height <= 0) {
        continue;
      }

      if (box.width >= MIN_SIDE && box.height >= MIN_SIDE) {
        continue;
      }

      small.push({ element, width: box.width, height: box.height });
    }

    small.sort(
      (a, b) =>
        Math.min(a.width, a.height) - Math.min(b.width, b.height) ||
        a.width * a.height - b.width * b.height
    );

    const { panel, body } = kraftyPanel({
      id: PANEL_ID,
      className: "kraftyTargetInformation",
      title: kraftyMessage("checkerTarget"),
      onRescan: run,
      onClose: () => {
        panel.remove();
        kraftyClearPointer();
        document.body.classList.remove(BODY_CLASS);
      },
    });

    const { reportText } = kraftyFindings(kraftySection(body, "sectionChecks"));

    if (small.length > 0) {
      reportText("note", kraftyCount("targetUndersized", small.length));
    }

    if (small.length > 0) {
      const section = kraftySection(body, "targetSectionList");

      const note = document.createElement("p");
      note.className = "kraftyNote";
      note.textContent = kraftyMessage("targetReviewNote");
      section.appendChild(note);

      kraftyListHead(
        section,
        "targetListLabel",
        kraftyMessage("copyFindings"),
        () =>
          [
            location.href,
            ...small.map(
              (entry) =>
                `- ${labelOf(entry.element)} ${px(entry.width)}×${px(entry.height)}`
            ),
          ].join("\n")
      );

      const list = document.createElement("ul");
      list.className = "kraftyPanelList";

      for (const entry of small) {
        const item = document.createElement("li");

        const label = document.createElement("code");
        label.textContent = labelOf(entry.element);
        item.appendChild(label);

        const aside = document.createElement("span");
        aside.className = "kraftyPanelCount";
        aside.textContent = `${px(entry.width)}×${px(entry.height)}`;
        item.appendChild(aside);

        kraftyPointAt(item, entry.element);
        list.appendChild(item);
      }

      section.appendChild(list);
    }

    const scanned = document.createElement("div");
    scanned.className = "kraftyPanelNote";
    scanned.textContent = kraftyMessage("panelScannedAt", [
      new Date().toLocaleTimeString(),
    ]);
    body.appendChild(scanned);

    document.body.appendChild(panel);
  };

  run();
})();
