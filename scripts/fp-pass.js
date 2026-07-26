// @ts-check

/* One-shot real-use pass: open busy public pages, run the findings panels,
   and print what each checker said. Not part of npm test — network and
   third-party markup change underfoot. */

const puppeteer = require("puppeteer");
const { SCRIPTS } = require("../test/support.js");
const fs = require("node:fs");
const path = require("node:path");

const messages = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "code", "_locales", "en", "messages.json"),
    "utf8"
  )
);

const css = fs.readFileSync(
  path.join(__dirname, "..", "code", "content.css"),
  "utf8"
);

const SITES = [
  "https://ja.wikipedia.org/wiki/HTML",
  "https://www.brainpad.co.jp/",
  "https://timetechnologies.ltd/",
  "https://takeshisakuma.github.io/",
];

const CHECKERS = [
  { name: "markup", script: SCRIPTS.markupCheck, panel: "js-kraftyMarkupInformation" },
  { name: "head", script: SCRIPTS.headCheck, panel: "js-kraftyHeadInformation" },
  { name: "heading", script: SCRIPTS.headingCheck, panel: "js-kraftyHeadingInformation" },
  { name: "landmark", script: SCRIPTS.landmarkCheck, panel: "js-kraftyLandmarkInformation" },
  { name: "image", script: SCRIPTS.imageCheck, panel: "js-kraftyImageInformation" },
  { name: "leftovers", script: SCRIPTS.leftoversCheck, panel: "js-kraftyLeftoversInformation" },
  { name: "nest", script: SCRIPTS.nestCheck, panel: "js-kraftyNestInformation" },
  { name: "token", script: SCRIPTS.tokenCheck, panel: "js-kraftyTokenInformation" },
];

/**
 * @param {import("puppeteer").Page} page
 */
async function installHelpers(page) {
  await page.addStyleTag({ content: css });
  await page.evaluate(
    (table, i18n, panelCss, panel) => {
      globalThis.chrome = /** @type {any} */ ({
        i18n: {
          /**
           * @param {string} key
           * @param {string | string[]} [substitutions]
           */
          getMessage(key, substitutions) {
            const entry = table[key];
            if (!entry) return "";
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
      eval(i18n);
      eval(panelCss);
      eval(panel);
    },
    messages,
    SCRIPTS.i18n,
    SCRIPTS.panelCss,
    SCRIPTS.panel
  );
}

/**
 * @param {import("puppeteer").Page} page
 * @param {{ name: string, script: string, panel: string }} checker
 */
async function runChecker(page, checker) {
  await page.evaluate(checker.script);

  try {
    await page.waitForSelector(`#${checker.panel}`, { timeout: 45000 });
  } catch {
    return { findings: ["(panel did not appear)"], notes: [] };
  }

  return page.evaluate((panelId) => {
    const panel = document.getElementById(panelId);
    const root = kraftyPanelRoot(panel);
    return {
      findings: [...(root?.querySelectorAll(".kraftyCheck") ?? [])].map(
        (item) => item.textContent ?? ""
      ),
      notes: [...(root?.querySelectorAll(".kraftyPanelNote") ?? [])]
        .map((note) => note.textContent ?? "")
        .filter((text) => !/Scanned at|scanned at/i.test(text)),
    };
  }, checker.panel);
}

async function main() {
  const browser = await puppeteer.launch({ channel: "chrome" });

  try {
    for (const url of SITES) {
      console.log(`\n=== ${url} ===`);
      const page = await browser.newPage();
      page.setDefaultTimeout(60000);

      try {
        await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
        await installHelpers(page);

        for (const checker of CHECKERS) {
          const result = await runChecker(page, checker);
          const lines = [...result.findings, ...result.notes];
          console.log(`\n[${checker.name}] ${lines.length} line(s)`);
          for (const line of lines.slice(0, 40)) {
            console.log(`  - ${line}`);
          }
          if (lines.length > 40) {
            console.log(`  … ${lines.length - 40} more`);
          }

          /* Toggle off before the next checker so body classes / panels
             do not stack into each other's walks. */
          await page.evaluate(checker.script);
        }
      } catch (error) {
        console.log(`  ERROR: ${error instanceof Error ? error.message : error}`);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
