// @ts-check

/* Stand-ins for a screenshot. Text, field values and pictures are swapped
   for something the same shape, so a capture does not carry a name, a
   sentence or a picture that was not meant to leave the machine. Spaces
   stay, and a wide character stays wide, so the lines wrap where they did.

   Turning it off puts the originals back. They are kept in this page, not
   sent anywhere.

   A canvas, a video frame and a document this script cannot open still
   paint their real pixels, so each is covered with a patch of the same
   box. The patch is labelled: a plain grey rectangle would look like the
   design, and the point of the mode is that a person can see what was not
   rewritten. An inline drawing is left. It is paths, not a photograph, and
   blanking every icon would throw the layout's chrome away.

   No panel. The review runs every checker that has one, and this must not
   be what a copied review describes or what it does to the live page.

   Each injection is a fresh scope, so the running one leaves its restore
   behind, the same reason the alt checker leaves kraftyAltStop. */

(() => {
  const BODY_CLASS = "kraftyDummyChecker";

  if (!document.body) {
    return;
  }

  if (typeof globalThis.kraftyDummyStop === "function") {
    globalThis.kraftyDummyStop();
    globalThis.kraftyDummyStop = undefined;
    return;
  }

  document.body.classList.add(BODY_CLASS);
  globalThis.kraftyDummyStop = start();

  /**
   * @returns {() => void}
   */
  function start() {
    const XLINK = "http://www.w3.org/1999/xlink";

    /* One stand-in tile. The marker is how a later pass tells its own
       pixels from a picture the page put back. */
    const swatch = `data:image/svg+xml,${encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" data-krafty-dummy="1"><rect width="8" height="8" fill="#e6e6e6"/><path d="M0 8 L8 0" stroke="#d0d0d0" stroke-width="2"/></svg>'
    )}`;

    const WIDE =
      /[\u1100-\u115F\u2329\u232A\u2E80-\u303E\u3040-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE10-\uFE19\uFE30-\uFE6F\uFF01-\uFF60\uFFE0-\uFFE6]/u;

    const TEXT_TYPES = new Set([
      "text",
      "search",
      "email",
      "tel",
      "url",
      "password",
      "number",
      "date",
      "time",
      "datetime-local",
      "month",
      "week",
    ]);

    /** @type {Map<Text, string>} */
    const textOriginals = new Map();

    /** @type {WeakMap<HTMLInputElement | HTMLTextAreaElement, string>} */
    const valueOriginals = new WeakMap();

    /** @type {WeakMap<HTMLInputElement | HTMLTextAreaElement, string>} */
    const placeholderOriginals = new WeakMap();

    /** @type {WeakSet<Element>} */
    const imagesRecorded = new WeakSet();

    /** @type {WeakSet<Element>} */
    const backgroundsRecorded = new WeakSet();

    /** @type {Array<() => void>} */
    const undos = [];

    /** @type {Map<Element, HTMLDivElement>} */
    const covers = new Map();

    let stopped = false;
    let busy = false;
    let scheduled = false;

    /**
     * Krafty's own UI sits in the page and must stay readable, including
     * the patches this checker adds. The body class is the checker's, so
     * the walk stops there: a class on the body would otherwise hide
     * every word under it. Classes this adds to the page's own elements
     * are data attributes, not krafty* classes, so they do not count.
     *
     * @param {Node} node
     */
    const isOurs = (node) => {
      /** @type {Node | null} */
      let current = node;

      while (current) {
        if (current instanceof ShadowRoot) {
          current = current.host;
          continue;
        }

        if (current === document.body || current === document.documentElement) {
          return false;
        }

        if (current instanceof Element) {
          for (const value of current.classList) {
            if (value.startsWith("krafty")) {
              return true;
            }
          }
        }

        current = current.parentNode;
      }

      return false;
    };

    /**
     * @param {Element} element
     */
    const shown = (element) => {
      if (
        !element.checkVisibility({
          contentVisibilityAuto: true,
          visibilityProperty: true,
          opacityProperty: true,
        })
      ) {
        return false;
      }

      const rect = element.getBoundingClientRect();

      return rect.width >= 1 && rect.height >= 1;
    };

    /**
     * @param {string} text
     */
    const dummy = (text) => {
      let out = "";

      for (const char of text) {
        if (/\s/u.test(char) || /[\u200B-\u200D\uFE0E\uFE0F\u2060]/u.test(char)) {
          out += char;
          continue;
        }

        const code = char.codePointAt(0) ?? 0;

        out += WIDE.test(char) || code >= 0x1f000 ? "あ" : "x";
      }

      return out;
    };

    /**
     * @param {number} width
     * @param {number} height
     */
    const boxImage = (width, height) => {
      const w = Math.max(1, Math.round(width));
      const h = Math.max(1, Math.round(height));
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" data-krafty-dummy="1"><rect width="100%" height="100%" fill="#e6e6e6"/><path d="M0 ${h} L${w} 0" stroke="#d0d0d0" stroke-width="8"/></svg>`;

      return `data:image/svg+xml,${encodeURIComponent(svg)}`;
    };

    /**
     * A url() can itself contain parentheses, so a single regex stops early
     * and would leave the real address in the value.
     *
     * @param {string} value
     */
    const replaceUrls = (value) => {
      let out = "";
      let index = 0;

      while (index < value.length) {
        const at = value.indexOf("url(", index);

        if (at === -1) {
          out += value.slice(index);
          break;
        }

        out += value.slice(index, at);

        let cursor = at + 4;
        const quote = value[cursor] === '"' || value[cursor] === "'" ? value[cursor] : "";

        if (quote) {
          cursor += 1;
          const end = value.indexOf(quote, cursor);
          cursor = end === -1 ? value.length : end + 1;
        }

        const close = value.indexOf(")", cursor);
        cursor = close === -1 ? value.length : close + 1;
        out += `url("${swatch}")`;
        index = cursor;
      }

      return out;
    };

    /**
     * @param {Text} text
     */
    const redactText = (text) => {
      if (!text.nodeValue || isOurs(text)) {
        return;
      }

      if (!textOriginals.has(text)) {
        textOriginals.set(text, text.nodeValue);
      }

      const next = dummy(textOriginals.get(text) ?? "");

      if (text.nodeValue !== next) {
        text.nodeValue = next;
      }
    };

    /**
     * @param {Node} root
     */
    const eachText = (root) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;

          if (!parent) {
            return NodeFilter.FILTER_REJECT;
          }

          const tag = parent.tagName;

          if (
            tag === "SCRIPT" ||
            tag === "STYLE" ||
            tag === "NOSCRIPT" ||
            tag === "TEXTAREA"
          ) {
            return NodeFilter.FILTER_REJECT;
          }

          if (isOurs(node)) {
            return NodeFilter.FILTER_REJECT;
          }

          return NodeFilter.FILTER_ACCEPT;
        },
      });

      while (walker.nextNode()) {
        const current = walker.currentNode;

        if (current instanceof Text) {
          redactText(current);
        }
      }

      if (root instanceof Element || root instanceof ShadowRoot) {
        for (const host of root.querySelectorAll("*")) {
          if (host.shadowRoot && !isOurs(host)) {
            eachText(host.shadowRoot);
          }
        }
      }
    };

    /**
     * @param {HTMLInputElement | HTMLTextAreaElement} control
     */
    const redactValue = (control) => {
      if (!valueOriginals.has(control)) {
        const original = control.value;
        valueOriginals.set(control, original);
        undos.push(() => {
          control.value = original;
        });
      }

      const next = dummy(valueOriginals.get(control) ?? "");

      /* A number or date field rejects letters and clears itself. Forcing
         the stand-in again would fight that clearing on every pass. An
         empty field shows nothing, which is the leak closed. A value the
         page writes back is still replaced. */
      if (control.value === next || (control.value === "" && next !== "")) {
        return;
      }

      control.value = next;
    };

    /**
     * @param {HTMLInputElement | HTMLTextAreaElement} control
     */
    const redactPlaceholder = (control) => {
      if (!control.placeholder && !placeholderOriginals.has(control)) {
        return;
      }

      if (!placeholderOriginals.has(control)) {
        const original = control.placeholder;
        placeholderOriginals.set(control, original);
        undos.push(() => {
          control.placeholder = original;
        });
      }

      const next = dummy(placeholderOriginals.get(control) ?? "");

      if (control.placeholder !== next) {
        control.placeholder = next;
      }
    };

    /**
     * @param {Element} element
     */
    const redactControl = (element) => {
      if (element instanceof HTMLTextAreaElement) {
        redactValue(element);
        redactPlaceholder(element);
        return;
      }

      if (!(element instanceof HTMLInputElement)) {
        return;
      }

      if (TEXT_TYPES.has(element.type)) {
        redactValue(element);
        redactPlaceholder(element);
        return;
      }

      if (
        (element.type === "submit" ||
          element.type === "button" ||
          element.type === "reset") &&
        element.value
      ) {
        redactValue(element);
      }
    };

    /**
     * @param {Element} element
     * @param {string} name
     * @param {string | null} value
     */
    const restoreAttr = (element, name, value) => {
      if (value === null) {
        element.removeAttribute(name);
      } else {
        element.setAttribute(name, value);
      }
    };

    /**
     * Lock the box before the source changes. An image with no width of its
     * own takes its size from the file, so a stand-in of a different
     * intrinsic size would reflow the page. The lock is the rendered box,
     * not the file's pixel size.
     *
     * @param {HTMLImageElement | HTMLInputElement} image
     */
    const redactImage = (image) => {
      if (!shown(image)) {
        return;
      }

      const src = image.getAttribute("src") ?? "";
      const picture =
        image.parentElement instanceof HTMLPictureElement ? image.parentElement : null;
      const sources = picture ? [...picture.querySelectorAll("source")] : [];
      const sourceLeaks = sources.some((source) => {
        const srcset = source.getAttribute("srcset") ?? "";

        return srcset !== "" && !srcset.includes("krafty-dummy");
      });

      if (src.includes("krafty-dummy") && !sourceLeaks && !image.getAttribute("srcset")) {
        return;
      }

      const rect = image.getBoundingClientRect();

      if (!imagesRecorded.has(image)) {
        imagesRecorded.add(image);

        const saved = {
          src: image.getAttribute("src"),
          srcset: image.getAttribute("srcset"),
          sizes: image.getAttribute("sizes"),
          alt: image.getAttribute("alt"),
          width: image.style.width,
          height: image.style.height,
          maxWidth: image.style.maxWidth,
          maxHeight: image.style.maxHeight,
          sources: sources.map((source) => ({
            source,
            srcset: source.getAttribute("srcset"),
          })),
        };

        undos.push(() => {
          restoreAttr(image, "src", saved.src);
          restoreAttr(image, "srcset", saved.srcset);
          restoreAttr(image, "sizes", saved.sizes);
          restoreAttr(image, "alt", saved.alt);
          image.style.width = saved.width;
          image.style.height = saved.height;
          image.style.maxWidth = saved.maxWidth;
          image.style.maxHeight = saved.maxHeight;

          for (const item of saved.sources) {
            restoreAttr(item.source, "srcset", item.srcset);
          }
        });
      }

      image.style.width = `${rect.width}px`;
      image.style.height = `${rect.height}px`;
      image.style.maxWidth = "none";
      image.style.maxHeight = "none";
      image.removeAttribute("srcset");
      image.removeAttribute("sizes");

      for (const source of sources) {
        source.removeAttribute("srcset");
      }

      image.setAttribute("src", boxImage(rect.width, rect.height));

      const alt = image.getAttribute("alt");

      if (alt) {
        image.setAttribute("alt", dummy(alt));
      }
    };

    /**
     * @param {Element} element
     */
    const redactSvgImage = (element) => {
      if (element.localName !== "image" || element instanceof HTMLImageElement) {
        return;
      }

      if (!shown(element)) {
        return;
      }

      const href = element.getAttribute("href");
      const xlink = element.getAttributeNS(XLINK, "href");
      const current = href || xlink || "";

      if (current === "" || current.startsWith("#") || current.includes("krafty-dummy")) {
        return;
      }

      const rect = element.getBoundingClientRect();

      if (!imagesRecorded.has(element)) {
        imagesRecorded.add(element);
        undos.push(() => {
          restoreAttr(element, "href", href);
          if (xlink === null) {
            element.removeAttributeNS(XLINK, "href");
          } else {
            element.setAttributeNS(XLINK, "href", xlink);
          }
        });
      }

      element.setAttribute("href", boxImage(rect.width, rect.height));
      element.removeAttributeNS(XLINK, "href");
    };

    /**
     * @param {Element} element
     */
    const redactBackground = (element) => {
      if (!(element instanceof HTMLElement)) {
        return;
      }

      if (element.style.backgroundImage.includes("krafty-dummy")) {
        return;
      }

      const computed = getComputedStyle(element).backgroundImage;

      if (!computed.includes("url(") || computed.includes("krafty-dummy")) {
        return;
      }

      const previous = element.style.backgroundImage;
      const priority = element.style.getPropertyPriority("background-image");

      element.style.setProperty("background-image", replaceUrls(computed), "important");

      if (!backgroundsRecorded.has(element)) {
        backgroundsRecorded.add(element);
        undos.push(() => {
          if (previous) {
            element.style.setProperty("background-image", previous, priority);
          } else {
            element.style.removeProperty("background-image");
          }
        });
      }
    };

    /**
     * Quoted generated text is visible, so it is swapped too. Counters and
     * attr() are left: there is no single string to measure, and inventing
     * one would be a guess. A background url on the same pseudo is a picture.
     *
     * @param {Element} element
     * @param {"::before" | "::after"} side
     */
    const redactPseudo = (element, side) => {
      if (!(element instanceof HTMLElement)) {
        return;
      }

      const style = getComputedStyle(element, side);
      const before = side === "::before";
      const textKey = before ? "kraftyDummyBefore" : "kraftyDummyAfter";
      const imageKey = before ? "kraftyDummyBeforeImage" : "kraftyDummyAfterImage";
      const variable = before ? "--krafty-dummy-before" : "--krafty-dummy-after";
      const content = style.content;
      const match = /^"([\s\S]*)"$/.exec(content);

      if (match && match[1] !== "" && !element.dataset[textKey]) {
        let text = match[1];

        try {
          const parsed = JSON.parse(content);

          if (typeof parsed === "string") {
            text = parsed;
          }
        } catch {
          /* A CSS escape is not JSON. The sliced string still hides the words. */
        }

        element.style.setProperty(variable, JSON.stringify(dummy(text)));
        element.dataset[textKey] = "1";
        undos.push(() => {
          delete element.dataset[textKey];
          element.style.removeProperty(variable);
        });
      }

      if (
        style.backgroundImage.includes("url(") &&
        !style.backgroundImage.includes("krafty-dummy") &&
        !element.dataset[imageKey]
      ) {
        element.style.setProperty("--krafty-dummy-swatch", `url("${swatch}")`);
        element.dataset[imageKey] = "1";
        undos.push(() => {
          delete element.dataset[imageKey];
          element.style.removeProperty("--krafty-dummy-swatch");
        });
      }
    };

    /**
     * @param {HTMLIFrameElement | HTMLObjectElement} frame
     */
    const canRead = (frame) => {
      try {
        return frame.contentDocument !== null;
      } catch {
        return false;
      }
    };

    /**
     * @param {Element} element
     */
    const coverKey = (element) => {
      if (element instanceof HTMLCanvasElement) {
        return "dummyCoverCanvas";
      }

      if (element instanceof HTMLVideoElement) {
        return "dummyCoverVideo";
      }

      if (element instanceof HTMLInputElement && element.type === "file") {
        return "dummyCoverFile";
      }

      if (
        element instanceof HTMLIFrameElement ||
        element instanceof HTMLObjectElement ||
        element instanceof HTMLEmbedElement
      ) {
        return "dummyCoverFrame";
      }

      return null;
    };

    /**
     * @param {Element} element
     * @param {Set<Element>} wanted
     */
    const noteCover = (element, wanted) => {
      const key = coverKey(element);

      if (!key || !shown(element)) {
        return;
      }

      if (
        (element instanceof HTMLIFrameElement || element instanceof HTMLObjectElement) &&
        canRead(element)
      ) {
        return;
      }

      if (element instanceof HTMLObjectElement && !element.getAttribute("data")) {
        return;
      }

      if (element instanceof HTMLEmbedElement && !element.getAttribute("src")) {
        return;
      }

      if (element instanceof HTMLInputElement && element.value === "") {
        return;
      }

      wanted.add(element);
    };

    /**
     * @param {Set<Element>} wanted
     */
    const settleCovers = (wanted) => {
      for (const element of wanted) {
        if (covers.has(element)) {
          continue;
        }

        const mask = document.createElement("div");
        const key = coverKey(element);

        mask.className = "kraftyDummyMask";
        mask.dataset.label = kraftyMessage(key ?? "dummyCoverFrame");
        mask.setAttribute("aria-hidden", "true");
        mask.style.position = "fixed";
        mask.style.zIndex = "2147483646";
        mask.style.pointerEvents = "none";
        mask.style.boxSizing = "border-box";
        document.body.append(mask);
        covers.set(element, mask);
      }

      for (const [element, mask] of covers) {
        if (wanted.has(element) && element.isConnected) {
          continue;
        }

        mask.remove();
        covers.delete(element);
      }
    };

    const place = () => {
      for (const [element, mask] of covers) {
        const rect = element.getBoundingClientRect();

        if (rect.width < 1 || rect.height < 1) {
          mask.hidden = true;
          continue;
        }

        mask.hidden = false;
        mask.style.left = `${rect.left}px`;
        mask.style.top = `${rect.top}px`;
        mask.style.width = `${rect.width}px`;
        mask.style.height = `${rect.height}px`;
      }
    };

    /**
     * @param {Element} element
     * @param {Set<Element>} wanted
     */
    const consider = (element, wanted) => {
      redactControl(element);

      if (element instanceof HTMLImageElement) {
        redactImage(element);
      } else if (element instanceof HTMLInputElement && element.type === "image") {
        redactImage(element);
      } else {
        redactSvgImage(element);
      }

      redactBackground(element);
      redactPseudo(element, "::before");
      redactPseudo(element, "::after");
      noteCover(element, wanted);
    };

    /**
     * @param {ParentNode} root
     * @param {Set<Element>} wanted
     */
    const walk = (root, wanted) => {
      for (const element of root.querySelectorAll("*")) {
        if (isOurs(element)) {
          continue;
        }

        consider(element, wanted);

        if (element.shadowRoot) {
          walk(element.shadowRoot, wanted);
        }
      }
    };

    /**
     * @param {Set<Element>} wanted
     */
    const pass = (wanted) => {
      eachText(document.body);
      consider(document.documentElement, wanted);
      consider(document.body, wanted);
      walk(document.body, wanted);
      settleCovers(wanted);
    };

    const apply = () => {
      if (busy || stopped) {
        return;
      }

      busy = true;

      try {
        pass(new Set());
        place();
      } finally {
        busy = false;
      }
    };

    const schedule = () => {
      if (scheduled || stopped) {
        return;
      }

      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;

        if (!stopped) {
          apply();
        }
      });
    };

    const observer = new MutationObserver(() => {
      schedule();
    });

    /**
     * @param {Event} event
     */
    const onLoad = (event) => {
      const target = event.target;

      if (target instanceof HTMLImageElement || target instanceof HTMLVideoElement) {
        schedule();
      }
    };

    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["src", "srcset", "href", "placeholder"],
    });
    document.addEventListener("load", onLoad, true);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);

    const timer = window.setInterval(schedule, 500);

    apply();

    return () => {
      if (stopped) {
        return;
      }

      stopped = true;
      observer.disconnect();
      window.clearInterval(timer);
      document.removeEventListener("load", onLoad, true);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      busy = true;

      for (const [node, text] of textOriginals) {
        node.nodeValue = text;
      }

      textOriginals.clear();

      for (const undo of undos) {
        undo();
      }

      for (const mask of covers.values()) {
        mask.remove();
      }

      covers.clear();
      document.body?.classList.remove(BODY_CLASS);
    };
  }
})();
