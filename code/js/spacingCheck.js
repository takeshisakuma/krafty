// @ts-check

/* Text spacing, stressed to the point a reader's own stylesheet is allowed
   to push it: line height 1.5, letter spacing 0.12em, word spacing 0.16em,
   and paragraph spacing of 2em. Clipping and overlap are what the stress is
   for, and both are visible, so this draws and does not count.

   A class on the body, not a backdrop screen. Spacing is not a filter; the
   used values have to change. The panels are a shadow tree whose own
   stylesheet sets its line height, and the host is kept at normal so a
   value set out here cannot inherit in. See content.scss. */

(() => {
  if (!document.body) {
    return;
  }

  document.body.classList.toggle("kraftySpacingChecker");
})();
