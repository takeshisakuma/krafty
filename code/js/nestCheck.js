// @ts-check

(() => {
  if (!document.body) {
    return;
  }

  const CUSTOM_CLASS = "kraftyCustomElement";

  for (const marked of document.querySelectorAll(`.${CUSTOM_CLASS}`)) {
    marked.classList.remove(CUSTOM_CLASS);
  }

  if (!document.body.classList.toggle("kraftyNestChecker")) {
    return;
  }

  /* Autonomous custom elements are flow content and phrasing content, so
     they are valid almost anywhere. CSS has no selector for "tag name
     contains a hyphen", so they have to be marked from script and excluded
     by class. Without this, a component based page reports little else:
     on MDN, 25 of 27 findings were custom elements.

     Elements inserted after this runs are not marked. Toggle the checker
     off and on again to re-scan. */
  for (const element of document.body.querySelectorAll("*")) {
    if (element.tagName.includes("-")) {
      element.classList.add(CUSTOM_CLASS);
    }
  }
})();
