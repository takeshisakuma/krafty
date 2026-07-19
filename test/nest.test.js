// @ts-check

/* Checks that the nest checker flags exactly the invalid nesting and
   nothing else.

   The markup is rendered in a real browser rather than a DOM shim on
   purpose: the checker is entirely CSS, so the assertions depend on
   selector matching and specificity that only a browser resolves
   correctly. A clean profile is used, so a Krafty build installed in the
   developer's own Chrome cannot skew the result. */

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const puppeteer = require("puppeteer");

const root = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(root, "code", "content.css"), "utf8");
const nestCheck = fs.readFileSync(
  path.join(root, "code", "js", "nestCheck.js"),
  "utf8"
);
const i18n = fs.readFileSync(path.join(root, "code", "js", "i18n.js"), "utf8");

/* The real message file, so a mistyped key or a broken placeholder fails
   here rather than showing up as a blank tooltip in the browser. */
const messages = JSON.parse(
  fs.readFileSync(
    path.join(root, "code", "_locales", "en", "messages.json"),
    "utf8"
  )
);

/* The element under test carries data-t. Cases go through the HTML parser,
   so they describe trees the parser actually produces - writing
   "<p><div></div></p>" here would silently test two siblings instead. */

/** @type {[name: string, flagged: boolean, html: string][]} */
const CASES = [
  ["body > article is valid", false, `<article data-t>x</article>`],
  ["ul > li is valid", false, `<ul><li data-t>x</li></ul>`],
  ["ul > div is invalid", true, `<ul><div data-t>x</div></ul>`],
  ["ul > ul is invalid", true, `<ul><ul data-t>x</ul></ul>`],
  ["ol > span is invalid", true, `<ol><span data-t>x</span></ol>`],
  ["span > div is invalid", true, `<span><div data-t>x</div></span>`],
  ["h1 > span is valid", false, `<h1><span data-t>x</span></h1>`],
  ["h1 > div is invalid", true, `<h1><div data-t>x</div></h1>`],
  ["p > span is valid", false, `<p><span data-t>x</span></p>`],
  ["article > li is invalid", true, `<article><li data-t>x</li></article>`],
  ["section > section is valid", false, `<section><section data-t>x</section></section>`],
  ["header > header is invalid", true, `<header><header data-t>x</header></header>`],
  ["blockquote > p is valid", false, `<blockquote><p data-t>x</p></blockquote>`],
  ["div > dt is invalid", true, `<div><dt data-t>x</dt></div>`],
  ["figure > figcaption is valid", false, `<figure><figcaption data-t>x</figcaption></figure>`],
  ["figure > li is invalid", true, `<figure><li data-t>x</li></figure>`],
  ["details > summary is valid", false, `<details><summary data-t>x</summary>b</details>`],
  ["label > label is invalid", true, `<label><label data-t>x</label></label>`],
  ["td > div is valid", false, `<table><tr><td><div data-t>x</div></td></tr></table>`],

  /* Exceptions that the generic rules would otherwise flag. */
  ["dl > div > dt is valid", false, `<dl><div><dt data-t>x</dt><dd>y</dd></div></dl>`],
  ["map > div > area is valid", false, `<map name="m"><div><area data-t></div></map>`],
  ["div > custom element is valid", false, `<div><my-widget data-t>x</my-widget></div>`],
  ["span > custom element is valid", false, `<span><my-widget data-t>x</my-widget></span>`],
  ["li > meta[itemprop] is valid", false, `<ul><li><meta itemprop="position" content="1" data-t></li></ul>`],
  ["div > link[rel=preload] is valid", false, `<div><link rel="preload" as="image" href="/x.png" data-t></div>`],
  ["div > meta is invalid", true, `<div><meta name="x" data-t></div>`],
  ["div > style is invalid", true, `<div><style data-t></style></div>`],
];

/* An element that already has a title: the checker writes its explanation
   into that attribute, so it has to put the page's own value back. */
const TITLE_CASE = `<ul><div data-titled title="page tooltip">x</div></ul>`;

async function collect() {
  /* Drive the Chrome already installed on this machine rather than a
     Chromium that puppeteer downloads: it is the browser the extension
     actually ships to, and it keeps `npm install` from pulling ~150MB. */
  const browser = await puppeteer.launch({ channel: "chrome" });

  try {
    const page = await browser.newPage();
    const body = CASES.map(
      ([, , html], index) => `<div data-case="${index}">${html}</div>`
    ).join("\n");

    await page.setContent(
      `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${body}${TITLE_CASE}</body></html>`
    );
    await page.addStyleTag({ content: css });

    /* Stand in for chrome.i18n, which content scripts have but a plain page
       does not. Mirrors Chrome's behaviour of returning "" for an unknown
       key, so a typo surfaces as the bare key via the fallback in i18n.js. */
    await page.evaluate((table) => {
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

            for (const [name, spec] of Object.entries(
              entry.placeholders ?? {}
            )) {
              const index = Number(String(spec.content).slice(1)) - 1;
              text = text.split(`$${name}$`).join(values[index] ?? "");
            }
            return text;
          },
        },
      });
    }, messages);

    /* i18n.js defines kraftyMessage, which the checker calls. Injected the
       same way the popup injects it, ahead of the checker. */
    await page.evaluate(i18n);
    await page.evaluate(nestCheck);

    /* Must be awaited inside the try: returning the pending promise would
       let the finally close the browser before it settles. */
    const scan = await page.evaluate((total) => {
      /** @type {Record<number, boolean | null>} */
      const flagged = {};

      for (let index = 0; index < total; index += 1) {
        const box = document.querySelector(`[data-case="${index}"]`);
        const target = box ? box.querySelector("[data-t]") : null;

        flagged[index] = target
          ? getComputedStyle(target).backgroundColor === "rgb(255, 0, 0)"
          : null;
      }

      const panel = document.getElementById("js-kraftyNestInformation");
      const titled = document.querySelector("[data-titled]");
      const anError = document.querySelector(".kraftyNestError");

      const summary = panel?.querySelector(".kraftyPanelSummary");

      return {
        flagged,
        panelText: panel ? (panel.textContent ?? "") : null,
        summaryText: summary ? (summary.textContent ?? "") : null,
        errorCount: document.querySelectorAll(".kraftyNestError").length,
        reason: anError ? anError.getAttribute("title") : null,
        titleWhileOn: titled ? titled.getAttribute("title") : null,
      };
    }, CASES.length);

    /* Toggle off and confirm the page is left as it was found. */
    await page.evaluate(nestCheck);

    const after = await page.evaluate(() => {
      const titled = document.querySelector("[data-titled]");

      return {
        panel: document.getElementById("js-kraftyNestInformation") !== null,
        errors: document.querySelectorAll(".kraftyNestError").length,
        restoredTitle: titled ? titled.getAttribute("title") : null,
        leftovers: document.querySelectorAll("[data-kraftyTitle]").length,
      };
    });

    return { ...scan, after };
  } finally {
    await browser.close();
  }
}

test("nest checker", async (t) => {
  const result = await collect();

  for (const [index, [name, expected]] of CASES.entries()) {
    await t.test(name, () => {
      assert.notStrictEqual(
        result.flagged[index],
        null,
        "the element under test is missing - the parser rewrote the markup"
      );
      assert.strictEqual(result.flagged[index], expected);
    });
  }

  /* These assert the data in the message, not its wording: rephrasing a
     string or adding a locale must not break the suite, but a missing key
     or a broken placeholder must. */

  await t.test("explains a finding in the title attribute", () => {
    const reason = String(result.reason);

    assert.notStrictEqual(
      reason.split("\n")[0],
      "nestReasonNotAllowed",
      "the message key did not resolve - check _locales/en/messages.json"
    );
    assert.match(reason, /ul/);
    assert.match(reason, /div/);
  });

  await t.test("counts every finding in the panel", () => {
    const expected = CASES.filter(([, flagged]) => flagged).length + 1;

    assert.strictEqual(result.errorCount, expected);
    assert.match(String(result.summaryText), new RegExp(`\\b${expected}\\b`));
  });

  await t.test("lists the offending pairs in the panel", () => {
    assert.match(String(result.panelText), /ul > div/);
  });

  await t.test("does not destroy a title the page already had", () => {
    assert.match(String(result.titleWhileOn), /ul/);
    assert.strictEqual(result.after.restoredTitle, "page tooltip");
  });

  await t.test("leaves nothing behind when toggled off", () => {
    assert.strictEqual(result.after.panel, false);
    assert.strictEqual(result.after.errors, 0);
    assert.strictEqual(result.after.leftovers, 0);
  });
});
