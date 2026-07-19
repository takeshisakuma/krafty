// @ts-check

/* Shared setup for the browser backed tests.

   The checkers are exercised in a real Chrome because their behaviour rests
   on selector matching, computed style and pointer events that no DOM shim
   resolves faithfully. A clean profile is used, so a Krafty build installed
   in the developer's own Chrome cannot skew a result. */

const fs = require("node:fs");
const path = require("node:path");
const puppeteer = require("puppeteer");

const root = path.join(__dirname, "..");

/** @param {string[]} parts */
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");

const css = read("code", "content.css");

/* The injected scripts, in the order the popup injects them. */
const SCRIPTS = {
  i18n: read("code", "js", "i18n.js"),
  panel: read("code", "js", "panel.js"),
  nestCheck: read("code", "js", "nestCheck.js"),
  headCheck: read("code", "js", "headCheck.js"),
};

/* The real message file, so a mistyped key or a broken placeholder fails
   here rather than showing up as a blank tooltip in the browser. */
const messages = JSON.parse(read("code", "_locales", "en", "messages.json"));

/**
 * Stand in for chrome.i18n, which content scripts have but a plain page does
 * not. Mirrors Chrome's behaviour of returning "" for an unknown key, so a
 * typo surfaces as the bare key via the fallback in i18n.js.
 *
 * @param {Record<string, any>} table
 */
function installI18n(table) {
  globalThis.chrome = /** @type {any} */ ({
    i18n: {
      /**
       * @param {string} key
       * @param {string | string[]} [substitutions]
       */
      getMessage(key, substitutions) {
        const entry = table[key];
        if (!entry) return "";

        /** @type {string[]} */
        const values =
          substitutions === undefined
            ? []
            : Array.isArray(substitutions)
              ? substitutions
              : [substitutions];

        let text = entry.message;

        for (const [name, spec] of Object.entries(entry.placeholders ?? {})) {
          const index = Number(String(spec.content).slice(1)) - 1;
          text = text.split(`$${name}$`).join(values[index] ?? "");
        }
        return text;
      },
    },
  });
}

/**
 * Open a page with the stylesheet and the named checkers already injected,
 * hand it to the caller, and close the browser afterwards.
 *
 * @template T
 * @param {{ html: string, checkers?: (keyof typeof SCRIPTS)[], width?: number, height?: number }} options
 * @param {(page: import("puppeteer").Page) => Promise<T>} run
 * @returns {Promise<T>}
 */
async function withPage({ html, checkers = [], width, height }, run) {
  const browser = await puppeteer.launch({ channel: "chrome" });

  try {
    const page = await browser.newPage();

    if (width && height) {
      await page.setViewport({ width, height });
    }

    await page.setContent(
      `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`
    );
    await page.addStyleTag({ content: css });
    await page.evaluate(installI18n, messages);

    for (const name of ["i18n", "panel", ...checkers]) {
      await page.evaluate(SCRIPTS[/** @type {keyof typeof SCRIPTS} */ (name)]);
    }

    /* Awaited inside the try: returning the pending promise would let the
       finally close the browser before it settles. */
    return await run(page);
  } finally {
    await browser.close();
  }
}

module.exports = { withPage, SCRIPTS, messages };
