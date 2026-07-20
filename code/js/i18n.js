// @ts-check

/* Injected ahead of every checker so they can look up localised strings.

   The checkers run as content scripts, where chrome.i18n is available, but
   they are also executed directly in the test suite, where it is not. The
   fallback returns the key so a missing message is visible rather than
   silently blank. */

globalThis.kraftyMessage = (key, substitutions) =>
  globalThis.chrome?.i18n?.getMessage(key, substitutions) || key;

/* A count and its message, where one of something reads differently from
   several. Every panel needed this and each decided it at the call site,
   which made the "…One" suffix a convention held in six places at once. A
   missing "…One" entry does not fail: kraftyMessage falls back to the key,
   so the mistake ships as a raw identifier on screen. One definition of the
   rule is one place to look, and the obvious home for real plural
   categories if they are ever needed. */
globalThis.kraftyCount = (key, count) =>
  count === 1
    ? globalThis.kraftyMessage(`${key}One`)
    : globalThis.kraftyMessage(key, [String(count)]);
