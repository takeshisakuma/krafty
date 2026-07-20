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

  document.body.classList.remove("kraftyBrightnessChecker");

  if (!document.body.classList.toggle("kraftyHeadChecker")) {
    return;
  }

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
    title: kraftyMessage("headPanelTitle"),
    onClose: () => {
      panel.remove();
      /* Drop the class too, or the popup would keep showing this checker
         as active with nothing on screen. */
      document.body.classList.remove("kraftyHeadChecker");
    },
  });

  /**
   * @param {string} key
   * @returns {HTMLElement}
   */
  const section = (key) => {
    const wrapper = document.createElement("section");
    wrapper.className = "kraftySection";

    const heading = document.createElement("h2");
    heading.className = "kraftySectionTitle";
    heading.textContent = kraftyMessage(key);
    wrapper.appendChild(heading);

    body.appendChild(wrapper);
    return wrapper;
  };

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

  if (canonical === null) {
    report("note", "checkCanonicalMissing");
  } else {
    const target = resolve(canonical);
    const here = location.href.split("#")[0];

    if (target && target.split("#")[0] !== here) {
      report("note", "checkCanonicalElsewhere", [target]);
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
  reportDuplicates('meta[property="og:image" i]', "og:image");

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
    { label: "og:image", value: ogImage, image: "ogp", url: true },
    { label: "og:description", value: ogDescription, count: true },
    { label: "og:site_name", value: metaByProperty("og:site_name") },
    { label: "og:locale", value: metaByProperty("og:locale") },
    { label: "fb:app_id", value: metaByProperty("fb:app_id") },
    { label: "twitter:card", value: metaByName("twitter:card") },
    { label: "twitter:site", value: metaByName("twitter:site") },
    { label: "twitter:title", value: metaByName("twitter:title") },
    { label: "twitter:description", value: metaByName("twitter:description") },
    { label: "twitter:image", value: metaByName("twitter:image"), url: true },
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

  for (const { label, value, count, image, url } of rows) {
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
        line.appendChild(document.createTextNode("　"));
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
})();
