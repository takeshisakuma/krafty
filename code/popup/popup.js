// @ts-check

/**
 * @typedef {object} Checker
 * @property {string} id Element id of the button that toggles it.
 * @property {string} file Script injected into the page.
 * @property {string} bodyClass Class the script toggles on <body>.
 * @property {boolean} allFrames Whether subframes are checked too.
 */

/** @type {Checker[]} */
const CHECKERS = [
  {
    id: "js-headCheckButton",
    file: "js/headCheck.js",
    bodyClass: "kraftyHeadChecker",
    /* The head of a subframe is not the head the user is auditing. */
    allFrames: false,
  },
  {
    id: "js-nestCheckButton",
    file: "js/nestCheck.js",
    bodyClass: "kraftyNestChecker",
    allFrames: true,
  },
  {
    id: "js-outlineCheckButton",
    file: "js/outlineCheck.js",
    bodyClass: "kraftyOutlineChecker",
    allFrames: true,
  },
  {
    id: "js-altCheckButton",
    file: "js/altCheck.js",
    bodyClass: "kraftyAltChecker",
    allFrames: true,
  },
  {
    id: "js-brightnessCheckButton",
    file: "js/brightnessCheck.js",
    bodyClass: "kraftyBrightnessChecker",
    allFrames: false,
  },
];

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

const statusArea = element("js-status");

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
  for (const { id } of CHECKERS) {
    button(id).disabled = !enabled;
  }
};

/** @returns {Promise<number>} */
async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || tab.id === undefined || tab.id === chrome.tabs.TAB_ID_NONE) {
    throw new Error("No active tab.");
  }
  return tab.id;
}

/**
 * Inject content.css once per page load rather than declaring a content
 * script for <all_urls>, which would demand host permission for every site
 * the user visits.
 *
 * @param {number} tabId
 */
async function ensureStyles(tabId) {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const root = document.documentElement;
      const already = root.dataset.kraftyStyled === "1";
      root.dataset.kraftyStyled = "1";
      return already;
    },
  });

  if (!injection?.result) {
    await chrome.scripting.insertCSS({
      target: { tabId, allFrames: true },
      files: ["content.css"],
    });
  }
}

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

  for (const { id, bodyClass } of CHECKERS) {
    button(id).classList.toggle("active", active.has(bodyClass));
  }
}

async function init() {
  /** @type {number} */
  let tabId;

  try {
    tabId = await getActiveTabId();
    await ensureStyles(tabId);
    await syncButtons(tabId);
  } catch (error) {
    setEnabled(false);
    showStatus(chrome.i18n.getMessage("popupCannotRun"));
    return;
  }

  for (const checker of CHECKERS) {
    button(checker.id).addEventListener("click", async () => {
      clearStatus();

      try {
        await chrome.scripting.executeScript({
          target: { tabId, allFrames: checker.allFrames },
          /* i18n.js runs first, in the same context, so the checker can
             look up localised strings. */
          files: ["js/i18n.js", checker.file],
        });
        await syncButtons(tabId);
      } catch (error) {
        showStatus(chrome.i18n.getMessage("popupCannotRun"));
      }
    });
  }
}

init();
