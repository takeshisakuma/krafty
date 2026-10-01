// @ts-check

/* The checker table and the code that runs one, shared by the popup and the
   service worker.

   `panelId` marks the checkers that report findings, which is what the
   popup's review button collects. Five without one - outline, brightness,
   squint, spacing, dummy - draw over the page and have nothing to say in
   text. Alt draws too, and has no panel, but the review still asks it for
   counts. Dummy is left out on purpose: a review must not replace the
   page it is describing.

   Keyboard shortcuts are handled in a service worker, which cannot see the
   popup's script. Keeping a second copy of this table there would drift the
   moment a checker is added, and the failure would be quiet: the button
   would work and the shortcut would not. It is loaded as a plain script
   that assigns globals, matching how js/i18n.js and js/panel.js are shared
   with the injected checkers. */

/** @type {Checker[]} */
globalThis.kraftyCheckers = [
  {
    id: "js-headCheckButton",
    panelId: "js-kraftyHeadInformation",
    command: "head-check",
    file: "js/headCheck.js",
    bodyClass: "kraftyHeadChecker",
    /* The head of a subframe is not the head the user is auditing. */
    allFrames: false,
  },
  {
    id: "js-nestCheckButton",
    panelId: "js-kraftyNestInformation",
    command: "nest-check",
    file: "js/nestCheck.js",
    bodyClass: "kraftyNestChecker",
    allFrames: true,
  },
  {
    id: "js-headingCheckButton",
    panelId: "js-kraftyHeadingInformation",
    command: "heading-check",
    file: "js/headingCheck.js",
    bodyClass: "kraftyHeadingChecker",
    /* A subframe's headings belong to a different document, so folding them
       into this page's outline would report a structure that does not
       exist. */
    allFrames: false,
  },
  {
    id: "js-markupCheckButton",
    panelId: "js-kraftyMarkupInformation",
    command: "markup-check",
    file: "js/markupCheck.js",
    bodyClass: "kraftyMarkupChecker",
    /* An id collides within one document, so a subframe's are its own
       problem and reporting them here would be a different page's findings
       in this page's panel. */
    allFrames: false,
  },
  {
    id: "js-imageCheckButton",
    panelId: "js-kraftyImageInformation",
    command: "image-check",
    file: "js/imageCheck.js",
    bodyClass: "kraftyImageChecker",
    /* Measures the images against the layout they sit in, and reports into
       one panel. A subframe is a different layout and would want its own. */
    allFrames: false,
  },
  {
    id: "js-leftoversCheckButton",
    panelId: "js-kraftyLeftoversInformation",
    command: "leftovers-check",
    file: "js/leftoversCheck.js",
    bodyClass: "kraftyLeftoversChecker",
    /* Resource addresses in the top document. A subframe's leftovers are its
       own document's, and reporting them here would put a different page's
       findings in this page's panel. */
    allFrames: false,
  },
  {
    id: "js-landmarkCheckButton",
    panelId: "js-kraftyLandmarkInformation",
    command: "landmark-check",
    file: "js/landmarkCheck.js",
    bodyClass: "kraftyLandmarkChecker",
    /* Landmark regions belong to one document; a subframe's are its own
       page's, and folding them in would draw a structure that does not
       exist - the same reason the heading outline stays in its own frame. */
    allFrames: false,
  },
  {
    id: "js-tokenCheckButton",
    panelId: "js-kraftyTokenInformation",
    command: "token-check",
    file: "js/tokenCheck.js",
    bodyClass: "kraftyTokenChecker",
    /* Computed colours and fonts belong to one document's layout. */
    allFrames: false,
  },
  {
    id: "js-tabCheckButton",
    panelId: "js-kraftyTabInformation",
    command: "tab-check",
    file: "js/tabCheck.js",
    bodyClass: "kraftyTabChecker",
    /* A subframe's tab order is a different document's. */
    allFrames: false,
  },
  {
    id: "js-targetCheckButton",
    panelId: "js-kraftyTargetInformation",
    command: "target-check",
    file: "js/targetCheck.js",
    bodyClass: "kraftyTargetChecker",
    /* Sizes belong to the layout of this document. */
    allFrames: false,
  },
  {
    id: "js-outlineCheckButton",
    command: "outline-check",
    file: "js/outlineCheck.js",
    bodyClass: "kraftyOutlineChecker",
    allFrames: true,
  },
  {
    id: "js-altCheckButton",
    command: "alt-check",
    file: "js/altCheck.js",
    bodyClass: "kraftyAltChecker",
    allFrames: true,
  },
  {
    id: "js-brightnessCheckButton",
    command: "brightness-check",
    file: "js/brightnessCheck.js",
    bodyClass: "kraftyBrightnessChecker",
    allFrames: false,
  },
  {
    id: "js-squintCheckButton",
    command: "squint-check",
    file: "js/squintCheck.js",
    bodyClass: "kraftySquintChecker",
    /* One screen over the top document blurs every frame under it. */
    allFrames: false,
  },
  {
    id: "js-spacingCheckButton",
    command: "spacing-check",
    file: "js/spacingCheck.js",
    bodyClass: "kraftySpacingChecker",
    /* Each frame has its own text, so the stress has to be applied in it. */
    allFrames: true,
  },
  {
    id: "js-dummyCheckButton",
    command: "dummy-check",
    file: "js/dummyCheck.js",
    bodyClass: "kraftyDummyChecker",
    /* Each frame has its own text and pictures. A frame this cannot be
       injected into is covered from the outside, which is the one case
       the script can see and not edit. */
    allFrames: true,
  },
];

/**
 * Inject content.css once per page load rather than declaring a content
 * script for <all_urls>, which would demand host permission for every site
 * the user visits.
 *
 * Keyed on the version, not a bare flag. The marker lives on the page and
 * survives the extension being updated underneath it, so a flag would leave
 * a long-open tab running new scripts against the previous stylesheet -
 * which presents as the CSS having stopped working. Within one version the
 * marker still short circuits, so reloading the page remains the way to
 * pick up an edit while developing.
 *
 * @param {number} tabId
 */
globalThis.kraftyEnsureStyles = async (tabId) => {
  const version = chrome.runtime.getManifest().version;

  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (expected) => {
      const root = document.documentElement;
      const already = root.dataset.kraftyStyled === expected;
      root.dataset.kraftyStyled = expected;
      return already;
    },
    args: [version],
  });

  if (!injection?.result) {
    await chrome.scripting.insertCSS({
      target: { tabId, allFrames: true },
      files: ["content.css"],
    });
  }
};

/**
 * @param {number} tabId
 * @param {Checker} checker
 */
globalThis.kraftyRunChecker = async (tabId, checker) => {
  await globalThis.kraftyEnsureStyles(tabId);

  await chrome.scripting.executeScript({
    target: { tabId, allFrames: checker.allFrames },
    /* panelCss.js before panel.js: the shadow root reads kraftyPanelCss when
       the shell is built. i18n.js stays ahead of both for localised strings. */
    files: ["js/i18n.js", "js/panelCss.js", "js/panel.js", checker.file],
  });
};

/**
 * The tab a checker should act on, or null when there is nothing to act on.
 *
 * @returns {Promise<number | null>}
 */
globalThis.kraftyActiveTabId = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || tab.id === undefined || tab.id === chrome.tabs.TAB_ID_NONE) {
    return null;
  }
  return tab.id;
};
