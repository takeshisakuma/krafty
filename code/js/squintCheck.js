// @ts-check

/* The squint test: blur the page until the words go and only the masses are
   left, so the reviewer can see what stands out first and whether the
   hierarchy holds without the text. It decides nothing - the judgement is
   the reader's, which is why this draws and does not report.

   Built exactly as the brightness checker is, and for the same reason: a
   fixed screen with backdrop-filter, never a filter on <body>, which would
   make the body the containing block for every fixed panel and fling them
   off the screen (see js/brightnessCheck.js). The panels sit above the
   screen and stay sharp.

   A screen of its own rather than a mode of the brightness one, so the two
   combine - squinting in monochrome is common - without either checker
   knowing the other exists. */

(() => {
  if (!document.body) {
    return;
  }

  const SCREEN_ID = "js-kraftySquintScreen";
  const BODY_CLASS = "kraftySquintChecker";

  const screen = document.getElementById(SCREEN_ID);

  if (screen) {
    screen.remove();
    document.body.classList.remove(BODY_CLASS);
    return;
  }

  const covering = document.createElement("div");
  covering.id = SCREEN_ID;
  covering.className = "kraftySquintScreen";

  document.body.appendChild(covering);
  document.body.classList.add(BODY_CLASS);
})();
