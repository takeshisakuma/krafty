// @ts-check

/* The order Tab walks, drawn for a person to read. The same split the
   landmark checker makes: what a machine can decide is only whether
   anything is reachable at all, and whether the sequence matches the page
   is not. Comparing it to visual position was the tempting half and the
   wrong one - a two-column layout is "out of order" to a sort by y, and
   right to a reader.

   Positive tabindex is already a markup finding. It is not repeated here.
   It does change this list, which is the point of showing the order rather
   than the attribute.

   One document. A subframe's tab order is its own page's, and folding it
   in would draw a sequence that does not exist. */

(() => {
  const PANEL_ID = "js-kraftyTabInformation";
  const BODY_CLASS = "kraftyTabChecker";

  document.getElementById(PANEL_ID)?.remove();

  if (!document.body) {
    return;
  }

  if (!document.body.classList.toggle(BODY_CLASS)) {
    kraftyClearPointer();
    return;
  }

  /**
   * Krafty's own controls sit in the page and some of them take focus. The
   * body class is the checker's, so the walk stops before the body: every
   * ancestor between an element and the body is fair game.
   *
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
   * Whether Tab can land here. visibility:hidden and content-visibility
   * take an element out of the order; opacity does not, and neither does
   * aria-hidden - a hidden control that still takes focus is a real stop,
   * and markup already names that contradiction.
   *
   * @param {Element} element
   */
  const isShown = (element) =>
    element.checkVisibility({
      contentVisibilityAuto: true,
      visibilityProperty: true,
    });

  /**
   * Enough of an accessible name to tell one stop from the next: the
   * markup checker's precedence, plus the label a form control is wired
   * to, which is the name a field actually has. Not the whole algorithm.
   *
   * @param {HTMLElement} element
   */
  const nameOf = (element) => {
    const labelledBy = (element.getAttribute("aria-labelledby") ?? "").trim();

    if (labelledBy !== "") {
      const named = labelledBy
        .split(/\s+/)
        .map((id) =>
          (document.getElementById(id)?.textContent ?? "")
            .replace(/\s+/g, " ")
            .trim()
        )
        .filter(Boolean)
        .join(" ");

      if (named !== "") {
        return named;
      }
    }

    const label = (element.getAttribute("aria-label") ?? "").trim();

    if (label !== "") {
      return label;
    }

    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLButtonElement
    ) {
      const fromLabels = [...(element.labels ?? [])]
        .map((one) => (one.textContent ?? "").replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join(" ");

      if (fromLabels !== "") {
        return fromLabels;
      }
    }

    if (element instanceof HTMLInputElement) {
      if (element.type === "image" && element.alt.trim() !== "") {
        return element.alt.trim();
      }

      if (
        (element.type === "button" ||
          element.type === "submit" ||
          element.type === "reset") &&
        element.value.trim() !== ""
      ) {
        return element.value.trim();
      }
    }

    const text = (element.textContent ?? "").replace(/\s+/g, " ").trim();

    if (text !== "") {
      return text;
    }

    for (const image of element.querySelectorAll("img")) {
      const alt = (image.getAttribute("alt") ?? "").trim();

      if (alt !== "") {
        return alt;
      }
    }

    return (element.getAttribute("title") ?? "").trim();
  };

  /**
   * A token the reader can search the markup for. An explicit role is the
   * author speaking, so it wins; an input is told apart by its type.
   *
   * @param {HTMLElement} element
   */
  const tokenOf = (element) => {
    const explicit = (element.getAttribute("role") ?? "")
      .trim()
      .toLowerCase()
      .split(/\s+/)[0];

    if (explicit) {
      return explicit;
    }

    if (element instanceof HTMLInputElement) {
      return `input ${element.type}`;
    }

    return element.localName;
  };

  const run = () => {
    document.getElementById(PANEL_ID)?.remove();
    kraftyClearPointer();

    /** @type {HTMLElement[]} */
    const tabbable = [];

    for (const element of document.body.querySelectorAll("*")) {
      if (!(element instanceof HTMLElement)) {
        continue;
      }

      /* Shadow trees are not walked. A component's internals are a
         different document from this one's light DOM, and the panels live
         in one, which is what keeps their buttons out of the list. */
      if (isOurs(element) || element.tabIndex < 0) {
        continue;
      }

      if (element.matches(":disabled") || element.closest("[inert]")) {
        continue;
      }

      if (!isShown(element)) {
        continue;
      }

      tabbable.push(element);
    }

    /* Positive tabindex first, ascending, and stable so equal values keep
       document order. Then everything else, already in tree order. */
    const ordered = [
      ...tabbable
        .filter((element) => element.tabIndex > 0)
        .sort((a, b) => a.tabIndex - b.tabIndex),
      ...tabbable.filter((element) => element.tabIndex === 0),
    ];

    const { panel, body } = kraftyPanel({
      id: PANEL_ID,
      className: "kraftyTabInformation",
      title: kraftyMessage("checkerTab"),
      onRescan: run,
      onClose: () => {
        panel.remove();
        kraftyClearPointer();
        document.body.classList.remove(BODY_CLASS);
      },
    });

    const { report } = kraftyFindings(kraftySection(body, "sectionChecks"));

    if (ordered.length === 0) {
      report("note", "tabNone");
    }

    if (ordered.length > 0) {
      const reviewSection = kraftySection(body, "sectionReview");

      const note = document.createElement("p");
      note.className = "kraftyNote";
      note.textContent = kraftyMessage("tabReviewNote");
      reviewSection.appendChild(note);

      kraftyListHead(
        reviewSection,
        "tabOutlineLabel",
        kraftyMessage("copyTabOrder"),
        () =>
          [
            location.href,
            ...ordered.map((element, index) => {
              const name = nameOf(element);
              const jump =
                element.tabIndex > 0 ? ` tabindex=${element.tabIndex}` : "";

              return `${index + 1}. ${tokenOf(element)}${
                name ? ` "${name}"` : ""
              }${jump}`;
            }),
          ].join("\n")
      );

      const list = document.createElement("ol");
      list.className = "kraftyOutline";

      for (const element of ordered) {
        const item = document.createElement("li");
        item.className = "kraftyOutlineItem";

        const token = document.createElement("code");
        token.className = "kraftyOutlineLevel";
        token.textContent = tokenOf(element);
        item.appendChild(token);

        const text = document.createElement("span");
        const name = nameOf(element);

        if (name === "") {
          text.className = "kraftyMissing";
          text.textContent = kraftyMessage("tabNoName");
        } else {
          text.textContent = name;
        }

        item.appendChild(text);

        if (element.tabIndex > 0) {
          const aside = document.createElement("span");
          aside.className = "kraftyPanelHint";
          aside.textContent = `tabindex=${element.tabIndex}`;
          item.appendChild(aside);
        }

        kraftyPointAt(item, element);
        list.appendChild(item);
      }

      reviewSection.appendChild(list);
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
