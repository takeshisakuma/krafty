// @ts-check

/* The panel is in three parts, and the split is the point of it.

   What a machine can decide - whether a tag is present, duplicated, or of a
   sane length - is decided and reported. What it cannot decide is whether
   the text is the *right* text: a title can be present, well formed, and
   still read "ホーム | ホーム" or carry a staging environment's name. Those
   values are put in front of the reader instead, drawn the way a visitor
   would meet them, because judging "does this look wrong" is quick and
   judging a bare string is not.

   Hence the wording of the summary: nothing wrong in what can be checked
   automatically. Claiming more than that would be a lie the reader has no
   way to catch. */

(() => {
  const PANEL_ID = "js-kraftyHeadInformation";

  /* Always start from a clean slate: the previous panel must go, otherwise
     repeated runs stack duplicate elements sharing the same id. */
  document.getElementById(PANEL_ID)?.remove();

  if (!document.body) {
    return;
  }

  if (!document.body.classList.toggle("kraftyHeadChecker")) {
    return;
  }

  /* Everything below runs again when the panel's rescan button is pressed,
     which is why the toggle is not part of it. */
  const run = () => {
    document.getElementById(PANEL_ID)?.remove();

    /* --- reading the document --- */

    /**
     * @param {string} selector
     * @returns {string | null}
     */
    const attr = (selector) => {
      const element = document.querySelector(selector);
      return element ? element.getAttribute("content") : null;
    };

    /** @param {string} name */
    const metaByName = (name) => attr(`meta[name="${name}" i]`);

    /** @param {string} property */
    const metaByProperty = (property) => attr(`meta[property="${property}" i]`);

    /**
     * @param {...string} wanted
     * @returns {string | null}
     */
    const linkByRel = (...wanted) => {
      for (const link of document.querySelectorAll("link[rel][href]")) {
        const rels = (link.getAttribute("rel") ?? "").toLowerCase().split(/\s+/);

        if (wanted.some((rel) => rels.includes(rel))) {
          return link.getAttribute("href");
        }
      }
      return null;
    };

    /**
     * @param {string} url
     * @returns {string | null}
     */
    const resolve = (url) => {
      try {
        return new URL(url, document.baseURI).href;
      } catch (error) {
        return null;
      }
    };

    /**
     * Whether two addresses name the same page.
     *
     * The finding this backs is "the page declares itself not the original",
     * which is serious. It has to mean a different *page*, not a different
     * spelling of this one: a canonical of /index.html read from / is the
     * same document on every static host, and picking one spelling over the
     * other is precisely what the tag is for. Reported as a contradiction, it
     * was a false positive on a correctly built site.
     *
     * Stripping tracking parameters is the same argument again, and the most
     * common correct use of the tag there is. Arriving at a page from an ad
     * carries a query string nobody wrote and nobody wants indexed; a
     * canonical naming the clean address is the page doing its job, not
     * disowning itself. Reported as a contradiction it fired on Amazon, whose
     * canonical was the bare URL of the very page being read.
     *
     * The query cannot simply be ignored, because it does identify a
     * different page often enough - ?id=2 is not ?id=1. The rule is
     * containment: every parameter the canonical names has to be here, with
     * the same value. A canonical that drops parameters is canonicalising;
     * one that changes or adds them is pointing somewhere else.
     *
     * What this gives up is a canonical from ?page=2 to the bare listing,
     * which is a real if arguable defect. That is the trade: a finding on
     * every ad-tracked URL costs more than a missing one on pagination, and
     * an SEO tool that cries wolf on an ad landing page will be ignored on
     * the day it is right.
     *
     * The path is matched the same way. Equal is the plain case; a segment
     * suffix is the SEO-slug canonical, where the tag names a prettier
     * spelling of this same address with the page's title prepended.
     * Amazon reads a product at /dp/B0D7VQ38KL/ and canonicalises to
     * /Aespa-.../dp/B0D7VQ38KL - one path is the tail of the other, the
     * shorter saying the same thing with fewer words, which is what the
     * tag is for. Reported as a contradiction it fired on every Amazon
     * product opened by its bare ASIN. The shorter path has to carry a
     * segment of its own: a bare "/" is the tail of every address, and
     * accepting it would call the whole site one page.
     *
     * A different host or scheme is still reported. Those are also ordinary
     * canonicalisation, but they are worth a person's glance in a way that a
     * directory index is not, and the finding is a note rather than an alert.
     *
     * @param {string} a
     * @param {string} b
     */
    const samePage = (a, b) => {
      /** @param {URL} url */
      const path = (url) => {
        const withoutIndex = url.pathname.replace(/\/index\.(html?|php)$/i, "/");
        return withoutIndex.endsWith("/") ? withoutIndex : `${withoutIndex}/`;
      };

      /** Whether two normalised paths name the same page: equal, or one's
         segments are the tail of the other's.
         @param {string} first @param {string} second */
      const samePath = (first, second) => {
        if (first === second) {
          return true;
        }

        const one = first.split("/").filter(Boolean);
        const two = second.split("/").filter(Boolean);
        const [longer, shorter] =
          one.length >= two.length ? [one, two] : [two, one];

        if (shorter.length === 0) {
          return false;
        }

        const offset = longer.length - shorter.length;
        return shorter.every((part, index) => part === longer[offset + index]);
      };

      /** @type {URL} */
      let target;
      /** @type {URL} */
      let here;

      try {
        target = new URL(a);
        here = new URL(b);
      } catch (error) {
        return a === b;
      }

      /* origin covers scheme, host and port together. */
      if (target.origin !== here.origin || !samePath(path(target), path(here))) {
        return false;
      }

      for (const [name, value] of target.searchParams) {
        if (here.searchParams.get(name) !== value) {
          return false;
        }
      }

      return true;
    };

    /** @param {string | null} value */
    const length = (value) => (value ? [...value].length : 0);

    const pageTitle = document.title;
    const description = metaByName("description");
    const robots = metaByName("robots");
    const canonical = linkByRel("canonical");
    const ogTitle = metaByProperty("og:title");
    const ogDescription = metaByProperty("og:description");
    const ogImage = metaByProperty("og:image");
    const documentLang = document.documentElement.getAttribute("lang");

    /* --- what a machine can decide --- */

    const { panel, body } = kraftyPanel({
      id: PANEL_ID,
      className: "kraftyHeadInformation",
      title: kraftyMessage("checkerHead"),
      onRescan: run,
      onClose: () => {
        panel.remove();
        /* Drop the class too, or the popup would keep showing this checker
           as active with nothing on screen. */
        document.body.classList.remove("kraftyHeadChecker");
      },
    });

    /** @param {string} key */
    const section = (key) => kraftySection(body, key);

    const { report } = kraftyFindings(section("sectionChecks"));

    /** @param {string} selector @param {string} label */
    const reportDuplicates = (selector, label) => {
      const count = document.querySelectorAll(selector).length;

      if (count > 1) {
        report("note", "checkDuplicate", [label, String(count)]);
      }
    };

    const robotDirectives = (robots ?? "").toLowerCase();

    if (robotDirectives.includes("noindex")) {
      report("alert", "checkNoindex");
    }
    if (robotDirectives.includes("nofollow")) {
      report("note", "checkNofollow");
    }

    if (document.compatMode === "BackCompat") {
      report("alert", "checkQuirks");
    }

    if (document.querySelector('meta[http-equiv="refresh" i]')) {
      report("alert", "checkRefresh");
    }

    if (pageTitle.trim() === "") {
      report("alert", "checkTitleMissing");
    }
    if (description === null) {
      report("note", "checkDescriptionMissing");
    }
    if (metaByName("viewport") === null) {
      report("note", "checkViewportMissing");
    }
    if (!documentLang || documentLang.trim() === "") {
      report("note", "checkLangMissing");
    }

    const canonicalTarget = canonical ? resolve(canonical) : null;

    if (canonical === null) {
      report("note", "checkCanonicalMissing");
    } else if (canonicalTarget && !samePage(canonicalTarget, location.href)) {
      report("note", "checkCanonicalElsewhere", [canonicalTarget]);
    }

    /* --- hreflang ---

       Checked only when the page declares any. One language needs none, so
       reporting their absence would fire on most of the web and teach the
       reader that this panel is noise. Once they are there, whether the set
       is internally sound is a question a machine can answer.

       Note that <html lang> is checked separately and for a different
       reason: search engines decide language from the content and from
       these, not from that attribute, but a screen reader picks its voice
       from it. Neither check stands in for the other. */

    /** @type {{ code: string, target: string | null }[]} */
    const alternates = [];

    for (const link of document.querySelectorAll(
      'link[rel~="alternate" i][hreflang]'
    )) {
      const href = (link.getAttribute("href") ?? "").trim();

      alternates.push({
        code: (link.getAttribute("hreflang") ?? "").trim(),
        /* An empty href resolves to this page, which would read as a self
           reference the markup never made. */
        target: href === "" ? null : resolve(href),
      });
    }

    /* Country codes standing in for a language, where the country code is
       not itself a language code - so saying it is wrong needs no judgement
       about what the author meant.

       "uk" and "se" are deliberately absent, though they are the same
       mistake: both are real languages (Ukrainian, Northern Sami), and a
       page in either would be told its correct code is wrong. A checker that
       is wrong about Ukrainian to be right about Denmark has made the worse
       trade. */
    const mistaken = {
      jp: "ja",
      cn: "zh",
      kr: "ko",
      gr: "el",
      dk: "da",
      cz: "cs",
    };

    /**
     * x-default is a reserved value rather than a language tag, which is why
     * Intl rejects it. Everything else is structural: Intl throws on a tag
     * BCP 47 cannot parse, and accepts one it can.
     *
     * @param {string} code
     */
    const parsesAsLanguage = (code) => {
      if (code.toLowerCase() === "x-default") {
        return true;
      }

      try {
        Intl.getCanonicalLocales(code);
        return true;
      } catch (error) {
        return false;
      }
    };

    if (alternates.length > 0) {
      /* A set that does not name itself is discarded whole, so this is the
         one worth an alert.

         Matching the canonical counts as naming itself. An hreflang set is
         meant to list canonical addresses, and a site whose canonical is
         https://www.example.com/ read over a bare example.com would
         otherwise be told its correct markup was broken. */
      const namesItself = alternates.some(
        ({ target }) =>
          target !== null &&
          (samePage(target, location.href) ||
            (canonicalTarget !== null && samePage(target, canonicalTarget)))
      );

      if (!namesItself) {
        report("alert", "checkHreflangNoSelf");
      }

      /** @type {Map<string, string | null>} */
      const seen = new Map();
      /* One finding per code, however many times the code appears. A site
         with forty alternates would otherwise report the same mistake forty
         times and bury everything else. */
      /** @type {Set<string>} */
      const said = new Set();
      /** @type {Set<string>} */
      const clashed = new Set();

      for (const { code, target } of alternates) {
        /* Case carries no meaning in a language tag, so en-CA and en-ca are
           one code - both for what has already been reported and for what
           counts as the same entry twice. */
        const key = code.toLowerCase();

        if (!said.has(key)) {
          if (Object.hasOwn(mistaken, key)) {
            said.add(key);
            report("alert", "checkHreflangMistaken", [
              code,
              mistaken[/** @type {keyof typeof mistaken} */ (key)],
            ]);
          } else if (!parsesAsLanguage(code)) {
            said.add(key);
            report("alert", "checkHreflangInvalid", [code]);
          }
        }

        if (seen.has(key)) {
          /* The same code twice for the same address is redundant markup,
             not a defect. Twice for two addresses is a question nothing can
             answer. */
          if (seen.get(key) !== target && !clashed.has(key)) {
            clashed.add(key);
            report("note", "checkHreflangConflict", [code]);
          }
        } else {
          seen.set(key, target);
        }
      }
    }

    /* Length only. Whether the words are the right words is the reader's
       call, which is what the previews below are for. */
    if (length(pageTitle) > 60) {
      report("note", "checkTooLong", ["title", String(length(pageTitle))]);
    }
    if (length(description) > 160) {
      report("note", "checkTooLong", [
        "description",
        String(length(description)),
      ]);
    }

    /* "head > title", not "title": in an HTML document a type selector matches
       every namespace, so a bare "title" also collects the <title> elements
       inside inline SVG. Those are accessible names for icons, not document
       titles, and any site with an SVG icon set has several - which reported a
       duplicate title on a page whose title is perfectly fine. The document
       title is a child of head by definition, so scoping there is both the
       narrower and the more accurate reading. */
    reportDuplicates("head > title", "title");
    reportDuplicates('meta[name="description" i]', "description");
    reportDuplicates('link[rel~="canonical" i]', "canonical");
    reportDuplicates('meta[property="og:title" i]', "og:title");

    /* og:image is deliberately absent from that list. Open Graph allows a
       property to be an array, and og:image is the one everybody uses that
       way: several images, each followed by its own og:image:type, :width and
       :height, for the platform to choose from. github.com ships three, which
       this reported as a duplicated tag - a defect finding on a page doing
       something the specification documents.

       The count is not thrown away, only moved. The reference row below says
       which of how many it is showing, because a reader looking at one
       picture should know there were others. */

    /* --- what only a person can decide --- */

    const reviewSection = section("sectionReview");

    const reviewNote = document.createElement("p");
    reviewNote.className = "kraftyNote";
    reviewNote.textContent = kraftyMessage("headReviewNote");
    reviewSection.appendChild(reviewNote);

    /**
     * @param {string} key
     * @returns {HTMLElement}
     */
    const preview = (key) => {
      const label = document.createElement("div");
      label.className = "kraftyPreviewLabel";
      label.textContent = kraftyMessage(key);
      reviewSection.appendChild(label);

      const frame = document.createElement("div");
      reviewSection.appendChild(frame);
      return frame;
    };

    /* Search result. */
    const serp = preview("headPreviewSearch");
    serp.className = "kraftySerp";

    const serpUrl = document.createElement("div");
    serpUrl.className = "kraftySerpUrl";
    serpUrl.textContent = [
      location.hostname,
      ...location.pathname.split("/"),
    ]
      .filter(Boolean)
      .join(" › ");
    serp.appendChild(serpUrl);

    const serpTitle = document.createElement("div");
    serpTitle.className = "kraftySerpTitle";
    serpTitle.textContent = pageTitle || kraftyMessage("valueNotSet");
    serp.appendChild(serpTitle);

    const serpDescription = document.createElement("div");
    serpDescription.className = "kraftySerpDescription";
    serpDescription.textContent = description || kraftyMessage("valueNotSet");
    serp.appendChild(serpDescription);

    /* Social card. Platforms fall back to title and description when the og:
       equivalents are missing, so the preview does too - and says so, because
       "the card looks fine" and "og:title is set" are different facts. */
    const card = preview("headPreviewCard");
    card.className = "kraftyCard";

    const cardImage = document.createElement("div");
    cardImage.className = "kraftyCardImage";
    card.appendChild(cardImage);

    const resolvedOgImage = ogImage ? resolve(ogImage) : null;

    if (resolvedOgImage) {
      const image = document.createElement("img");
      image.src = resolvedOgImage;
      image.alt = "";

      image.addEventListener("load", () => {
        if (image.naturalWidth < 1200 || image.naturalHeight < 630) {
          report("note", "checkOgImageSmall", [
            String(image.naturalWidth),
            String(image.naturalHeight),
          ]);
        }
      });
      image.addEventListener("error", () => {
        report("note", "checkOgImageFailed");
        cardImage.textContent = kraftyMessage("checkOgImageFailed");
      });

      cardImage.appendChild(image);
    } else {
      cardImage.textContent = kraftyMessage("headCardNoImage");
      cardImage.classList.add("kraftyCardImageEmpty");
    }

    const cardBody = document.createElement("div");
    cardBody.className = "kraftyCardBody";

    const cardDomain = document.createElement("div");
    cardDomain.className = "kraftyCardDomain";
    cardDomain.textContent = location.hostname;
    cardBody.appendChild(cardDomain);

    const cardTitle = document.createElement("div");
    cardTitle.className = "kraftyCardTitle";
    cardTitle.textContent = ogTitle || pageTitle || kraftyMessage("valueNotSet");
    cardBody.appendChild(cardTitle);

    const cardDescription = document.createElement("div");
    cardDescription.className = "kraftyCardDescription";
    cardDescription.textContent =
      ogDescription || description || kraftyMessage("valueNotSet");
    cardBody.appendChild(cardDescription);

    card.appendChild(cardBody);

    for (const [value, key] of [
      [ogTitle, "headCardFallbackTitle"],
      [ogDescription, "headCardFallbackDescription"],
    ]) {
      if (!value) {
        const fallback = document.createElement("div");
        fallback.className = "kraftyFallbackNote";
        fallback.textContent = kraftyMessage(String(key));
        reviewSection.appendChild(fallback);
      }
    }

    const approximate = document.createElement("p");
    approximate.className = "kraftyNote";
    approximate.textContent = kraftyMessage("headPreviewApproximate");
    reviewSection.appendChild(approximate);

    /* --- everything, for reference --- */

    const favicon = linkByRel("icon") || "/favicon.ico";

    const rows = [
      { label: "title", value: pageTitle, count: true },
      { label: "description", value: description, count: true },
      { label: "robots", value: robots },
      { label: "html lang", value: documentLang },
      /* The codes, not the addresses: a dozen alternates would otherwise
         fill the panel with URLs nobody reads one at a time, and which of
         them exist is the question this row is here to answer. */
      {
        label: "hreflang",
        value:
          alternates.length > 0
            ? alternates.map(({ code }) => code).join(", ")
            : null,
      },
      { label: "charset", value: document.characterSet },
      {
        label: "compatMode",
        value:
          document.compatMode === "BackCompat" ? "quirks" : "standards",
      },
      { label: "canonical", value: canonical, url: true },
      { label: "base", value: document.querySelector("base")?.getAttribute("href") ?? null, url: true },
      { label: "og:title", value: ogTitle, count: true },
      { label: "og:type", value: metaByProperty("og:type") },
      { label: "og:url", value: metaByProperty("og:url"), url: true },
      {
        label: "og:image",
        value: ogImage,
        image: "ogp",
        url: true,
        /* Open Graph lets this be an array, and only the first is previewed.
           Saying so beats letting a reader think one is all there is. */
        of: document.querySelectorAll('meta[property="og:image" i]').length,
      },
      { label: "og:description", value: ogDescription, count: true },
      { label: "og:site_name", value: metaByProperty("og:site_name") },
      { label: "og:locale", value: metaByProperty("og:locale") },
      { label: "fb:app_id", value: metaByProperty("fb:app_id") },
      { label: "twitter:card", value: metaByName("twitter:card") },
      { label: "twitter:site", value: metaByName("twitter:site") },
      { label: "twitter:title", value: metaByName("twitter:title") },
      { label: "twitter:description", value: metaByName("twitter:description") },
      {
        label: "twitter:image",
        value: metaByName("twitter:image"),
        /* A thumbnail, like og:image: without this key the row drew only the
           address and never the picture the card actually shows. */
        image: "ogp",
        url: true,
      },
      { label: "viewport", value: metaByName("viewport") },
      { label: "theme-color", value: metaByName("theme-color") },
      { label: "manifest", value: linkByRel("manifest"), url: true },
      { label: "favicon", value: favicon, image: "favicon", url: true },
      {
        label: "apple touch icon",
        value: linkByRel("apple-touch-icon", "apple-touch-icon-precomposed"),
        image: "apple",
        url: true,
      },
    ];

    const referenceSection = section("headSectionReference");

    for (const { label, value, count, image, url, of } of rows) {
      const row = document.createElement("div");
      row.className = "kraftyRow";

      const head = document.createElement("div");
      head.className = "kraftyRowHead";
      row.appendChild(head);

      /* The label is a literal tag name, so it stays as it is in every
         locale. It used to read "title is", which needed English grammar to
         make sense of. */
      const heading = document.createElement("strong");
      heading.textContent = label;
      head.appendChild(heading);

      /* Count code points, so an emoji or a surrogate pair counts as one.

         An element rather than a bare text node: loose text inside a flex row
         becomes an anonymous item that nothing can select, style or position,
         which is how it ended up drifting away from the label it belongs to. */
      if (count && value) {
        const characters = document.createElement("span");
        characters.className = "kraftyRowCount";
        characters.textContent = kraftyMessage("headCharacterCount", [
          String(length(value)),
        ]);
        head.appendChild(characters);
      }

      /* A property the specification lets repeat, where only the first is
         shown. Not a finding - the row simply says which of how many. */
      if (of && of > 1) {
        const which = document.createElement("span");
        which.className = "kraftyRowCount";
        which.textContent = kraftyMessage("headOneOfSeveral", [String(of)]);
        head.appendChild(which);
      }

      const line = document.createElement("div");
      line.className = "kraftyRowValue";
      row.appendChild(line);

      if (value === null || value === "") {
        const missing = document.createElement("span");
        missing.className = "kraftyMissing";
        missing.textContent = kraftyMessage(
          value === "" ? "valueEmpty" : "valueNotSet"
        );
        line.appendChild(missing);
      } else {
        /* Nothing to copy when there is no value, so the button only appears
           alongside one. */
        head.appendChild(
          kraftyCopyButton(kraftyMessage("copyValue", [label]), () => value)
        );

        const source = image ? resolve(value) : null;

        if (source) {
          const thumbnail = document.createElement("img");
          thumbnail.className = `headImage ${image}`;
          thumbnail.src = source;
          thumbnail.alt = "";
          line.appendChild(thumbnail);
        }

        const target = url ? resolve(value) : null;
        const scheme = target ? new URL(target).protocol : null;

        /* Only http(s) becomes a link. The value is written by the page, so a
           javascript: or data: URL would otherwise turn a row that is inert
           today into something that runs on click. The text stays as the
           markup wrote it - whether a URL is relative or absolute is part of
           what is being audited - while the href is resolved so it works. */
        if (target && (scheme === "http:" || scheme === "https:")) {
          const link = document.createElement("a");
          link.className = "kraftyLink";
          link.href = target;
          link.target = "_blank";
          /* noreferrer as well as noopener: the audited address should not be
             handed to whatever the page points at. */
          link.rel = "noopener noreferrer";
          link.textContent = value;
          line.appendChild(link);
        } else {
          /* textContent, not insertAdjacentHTML: these values come from the
             page and must never be parsed as markup. */
          line.appendChild(document.createTextNode(value));
        }
      }

      referenceSection.appendChild(row);
    }

    document.body.appendChild(panel);
  };

  run();
})();
