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

  /** @type {HTMLElement[]} */
  const labels = [];

  for (const image of document.querySelectorAll('img, input[type="image"]')) {
    /* Skip the head checker's own preview images. */
    if (image.classList.contains("headImage")) {
      continue;
    }

    const { text, state } = describe(image);

    const label = document.createElement("span");
    label.className = state ? `${LABEL_CLASS} ${state}` : LABEL_CLASS;
    label.textContent = text;

    /* The label shows two lines and opens the rest on hover. The same text
       goes in a title so it is reachable without a pointer, and so it can
       be read at all where the stylesheet did not arrive. */
    label.title = text;

    /* insertAdjacentElement, not insertAdjacentHTML: a <p> would be dropped
       when the image sits inside a <p>, and alt text must not be parsed as
       markup. A <span> is phrasing content, so it is valid wherever an
       <img> is. */
    image.insertAdjacentElement("beforebegin", label);
    labels.push(label);
  }

  /* How tall each label wants to be, handed to the stylesheet so the hover
     can animate to it.

     A fixed target does not work. max-height has to be a length to be
     transitioned, and any length large enough for the longest alt is far
     past what most of them need - the box reaches its content height in the
     first fraction of the transition and the rest of the duration plays out
     invisibly. On a product name it finished in about 30ms of 200ms, which
     is the snap this is meant to replace.

     Read and write in separate passes. Asking one label for its height and
     then writing to it, over and over, makes the browser lay the page out
     once per label; a page of ninety images would pay for that ninety
     times. Every read first, then every write, costs one. */
  const wanted = labels.map((label) => label.scrollHeight);

  labels.forEach((label, index) => {
    label.style.setProperty("--kraftyAltFull", `${wanted[index]}px`);
  });
})();
