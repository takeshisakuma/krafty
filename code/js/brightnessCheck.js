// @ts-check

(() => {
  if (!document.body) {
    return;
  }

  /* grayscale() on <body> creates a containing block for fixed-position
     descendants, which would strand the head panel. The two checkers are
     therefore mutually exclusive. */
  document.body.classList.remove("kraftyHeadChecker");

  const panel = document.getElementById("js-kraftyHeadInformation");
  if (panel) {
    panel.remove();
  }

  document.body.classList.toggle("kraftyBrightnessChecker");
})();
