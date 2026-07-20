// @ts-check

(() => {
  if (!document.body) {
    return;
  }

  const LABEL_CLASS = "kraftyAltContent";

  for (const label of document.querySelectorAll(`.${LABEL_CLASS}`)) {
    label.remove();
  }

  if (!document.body.classList.toggle("kraftyAltChecker")) {
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

  const originX = window.scrollX - (bodyBox ? bodyBox.left + window.scrollX : 0);
  const originY = window.scrollY - (bodyBox ? bodyBox.top + window.scrollY : 0);

  /* Appending to the body took the labels out of whatever clipped them,
     which a carousel relies on: its off-screen items stay in the document
     at real coordinates and are hidden only by an ancestor's overflow. A
     label for one of those is drawn on top of whatever happens to be at
     those coordinates, and the reported symptom was a section showing the
     alt of every image except the ones on screen.

     So an image that its own page has clipped away gets no label. Read in
     the same pass as everything else, with the ancestors' boxes and styles
     kept, because a page of ninety images shares most of its ancestors. */

  /** @type {Map<Element, { clipsX: boolean, clipsY: boolean, box: DOMRect }>} */
  const frames = new Map();

  /** @param {Element} element */
  const frameOf = (element) => {
    let known = frames.get(element);

    if (!known) {
      const styles = getComputedStyle(element);
      known = {
        clipsX: styles.overflowX !== "visible",
        clipsY: styles.overflowY !== "visible",
        box: element.getBoundingClientRect(),
      };
      frames.set(element, known);
    }
    return known;
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

    const label = document.createElement("span");
    label.className = state ? `${LABEL_CLASS} ${state}` : LABEL_CLASS;
    label.textContent = text;

    /* The label shows two lines and opens the rest on hover. The same text
       goes in a title so it is reachable without a pointer, and so it can
       be read at all where the stylesheet did not arrive. */
    label.title = text;

    const box = places[index];
    label.style.left = `${box.left + originX}px`;
    label.style.top = `${box.top + originY}px`;

    /* Appended to the body rather than beside the image, so the coordinates
       resolve against the document instead of whichever ancestor the page
       happens to have positioned. */
    document.body.appendChild(label);
    labels.push({ label, box });
  });

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
})();
