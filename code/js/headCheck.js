// @ts-check

(() => {
  const PANEL_ID = "js-kraftyHeadInformation";

  /* Always start from a clean slate: the previous panel must go, otherwise
     repeated runs stack duplicate elements sharing the same id. */
  const previous = document.getElementById(PANEL_ID);
  if (previous) {
    previous.remove();
  }

  if (!document.body) {
    return;
  }

  document.body.classList.remove("kraftyBrightnessChecker");

  if (!document.body.classList.toggle("kraftyHeadChecker")) {
    return;
  }

  /**
   * @param {string} name
   * @returns {string | null}
   */
  const metaByName = (name) => {
    const meta = document.querySelector(`meta[name="${name}"]`);
    return meta ? meta.getAttribute("content") : null;
  };

  /**
   * @param {string} property
   * @returns {string | null}
   */
  const metaByProperty = (property) => {
    const meta = document.querySelector(`meta[property="${property}"]`);
    return meta ? meta.getAttribute("content") : null;
  };

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

  const favicon = linkByRel("icon") || "/favicon.ico";

  const rows = [
    { label: "title", value: document.title, count: true },
    { label: "description", value: metaByName("description"), count: true },
    { label: "charset", value: document.characterSet },
    { label: "og:title", value: metaByProperty("og:title"), count: true },
    { label: "og:type", value: metaByProperty("og:type") },
    { label: "og:url", value: metaByProperty("og:url") },
    { label: "og:image", value: metaByProperty("og:image"), image: "ogp" },
    {
      label: "og:description",
      value: metaByProperty("og:description"),
      count: true,
    },
    { label: "fb:app_id", value: metaByProperty("fb:app_id") },
    { label: "twitter:card", value: metaByName("twitter:card") },
    { label: "viewport", value: metaByName("viewport") },
    { label: "canonical", value: linkByRel("canonical") },
    { label: "favicon", value: favicon, image: "favicon" },
    {
      label: "apple touch icon",
      value: linkByRel("apple-touch-icon", "apple-touch-icon-precomposed"),
      image: "apple",
    },
  ];

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

  for (const { label, value, count, image } of rows) {
    const row = document.createElement("div");

    /* The label is a literal tag name, so it stays as it is in every
       locale. It used to read "title is", which needed English grammar to
       make sense of. */
    const heading = document.createElement("strong");
    heading.textContent = label;
    row.appendChild(heading);

    /* Count code points, so an emoji or a surrogate pair counts as one. */
    if (count && value) {
      row.appendChild(
        document.createTextNode(
          `　${kraftyMessage("headCharacterCount", [
            String([...value].length),
          ])}`
        )
      );
    }

    row.appendChild(document.createElement("br"));

    if (value === null || value === "") {
      const missing = document.createElement("span");
      missing.className = "kraftyMissing";
      missing.textContent = kraftyMessage(
        value === "" ? "valueEmpty" : "valueNotSet"
      );
      row.appendChild(missing);
    } else {
      const source = image ? resolve(value) : null;

      if (source) {
        const preview = document.createElement("img");
        preview.className = `headImage ${image}`;
        preview.src = source;
        preview.alt = "";
        row.appendChild(preview);
        row.appendChild(document.createTextNode("　"));
      }

      /* textContent, not insertAdjacentHTML: these values come from the
         page and must never be parsed as markup. */
      row.appendChild(document.createTextNode(value));
    }

    row.appendChild(document.createElement("hr"));
    body.appendChild(row);
  }

  document.body.appendChild(panel);
})();
