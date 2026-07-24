// @ts-check

/* Copy lean-qr into code/popup/qr.js as a classic-script IIFE. */

const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const src = fs.readFileSync(
  path.join(root, "node_modules", "lean-qr", "index.js"),
  "utf8"
);
const body = src.replace(/^"use strict";/, "");

const out = [
  "// @ts-check",
  "/* Vendored from lean-qr@2.7.2 (MIT, David Evans).",
  "   https://www.npmjs.com/package/lean-qr",
  "   Local generation only — never send the URL to a QR service (item 25). */",
  "(() => {",
  "  const exports = {};",
  body,
  "  /**",
  "   * @param {string} text",
  "   * @param {{ minCorrectionLevel?: number, maxCorrectionLevel?: number, minVersion?: number, maxVersion?: number }=} [options]",
  "   */",
  "  globalThis.kraftyQrGenerate = (text, options) => exports.generate(text, options);",
  "})();",
  "",
].join("\n");

fs.writeFileSync(path.join(root, "code", "popup", "qr.js"), out);
console.log(`Wrote code/popup/qr.js (${out.length} bytes)`);
