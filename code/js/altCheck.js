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
  }
})();
