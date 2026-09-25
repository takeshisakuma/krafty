// @ts-check

/* The content model table lives here rather than in content.scss because the
   checker has to be able to explain its findings: CSS can flag an element
   but cannot report one. Keeping a second copy in SCSS would guarantee the
   two drift apart, so the stylesheet now only colours what this file marks.

   Moving the judging here also retired the machinery the CSS approach
   needed - :where() to neutralise the specificity of ~80 chained :not()
   clauses, and exception rules that had to out-specify the generated ones.
   Both were sources of silent breakage. */

(() => {
  const BODY_CLASS = "kraftyNestChecker";
  const ERROR_CLASS = "kraftyNestError";

  /** @param {string} names */
  const split = (names) => names.split(" ");

  /**
   * @param {string[]} list
   * @param {string[]} removed
   */
  const without = (list, removed) => list.filter((n) => !removed.includes(n));

  /**
   * @param {string[]} list
   * @param {string[]} added
   */
  const plus = (list, added) => list.concat(added);

  const FLOW = split(
    "article section nav aside h1 h2 h3 h4 h5 h6 hgroup header footer address" +
      " p hr pre blockquote ol ul menu dl figure search div main a em strong" +
      " small s cite q dfn abbr data time code var samp kbd sub sup i b u mark" +
      " ruby bdi bdo span br wbr ins del picture img iframe embed object video" +
      " audio map math svg table form label input button select datalist" +
      " textarea keygen output progress meter fieldset details dialog script" +
      " noscript template canvas slot"
  );

  const PHRASING = split(
    "a em strong small s cite q dfn abbr data time code var samp kbd sub sup" +
      " i b u mark ruby bdi bdo span br wbr ins del picture img iframe embed" +
      " object video audio map math svg label input button select datalist" +
      " textarea keygen output progress meter script noscript template canvas" +
      " slot selectedcontent"
  );

  const HEADINGS = split("h1 h2 h3 h4 h5 h6");
  /* Heading content includes hgroup; keep HEADINGS as the h1–h6 set used for
     parents that only allow those, not the hgroup wrapper itself. */
  const HEADING_CONTENT = plus(HEADINGS, ["hgroup"]);
  const SECTIONING = plus(
    HEADING_CONTENT,
    split("article section nav aside header footer main")
  );

  const FLOW_NO_SECTIONING = without(FLOW, SECTIONING);
  const FLOW_NO_HEADER_FOOTER = without(FLOW, split("header footer main"));

  /* Parent element -> the child elements it may contain. A parent that is
     absent is not checked: transparent content models (a, ins, del, video,
     audio, map, math, svg, button, canvas, noscript, template) depend on the
     context of their own parent, which a static table cannot express. */

  /** @type {Record<string, string[]>} */
  const MODELS = {};

  /**
   * @param {string[]} parents
   * @param {string[]} allowed
   */
  const model = (parents, allowed) => {
    for (const parent of parents) {
      MODELS[parent] = allowed;
    }
  };

  model(
    split(
      "body article section nav aside main blockquote li dd figcaption div" +
        " dialog td search"
    ),
    FLOW
  );
  model(split("header footer"), FLOW_NO_HEADER_FOOTER);
  model(split("address dt th"), FLOW_NO_SECTIONING);
  model(
    plus(
      HEADINGS,
      split(
        "p pre em strong small s cite q dfn abbr data time code var samp kbd" +
          " sub sup i b u mark span bdi bdo output rb rt rp"
      )
    ),
    PHRASING
  );
  /* Zero or more p, one h1–h6, zero or more p; flat table cannot enforce
     the single heading, only the permitted child names. */
  model(["hgroup"], plus(HEADINGS, split("p script template")));
  model(split("ol ul menu"), split("li script template"));
  model(["dl"], split("dt dd div script template"));
  model(["figure"], plus(FLOW, ["figcaption"]));
  model(["details"], plus(FLOW, ["summary"]));
  model(split("summary legend"), plus(PHRASING, HEADING_CONTENT));
  model(["fieldset"], plus(FLOW, ["legend"]));
  model(["form"], without(FLOW, ["form"]));
  model(["label"], without(PHRASING, ["label"]));
  model(["ruby"], plus(PHRASING, split("rb rt rtc rp")));
  model(["rtc"], plus(PHRASING, ["rt"]));
  model(["picture"], split("source img"));
  model(["object"], plus(FLOW, ["param"]));
  model(
    ["table"],
    split("caption colgroup tbody thead tfoot tr script template")
  );
  model(["caption"], without(FLOW, ["table"]));
  model(["colgroup"], split("col template"));
  model(split("thead tbody tfoot"), split("tr script template"));
  model(["tr"], split("th td script template"));
  /* Customizable <select> also allows a button, div wrappers, and noscript. */
  model(
    ["select"],
    split("optgroup option hr script template button div noscript")
  );
  model(["optgroup"], split("option script template legend noscript div"));
  model(["datalist"], plus(PHRASING, ["option"]));

  /* Void and text-only elements: any child element is a markup error. */
  model(
    split(
      "hr br wbr img iframe embed param source track area col input textarea" +
        " keygen option script selectedcontent"
    ),
    []
  );

  /* rel values that make a <link> valid in the body. */
  const BODY_OK_REL = split(
    "dns-prefetch modulepreload pingback preconnect prefetch preload stylesheet"
  );

  /**
   * @param {Element} element
   * @returns {{ parent: string, child: string, allowed: string[] } | null}
   */
  const judge = (element) => {
    const parentElement = element.parentElement;

    if (!parentElement) {
      return null;
    }

    const parent = parentElement.tagName.toLowerCase();
    const child = element.tagName.toLowerCase();
    const grandparent =
      parentElement.parentElement?.tagName.toLowerCase() ?? "";

    /* A div that is a direct child of dl may only wrap dt/dd groups (plus
       script-supporting elements) — not ordinary flow content. */
    if (parent === "div" && grandparent === "dl") {
      const dlDivAllowed = split("dt dd script template");

      if (dlDivAllowed.includes(child)) {
        return null;
      }

      return { parent, child, allowed: dlDivAllowed };
    }

    const allowed = MODELS[parent];

    if (!allowed) {
      return null;
    }

    /* dl is Either/Or: direct dt/dd groups, or div wrappers — not both.
       When mixed, flag the div wrappers (the special mode) and leave the
       classic dt/dd groups alone, so one conflict does not paint every term. */
    if (parent === "dl" && child === "div") {
      const hasDtDd = [...parentElement.children].some((el) => {
        const name = el.tagName.toLowerCase();
        return name === "dt" || name === "dd";
      });

      if (hasDtDd) {
        return { parent, child, allowed: split("dt dd script template") };
      }
    }

    if (allowed.includes(child)) {
      return null;
    }

    /* Autonomous custom elements are flow and phrasing content, so they are
       valid nearly anywhere. */
    if (child.includes("-")) {
      return null;
    }

    /* area is only meaningful inside a map, at any depth. */
    if (child === "area" && element.closest("map")) {
      return null;
    }

    /* meta and link carrying microdata are valid in the body. */
    if (
      (child === "meta" || child === "link") &&
      element.hasAttribute("itemprop")
    ) {
      return null;
    }

    if (child === "link") {
      const rels = (element.getAttribute("rel") ?? "")
        .toLowerCase()
        .split(/\s+/);

      if (rels.some((rel) => BODY_OK_REL.includes(rel))) {
        return null;
      }
    }

    return { parent, child, allowed };
  };

  const PANEL_ID = "js-kraftyNestInformation";
  const SAVED_TITLE = "data-kraftyTitle";

  /* A tooltip listing 80 permitted elements helps nobody; the list is only
     worth showing when it is short enough to act on. */
  const MAX_LISTED_CHILDREN = 12;

  /** Undo everything this checker writes onto the page. */
  const clear = () => {
    document.getElementById(PANEL_ID)?.remove();
    kraftyClearPointer();

    for (const marked of document.querySelectorAll(`.${ERROR_CLASS}`)) {
      marked.classList.remove(ERROR_CLASS);

      /* Put back whatever title the page had, rather than destroying it. */
      const saved = marked.getAttribute(SAVED_TITLE);

      if (saved === null) {
        marked.removeAttribute("title");
      } else {
        marked.setAttribute("title", saved);
        marked.removeAttribute(SAVED_TITLE);
      }
    }
  };

  if (!document.body) {
    return;
  }

  clear();

  if (!document.body.classList.toggle(BODY_CLASS)) {
    return;
  }

  /* Everything below runs again when the panel's rescan button is pressed,
     which is why the toggle is not part of it. */
  const run = () => {
    clear();

    /** @type {Map<string, { count: number, first: Element }>} */
    const totals = new Map();

    /* The judging sees the DOM as it is now, so elements a single page app
       inserts later are not marked. Toggle the checker off and on to re-scan. */
    for (const element of document.body.querySelectorAll("*")) {
      /* Never report the checker's own UI. */
      if (
        element.closest(".kraftyPanel") ||
        element.classList.contains("kraftyAltContent")
      ) {
        continue;
      }

      const finding = judge(element);

      if (!finding) {
        continue;
      }

      const { parent, child, allowed } = finding;

      element.classList.add(ERROR_CLASS);

      const lines = [
        allowed.length === 0
          ? kraftyMessage("nestReasonEmptyModel", [parent])
          : kraftyMessage("nestReasonNotAllowed", [child, parent]),
      ];

      if (allowed.length > 0 && allowed.length <= MAX_LISTED_CHILDREN) {
        lines.push(
          kraftyMessage("nestAllowedChildren", [parent, allowed.join(", ")])
        );
      }

      const existing = element.getAttribute("title");

      if (existing !== null) {
        element.setAttribute(SAVED_TITLE, existing);
      }
      element.setAttribute("title", lines.join("\n"));

      const key = `${parent} > ${child}`;
      const entry = totals.get(key);

      if (entry) {
        entry.count += 1;
      } else {
        totals.set(key, { count: 1, first: element });
      }
    }

    /* --- findings panel --- */

    const total = [...totals.values()].reduce((sum, entry) => sum + entry.count, 0);

    const { panel, body } = kraftyPanel({
      id: PANEL_ID,
      className: "kraftyNestInformation",
      title: kraftyMessage("checkerNest"),
      onRescan: run,
      onClose: () => {
        clear();
        kraftyClearPointer();
        document.body.classList.remove(BODY_CLASS);
      },
    });

    const head = document.createElement("div");
    head.className = "kraftyChecksHead";
    body.appendChild(head);

    const summary = document.createElement("div");
    summary.className = "kraftyPanelSummary";
    summary.textContent =
      total === 0
        ? kraftyMessage("nestPanelClean")
        : kraftyCount("nestPanelCount", total);
    head.appendChild(summary);

    /* Same reasoning as the head checker's: the breakdown is what goes into a
       ticket, and copying it a line at a time is not what anyone wants. The
       page address leads, because a list of counts means nothing without it. */
    if (total > 0) {
      const copyAll = kraftyCopyButton(kraftyMessage("copyFindings"), () =>
        [
          location.href,
          summary.textContent,
          ...[...totals]
            .sort((a, b) => b[1].count - a[1].count)
            .map(([key, entry]) => `- ${key} × ${entry.count}`),
        ].join("\n")
      );
      copyAll.classList.add("kraftyCopyAll");
      head.appendChild(copyAll);
    }

    if (total > 0) {
      const list = document.createElement("ul");
      list.className = "kraftyPanelList";

      for (const [key, entry] of [...totals].sort(
        (a, b) => b[1].count - a[1].count
      )) {
        const item = document.createElement("li");

        const label = document.createElement("code");
        label.textContent = key;
        item.appendChild(label);

        const times = document.createElement("span");
        times.className = "kraftyPanelCount";
        times.textContent = `× ${entry.count}`;
        item.appendChild(times);

        /* Count stays; the first flagged element is the one the row points
           at, so the breakdown is still findable from the panel. */
        kraftyPointAt(item, entry.first);

        list.appendChild(item);
      }

      body.appendChild(list);
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
