// @ts-check

/* The checker table and the injection live in ../checkers.js, because the
   service worker that handles keyboard shortcuts needs them too. */

/* Swap the menu into the browser's language, the same way the manual does.

   This was the one surface left in English. Everything else - the store
   listing, the manual, every finding, every panel - has been in both
   languages for a while, and the eight labels a reader looks at most often
   were not. Eight lines of a language that is not yours is a slow thing to
   scan, which was the complaint that started this. */

for (const element of document.querySelectorAll("[data-i18n]")) {
  const key = element.getAttribute("data-i18n");
  const message = key ? chrome.i18n.getMessage(key) : "";

  /* A missing message leaves the English in the markup rather than blanking
     the element. */
  if (message) {
    element.textContent = message;
  }
}

for (const element of document.querySelectorAll("[data-i18n-aria]")) {
  const key = element.getAttribute("data-i18n-aria");
  const message = key ? chrome.i18n.getMessage(key) : "";

  if (message) {
    element.setAttribute("aria-label", message);
  }
}

document.documentElement.lang = chrome.i18n.getUILanguage();

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

/**
 * @param {string} message
 * @param {"error" | "done"} [tone]
 */
const showStatus = (message, tone = "error") => {
  statusArea.textContent = message;
  statusArea.classList.toggle("statusDone", tone === "done");
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
  button("js-reviewButton").disabled = !enabled;
};

/**
 * Read every findings panel on the page and write one report.
 *
 * Runs in the page. Takes the panels rather than re-deciding anything, so
 * the report says exactly what the panels say and cannot drift from them.
 *
 * @param {{ id: string, title: string }[]} panels
 * @returns {string}
 */
function collectReview(panels) {
  const lines = [location.href, document.title, ""];

  for (const { id, title } of panels) {
    const panel = document.getElementById(id);

    if (!panel) {
      continue;
    }

    lines.push(title);

    /* Item 24: findings live in the panel's shadow root. */
    const root = panel.shadowRoot ?? panel;

    const summary =
      root.querySelector(".kraftyChecksSummary") ??
      root.querySelector(".kraftyPanelSummary");

    if (summary) {
      lines.push(`  ${summary.textContent}`);
    }

    for (const finding of root.querySelectorAll(".kraftyCheck")) {
      lines.push(`  - ${finding.textContent}`);
    }

    /* Nest and leftovers use .kraftyPanelList; the image checker uses
       .kraftyImageList. Both are the detail the panels show, so both belong
       in the pasted report. */
    for (const row of root.querySelectorAll(
      ".kraftyPanelList li, .kraftyImageList li"
    )) {
      lines.push(`  - ${(row.textContent ?? "").replace(/\s+/g, " ").trim()}`);
    }

    /* Heading and landmark keep their map in .kraftyOutline. The indent is
       the shape of the thing - carried as data-krafty-depth because the
       review cannot infer meaning from padding. */
    for (const row of root.querySelectorAll(".kraftyOutlineItem")) {
      const depth =
        Number(/** @type {HTMLElement} */ (row).dataset.kraftyDepth ?? "0") ||
        0;
      const text = (row.textContent ?? "").replace(/\s+/g, " ").trim();
      lines.push(`  - ${"  ".repeat(depth)}${text}`);
    }

    lines.push("");
  }

  /* Alt draws on the page and has no panel, so it is not in the list above.
     The counts are the same images its labels would cover. No images means
     no heading: a heading with nothing under it would read as a verdict. */
  const alt = typeof kraftyAltCensus === "function" ? kraftyAltCensus() : null;

  if (alt && alt.total > 0) {
    lines.push(alt.title);

    for (const line of alt.lines) {
      lines.push(`  - ${line}`);
    }

    lines.push("");
  }

  return lines.join("\n");
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

  for (const { id, bodyClass } of kraftyCheckers) {
    button(id).classList.toggle("active", active.has(bodyClass));
  }
}

/**
 * Draw a local QR of the tab URL. Needs nothing from the page, so it still
 * works when the checkers cannot inject (chrome:// and the like).
 *
 * @param {string} url
 */
function showQr(url) {
  const block = element("js-qrBlock");
  const canvas = element("js-qrCanvas");
  const urlLine = element("js-qrUrl");

  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("Krafty: js-qrCanvas is not a canvas");
  }

  if (!url) {
    block.classList.add("isEmpty");
    urlLine.textContent = "";
    return;
  }

  try {
    const code = kraftyQrGenerate(url);
    code.toCanvas(canvas, { pad: 2 });
    block.classList.remove("isEmpty");
    urlLine.textContent = url;
  } catch (error) {
    block.classList.add("isEmpty");
    urlLine.textContent = "";
  }
}

/* The QR is a view of its own rather than the foot of the menu. Chrome
   stops an action popup at 600px tall, and the two together measured 700px
   (760px with a long address), so the code meant for a phone camera came up
   half behind a scrollbar. Bound before init so it works on a tab the
   checkers cannot reach, where the QR is still worth having. */
const menuView = element("js-menuView");
const qrView = element("js-qrView");
const qrOpenButton = button("js-qrOpenButton");
const qrBackButton = button("js-qrBackButton");

qrOpenButton.addEventListener("click", () => {
  /* Held at the menu's width, so the popup only changes height. */
  document.body.style.width = `${document.body.offsetWidth}px`;
  menuView.hidden = true;
  qrView.hidden = false;
  qrBackButton.focus();
});

qrBackButton.addEventListener("click", () => {
  qrView.hidden = true;
  menuView.hidden = false;
  document.body.style.width = "";
  qrOpenButton.focus();
});

async function init() {
  /* The QR only needs the tab's address. Resolve it before any scripting so
     a restricted page still gets a code the phone can open (or not). */
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  showQr(tab?.url ?? "");

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

  /* One pass, one block to paste.

     A delivery review means turning the reporting checkers on in turn and
     copying their panels. This runs the ones that are off, waits for their
     panels, and puts what they say in one place. Alt has no panel; its
     counts are read afterwards, without drawing the labels.

     There is deliberately no total. "12 issues" reads as a verdict on the
     page, including the parts nothing looked at, which is the single score
     this project refuses further down its roadmap. Each checker names
     itself and says what it found, which claims exactly as much as the
     panels do. */
  button("js-reviewButton").addEventListener("click", async () => {
    clearStatus();

    const reporting = kraftyCheckers.filter((checker) => checker.panelId);

    try {
      const [state] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => (document.body ? Array.from(document.body.classList) : []),
      });

      const active = new Set(state?.result ?? []);

      /* Only the ones that are off. Running a checker that is already on
         would toggle it off and take its panel with it. */
      for (const checker of reporting) {
        if (!active.has(checker.bodyClass)) {
          await kraftyRunChecker(tabId, checker);
        }
      }

      /* Count alts without toggling the overlay. The flag makes this
         injection define kraftyAltCensus and return, so labels that are
         already up stay up, and a review does not cover the pictures. */
      await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          globalThis.kraftyAltCensusOnly = true;
        },
      });

      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ["js/i18n.js", "js/altCheck.js"],
        });
      } finally {
        await chrome.scripting.executeScript({
          target: { tabId },
          func: () => {
            globalThis.kraftyAltCensusOnly = false;
          },
        });
      }

      const [review] = await chrome.scripting.executeScript({
        target: { tabId },
        func: collectReview,
        args: [
          reporting.map((checker) => ({
            id: String(checker.panelId),
            title: button(checker.id).textContent ?? checker.command,
          })),
        ],
      });

      await navigator.clipboard.writeText(String(review?.result ?? ""));

      await syncButtons(tabId);
      showStatus(chrome.i18n.getMessage("popupReviewCopied"), "done");
    } catch (error) {
      showStatus(chrome.i18n.getMessage("popupCannotRun"));
    }
  });
}

init();
