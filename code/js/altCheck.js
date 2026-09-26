// @ts-check

(() => {
  if (!document.body) {
    return;
  }

  const LABEL_CLASS = "kraftyAltContent";
  const RESCAN_ID = "js-kraftyAltRescan";
  const BODY_CLASS = "kraftyAltChecker";

  /** @type {ReturnType<typeof setTimeout> | null} */
  let scheduled = null;

  /** @type {IntersectionObserver | null} */
  let intersection = null;

  /**
   * @param {Event} event
   */
  const onImageLoad = (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }

    if (!event.target.matches('img, input[type="image"]')) {
      return;
    }

    scheduleRun();
  };

  const stopWatching = () => {
    document.removeEventListener("load", onImageLoad, true);
    intersection?.disconnect();
    intersection = null;

    if (scheduled !== null) {
      clearTimeout(scheduled);
      scheduled = null;
    }
  };

  /** Drop labels and the rescan control. Called when turning off, and before
     a fresh placement so a re-measure never stacks on the last one. */
  const clear = () => {
    for (const label of document.querySelectorAll(`.${LABEL_CLASS}`)) {
      label.remove();
    }

    document.getElementById(RESCAN_ID)?.remove();
  };

  clear();

  /* The watchers to stop are the last injection's, not this one's. Every
     click injects this file again into a fresh scope, so a stopWatching
     from here only ever saw its own nulls, and the observer and load
     listener from turning on outlived turning off: scroll an image into
     view or let one load, and its labels came back on a page with the
     checker off. So the running injection leaves its stop behind. */
  globalThis.kraftyAltStop?.();
  globalThis.kraftyAltStop = undefined;

  if (!document.body.classList.toggle(BODY_CLASS)) {
    return;
  }

  /**
   * @param {Element} image
   * @returns {{ text: string, state: string | null }}
   */
  const describe = (image) => {
    const alt = image.getAttribute("alt");

    if (alt === null) {
      return { text: kraftyMessage("altMissing"), state: "kraftyAltMissing" };
    }
    if (alt.trim() === "") {
      return { text: kraftyMessage("altEmpty"), state: "kraftyAltEmpty" };
    }
    return { text: kraftyMessage("altPresent", [alt]), state: null };
  };

  /* Each image's label, kept across re-measures.

     A re-measure used to remove every label and build them again. The
     IntersectionObserver below reports every image in view as soon as it is
     told to watch them, so that happened 150ms after the checker came on,
     and again on each scroll that brought an image in: a label being read
     on hover was swapped for a fresh folded one under the pointer, and
     snapped shut. So a re-measure moves and rewrites the label it already
     has, and only adds or drops the ones whose image appeared or went. */
  /** @type {Map<Element, HTMLElement>} */
  const placed = new Map();

  /* Place every label from a fresh measurement of the page. The toggle stays
     outside this so pressing rescan does not turn the checker off - the same
     split the findings panels use (item 14). Lazy load and intersection also
     schedule a re-measure; the button remains for anything those miss. */
  const run = () => {
    /* A label kept for an image that is gone, hidden or clipped this time is
       dropped at the end; anything still in this set then is stale. */
    const stale = new Set(placed.values());

    const subjects = [
      ...document.querySelectorAll('img, input[type="image"]'),
      /* Skip the head checker's own preview images. */
    ].filter((image) => !image.classList.contains("headImage"));

    /* Where each image actually is.

       The labels used to be inserted next to their image and positioned
       absolutely with no offsets, which puts them at their static position -
       where the label would have sat had it stayed in the flow. It does not
       stay in the flow, so the next label's static position never advances,
       and a row of images gets every one of its labels stacked at the first.
       Measured on five covers in a flex row: images at 8, 136, 264, 392, 520
       and all five labels at 18. Only the last was visible; the rest were
       under it, unreadable and unhoverable, nowhere near the picture they
       described.

       So the position is measured rather than inherited. This is a snapshot,
       like everything else here - a page that reflows underneath leaves the
       labels where they were, which is why the panels say what time they
       scanned. */
    const bodyIsPositioned =
      getComputedStyle(document.body).position !== "static";
    const bodyBox = bodyIsPositioned
      ? document.body.getBoundingClientRect()
      : null;

    const originX =
      window.scrollX - (bodyBox ? bodyBox.left + window.scrollX : 0);
    const originY =
      window.scrollY - (bodyBox ? bodyBox.top + window.scrollY : 0);

    /* Appending to the body took the labels out of whatever clipped them,
       which a carousel relies on: its off-screen items stay in the document
       at real coordinates and are hidden only by an ancestor's overflow. A
       label for one of those is drawn on top of whatever happens to be at
       those coordinates, and the reported symptom was a section showing the
       alt of every image except the ones on screen.

       So an image that its own page has clipped away gets no label. Read in
       the same pass as everything else, with the ancestors' boxes and styles
       kept, because a page of ninety images shares most of its ancestors. */

    /** @type {Map<Element, { clipsX: boolean, clipsY: boolean, fixed: boolean, box: DOMRect }>} */
    const frames = new Map();

    /** @param {Element} element */
    const frameOf = (element) => {
      let known = frames.get(element);

      if (!known) {
        const styles = getComputedStyle(element);
        known = {
          clipsX: styles.overflowX !== "visible",
          clipsY: styles.overflowY !== "visible",
          fixed: styles.position === "fixed",
          box: element.getBoundingClientRect(),
        };
        frames.set(element, known);
      }
      return known;
    };

    /* Every position here is a document coordinate, which is right for an
       image that scrolls with the page: the label is pinned to the spot on
       the document where the image sat, and the two move together.

       An image fixed to the viewport does not move with the document - a
       banner that rides along as you scroll keeps its place on screen while
       the page runs underneath it. A document-pinned label for one slides
       away the moment you scroll and ends up over whatever the scroll
       brought past, describing the wrong picture. Such a label is fixed to
       the viewport too, at the same coordinates the image holds.

       Fixedness is inherited: an image inside a position: fixed element rides
       the viewport whatever its own position says. So the image and its
       ancestors are checked, reusing the frames already read for the
       clipping test above. */
    /** @param {Element} image */
    const ridesViewport = (image) => {
      if (getComputedStyle(image).position === "fixed") {
        return true;
      }

      for (
        let parent = image.parentElement;
        parent && parent !== document.body;
        parent = parent.parentElement
      ) {
        if (frameOf(parent).fixed) {
          return true;
        }
      }

      return false;
    };

    /**
     * @param {Element} image
     * @param {DOMRect} box
     */
    const outOfSight = (image, box) => {
      if (box.width === 0 || box.height === 0) {
        return true;
      }

      for (
        let parent = image.parentElement;
        parent && parent !== document.body;
        parent = parent.parentElement
      ) {
        const frame = frameOf(parent);

        if (
          frame.clipsX &&
          (box.right <= frame.box.left || box.left >= frame.box.right)
        ) {
          return true;
        }
        if (
          frame.clipsY &&
          (box.bottom <= frame.box.top || box.top >= frame.box.bottom)
        ) {
          return true;
        }
      }

      return false;
    };

    const places = subjects.map((image) => image.getBoundingClientRect());

    /** @type {{ label: HTMLElement, box: DOMRect }[]} */
    const labels = [];

    subjects.forEach((image, index) => {
      if (outOfSight(image, places[index])) {
        return;
      }

      const { text, state } = describe(image);
      const fixed = ridesViewport(image);

      const kept = placed.get(image);
      const label =
        kept && kept.isConnected ? kept : document.createElement("span");
      stale.delete(label);

      label.className = state ? `${LABEL_CLASS} ${state}` : LABEL_CLASS;
      if (fixed) {
        label.classList.add("kraftyAltFixed");
      }
      if (label.textContent !== text) {
        label.textContent = text;
      }

      /* The label shows two lines and opens the rest on hover. The same text
         goes in a title so it is reachable without a pointer, and so it can
         be read at all where the stylesheet did not arrive. */
      label.title = text;

      /* Back to the open width for the measurement below, which a kept label
         was narrowed from last time. Read and rewritten in the same frame,
         so nothing on screen sees it. */
      label.style.removeProperty("--kraftyAltWidth");

      const box = places[index];
      if (fixed) {
        /* Viewport coordinates with no scroll origin added, and position:
           fixed from the stylesheet, so the label keeps its place on screen
           alongside the image instead of being left where the page has
           scrolled past. */
        label.style.left = `${box.left}px`;
        label.style.top = `${box.top}px`;
      } else {
        label.style.left = `${box.left + originX}px`;
        label.style.top = `${box.top + originY}px`;
      }

      /* Appended to the body rather than beside the image, so the coordinates
         resolve against the document instead of whichever ancestor the page
         happens to have positioned. */
      if (label !== kept) {
        document.body.appendChild(label);
        placed.set(image, label);
      }
      labels.push({ label, box });
    });

    for (const label of stale) {
      label.remove();
    }
    for (const [image, label] of placed) {
      if (stale.has(label)) {
        placed.delete(image);
      }
    }

    /* Two numbers per label, handed to the stylesheet.

       The width it may take at rest. A label wider than its own image reaches
       across the one beside it, and in a row of book covers it ends up behind
       that image's label - unreadable, and worse, unhoverable, so the way to
       open it is behind the thing covering it. Folded, a label stays inside
       its own picture's footprint; opened, it is above everything and may
       spread as wide as it likes.

       And the height it wants when open, because max-height has to be a
       length to be transitioned and a fixed one does not work: any value
       large enough for the longest alt is far past what most of them need, so
       the box reaches its content height in the first fraction of the
       duration and the rest plays out invisibly. Measured, that was about
       30ms of 200ms - the snap this replaces, with a duration attached.

       Measured before the width is narrowed, which is deliberate. The
       stylesheet's own 220px is the width a label has when open, so reading
       here gives the height it will actually need then. Measuring after
       narrowing would describe the folded shape, which is taller, and the
       hover would stop short and cut the text.

       One read pass and one write pass. Asking a label for its height and
       then writing to it, over and over, lays the page out once per label,
       and ninety images would pay for that ninety times. */
    /* The widest a label goes when open, matching the stylesheet, and a floor
       so a favicon-sized image still leaves something readable folded. */
    const OPEN_WIDTH = 220;
    const LEAST_WIDTH = 80;

    const measured = labels.map(({ label, box }) => ({
      height: label.scrollHeight,
      width: Math.max(Math.min(Math.round(box.width), OPEN_WIDTH), LEAST_WIDTH),
    }));

    labels.forEach(({ label }, index) => {
      label.style.setProperty("--kraftyAltFull", `${measured[index].height}px`);
      label.style.setProperty("--kraftyAltWidth", `${measured[index].width}px`);
    });
  };

  const watchImages = () => {
    intersection?.disconnect();

    for (const image of document.querySelectorAll(
      'img, input[type="image"]'
    )) {
      if (image.classList.contains("headImage")) {
        continue;
      }

      intersection?.observe(image);
    }
  };

  const runAndWatch = () => {
    run();
    watchImages();
  };

  const scheduleRun = () => {
    if (scheduled !== null) {
      clearTimeout(scheduled);
    }

    /* Short debounce so a burst of loads (a gallery entering view) becomes
       one re-measure rather than one per image. Re-measure only — re-
       observing here would re-fire IntersectionObserver and loop. */
    scheduled = setTimeout(() => {
      scheduled = null;
      run();
    }, 150);
  };

  /* A control without a findings panel: alt draws on the page and has
     nothing to paste into a review, so it must not take a panelId. The
     button is the half of item 14 the panels get for free. */
  const rescan = document.createElement("button");
  rescan.id = RESCAN_ID;
  rescan.type = "button";
  rescan.className = "kraftyAltRescan";
  rescan.textContent = "↻";
  rescan.title = kraftyMessage("panelRescan");
  rescan.addEventListener("click", (event) => {
    event.stopPropagation();
    runAndWatch();
  });
  document.body.appendChild(rescan);

  /* Capture-phase load: lazy images fire load when they decode after
     entering view. IntersectionObserver catches the enter itself so labels
     appear even before decode finishes, then load re-measures once sizes
     are known. Not a MutationObserver - that is the Known limitation still
     declined for self-write loops. */
  document.addEventListener("load", onImageLoad, true);
  globalThis.kraftyAltStop = stopWatching;

  intersection = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        scheduleRun();
      }
    },
    { rootMargin: "100px" }
  );

  runAndWatch();
})();
