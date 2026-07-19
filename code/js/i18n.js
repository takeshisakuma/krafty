// @ts-check

/* Injected ahead of every checker so they can look up localised strings.

   The checkers run as content scripts, where chrome.i18n is available, but
   they are also executed directly in the test suite, where it is not. The
   fallback returns the key so a missing message is visible rather than
   silently blank. */

globalThis.kraftyMessage = (key, substitutions) =>
  globalThis.chrome?.i18n?.getMessage(key, substitutions) || key;
