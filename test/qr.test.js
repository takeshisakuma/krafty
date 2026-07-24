// @ts-check

/* Item 25: the QR is generated locally from a string. Nothing here needs a
   browser beyond TextEncoder, which Node provides. */

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

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
});
