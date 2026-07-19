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
    "article section nav aside h1 h2 h3 h4 h5 h6 header footer address p hr" +
      " pre blockquote ol ul dl figure div main a em strong small s cite q dfn" +
      " abbr data time code var samp kbd sub sup i b u mark ruby bdi bdo span" +
      " br wbr ins del picture img iframe embed object video audio map math" +
      " svg table form label input button select datalist textarea keygen" +
      " output progress meter fieldset details dialog script noscript" +
      " template canvas"
  );

  const PHRASING = split(
    "a em strong small s cite q dfn abbr data time code var samp kbd sub sup" +
      " i b u mark ruby bdi bdo span br wbr ins del picture img iframe embed" +
      " object video audio map math svg label input button select datalist" +
      " textarea keygen output progress meter script noscript template canvas"
  );

  const HEADINGS = split("h1 h2 h3 h4 h5 h6");
  const SECTIONING = plus(
    HEADINGS,
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
        " dialog td"
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
  model(split("ol ul"), split("li script template"));
  model(["dl"], split("dt dd div script template"));
  model(["figure"], plus(FLOW, ["figcaption"]));
  model(["details"], plus(FLOW, ["summary"]));
  model(split("summary legend"), plus(PHRASING, HEADINGS));
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
  model(["select"], split("optgroup option hr script template"));
  model(["optgroup"], split("option script template"));
  model(["datalist"], plus(PHRASING, ["option"]));

  /* Void and text-only elements: any child element is a markup error. */
  model(
    split(
      "hr br wbr img iframe embed param source track area col input textarea" +
        " keygen option script"
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
    const allowed = MODELS[parent];

    if (!allowed) {
      return null;
    }

    const child = element.tagName.toLowerCase();

    if (allowed.includes(child)) {
      return null;
    }

    /* Autonomous custom elements are flow and phrasing content, so they are
       valid nearly anywhere. */
    if (child.includes("-")) {
      return null;
    }

    /* A dl may wrap each dt/dd group in a div. */
    if (
      (child === "dt" || child === "dd") &&
      parent === "div" &&
      parentElement.parentElement?.tagName.toLowerCase() === "dl"
    ) {
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

  if (!document.body) {
    return;
  }

  for (const marked of document.querySelectorAll(`.${ERROR_CLASS}`)) {
    marked.classList.remove(ERROR_CLASS);
  }

  if (!document.body.classList.toggle(BODY_CLASS)) {
    return;
  }

  /* The judging sees the DOM as it is now, so elements a single page app
     inserts later are not marked. Toggle the checker off and on to re-scan. */
  const panel = document.getElementById("js-kraftyHeadInformation");

  for (const element of document.body.querySelectorAll("*")) {
    /* Never report the checker's own UI. */
    if (
      panel?.contains(element) ||
      element.classList.contains("kraftyAltContent")
    ) {
      continue;
    }

    if (judge(element)) {
      element.classList.add(ERROR_CLASS);
    }
  }
})();
