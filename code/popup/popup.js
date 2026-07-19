// @ts-check

/* The checker table and the injection live in ../checkers.js, because the
   service worker that handles keyboard shortcuts needs them too. */

const statusArea = element("js-status");

/**
 * Throws rather than returning null: every id here is in popup.html, so a
 * miss means the markup and this file disagree, and failing loudly beats a
 * button that quietly does nothing.
 *
 * @param {string} id
 * @returns {HTMLElement}
 */
function element(id) {
  const found = document.getElementById(id);

  if (!found) {
    throw new Error(`Krafty: no element with id ${id}`);
  }
  return found;
}

/**
 * @param {string} id
 * @returns {HTMLButtonElement}
 */
function button(id) {
  const found = element(id);

  if (!(found instanceof HTMLButtonElement)) {
    throw new Error(`Krafty: element ${id} is not a button`);
  }
  return found;
}

/** @param {string} message */
const showStatus = (message) => {
  statusArea.textContent = message;
  statusArea.hidden = false;
};

const clearStatus = () => {
  statusArea.textContent = "";
  statusArea.hidden = true;
};

/** @param {boolean} enabled */
const setEnabled = (enabled) => {
  for (const { id } of kraftyCheckers) {
    button(id).disabled = !enabled;
  }
};

/**
 * Read the state back off the page instead of tracking it in the popup:
 * the popup is rebuilt from scratch every time it opens, so any state kept
 * here would silently drift out of sync with the page.
 *
 * @param {number} tabId
 */
async function syncButtons(tabId) {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => (document.body ? Array.from(document.body.classList) : []),
  });

  const active = new Set(injection?.result ?? []);

  for (const { id, bodyClass } of kraftyCheckers) {
    button(id).classList.toggle("active", active.has(bodyClass));
  }
}

async function init() {
  /** @type {number} */
  let tabId;

  try {
    const found = await kraftyActiveTabId();

    if (found === null) {
      throw new Error("No active tab.");
    }
    tabId = found;

    await kraftyEnsureStyles(tabId);
    await syncButtons(tabId);
  } catch (error) {
    setEnabled(false);
    showStatus(chrome.i18n.getMessage("popupCannotRun"));
    return;
  }

  for (const checker of kraftyCheckers) {
    button(checker.id).addEventListener("click", async () => {
      clearStatus();

      try {
        await kraftyRunChecker(tabId, checker);
        await syncButtons(tabId);
      } catch (error) {
        showStatus(chrome.i18n.getMessage("popupCannotRun"));
      }
    });
  }
}

init();
