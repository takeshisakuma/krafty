// @ts-check

/* Markup that is wrong in ways the page does not show.

   Named for the family rather than for any one check, which is what let the
   third and fourth arrive without renaming anything. Renaming a checker
   after it ships costs a store listing, another review, and a name its
   users have to unlearn.

   A duplicated id is the cheapest thing this project can decide - count the
   ids, look for a number above one - and among the most consequential.
   `label[for]` stops reaching its field. An in-page anchor lands on the
   first one and never the second. `aria-labelledby` resolves to the wrong
   text. Any script asking for the element by id silently gets whichever
   came first in the document.

   A table with no header cells is the same kind of quiet. It looks like a
   table and reads as one, and a screen reader announces every cell bare,
   with nothing to say which column or row it belongs to.

   A form field with no label is the same defect as a missing alt, one
   element along: the placeholder or the text beside it says what it is to
   anyone looking, and nothing says it to anyone not.

   An inline svg with no name and no aria-hidden is the odd one, because the
   defect is that it is neither. Named, it is announced; hidden, it is
   skipped; neither, and what happens depends on which screen reader is
   reading - which cannot be predicted from the markup, so it cannot be
   checked by looking at the page either.

   And none of it shows. That is why it belongs in a tool used to review a
   page that looks finished, rather than being left to a validator nobody
   opens once the layout is right. */

(() => {
  const PANEL_ID = "js-kraftyMarkupInformation";
  const BODY_CLASS = "kraftyMarkupChecker";

  /* Always start from a clean slate: the previous panel must go, otherwise
     repeated runs stack duplicate elements sharing the same id. */
  document.getElementById(PANEL_ID)?.remove();

  if (!document.body) {
    return;
  }

  if (!document.body.classList.toggle(BODY_CLASS)) {
    return;
  }

  /** Enough of an element to find it again on the page, and no more.

     A duplicated id names itself, which is why that list needed none of
     this. An unlabelled field and a nameless icon are the opposite: what is
     wrong with them is precisely that they have nothing to be called. So
     the row has to be built out of whatever the element does carry, in the
     order of how much it narrows things down.

     This is not a selector and is not promised to be one. It is a label to
     read, and writing it to be pasted into querySelector would mean
     escaping and uniqueness work that nothing here asks for.

     @param {Element} element */
  const descriptor = (element) => {
    const tag = element.localName;

    if (element.id !== "") {
      return `${tag}#${element.id}`;
    }

    const name = element.getAttribute("name");

    if (name) {
      return `${tag}[name="${name}"]`;
    }

    /* Not the checker's own classes; those say nothing about the page. */
    const className = [...element.classList].find(
      (value) => !value.startsWith("krafty")
    );

    if (className) {
      return `${tag}.${className}`;
    }

    const type = element.getAttribute("type");

    if (type) {
      return `${tag}[type="${type}"]`;
    }

    return tag;
  };

  /** A bare tag on its own - `input`, `svg` - is no help at all on a page
     with forty of them, so borrow the parent's identity when the element
     has none of its own.
     @param {Element} element */
  const locate = (element) => {
    const own = descriptor(element);

    if (own !== element.localName) {
      return own;
    }

    const parent = element.parentElement;

    return parent && parent !== document.body
      ? `${descriptor(parent)} > ${own}`
      : own;
  };

  /* Everything below runs again when the panel's rescan button is pressed,
     which is why the toggle is not part of it. */
  const run = () => {
    document.getElementById(PANEL_ID)?.remove();

    /* --- reading the document --- */

    /** @type {Map<string, number>} */
    const seen = new Map();

    /* The whole document, not just the body: an id in the head is rarer but
       collides exactly the same way. */
    for (const element of document.querySelectorAll("[id]")) {
      /* Never report the checker's own UI. closest matches the element
         itself, so the panel's own id is covered by this too. */
      if (element.closest(".kraftyPanel")) {
        continue;
      }

      const id = element.id;

      if (id === "") {
        continue;
      }

      seen.set(id, (seen.get(id) ?? 0) + 1);
    }

    /* Worst first: an id used five times is five places to look. */
    const duplicated = [...seen]
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

    /* A table whose cells have no headers to be announced with.

       The shape has to be a table's before the missing headers mean
       anything, and measuring said so. On ja.wikipedia.org this reported
       twelve, of which the succession boxes and the navigation boxes - one
       row, a handful of cells - were layout wearing a table's tags, and on
       amazon.co.jp the single finding was a one-cell spacer. A table with
       one row cannot have a header row, and one with a single column is a
       list. Neither is a data table with something missing.

       Its own rows and cells, not its descendants': Wikipedia nests tables
       inside tables, and a nested one's `th` would otherwise excuse the
       table around it. */
    /**
     * @param {Element} element
     * @param {string} child
     */
    const own = (element, child) =>
      [
        ...element.querySelectorAll(
          `:scope > ${child}, :scope > thead > ${child}, :scope > tbody > ${child}, :scope > tfoot > ${child}`
        ),
      ];

    const headerless = [...document.querySelectorAll("table")].filter(
      (table) => {
        if (table.closest(".kraftyPanel")) {
          return false;
        }

        const role = (table.getAttribute("role") ?? "").toLowerCase();

        if (role === "presentation" || role === "none") {
          return false;
        }

        const rows = own(table, "tr");

        if (rows.length < 2) {
          return false;
        }

        const widest = Math.max(
          ...rows.map((row) => row.querySelectorAll(":scope > td").length)
        );

        if (widest < 2) {
          return false;
        }

        return rows.every(
          (row) => row.querySelectorAll(":scope > th").length === 0
        );
      }
    );

    /* A form field nothing names.

       The routes to a name are checked in the order the accessible name
       calculation uses them, and a field needs only one. `title` is in the
       list although the roadmap item did not name it: it is a genuine name
       per spec, so a field carrying one is not nameless. Whether it is a
       *good* name is a judgement, and this checker does not make those. */
    /** @type {Map<string, boolean>} */
    const namedByFor = new Map();

    for (const label of document.querySelectorAll("label[for]")) {
      const target = label.getAttribute("for") ?? "";
      const hasText = (label.textContent ?? "").trim() !== "";

      /* Two labels can point at one field, and only one of them has to say
         something. Never let a later empty one overwrite an earlier name. */
      namedByFor.set(target, (namedByFor.get(target) ?? false) || hasText);
    }

    /** @param {Element} field */
    const isNamed = (field) => {
      const labelledBy = (field.getAttribute("aria-labelledby") ?? "").trim();

      if (labelledBy !== "") {
        /* Only if it resolves. A reference to an id that is not on the page
           names nothing, which is the failure this check exists to find. */
        const named = labelledBy
          .split(/\s+/)
          .some(
            (id) =>
              (document.getElementById(id)?.textContent ?? "").trim() !== ""
          );

        if (named) {
          return true;
        }
      }

      if ((field.getAttribute("aria-label") ?? "").trim() !== "") {
        return true;
      }

      if (field.id !== "" && namedByFor.get(field.id)) {
        return true;
      }

      /* A label wrapped around the field, which needs no `for` at all. */
      const wrapping = field.closest("label");

      if (wrapping && (wrapping.textContent ?? "").trim() !== "") {
        return true;
      }

      if ((field.getAttribute("title") ?? "").trim() !== "") {
        return true;
      }

      /* `input type="image"` is named by its alt, the same way an img is.
         The alt checker draws that one; this one only has to know it counts
         as a name so a correct button is not reported here as well. */
      if ((field.getAttribute("alt") ?? "").trim() !== "") {
        return true;
      }

      return false;
    };

    /* Types that take no label: hidden has no field to label, and the three
       button types are named by their own value or text. */
    const UNLABELLABLE = new Set(["hidden", "submit", "button", "reset"]);

    const unlabelled = [
      ...document.querySelectorAll("input, select, textarea"),
    ].filter((field) => {
      if (field.closest(".kraftyPanel")) {
        return false;
      }

      const type = (field.getAttribute("type") ?? "").toLowerCase();

      if (field instanceof HTMLInputElement && UNLABELLABLE.has(type)) {
        return false;
      }

      return !isNamed(field);
    });

    /* An inline svg that is neither named nor hidden.

       aria-hidden is read with closest, not off the element: an icon
       wrapped in a hidden span is the ordinary way this is done correctly,
       and reading only the svg would report every one of them. */
    const namelessSvg = [...document.querySelectorAll("svg")].filter((svg) => {
      if (svg.closest(".kraftyPanel")) {
        return false;
      }

      /* An svg inside an svg is one graphic, and its parent already
         answered for it. */
      if (svg.parentElement?.closest("svg")) {
        return false;
      }

      if (svg.closest('[aria-hidden="true"]')) {
        return false;
      }

      const role = (svg.getAttribute("role") ?? "").toLowerCase();

      if (role === "img" || role === "presentation" || role === "none") {
        return false;
      }

      if ((svg.getAttribute("aria-label") ?? "").trim() !== "") {
        return false;
      }

      if ((svg.getAttribute("aria-labelledby") ?? "").trim() !== "") {
        return false;
      }

      /* The svg's own title, scoped to a direct child. A title deeper in
         belongs to a shape inside the graphic, and the head checker has
         already been bitten once by reading svg titles as something else. */
      const title = svg.querySelector(":scope > title");

      return (title?.textContent ?? "").trim() === "";
    });

    /* --- the panel --- */

    const { panel, body } = kraftyPanel({
      id: PANEL_ID,
      className: "kraftyMarkupInformation",
      title: kraftyMessage("checkerMarkup"),
      onRescan: run,
      onClose: () => {
        panel.remove();
        /* Drop the class too, or the popup would keep showing this checker
           as active with nothing on screen. */
        document.body.classList.remove(BODY_CLASS);
      },
    });

    const { reportText } = kraftyFindings(kraftySection(body, "sectionChecks"));

    if (duplicated.length > 0) {
      reportText("note", kraftyCount("markupDuplicateId", duplicated.length));
    }

    if (headerless.length > 0) {
      reportText("note", kraftyCount("markupTableNoHeader", headerless.length));
    }

    if (unlabelled.length > 0) {
      reportText("note", kraftyCount("markupInputNoLabel", unlabelled.length));
    }

    if (namelessSvg.length > 0) {
      reportText("note", kraftyCount("markupSvgNoName", namelessSvg.length));
    }

    /** A titled section holding a list of rows, each a label and an optional
       aside. The ids list was the only one of these until the two
       accessibility checks arrived wanting the same shape; a third copy is
       what usually gets one of them subtly wrong.

       @param {string} sectionKey
       @param {string} labelKey
       @param {{ label: string, aside?: string, asideClass?: string }[]} rows */
    const listOf = (sectionKey, labelKey, rows) => {
      const section = kraftySection(body, sectionKey);

      kraftyListHead(section, labelKey, kraftyMessage("copyFindings"), () =>
        [
          location.href,
          ...rows.map(
            (row) => `- ${row.label}${row.aside ? ` ${row.aside}` : ""}`
          ),
        ].join("\n")
      );

      const list = document.createElement("ul");
      list.className = "kraftyPanelList";

      for (const row of rows) {
        const item = document.createElement("li");

        const label = document.createElement("code");
        /* textContent, not insertAdjacentHTML: every one of these is built
           out of the page's own ids, names and classes, and must never be
           parsed as markup. */
        label.textContent = row.label;
        item.appendChild(label);

        if (row.aside) {
          const aside = document.createElement("span");
          aside.className = row.asideClass ?? "kraftyPanelCount";
          aside.textContent = row.aside;
          item.appendChild(aside);
        }

        list.appendChild(item);
      }

      section.appendChild(list);
    };

    if (duplicated.length > 0) {
      listOf(
        "markupSectionIds",
        "markupIdListLabel",
        duplicated.map(([id, count]) => ({
          label: `#${id}`,
          aside: `× ${count}`,
        }))
      );
    }

    if (unlabelled.length > 0) {
      listOf(
        "markupSectionFields",
        "markupFieldListLabel",
        unlabelled.map((field) => {
          /* The placeholder is what the field looks like it is called, to
             everyone who can see it. That makes it the fastest way to find
             the row's field on the page - and it is also the reason the
             field was left unlabelled, so it belongs beside the finding
             rather than being treated as one. */
          const placeholder = (
            field.getAttribute("placeholder") ?? ""
          ).trim();

          return {
            label: locate(field),
            aside: placeholder === "" ? undefined : placeholder,
            asideClass: "kraftyPanelHint",
          };
        })
      );
    }

    if (namelessSvg.length > 0) {
      listOf(
        "markupSectionSvg",
        "markupSvgListLabel",
        namelessSvg.map((svg) => ({ label: locate(svg) }))
      );
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
