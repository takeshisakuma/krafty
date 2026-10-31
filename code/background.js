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
  const tabId = await globalThis.kraftyActiveTabId();

  if (tabId === null) {
    return;
  }

  try {
    /* Reset is not a checker. It re-runs whichever checkers are on, so it
       cannot live in the table a command looks a checker up in. */
    if (command === "reset") {
      await globalThis.kraftyReset(tabId);
      return;
    }

    const checker = globalThis.kraftyCheckers.find(
      (candidate) => candidate.command === command
    );

    if (!checker) {
      return;
    }

    await globalThis.kraftyRunChecker(tabId, checker);
  } catch (error) {
    /* chrome:// pages, the web store, PDFs. Expected, not worth reporting. */
  }
});
