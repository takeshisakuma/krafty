// @ts-check

/* Two defects that live in the same walk over the page's images.

   Served larger than shown: a 3000px photograph dropped into a 300px slot.
   The bytes are downloaded and thrown away, and the person who signed the
   page off is the one asked why it is slow. The same waste happens when the
   photograph is a CSS background-image on a hero — those are measured too,
   after loading each url() into an Image so the natural size is known.

   No width and height attributes: the browser cannot reserve the space, so
   the layout jumps as each image arrives. Backgrounds have no attributes to
   miss, so that half stays on <img> only.

   The trap is high density displays. A correctly built page serves roughly
   twice the CSS size so the image is sharp on a retina screen, and a flat
   "more than twice the displayed size" rule would flag every one of them.

   Reading window.devicePixelRatio alone does not fix it, and this is the
   part worth being careful about: it would make the answer depend on the
   monitor the audit happens to run on. The same page, correctly built,
   would come back clean on a retina laptop and covered in findings on an
   external 1x display, because there every 2x asset is twice the size the
   CSS box needs. A checker whose output changes with the hardware is worse
   than one that is merely wrong, because nothing on screen says which
   reading you are looking at.

   So the allowance is max(devicePixelRatio, 2): never less than the 2x a
   page should be ready for, and higher on a display that genuinely wants
   more. The same page gives the same answer wherever it is checked. */

(() => {
  const PANEL_ID = "js-kraftyImageInformation";
  const BODY_CLASS = "kraftyImageChecker";

  /* Always start from a clean slate: the previous panel must go, otherwise
     repeated runs stack duplicate elements sharing the same id. */
  document.getElementById(PANEL_ID)?.remove();

  if (!document.body) {
    return;
  }

  /* Shared across reinjections of this script. Bumped when the checker is
     turned off, or when a newer scan starts, so an in-flight background
     probe cannot rebuild a panel after teardown. */
  const nextScan = () => {
    globalThis.kraftyImageScan = (globalThis.kraftyImageScan ?? 0) + 1;
    return globalThis.kraftyImageScan;
  };

  if (!document.body.classList.toggle(BODY_CLASS)) {
    nextScan();
    kraftyClearPointer();
    return;
  }

  /** @type {Map<string, Promise<{ width: number, height: number } | null>>} */
  const naturalCache = new Map();

  /**
   * Natural size of a URL, or null when it will not load. Used for CSS
   * backgrounds, which have no naturalWidth on the element itself. Cached
   * per address: the same sprite on twenty tiles must not open twenty
   * probes.
   *
   * @param {string} src
   * @returns {Promise<{ width: number, height: number } | null>}
   */
  const naturalOf = (src) => {
    const known = naturalCache.get(src);

    if (known) {
      return known;
    }

    const probe = new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        if (image.naturalWidth === 0) {
          resolve(null);
          return;
        }

        resolve({ width: image.naturalWidth, height: image.naturalHeight });
      };
      image.onerror = () => resolve(null);
      image.src = src;
    });

    naturalCache.set(src, probe);
    return probe;
  };

  /**
   * url(...) tokens from a background-image value. Gradients and none yield
   * nothing. Relative addresses resolve against the document.
   *
   * @param {string} value
   * @returns {string[]}
   */
  const backgroundUrls = (value) => {
    if (!value || value === "none") {
      return [];
    }

    /** @type {string[]} */
    const urls = [];

    for (const match of value.matchAll(
      /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi
    )) {
      const raw = (match[1] ?? match[2] ?? match[3] ?? "").trim();

      if (raw === "") {
        continue;
      }

      try {
        urls.push(new URL(raw, document.baseURI).href);
      } catch {
        urls.push(raw);
      }
    }

    return urls;
  };

  /* Everything below runs again when the panel's rescan button is pressed,
     which is why the toggle is not part of it. */
  const run = async () => {
    const token = nextScan();

    document.getElementById(PANEL_ID)?.remove();
    /* A pinned pointer box belongs to the last scan; the rows about to be
       rebuilt are its only way home. */
    kraftyClearPointer();

    /* --- the rules --- */

    const allowance = Math.max(window.devicePixelRatio || 1, 2);

    /* How far past the allowance counts as wasteful. Conventional rather than
       measured, like the head checker's title length - so the ratio is put in
       every row for the reader to disagree with, rather than hidden behind a
       verdict. */
    const WASTE_FACTOR = 1.5;

    /* An image can be several times larger than it needs and still not be
       worth a ticket, if it is a 40px icon. Without a floor in absolute
       pixels the panel fills up with sprites and spacer images. */
    const MIN_WASTED_PIXELS = 200;

    /** @type {{ src: string, natural: string, shown: string, ratio: number, element: Element }[]} */
    const oversized = [];
    /** @type {{ src: string, natural: string, shown: string, ratio: number, element: Element }[]} */
    const oversizedBackgrounds = [];
    /** @type {HTMLImageElement[]} */
    const missingDimensions = [];
    let unmeasured = 0;
    let unmeasuredBackgrounds = 0;

    for (const image of document.body.querySelectorAll("img")) {
      /* Never report the checker's own UI. The head checker's preview images
         carry a headImage class, which the alt checker has to test for - but
         they live inside its panel, so this walk has already excluded them. */
      if (image.closest(".kraftyPanel")) {
        continue;
      }

      const shownWidth = image.clientWidth;
      const shownHeight = image.clientHeight;

      /* Not laid out: display:none, or not in the flow. There is no displayed
         size to compare against, so there is nothing to say. */
      if (shownWidth === 0 || shownHeight === 0) {
        continue;
      }

      if (!image.hasAttribute("width") || !image.hasAttribute("height")) {
        missingDimensions.push(image);
      }

      /* Still loading, lazy loaded below the fold, or failed outright. The
         natural size is unknown, so it is counted and said out loud rather
         than quietly treated as fine. */
      if (!image.complete || image.naturalWidth === 0) {
        unmeasured += 1;
        continue;
      }

      const needed = shownWidth * allowance;
      const ratio = image.naturalWidth / needed;

      if (
        ratio >= WASTE_FACTOR &&
        image.naturalWidth - needed >= MIN_WASTED_PIXELS
      ) {
        oversized.push({
          src: image.currentSrc || image.src,
          natural: `${image.naturalWidth}×${image.naturalHeight}`,
          shown: `${shownWidth}×${shownHeight}`,
          ratio,
          element: image,
        });
      }
    }

    /* Background images: same waste rule against the element's box. cover /
       contain and multi-layer stacks are not modelled - the box is what the
       layout reserved, which is the honest half of the comparison. */
    /** @type {{ element: Element, src: string, shownWidth: number, shownHeight: number }[]} */
    const backgroundJobs = [];

    for (const element of document.body.querySelectorAll("*")) {
      if (element.closest(".kraftyPanel")) {
        continue;
      }

      const shownWidth = /** @type {HTMLElement} */ (element).clientWidth;
      const shownHeight = /** @type {HTMLElement} */ (element).clientHeight;

      if (shownWidth === 0 || shownHeight === 0) {
        continue;
      }

      const urls = backgroundUrls(getComputedStyle(element).backgroundImage);

      for (const src of urls) {
        backgroundJobs.push({ element, src, shownWidth, shownHeight });
      }
    }

    for (const job of backgroundJobs) {
      const natural = await naturalOf(job.src);

      if (token !== globalThis.kraftyImageScan) {
        return;
      }

      if (!natural) {
        unmeasuredBackgrounds += 1;
        continue;
      }

      const needed = job.shownWidth * allowance;
      const ratio = natural.width / needed;

      if (
        ratio >= WASTE_FACTOR &&
        natural.width - needed >= MIN_WASTED_PIXELS
      ) {
        oversizedBackgrounds.push({
          src: job.src,
          natural: `${natural.width}×${natural.height}`,
          shown: `${job.shownWidth}×${job.shownHeight}`,
          ratio,
          element: job.element,
        });
      }
    }

    if (token !== globalThis.kraftyImageScan) {
      return;
    }

    /* Largest waste first: that is the order they are worth fixing in. */
    oversized.sort((a, b) => b.ratio - a.ratio);
    oversizedBackgrounds.sort((a, b) => b.ratio - a.ratio);

    /* --- the panel --- */

    const { panel, body } = kraftyPanel({
      id: PANEL_ID,
      className: "kraftyImageInformation",
      title: kraftyMessage("checkerImage"),
      onRescan: () => {
        void run();
      },
      onClose: () => {
        nextScan();
        panel.remove();
        kraftyClearPointer();
        /* Drop the class too, or the popup would keep showing this checker as
           active with nothing on screen. */
        document.body.classList.remove(BODY_CLASS);
      },
    });

    const { reportText } = kraftyFindings(kraftySection(body, "sectionChecks"));

    if (oversized.length > 0) {
      reportText("note", kraftyCount("imageOversized", oversized.length));
    }

    if (oversizedBackgrounds.length > 0) {
      reportText(
        "note",
        kraftyCount("imageBgOversized", oversizedBackgrounds.length)
      );
    }

    if (missingDimensions.length > 0) {
      reportText(
        "note",
        kraftyCount("imageNoSize", missingDimensions.length)
      );
    }

    /**
     * The last path segment, which is what anyone recognises the image by.
     * Falls back to the whole address for a data: URL or anything unparseable.
     *
     * @param {string} src
     * @returns {string}
     */
    const fileName = (src) => {
      try {
        const { pathname } = new URL(src, document.baseURI);
        return pathname.split("/").filter(Boolean).pop() || src;
      } catch {
        return src;
      }
    };

    /**
     * @param {string} sectionKey
     * @param {string} labelKey
     * @param {{ src: string, natural: string, shown: string, ratio: number, element: Element }[]} rows
     * @param {boolean} withBasis
     */
    const listOversized = (sectionKey, labelKey, rows, withBasis) => {
      const listSection = kraftySection(body, sectionKey);

      kraftyListHead(
        listSection,
        labelKey,
        kraftyMessage("copyFindings"),
        () =>
          [
            location.href,
            ...rows.map(
              (entry) =>
                `- ${entry.natural} → ${entry.shown} (×${entry.ratio.toFixed(1)}) ${entry.src}`
            ),
          ].join("\n")
      );

      const list = document.createElement("ul");
      list.className = "kraftyImageList";

      for (const entry of rows) {
        const item = document.createElement("li");

        const sizes = document.createElement("div");
        sizes.className = "kraftyImageSizes";

        const measurement = document.createElement("code");
        measurement.textContent = kraftyMessage("imageSizeComparison", [
          entry.natural,
          entry.shown,
        ]);
        sizes.appendChild(measurement);

        const times = document.createElement("span");
        times.className = "kraftyImageRatio";
        times.textContent = `×${entry.ratio.toFixed(1)}`;
        sizes.appendChild(times);

        item.appendChild(sizes);

        const name = document.createElement("div");
        name.className = "kraftyImageSrc";
        name.textContent = fileName(entry.src);
        name.title = entry.src;
        item.appendChild(name);

        item.appendChild(
          kraftyCopyButton(kraftyMessage("copyValue", ["src"]), () => entry.src)
        );

        kraftyPointAt(item, entry.element);

        list.appendChild(item);
      }

      listSection.appendChild(list);

      if (withBasis) {
        const basis = document.createElement("p");
        basis.className = "kraftyNote";
        basis.textContent = kraftyMessage("imageAllowanceNote", [
          String(allowance),
        ]);
        listSection.appendChild(basis);
      }
    };

    /* --- the offending images --- */

    if (oversized.length > 0) {
      listOversized(
        "imageSectionList",
        "imageListLabel",
        oversized,
        oversizedBackgrounds.length === 0
      );
    }

    if (oversizedBackgrounds.length > 0) {
      listOversized(
        "imageSectionBackgrounds",
        "imageBgListLabel",
        oversizedBackgrounds,
        true
      );
    }

    if (missingDimensions.length > 0) {
      const listSection = kraftySection(body, "imageSectionNoSize");

      kraftyListHead(
        listSection,
        "imageNoSizeListLabel",
        kraftyMessage("copyFindings"),
        () =>
          [
            location.href,
            ...missingDimensions.map((image) => {
              const src = image.currentSrc || image.src;
              return `- ${src}`;
            }),
          ].join("\n")
      );

      const list = document.createElement("ul");
      list.className = "kraftyImageList";

      for (const image of missingDimensions) {
        const item = document.createElement("li");
        const src = image.currentSrc || image.src;

        const name = document.createElement("div");
        name.className = "kraftyImageSrc";
        name.textContent = fileName(src);
        name.title = src;
        item.appendChild(name);

        item.appendChild(
          kraftyCopyButton(kraftyMessage("copyValue", ["src"]), () => src)
        );

        kraftyPointAt(item, image);

        list.appendChild(item);
      }

      listSection.appendChild(list);
    }

    if (unmeasured > 0) {
      const note = document.createElement("div");
      note.className = "kraftyPanelNote";
      note.textContent = kraftyCount("imageUnmeasured", unmeasured);
      body.appendChild(note);
    }

    if (unmeasuredBackgrounds > 0) {
      const note = document.createElement("div");
      note.className = "kraftyPanelNote";
      note.textContent = kraftyCount(
        "imageBgUnmeasured",
        unmeasuredBackgrounds
      );
      body.appendChild(note);
    }

    const scanned = document.createElement("div");
    scanned.className = "kraftyPanelNote";
    scanned.textContent = kraftyMessage("panelScannedAt", [
      new Date().toLocaleTimeString(),
    ]);
    body.appendChild(scanned);

    document.body.appendChild(panel);
  };

  void run();
})();
