// @ts-check

/* Item 25: the QR is generated locally from a string, which needs nothing
   beyond TextEncoder, which Node provides. The last test does open a
   browser: whether the popup fits is a layout question. */

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { pathToFileURL } = require("node:url");
const puppeteer = require("puppeteer");
const { closeBrowser } = require("./support.js");

const root = path.join(__dirname, "..");
const qrSource = fs.readFileSync(
  path.join(root, "code", "popup", "qr.js"),
  "utf8"
);

/**
 * @returns {{ kraftyQrGenerate: (text: string) => { size: number, get: (x: number, y: number) => boolean } }}
 */
function loadQr() {
  const sandbox = {
    TextEncoder,
    TextDecoder,
    Uint8Array,
    Uint32Array,
    Map,
    Error,
    globalThis: /** @type {Record<string, unknown>} */ ({}),
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(qrSource, sandbox);
  return /** @type {any} */ (sandbox);
}

test("QR of the current URL", async (t) => {
  await t.test("encodes a typical staging URL locally", () => {
    const { kraftyQrGenerate } = loadQr();
    const url =
      "https://staging.example.com/review/page?utm=krafty&lang=ja#section";
    const code = kraftyQrGenerate(url);

    assert.ok(code.size >= 21, `expected a QR matrix, got size ${code.size}`);
    /* Finder pattern at the top-left corner is dark. */
    assert.strictEqual(code.get(0, 0), true);
    assert.strictEqual(code.get(6, 6), true);
  });

  await t.test("accepts a long query without calling a network", () => {
    const { kraftyQrGenerate } = loadQr();
    const url = `https://example.com/path?${"a".repeat(180)}=1`;
    const code = kraftyQrGenerate(url);

    assert.ok(code.size >= 21);
    assert.strictEqual(typeof code.get(0, 0), "boolean");
  });

  await t.test("popup loads the local encoder before its own script", () => {
    const html = fs.readFileSync(
      path.join(root, "code", "popup", "popup.html"),
      "utf8"
    );

    assert.ok(
      html.indexOf("qr.js") < html.indexOf("popup.js"),
      "popup.js calls kraftyQrGenerate, so qr.js has to come first"
    );
    assert.match(html, /id="js-qrCanvas"/);
    assert.doesNotMatch(
      html,
      /qrserver|api\.qr|chart\.googleapis|quickchart/i,
      "the popup must not point at a QR-image service"
    );
  });

  await t.test("fits Chrome's 600px popup in both views", async () => {
    /* Chrome cuts an action popup off at 600px tall. The menu with the QR
       under it measured 700px, so the code sat half behind a scrollbar; the
       QR is its own view now. Measured with the status line showing and a
       long address, the tallest each view gets. */
    const messages = JSON.parse(
      fs.readFileSync(
        path.join(root, "code", "_locales", "en", "messages.json"),
        "utf8"
      )
    );
    const url = `https://example.com/${"a".repeat(200)}`;

    const browser = await puppeteer.launch({ channel: "chrome" });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 800, height: 1200 });

      /* Only what the popup touches. Scripting refuses, as on a chrome://
         page, which is what puts the status line up. */
      await page.evaluateOnNewDocument(
        (table, address) => {
          const refuse = async () => {
            throw new Error("refused");
          };

          /** @type {any} */ (window).chrome = {
            i18n: {
              /** @param {string} key */
              getMessage: (key) => table[key]?.message ?? "",
              getUILanguage: () => "en",
            },
            tabs: { query: async () => [{ id: 1, url: address }] },
            scripting: { executeScript: refuse, insertCSS: refuse },
          };
        },
        messages,
        url
      );

      await page.goto(
        pathToFileURL(path.join(root, "code", "popup", "popup.html")).href
      );
      await page.waitForFunction(
        () => !document.getElementById("js-qrBlock")?.classList.contains("isEmpty")
      );
      await page.waitForFunction(
        () => !(/** @type {HTMLElement} */ (document.getElementById("js-status")).hidden)
      );

      const height = () =>
        page.evaluate(() => document.body.getBoundingClientRect().height);

      const menu = await height();

      await page.click("#js-qrOpenButton");
      const qr = await height();
      const onQr = await page.evaluate(() => ({
        menuHidden: /** @type {HTMLElement} */ (
          document.getElementById("js-menuView")
        ).hidden,
        focus: document.activeElement?.id,
      }));

      await page.click("#js-qrBackButton");
      const back = await page.evaluate(() => ({
        qrHidden: /** @type {HTMLElement} */ (
          document.getElementById("js-qrView")
        ).hidden,
        focus: document.activeElement?.id,
      }));

      assert.ok(menu <= 600, `the menu is ${Math.round(menu)}px tall`);
      assert.ok(qr <= 600, `the QR view is ${Math.round(qr)}px tall`);
      assert.deepStrictEqual(onQr, {
        menuHidden: true,
        focus: "js-qrBackButton",
      });
      assert.deepStrictEqual(back, {
        qrHidden: true,
        focus: "js-qrOpenButton",
      });
    } finally {
      await closeBrowser(browser);
    }
  });
});
