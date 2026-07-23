// @ts-check

/* The same split the heading checker makes, applied to the landmark regions.

   What a machine can decide: no `main` on the page, or more than one; and
   two landmarks of the same role that a screen reader would announce
   identically, because they share an accessible name or because neither
   carries one. A user listing the landmarks to jump between them is given
   the same word twice, with nothing to say which is which. Those are the
   findings.

   What it cannot decide is the part the proposal led with - whether the
   page marks up the regions it ought to. A page with one `main` and nothing
   else may be right, or may have a header and a footer built out of unmarked
   divs, and nothing in the DOM separates those two. So the landmarks are
   drawn in document order, nested by containment, each with its role and
   accessible name, for the reader to scan - the same treatment the heading
   checker gives its outline.

   Nothing is written onto the page. A landmark is meaningful as a region in
   a list, the way a heading is meaningful in an outline, and leaving the page
   untouched means there is nothing to restore when the panel closes. */

(() => {
  const PANEL_ID = "js-kraftyLandmarkInformation";
  const BODY_CLASS = "kraftyLandmarkChecker";

  /* Always start from a clean slate: the previous panel must go, otherwise
     repeated runs stack duplicate elements sharing the same id. */
  document.getElementById(PANEL_ID)?.remove();

  if (!document.body) {
    return;
  }

  if (!document.body.classList.toggle(BODY_CLASS)) {
    return;
  }

  /* The eight landmark roles this reports, named the way ARIA names them.
     The role token is a technical literal, like the heading checker's tag
     names, so it is shown as it is in every locale - it is also what a
     director searches the markup for. */
  const LANDMARK_ROLES = new Set([
    "main",
    "navigation",
    "banner",
    "contentinfo",
    "complementary",
    "region",
    "search",
    "form",
  ]);

  /* header and footer are landmarks only at the top level. Inside any of
     these - the sectioning content, plus main - they are the header or
     footer of that section, not of the page, and mapping them to banner or
     contentinfo would report a card's footer as the page's. */
  const SECTIONING = "article, aside, main, nav, section";

  /* Everything below runs again when the panel's rescan button is pressed,
     which is why the toggle is not part of it. */
  const run = () => {
    document.getElementById(PANEL_ID)?.remove();

    /* --- reading the document --- */

    /**
     * A landmark's accessible name, enough of the computation to tell one
     * region from another: aria-labelledby that resolves, then aria-label,
     * then title. The element's text is deliberately not read - a nav's
     * links are not its name, and treating them as one would call every
     * unlabelled navigation "named".
     *
     * @param {Element} element
     * @returns {string}
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

      return (element.getAttribute("title") ?? "").trim();
    };

    /**
     * The landmark role an element carries, or null when it is not a
     * landmark. An explicit role wins outright: a role attribute is the
     * author speaking directly, so a non-landmark role on a header - a
     * role="presentation" banner - takes it out rather than falling through
     * to the tag. region and form are landmarks only with a name; without
     * one they are generic, which is what the accessible-name gate below is.
     *
     * @param {Element} element
     * @returns {string | null}
     */
    const landmarkRole = (element) => {
      const named = () => nameOf(element) !== "";

      const explicit = (element.getAttribute("role") ?? "")
        .trim()
        .toLowerCase()
        .split(/\s+/)[0];

      if (explicit) {
        if (!LANDMARK_ROLES.has(explicit)) {
          return null;
        }
        if (explicit === "region" || explicit === "form") {
          return named() ? explicit : null;
        }
        return explicit;
      }

      switch (element.localName) {
        case "main":
          return "main";
        case "nav":
          return "navigation";
        case "aside":
          return "complementary";
        case "search":
          return "search";
        case "header":
          return element.parentElement?.closest(SECTIONING) ? null : "banner";
        case "footer":
          return element.parentElement?.closest(SECTIONING)
            ? null
            : "contentinfo";
        case "section":
          return named() ? "region" : null;
        case "form":
          return named() ? "form" : null;
        default:
          return null;
      }
    };

    /**
     * Whether the region reaches anybody. display:none, visibility:hidden and
     * aria-hidden take an element out of the accessibility tree, so a landmark
     * behind any of them is announced to nobody - and counting it would not
     * only draw a phantom region but could report two navs as indistinguish-
     * able when only one is ever present, a mobile menu hidden beside the
     * desktop one being the everyday case.
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

    /** @type {Element[]} */
    const elements = [];

    /* Document order, which is the order the outline wants. The tag list and
       [role] together catch a landmark declared either way; querySelectorAll
       returns each element once even when both match. */
    for (const element of document.body.querySelectorAll(
      `${SECTIONING}, header, footer, search, form, [role]`
    )) {
      /* Never report the checker's own UI. Its sections carry no accessible
         name and so are not region landmarks, but skipping the whole panel is
         cheaper than relying on that and safe against future markup. */
      if (element.closest(".kraftyPanel")) {
        continue;
      }

      if (landmarkRole(element) === null || !isExposed(element)) {
        continue;
      }

      elements.push(element);
    }

    const landmarkSet = new Set(elements);

    /** The number of other landmarks that contain this one, for the indent.
        @param {Element} element */
    const depthOf = (element) => {
      let depth = 0;

      for (
        let parent = element.parentElement;
        parent;
        parent = parent.parentElement
      ) {
        if (landmarkSet.has(parent)) {
          depth += 1;
        }
      }

      return depth;
    };

    const landmarks = elements.map((element) => ({
      role: /** @type {string} */ (landmarkRole(element)),
      tag: element.localName,
      name: nameOf(element),
      depth: depthOf(element),
    }));

    /* --- the panel --- */

    const { panel, body } = kraftyPanel({
      id: PANEL_ID,
      className: "kraftyLandmarkInformation",
      title: kraftyMessage("checkerLandmark"),
      onRescan: run,
      onClose: () => {
        panel.remove();
        /* Drop the class too, or the popup would keep showing this checker as
           active with nothing on screen. */
        document.body.classList.remove(BODY_CLASS);
      },
    });

    /* --- what a machine can decide --- */

    const { report } = kraftyFindings(kraftySection(body, "sectionChecks"));

    if (landmarks.length === 0) {
      report("note", "landmarkNoneFound");
    }

    const mains = landmarks.filter((entry) => entry.role === "main");

    /* No main is a best-practice gap and common enough on real pages to be a
       note. More than one is a hard rule broken - only one main is allowed to
       be exposed - so a genuine contradiction, and an alert. */
    if (landmarks.length > 0 && mains.length === 0) {
      report("note", "landmarkNoMain");
    } else if (mains.length > 1) {
      report("alert", "landmarkMultipleMain", [String(mains.length)]);
    }

    /* Landmarks of one role a screen reader cannot tell apart. Grouped by
       role, then by the name announced - the nameless falling together under
       one empty key, since "navigation" and "navigation" are the collision
       this finds. A group of two or more is the finding: the same word, twice
       or more, in the list a user jumps between regions with.

       main is left out: more than one is its own finding above, and reporting
       the two mains again here as indistinguishable would be the same fault
       said twice. */
    /** @type {Map<string, Map<string, number>>} */
    const byRole = new Map();

    for (const { role, name } of landmarks) {
      if (role === "main") {
        continue;
      }

      const names = byRole.get(role) ?? new Map();
      const key = name.toLowerCase();
      names.set(key, (names.get(key) ?? 0) + 1);
      byRole.set(role, names);
    }

    for (const [role, names] of byRole) {
      for (const [key, count] of names) {
        if (count < 2) {
          continue;
        }

        if (key === "") {
          report("alert", "landmarkSameNameless", [String(count), role]);
        } else {
          /* The name as it was written, not the lower-cased key. */
          const original =
            landmarks.find(
              (entry) =>
                entry.role === role && entry.name.toLowerCase() === key
            )?.name ?? key;

          report("alert", "landmarkSameName", [
            String(count),
            role,
            original,
          ]);
        }
      }
    }

    /* --- what only a person can decide --- */

    if (landmarks.length > 0) {
      const reviewSection = kraftySection(body, "sectionReview");

      const note = document.createElement("p");
      note.className = "kraftyNote";
      note.textContent = kraftyMessage("landmarkReviewNote");
      reviewSection.appendChild(note);

      /* The indentation is the shape of the thing, so the copy keeps it
         rather than flattening the nesting away. */
      kraftyListHead(
        reviewSection,
        "landmarkOutlineLabel",
        kraftyMessage("copyLandmarks"),
        () =>
          [
            location.href,
            ...landmarks.map(
              (entry) =>
                `${"  ".repeat(entry.depth)}${entry.role}${
                  entry.name ? ` "${entry.name}"` : ""
                }`
            ),
          ].join("\n")
      );

      const list = document.createElement("ol");
      list.className = "kraftyOutline";

      for (const entry of landmarks) {
        const item = document.createElement("li");
        item.className = "kraftyOutlineItem";

        /* Indented inline rather than by a class per level: nesting has no
           fixed ceiling, and a table of rules would quietly stop indenting
           past the last one it knew. Capped so a deep tree cannot push the
           text off the panel. */
        item.style.paddingLeft = `${Math.min(entry.depth, 8) * 14}px`;

        const role = document.createElement("code");
        role.className = "kraftyOutlineLevel";
        role.textContent = entry.role;
        item.appendChild(role);

        const text = document.createElement("span");

        if (entry.name === "") {
          text.className = "kraftyMissing";
          text.textContent = kraftyMessage("landmarkNoName");
        } else {
          /* textContent, not insertAdjacentHTML: this comes from the page and
             must never be parsed as markup. */
          text.textContent = entry.name;
        }

        item.appendChild(text);
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
