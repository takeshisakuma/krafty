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

  /** The element's index among its like siblings, as an `:nth-of-type`, or
     nothing when it stands alone. It is a position to tell one of a row of
     identical elements from the next, so a single one - where there is
     nothing to tell it from - gets no suffix and stays clean.

     @param {Element} element */
  const positionOf = (element) => {
    const parent = element.parentElement;

    if (!parent) {
      return "";
    }

    const kin = [...parent.children].filter(
      (child) => child.localName === element.localName
    );

    return kin.length > 1
      ? `:nth-of-type(${kin.indexOf(element) + 1})`
      : "";
  };

  /** The strongest identifier an element carries on its own, and whether it
     is strong enough to name one element by itself.

     An id, a name, or a link's href points at a single element; a shared
     class or a bare tag can be the same string for a whole row of siblings.
     That difference is what item 21 measured: `a > svg` and
     `i.icon-blank > svg`, repeated identically down a list until the count
     was all it said. A weak identifier is one that wants a position beside
     it when it is borrowed as another element's context; a strong one does
     not, and gets none so the common case stays legible.

     A link's href is here because it is the one thing a nameless icon link
     still carries - `<a href="/twitter"><svg></svg></a>` has nothing else -
     and it is read only for a link with no class, so a classed link keeps
     its class, which usually reads better than a URL.

     None of this is a selector, and none of it is promised to be one.

     @param {Element} element
     @returns {{ text: string, weak: boolean, bare: boolean }} */
  const identify = (element) => {
    const tag = element.localName;

    if (element.id !== "") {
      return { text: `${tag}#${element.id}`, weak: false, bare: false };
    }

    const name = element.getAttribute("name");

    if (name) {
      return { text: `${tag}[name="${name}"]`, weak: false, bare: false };
    }

    /* Not the checker's own classes; those say nothing about the page. */
    const className = [...element.classList].find(
      (value) => !value.startsWith("krafty")
    );

    if (className) {
      return { text: `${tag}.${className}`, weak: true, bare: false };
    }

    if (
      element instanceof HTMLAnchorElement ||
      element instanceof HTMLAreaElement
    ) {
      const href = element.getAttribute("href");

      if (href) {
        return { text: `${tag}[href="${href}"]`, weak: false, bare: false };
      }
    }

    const type = element.getAttribute("type");

    if (type) {
      return { text: `${tag}[type="${type}"]`, weak: true, bare: false };
    }

    return { text: tag, weak: true, bare: true };
  };

  /** A label to find the element again on the page, and no more.

     An element that names itself is named by itself. One with nothing -
     `input`, `svg` - is no help at all on a page with forty of them, so it
     borrows the parent's identity. Where that borrowed identity is weak - a
     shared class, a bare tag - a position is added, because it is the same
     string for every sibling otherwise, which is exactly item 21's collapse.
     A strong parent identity (an href, an id) is left to stand on its own.

     @param {Element} element */
  const locate = (element) => {
    const self = identify(element);

    if (!self.bare) {
      return self.text;
    }

    const parent = element.parentElement;

    if (!parent || parent === document.body) {
      return self.text;
    }

    const context = identify(parent);
    const position = context.weak ? positionOf(parent) : "";

    return `${context.text}${position} > ${self.text}`;
  };

  /* Links and buttons, native and by role. The name check and item 21's
     weight split both ask "is this the control that the nameless thing sits
     inside", and both mean the same four things by a control. A bare `<a>`
     with no href is not one - it is a target or a fragment of script, not
     something a screen reader lists as a link - so href is required. */
  const INTERACTIVE = 'a[href], button, [role="link"], [role="button"]';

  /** The text an element offers as its own name: its text, or, when it has
     none, the alt of an image inside it. An icon link is the case that
     matters - `<a href><img alt="Home"></a>` is named by the picture, and
     `<a href><svg></svg></a>` is named by nothing.
     @param {Element} element */
  const ownText = (element) => {
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

    return "";
  };

  /** What a screen reader would read out for an element, or "" when it would
     read nothing. Enough of the accessible name computation to tell a named
     control from a nameless one, in precedence order - aria-labelledby that
     resolves, aria-label, the element's own text, then title - and not the
     whole ARIA algorithm, which this project has no business half-doing.

     aria-label is above the text on purpose: a link labelled "Home" whose
     visible text is "こちら" is named, and reading the text first would call
     it vague when it is not. A labelledby that resolves to nothing falls
     through, the same failure the field check looks for.

     @param {Element} element */
  const accessibleName = (element) => {
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

    const text = ownText(element);

    if (text !== "") {
      return text;
    }

    return (element.getAttribute("title") ?? "").trim();
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

    /* A link or button a screen reader would announce as nothing. The icon
       button is where this lives: a `<button>` or `<a href>` holding only an
       svg is silent and looks finished. aria-hidden ones are skipped, the
       same as the svgs above - one removed from the accessibility tree is
       not announced at all, so a missing name on it reaches nobody either
       way, and item 22 is where that contradiction belongs. */
    const namelessLinks = [
      ...document.querySelectorAll(INTERACTIVE),
    ].filter((element) => {
      if (element.closest(".kraftyPanel")) {
        return false;
      }

      if (element.closest('[aria-hidden="true"]')) {
        return false;
      }

      return accessibleName(element) === "";
    });

    /* Item 21's weight split, which waited for this computation. A nameless
       svg that is the only content of a control is the reason that control
       has no name - the heavier fault, item 11's from the other end - while
       one that is merely undeclared decoration is a note. The same svg
       appears here and in namelessLinks by design: the two are one defect
       seen from the markup and from the reader, and a director fixing it
       wants both. */
    /** @param {Element} svg */
    const leavesControlUnnamed = (svg) => {
      const control = svg.closest(INTERACTIVE);
      return control !== null && accessibleName(control) === "";
    };

    const svgUnnamedControl = namelessSvg.filter(leavesControlUnnamed);
    const svgDecorative = namelessSvg.filter(
      (svg) => !leavesControlUnnamed(svg)
    );

    /* A link that goes nowhere: an empty href, or a bare `#`. A fragment
       like `#main` is a real in-page jump and is left alone; only `#` on its
       own is the placeholder a build leaves behind. This is a defect for
       everyone, not only a screen reader, so aria-hidden is not a reason to
       skip it. */
    const deadLinks = [...document.querySelectorAll("a[href]")].filter(
      (link) => {
        if (link.closest(".kraftyPanel")) {
          return false;
        }

        const href = (link.getAttribute("href") ?? "").trim();

        return href === "" || href === "#";
      }
    );

    /* One accessible name pointing at more than one place. In a screen
       reader's link list the same word appears twice and goes somewhere
       different each time, with nothing to tell them apart. Grouped by the
       name a reader hears, counting the distinct addresses under it.

       hrefs are compared as written rather than resolved: about:blank has no
       base to resolve a relative one against, which is the trap support.js
       warns of, and the raw attribute is what the author typed anyway. The
       nameless and the dead are the other findings' business, so both are
       left out of this one. */
    /** @type {Map<string, { name: string, hrefs: Set<string> }>} */
    const named = new Map();

    for (const link of document.querySelectorAll("a[href]")) {
      if (link.closest(".kraftyPanel") || link.closest('[aria-hidden="true"]')) {
        continue;
      }

      const name = accessibleName(link);
      const href = (link.getAttribute("href") ?? "").trim();

      if (name === "" || href === "" || href === "#") {
        continue;
      }

      const key = name.toLowerCase();
      const entry = named.get(key) ?? { name, hrefs: new Set() };
      entry.hrefs.add(href);
      named.set(key, entry);
    }

    const reused = [...named.values()]
      .filter((entry) => entry.hrefs.size > 1)
      .sort((a, b) => b.hrefs.size - a.hrefs.size);

    /* Link text that says nothing out of the run of the page. Whether a
       phrase is too vague is a judgement and the list of them is
       per-language, so these are listed for the reader to weigh rather than
       asserted to be wrong - the same treatment the head checker gives the
       values only a person can judge. English and Japanese are checked
       together because a page mixes them. */
    const VAGUE = new Set([
      "click here",
      "here",
      "read more",
      "more",
      "learn more",
      "see more",
      "details",
      "detail",
      "this",
      "this link",
      "link",
      "continue reading",
      "continue",
      "こちら",
      "こちらから",
      "こちらをクリック",
      "詳細",
      "詳しくはこちら",
      "もっと見る",
      "続きを読む",
      "続きを見る",
      "リンク",
      "ここ",
      "ここをクリック",
    ]);

    /** @type {Map<string, { name: string, count: number }>} */
    const vague = new Map();

    for (const link of document.querySelectorAll("a[href]")) {
      if (link.closest(".kraftyPanel") || link.closest('[aria-hidden="true"]')) {
        continue;
      }

      const name = accessibleName(link);

      if (name === "" || !VAGUE.has(name.toLowerCase())) {
        continue;
      }

      const key = name.toLowerCase();
      const entry = vague.get(key) ?? { name, count: 0 };
      entry.count += 1;
      vague.set(key, entry);
    }

    const vagueTexts = [...vague.values()].sort((a, b) => b.count - a.count);

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

    if (namelessLinks.length > 0) {
      reportText("alert", kraftyCount("markupLinkNoName", namelessLinks.length));
    }

    if (deadLinks.length > 0) {
      reportText("alert", kraftyCount("markupLinkDead", deadLinks.length));
    }

    if (reused.length > 0) {
      reportText("note", kraftyCount("markupLinkSameText", reused.length));
    }

    /* Split by weight: the svgs that leave a control unnamed are an alert,
       the decorative rest a note. Reported as two findings so the count a
       reader acts on first is separated from the count they may leave. */
    if (svgUnnamedControl.length > 0) {
      reportText(
        "alert",
        kraftyCount("markupSvgUnnamedControl", svgUnnamedControl.length)
      );
    }

    if (svgDecorative.length > 0) {
      reportText("note", kraftyCount("markupSvgNoName", svgDecorative.length));
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

    if (namelessLinks.length > 0) {
      listOf(
        "markupSectionLinks",
        "markupLinkListLabel",
        namelessLinks.map((element) => {
          const label = locate(element);
          const href = (element.getAttribute("href") ?? "").trim();

          /* The address is what a nameless link is otherwise mute about, so
             it is worth showing - unless the label already carries it, which
             it does for a link that had nothing else to be named by. */
          const aside =
            href !== "" && !label.includes(href) ? href : undefined;

          return { label, aside, asideClass: "kraftyPanelHint" };
        })
      );
    }

    if (deadLinks.length > 0) {
      listOf(
        "markupSectionDeadLinks",
        "markupDeadLinkListLabel",
        deadLinks.map((link) => {
          /* Its text, so the reader knows which link goes nowhere - a dead
             link is often named, it just does not lead anywhere. */
          const name = accessibleName(link);

          return {
            label: locate(link),
            aside: name === "" ? undefined : name,
            asideClass: "kraftyPanelHint",
          };
        })
      );
    }

    if (reused.length > 0) {
      listOf(
        "markupSectionReused",
        "markupReusedListLabel",
        reused.map((entry) => ({
          label: entry.name,
          aside: `× ${entry.hrefs.size}`,
        }))
      );
    }

    if (vagueTexts.length > 0) {
      listOf(
        "markupSectionVague",
        "markupVagueListLabel",
        vagueTexts.map((entry) => ({
          label: entry.name,
          aside: entry.count > 1 ? `× ${entry.count}` : undefined,
        }))
      );
    }

    if (namelessSvg.length > 0) {
      /* The heavier ones first, each tagged with why it is heavier: it is
         the reason a link or button next to it has no name. */
      listOf("markupSectionSvg", "markupSvgListLabel", [
        ...svgUnnamedControl.map((svg) => ({
          label: locate(svg),
          aside: kraftyMessage("markupSvgControlTag"),
          asideClass: "kraftyPanelHint",
        })),
        ...svgDecorative.map((svg) => ({ label: locate(svg) })),
      ]);
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
