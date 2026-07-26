// @ts-check

/* Design-token audit (item 26).

   What a designer reviewing a build wants: the colours, fonts, radii and
   shadows the page actually renders with. The trap is shipping a dump —
   DevTools already does that. This is an audit: lead with the counts that
   say whether the tokens are disciplined, list them for a person to judge,
   and never assert "off-system" because Krafty does not know the system.

   Near-identical colours, radii or shadows (a cluster that should have been
   one token) and a font-family whose first named face never loaded are
   notes, listed rather than failed, the same shape as vague link text. */

(() => {
  const PANEL_ID = "js-kraftyTokenInformation";
  const BODY_CLASS = "kraftyTokenChecker";

  /* How close two colours have to be to count as the same token gone
     sprawling. Measured in sRGB; ~18 catches the "forty-seven greys"
     case without collapsing distinct brand colours into one pile. */
  const NEAR_COLOUR = 18;

  /* Radii within this many px of each other count as the same corner
     token gone sprawling. */
  const NEAR_RADIUS = 2;

  /* Shadow stacks within this distance (offsets + blur + spread, plus a
     scaled colour delta) count as near-duplicates. */
  const NEAR_SHADOW = 4;

  /* A cluster this size or larger is worth naming as sprawl. Two near
     neighbours is often just hover/active; three-plus is a pattern. */
  const SPRAWL_MIN = 3;

  const SKIP_TAGS = new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "TEMPLATE",
    "HEAD",
    "META",
    "LINK",
    "BR",
    "WBR",
    "SOURCE",
    "TRACK",
  ]);

  const GENERIC_FONTS = new Set([
    "serif",
    "sans-serif",
    "monospace",
    "cursive",
    "fantasy",
    "system-ui",
    "ui-sans-serif",
    "ui-serif",
    "ui-monospace",
    "ui-rounded",
    "emoji",
    "math",
    "fangsong",
    "inherit",
    "initial",
    "unset",
    "revert",
    "revert-layer",
  ]);

  /* Soft bound so a pathological DOM cannot freeze the tab. Distinct
     tokens are counted from whatever was read; the panel says how many
     elements were looked at. */
  const MAX_ELEMENTS = 4000;

  document.getElementById(PANEL_ID)?.remove();

  if (!document.body) {
    return;
  }

  if (!document.body.classList.toggle(BODY_CLASS)) {
    kraftyClearPointer();
    return;
  }

  /**
   * @param {string} value
   * @returns {{ r: number, g: number, b: number, a: number, key: string } | null}
   */
  const parseColour = (value) => {
    if (!value || value === "transparent") {
      return null;
    }

    const match = value.match(
      /^rgba?\(\s*([\d.]+)[%]?\s*[,\s]\s*([\d.]+)[%]?\s*[,\s]\s*([\d.]+)[%]?(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i
    );

    if (!match) {
      return null;
    }

    const alpha =
      match[4] === undefined
        ? 1
        : match[4].endsWith("%")
          ? Number(match[4].slice(0, -1)) / 100
          : Number(match[4]);

    if (!(alpha > 0)) {
      return null;
    }

    const r = Math.round(Number(match[1]));
    const g = Math.round(Number(match[2]));
    const b = Math.round(Number(match[3]));
    const a = Math.round(alpha * 1000) / 1000;
    const key =
      a >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`;

    return { r, g, b, a, key };
  };

  /**
   * @param {{ r: number, g: number, b: number }} a
   * @param {{ r: number, g: number, b: number }} b
   */
  const colourDistance = (a, b) =>
    Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);

  /**
   * Greedy clusters. `near` returns whether two items belong together.
   *
   * @template {{ key: string }} T
   * @param {T[]} items
   * @param {(a: T, b: T) => boolean} near
   * @returns {T[][]}
   */
  const nearClusters = (items, near) => {
    /** @type {T[][]} */
    const clusters = [];
    const used = new Set();

    for (let i = 0; i < items.length; i++) {
      const seed = items[i];

      if (used.has(seed.key)) {
        continue;
      }

      /** @type {T[]} */
      const group = [seed];
      used.add(seed.key);

      for (let j = i + 1; j < items.length; j++) {
        const other = items[j];

        if (used.has(other.key)) {
          continue;
        }

        if (near(seed, other)) {
          group.push(other);
          used.add(other.key);
        }
      }

      if (group.length >= SPRAWL_MIN) {
        clusters.push(group);
      }
    }

    return clusters;
  };

  /**
   * @param {string} value
   * @returns {{ key: string, size: number } | null}
   */
  const parseRadius = (value) => {
    const key = value.replace(/\s+/g, " ").trim();

    if (!key || /^(0px\s*)+$/.test(key)) {
      return null;
    }

    const nums = [...key.matchAll(/([\d.]+)px/gi)].map((match) =>
      Number(match[1])
    );

    if (nums.length === 0 || nums.every((n) => n === 0)) {
      return null;
    }

    const size = nums.reduce((sum, n) => sum + n, 0) / nums.length;
    return { key, size };
  };

  /**
   * One box-shadow stack as the browser serialised it. "none" is skipped.
   * Distance uses the first layer's lengths and colour so near-duplicates
   * still cluster when only blur or alpha drifted.
   *
   * @param {string} value
   * @returns {{ key: string, x: number, y: number, blur: number, spread: number, colour: { r: number, g: number, b: number } | null } | null}
   */
  const parseShadow = (value) => {
    const key = value.replace(/\s+/g, " ").trim();

    if (!key || key === "none") {
      return null;
    }

    /* First layer only for clustering — comma-separated stacks stay one
       token by their full key. */
    const layer = key.split(/,(?![^(]*\))/)[0]?.trim() ?? key;
    const colourMatch = layer.match(/rgba?\([^)]+\)/i);
    const colour = colourMatch ? parseColour(colourMatch[0]) : null;
    const nums = [...layer.matchAll(/(-?[\d.]+)px/gi)].map((match) =>
      Number(match[1])
    );

    return {
      key,
      x: nums[0] ?? 0,
      y: nums[1] ?? 0,
      blur: nums[2] ?? 0,
      spread: nums[3] ?? 0,
      colour: colour ? { r: colour.r, g: colour.g, b: colour.b } : null,
    };
  };

  /**
   * @param {{ x: number, y: number, blur: number, spread: number, colour: { r: number, g: number, b: number } | null }} a
   * @param {{ x: number, y: number, blur: number, spread: number, colour: { r: number, g: number, b: number } | null }} b
   */
  const shadowDistance = (a, b) => {
    const lengths = Math.hypot(
      a.x - b.x,
      a.y - b.y,
      a.blur - b.blur,
      a.spread - b.spread
    );
    const colours =
      a.colour && b.colour ? colourDistance(a.colour, b.colour) / 12 : 0;
    return lengths + colours;
  };

  /**
   * @param {string} family
   * @returns {string}
   */
  const primaryFont = (family) =>
    family
      .split(",")[0]
      .trim()
      .replace(/^["']|["']$/g, "");

  /**
   * Whether the first named face in a stack appears to paint. Generic
   * families always count as loaded. For a named face, compare canvas
   * metrics against the stack's fallback alone — `document.fonts.check`
   * can report true for faces that never arrived.
   *
   * @param {string} stack
   * @param {string} primary
   * @returns {boolean}
   */
  const fontFaceLoaded = (stack, primary) => {
    if (GENERIC_FONTS.has(primary.toLowerCase())) {
      return true;
    }

    try {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        return true;
      }

      const sample = "mmmmmmmmmmlli";
      const rest = stack
        .split(",")
        .slice(1)
        .map((part) => part.trim())
        .filter(Boolean);
      const fallback = rest.length > 0 ? rest.join(", ") : "serif";

      context.font = `72px ${stack}`;
      const withStack = context.measureText(sample).width;
      context.font = `72px ${fallback}`;
      const fallbackOnly = context.measureText(sample).width;

      return withStack !== fallbackOnly;
    } catch {
      return true;
    }
  };

  /**
   * @param {Element} element
   * @returns {boolean}
   */
  const isVisible = (element) => {
    if (!(element instanceof HTMLElement) && !(element instanceof SVGElement)) {
      return false;
    }

    if (typeof element.checkVisibility === "function") {
      return element.checkVisibility({
        checkOpacity: true,
        checkVisibilityCSS: true,
        contentVisibilityAuto: true,
        visibilityProperty: true,
      });
    }

    const style = getComputedStyle(element);
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0"
    );
  };

  const run = () => {
    document.getElementById(PANEL_ID)?.remove();
    kraftyClearPointer();

    /** @type {Map<string, { colour: { r: number, g: number, b: number, a: number, key: string }, count: number, element: Element }>} */
    const colours = new Map();
    /** @type {Map<string, { stack: string, primary: string, count: number, loaded: boolean, element: Element }>} */
    const fonts = new Map();
    /** @type {Map<string, { radius: { key: string, size: number }, count: number, element: Element }>} */
    const radii = new Map();
    /** @type {Map<string, { shadow: { key: string, x: number, y: number, blur: number, spread: number, colour: { r: number, g: number, b: number } | null }, count: number, element: Element }>} */
    const shadows = new Map();

    let examined = 0;

    for (const element of document.querySelectorAll("body *")) {
      if (examined >= MAX_ELEMENTS) {
        break;
      }

      if (SKIP_TAGS.has(element.tagName)) {
        continue;
      }

      if (element.closest(".kraftyPanel")) {
        continue;
      }

      if (!isVisible(element)) {
        continue;
      }

      examined += 1;

      const style = getComputedStyle(element);

      for (const property of /** @type {const} */ ([
        "color",
        "backgroundColor",
      ])) {
        const parsed = parseColour(style[property]);

        if (!parsed) {
          continue;
        }

        const existing = colours.get(parsed.key);

        if (existing) {
          existing.count += 1;
        } else {
          colours.set(parsed.key, { colour: parsed, count: 1, element });
        }
      }

      const stack = style.fontFamily.trim();

      if (stack !== "") {
        const primary = primaryFont(stack);
        const existingFont = fonts.get(stack);

        if (existingFont) {
          existingFont.count += 1;
        } else {
          fonts.set(stack, {
            stack,
            primary,
            count: 1,
            loaded: fontFaceLoaded(stack, primary),
            element,
          });
        }
      }

      const radius = parseRadius(style.borderRadius);

      if (radius) {
        const existingRadius = radii.get(radius.key);

        if (existingRadius) {
          existingRadius.count += 1;
        } else {
          radii.set(radius.key, { radius, count: 1, element });
        }
      }

      const shadow = parseShadow(style.boxShadow);

      if (shadow) {
        const existingShadow = shadows.get(shadow.key);

        if (existingShadow) {
          existingShadow.count += 1;
        } else {
          shadows.set(shadow.key, { shadow, count: 1, element });
        }
      }
    }

    const colourRows = [...colours.values()].sort(
      (a, b) => b.count - a.count || a.colour.key.localeCompare(b.colour.key)
    );
    const fontRows = [...fonts.values()].sort(
      (a, b) => b.count - a.count || a.stack.localeCompare(b.stack)
    );
    const radiusRows = [...radii.values()].sort(
      (a, b) => b.count - a.count || a.radius.key.localeCompare(b.radius.key)
    );
    const shadowRows = [...shadows.values()].sort(
      (a, b) => b.count - a.count || a.shadow.key.localeCompare(b.shadow.key)
    );

    const colourClusters = nearClusters(
      colourRows.map((row) => row.colour),
      (a, b) => colourDistance(a, b) <= NEAR_COLOUR
    );
    const radiusClusters = nearClusters(
      radiusRows.map((row) => row.radius),
      (a, b) => Math.abs(a.size - b.size) <= NEAR_RADIUS
    );
    const shadowClusters = nearClusters(
      shadowRows.map((row) => row.shadow),
      (a, b) => shadowDistance(a, b) <= NEAR_SHADOW
    );

    const sprawlColours = colourClusters.reduce(
      (sum, group) => sum + group.length,
      0
    );
    const sprawlRadii = radiusClusters.reduce(
      (sum, group) => sum + group.length,
      0
    );
    const sprawlShadows = shadowClusters.reduce(
      (sum, group) => sum + group.length,
      0
    );
    const fallbackFonts = fontRows.filter((row) => !row.loaded);

    const { panel, body } = kraftyPanel({
      id: PANEL_ID,
      className: "kraftyTokenInformation",
      title: kraftyMessage("checkerToken"),
      onRescan: run,
      onClose: () => {
        panel.remove();
        kraftyClearPointer();
        document.body.classList.remove(BODY_CLASS);
      },
    });

    const { reportText } = kraftyFindings(kraftySection(body, "sectionChecks"));

    reportText(
      "note",
      kraftyMessage("tokenSummary", [
        String(colourRows.length),
        String(fontRows.length),
        String(radiusRows.length),
        String(shadowRows.length),
      ])
    );

    if (colourClusters.length > 0) {
      reportText(
        "note",
        kraftyMessage("tokenPaletteSprawl", [
          String(sprawlColours),
          String(colourClusters.length),
        ])
      );
    }

    if (radiusClusters.length > 0) {
      reportText(
        "note",
        kraftyMessage("tokenRadiusSprawl", [
          String(sprawlRadii),
          String(radiusClusters.length),
        ])
      );
    }

    if (shadowClusters.length > 0) {
      reportText(
        "note",
        kraftyMessage("tokenShadowSprawl", [
          String(sprawlShadows),
          String(shadowClusters.length),
        ])
      );
    }

    if (fallbackFonts.length > 0) {
      reportText("note", kraftyCount("tokenFontFallback", fallbackFonts.length));
    }

    if (examined >= MAX_ELEMENTS) {
      reportText("note", kraftyMessage("tokenSampled", [String(MAX_ELEMENTS)]));
    }

    /**
     * @param {string} sectionKey
     * @param {string} labelKey
     * @param {string} listClass
     * @param {{ label: string, count: number, swatch?: string, element: Element }[]} rows
     * @param {() => string} copy
     */
    const listTokens = (sectionKey, labelKey, listClass, rows, copy) => {
      const section = kraftySection(body, sectionKey);

      kraftyListHead(section, labelKey, kraftyMessage("copyFindings"), copy);

      const list = document.createElement("ul");
      list.className = `kraftyPanelList ${listClass}`;

      for (const row of rows) {
        const item = document.createElement("li");

        if (row.swatch) {
          const swatch = document.createElement("span");
          swatch.className = "kraftyTokenSwatch";
          swatch.style.setProperty("background-color", row.swatch, "important");
          item.appendChild(swatch);
        }

        const value = document.createElement("code");
        value.textContent = row.label;
        item.appendChild(value);

        const count = document.createElement("span");
        count.className = "kraftyPanelCount";
        count.textContent = `× ${row.count}`;
        item.appendChild(count);

        /* Count stays; the first element that used the token is the sample
           the row points at. */
        kraftyPointAt(item, row.element);

        list.appendChild(item);
      }

      section.appendChild(list);
    };

    if (colourRows.length > 0) {
      listTokens(
        "tokenSectionColours",
        "tokenColoursListLabel",
        "kraftyTokenColourList",
        colourRows.map((row) => ({
          label: row.colour.key,
          count: row.count,
          swatch: row.colour.key,
          element: row.element,
        })),
        () =>
          [
            location.href,
            ...colourRows.map((row) => `- ${row.colour.key} × ${row.count}`),
          ].join("\n")
      );
    }

    if (fontRows.length > 0) {
      const section = kraftySection(body, "tokenSectionFonts");

      kraftyListHead(
        section,
        "tokenFontsListLabel",
        kraftyMessage("copyFindings"),
        () =>
          [
            location.href,
            ...fontRows.map((row) => {
              const mark = row.loaded ? "" : " (fallback?)";
              return `- ${row.stack}${mark} × ${row.count}`;
            }),
          ].join("\n")
      );

      const list = document.createElement("ul");
      list.className = "kraftyPanelList kraftyTokenFontList";

      for (const row of fontRows) {
        const item = document.createElement("li");

        const stack = document.createElement("code");
        stack.textContent = row.stack;
        item.appendChild(stack);

        if (!row.loaded) {
          const hint = document.createElement("span");
          hint.className = "kraftyPanelHint";
          hint.textContent = kraftyMessage("tokenFontFallbackHint");
          item.appendChild(hint);
        }

        const count = document.createElement("span");
        count.className = "kraftyPanelCount";
        count.textContent = `× ${row.count}`;
        item.appendChild(count);

        kraftyPointAt(item, row.element);

        list.appendChild(item);
      }

      section.appendChild(list);
    }

    if (radiusRows.length > 0) {
      listTokens(
        "tokenSectionRadii",
        "tokenRadiiListLabel",
        "kraftyTokenValueList kraftyTokenRadiusList",
        radiusRows.map((row) => ({
          label: row.radius.key,
          count: row.count,
          element: row.element,
        })),
        () =>
          [
            location.href,
            ...radiusRows.map((row) => `- ${row.radius.key} × ${row.count}`),
          ].join("\n")
      );
    }

    if (shadowRows.length > 0) {
      listTokens(
        "tokenSectionShadows",
        "tokenShadowsListLabel",
        "kraftyTokenValueList kraftyTokenShadowList",
        shadowRows.map((row) => ({
          label: row.shadow.key,
          count: row.count,
          element: row.element,
        })),
        () =>
          [
            location.href,
            ...shadowRows.map((row) => `- ${row.shadow.key} × ${row.count}`),
          ].join("\n")
      );
    }

    const scanned = document.createElement("p");
    scanned.className = "kraftyPanelNote";
    scanned.textContent = kraftyMessage("panelScannedAt", [
      new Date().toLocaleString(),
    ]);
    body.appendChild(scanned);

    document.body.appendChild(panel);
  };

  void (document.fonts?.ready?.then(run, run) ?? run());
})();
