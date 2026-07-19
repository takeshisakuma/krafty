// @ts-check

/* Swaps the manual page into the browser's language.

   The markup carries the English, so the page still reads correctly if this
   never runs, and a missing message leaves the English in place rather than
   blanking the element. */

for (const element of document.querySelectorAll("[data-i18n]")) {
  const key = element.getAttribute("data-i18n");
  const message = key ? chrome.i18n.getMessage(key) : "";

  if (message) {
    element.textContent = message;
  }
}

/* The head checker flags a document with no lang, so this page should not be
   one - and the right value is only known once the language is. */
document.documentElement.lang = chrome.i18n.getUILanguage();
