// @ts-check

/* Monochrome, so anything relying on colour alone to be understood has
   nowhere to hide.

   Done with a screen laid over the page rather than a filter on <body>, and
   the difference is not cosmetic. `filter` on an element makes it the
   containing block for every fixed-position descendant inside it, and every
   panel this extension draws is fixed. Greying the body therefore re-anchors
   the panels to the document: measured with the page scrolled 1200px, the
   nest panel went from 418px down the viewport to 1634px, which is to say
   off the screen entirely.

   That was known when there was one panel, and the answer then was to make
   the head checker and this one mutually exclusive - brightness deleted the
   head panel by name on its way in. Four more panels have been built since,
   none of them named there, so those were flung off the page rather than
   removed, and which happened to a panel depended on whether anyone had
   remembered it here. One checker knowing another by name was the bug; the
   fix is that it no longer needs to.

   A fixed screen with backdrop-filter greys everything painted behind it.
   The panels sit above it and are left in colour - which is the right answer
   anyway, since the question is whether the page relies on colour, not
   whether the tool does. */

(() => {
  if (!document.body) {
    return;
  }

  const SCREEN_ID = "js-kraftyBrightnessScreen";
  const BODY_CLASS = "kraftyBrightnessChecker";

  const screen = document.getElementById(SCREEN_ID);

  if (screen) {
    screen.remove();
    document.body.classList.remove(BODY_CLASS);
    return;
  }

  const covering = document.createElement("div");
  covering.id = SCREEN_ID;
  covering.className = "kraftyBrightnessScreen";

  document.body.appendChild(covering);
  document.body.classList.add(BODY_CLASS);
})();
