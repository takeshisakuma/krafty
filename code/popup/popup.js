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

const statusArea = document.getElementById("js-status");

const showStatus = (message) => {
  statusArea.textContent = message;
  statusArea.hidden = false;
};

const clearStatus = () => {
  statusArea.textContent = "";
  statusArea.hidden = true;
};

const setEnabled = (enabled) => {
  for (const { id } of CHECKERS) {
    document.getElementById(id).disabled = !enabled;
  }
};

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || tab.id === undefined || tab.id === chrome.tabs.TAB_ID_NONE) {
    throw new Error("No active tab.");
  }
  return tab;
}

/* Inject content.css once per page load rather than declaring a content
   script for <all_urls>, which would demand host permission for every site
   the user visits. */
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

/* Read the state back off the page instead of tracking it in the popup: the
   popup is rebuilt from scratch every time it opens, so any state kept here
   would silently drift out of sync with the page. */
async function syncButtons(tabId) {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => (document.body ? Array.from(document.body.classList) : []),
  });

  const active = new Set(injection?.result ?? []);

  for (const { id, bodyClass } of CHECKERS) {
    document.getElementById(id).classList.toggle("active", active.has(bodyClass));
  }
}

async function init() {
  let tab;

  try {
    tab = await getActiveTab();
    await ensureStyles(tab.id);
    await syncButtons(tab.id);
  } catch (error) {
    setEnabled(false);
    showStatus("Krafty cannot run on this page.");
    return;
  }

  for (const checker of CHECKERS) {
    document.getElementById(checker.id).addEventListener("click", async () => {
      clearStatus();

      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: checker.allFrames },
          files: [checker.file],
        });
        await syncButtons(tab.id);
      } catch (error) {
        showStatus("Krafty cannot run on this page.");
      }
    });
  }
}

init();
