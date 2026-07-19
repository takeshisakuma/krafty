// @ts-check

/* Keyboard shortcuts.

   A command grants activeTab for the tab it fires on, the same as clicking
   the toolbar icon, so this needs no extra permission.

   Nothing is reported back when a page cannot be scripted. The popup shows a
   message because it has somewhere to put one; a shortcut has no surface,
   and a notification for pressing a key on a settings page would be worse
   than silence. */

importScripts("checkers.js");

chrome.commands.onCommand.addListener(async (command) => {
  const checker = globalThis.kraftyCheckers.find(
    (candidate) => candidate.command === command
  );

  if (!checker) {
    return;
  }

  const tabId = await globalThis.kraftyActiveTabId();

  if (tabId === null) {
    return;
  }

  try {
    await globalThis.kraftyRunChecker(tabId, checker);
  } catch (error) {
    /* chrome:// pages, the web store, PDFs. Expected, not worth reporting. */
  }
});
