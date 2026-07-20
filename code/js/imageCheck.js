// @ts-check

/* Two defects that live in the same walk over the page's images.

   Served larger than shown: a 3000px photograph dropped into a 300px slot.
   The bytes are downloaded and thrown away, and the person who signed the
   page off is the one asked why it is slow.

   No width and height attributes: the browser cannot reserve the space, so
   the layout jumps as each image arrives.

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

  if (!document.body.classList.toggle(BODY_CLASS)) {
    return;
  }

  /* Everything below runs again when the panel's rescan button is pressed,
     which is why the toggle is not part of it. */
  const run = () => {
    document.getElementById(PANEL_ID)?.remove();

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

    /** @type {{ src: string, natural: string, shown: string, ratio: number }[]} */
    const oversized = [];
    let missingDimensions = 0;
    let unmeasured = 0;

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
        missingDimensions += 1;
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
        });
      }
    }

    /* Largest waste first: that is the order they are worth fixing in. */
    oversized.sort((a, b) => b.ratio - a.ratio);

    /* --- the panel --- */

    const { panel, body } = kraftyPanel({
      id: PANEL_ID,
      className: "kraftyImageInformation",
      title: kraftyMessage("checkerImage"),
      onRescan: run,
      onClose: () => {
        panel.remove();
        /* Drop the class too, or the popup would keep showing this checker as
           active with nothing on screen. */
        document.body.classList.remove(BODY_CLASS);
      },
    });

    const { reportText } = kraftyFindings(kraftySection(body, "sectionChecks"));

    if (oversized.length > 0) {
      reportText("note", kraftyCount("imageOversized", oversized.length));
    }

    if (missingDimensions > 0) {
      reportText("note", kraftyCount("imageNoSize", missingDimensions));
    }

    /* --- the offending images --- */

    if (oversized.length > 0) {
      const listSection = kraftySection(body, "imageSectionList");

      kraftyListHead(
        listSection,
        "imageListLabel",
        kraftyMessage("copyFindings"),
        () =>
          [
            location.href,
            ...oversized.map(
              (entry) =>
                `- ${entry.natural} → ${entry.shown} (×${entry.ratio.toFixed(1)}) ${entry.src}`
            ),
          ].join("\n")
      );

      const list = document.createElement("ul");
      list.className = "kraftyImageList";

      for (const entry of oversized) {
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

        /* The file name is what identifies the image at a glance; the whole
           address is what goes in the ticket, so that is what copies. */
        const name = document.createElement("div");
        name.className = "kraftyImageSrc";
        name.textContent = fileName(entry.src);
        name.title = entry.src;
        item.appendChild(name);

        item.appendChild(
          kraftyCopyButton(kraftyMessage("copyValue", ["src"]), () => entry.src)
        );

        list.appendChild(item);
      }

      listSection.appendChild(list);

      const basis = document.createElement("p");
      basis.className = "kraftyNote";
      basis.textContent = kraftyMessage("imageAllowanceNote", [
        String(allowance),
      ]);
      listSection.appendChild(basis);
    }

    if (unmeasured > 0) {
      const note = document.createElement("div");
      note.className = "kraftyPanelNote";
      note.textContent = kraftyCount("imageUnmeasured", unmeasured);
      body.appendChild(note);
    }

    const scanned = document.createElement("div");
    scanned.className = "kraftyPanelNote";
    scanned.textContent = kraftyMessage("panelScannedAt", [
      new Date().toLocaleTimeString(),
    ]);
    body.appendChild(scanned);

    document.body.appendChild(panel);

    /**
     * The last path segment, which is what anyone recognises the image by.
     * Falls back to the whole address for a data: URL or anything unparseable.
     *
     * @param {string} src
     * @returns {string}
     */
    function fileName(src) {
      try {
        const { pathname } = new URL(src, document.baseURI);
        return pathname.split("/").filter(Boolean).pop() || src;
      } catch (error) {
        return src;
      }
    }
  };

  run();
})();
