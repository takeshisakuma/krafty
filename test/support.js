// @ts-check

/* Shared setup for the browser backed tests.

   The checkers are exercised in a real Chrome because their behaviour rests
   on selector matching, computed style and pointer events that no DOM shim
   resolves faithfully. A clean profile is used, so a Krafty build installed
   in the developer's own Chrome cannot skew a result. */

const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const path = require("node:path");
const puppeteer = require("puppeteer");

const root = path.join(__dirname, "..");

/** @param {string[]} parts */
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");

const css = read("code", "content.css");

/* Self-signed pair for the https harness. Chrome accepts it under
   acceptInsecureCerts; the SAN covers staging.example.com so Host mapping
   and TLS agree. */
const httpsCert = {
  key: read("test", "fixtures", "https", "key.pem"),
  cert: read("test", "fixtures", "https", "cert.pem"),
};

/* The injected scripts, in the order the popup injects them. */
const SCRIPTS = {
  i18n: read("code", "js", "i18n.js"),
  panelCss: read("code", "js", "panelCss.js"),
  panel: read("code", "js", "panel.js"),
  nestCheck: read("code", "js", "nestCheck.js"),
  headCheck: read("code", "js", "headCheck.js"),
  headingCheck: read("code", "js", "headingCheck.js"),
  imageCheck: read("code", "js", "imageCheck.js"),
  markupCheck: read("code", "js", "markupCheck.js"),
  leftoversCheck: read("code", "js", "leftoversCheck.js"),
  landmarkCheck: read("code", "js", "landmarkCheck.js"),
  tokenCheck: read("code", "js", "tokenCheck.js"),
  altCheck: read("code", "js", "altCheck.js"),
  outlineCheck: read("code", "js", "outlineCheck.js"),
  brightnessCheck: read("code", "js", "brightnessCheck.js"),
  squintCheck: read("code", "js", "squintCheck.js"),
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
 * Serve one document from a throwaway port.
 *
 * setContent leaves the page at about:blank, where a relative URL cannot be
 * resolved at all - new URL("/x", "about:blank") throws, because about: is
 * not hierarchical. Anything that reads location or resolves an href is
 * therefore untestable that way, and worse, passes: a check that quietly
 * measures nothing looks exactly like a check that found nothing wrong.
 * That is how the self-referential canonical test came to assert nothing
 * for as long as it existed.
 *
 * Pass `https: true` for the mixed-content / staging-own-host fixtures: a
 * self-signed cert from test/fixtures/https, with Chrome told to accept it.
 *
 * @param {string} body
 * @param {{ https?: boolean }} [options]
 * @returns {Promise<import("node:http").Server | import("node:https").Server>}
 */
function serveOnce(body, options = {}) {
  return new Promise((resolve) => {
    /**
     * @param {import("node:http").IncomingMessage} _request
     * @param {import("node:http").ServerResponse} response
     */
    const handler = (_request, response) => {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(body);
    };

    const server = options.https
      ? https.createServer(httpsCert, handler)
      : http.createServer(handler);

    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

/**
 * Open a page with the stylesheet and the named checkers already injected,
 * hand it to the caller, and close the browser afterwards.
 *
 * Pass `serve` - a path such as "/" - to load the document over http from a
 * local port instead of setting it directly, which is what anything reading
 * location or resolving a relative URL needs.
 *
 * Pass `https: true` with `serve` for an https origin (mixed content). Pass
 * `host` (e.g. staging.example.com) to map that name to the local listener
 * via Chrome's host-resolver-rules, so location.hostname is the staging
 * label the leftovers checker reads.
 *
 * @template T
 * @param {{ html: string, checkers?: (keyof typeof SCRIPTS)[], width?: number, height?: number, hasTouch?: boolean, deviceScaleFactor?: number, serve?: string, https?: boolean, host?: string }} options
 * @param {(page: import("puppeteer").Page) => Promise<T>} run
 * @returns {Promise<T>}
 */
async function withPage(
  {
    html,
    checkers = [],
    width,
    height,
    hasTouch,
    deviceScaleFactor,
    serve,
    https: useHttps = false,
    host,
  },
  run
) {
  if ((useHttps || host) && !serve) {
    throw new Error("withPage: https and host require serve");
  }

  /** @type {string[]} */
  const args = [];

  if (host && host !== "127.0.0.1" && host !== "localhost") {
    args.push(`--host-resolver-rules=MAP ${host} 127.0.0.1`);
  }

  /* acceptInsecureCerts (not the older ignoreHTTPSErrors name) is what
     current Puppeteer honours for a self-signed fixture. The flag is only
     needed for https pages; leaving it false elsewhere keeps ordinary
     runs strict. */
  const browser = await puppeteer.launch({
    channel: "chrome",
    acceptInsecureCerts: useHttps,
    args,
  });

  /** @type {import("node:http").Server | import("node:https").Server | null} */
  let server = null;

  try {
    const page = await browser.newPage();

    if (width && height) {
      await page.setViewport({
        width,
        height,
        hasTouch: Boolean(hasTouch),
        deviceScaleFactor: deviceScaleFactor ?? 1,
      });
    }

    const document = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`;

    if (serve) {
      server = await serveOnce(document, { https: useHttps });

      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      const hostname = host || "127.0.0.1";
      const scheme = useHttps ? "https" : "http";

      await page.goto(`${scheme}://${hostname}:${port}${serve}`);
    } else {
      await page.setContent(document);
    }

    await page.addStyleTag({ content: css });
    await page.evaluate(installI18n, messages);

    for (const name of ["i18n", "panelCss", "panel", ...checkers]) {
      await page.evaluate(SCRIPTS[/** @type {keyof typeof SCRIPTS} */ (name)]);
    }

    /* Awaited inside the try: returning the pending promise would let the
       finally close the browser before it settles. */
    return await run(page);
  } finally {
    await browser.close();
    server?.close();
  }
}

/**
 * Bounding box of an element inside a panel's open shadow root (or the host
 * itself if there is no shadow yet). Puppeteer's light-DOM selectors stop at
 * the host, so hover/click of panel chrome goes through here then page.mouse.
 *
 * @param {import("puppeteer").Page} page
 * @param {string} hostSelector
 * @param {string} innerSelector
 * @returns {Promise<{ x: number; y: number; width: number; height: number }>}
 */
async function shadowBox(page, hostSelector, innerSelector) {
  const box = await page.evaluate(
    (host, inner) => {
      const panel = document.querySelector(host);
      const root = panel?.shadowRoot ?? panel;
      const el = root?.querySelector(inner);
      if (!el) return null;

      const rect = el.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };
    },
    hostSelector,
    innerSelector
  );

  if (!box) {
    throw new Error(`missing shadow element: ${hostSelector} ${innerSelector}`);
  }

  return box;
}

/**
 * @param {import("puppeteer").Page} page
 * @param {string} hostSelector
 * @param {string} innerSelector
 */
async function hoverShadow(page, hostSelector, innerSelector) {
  const box = await shadowBox(page, hostSelector, innerSelector);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
}

/**
 * @param {import("puppeteer").Page} page
 * @param {string} hostSelector
 * @param {string} innerSelector
 */
async function clickShadow(page, hostSelector, innerSelector) {
  const box = await shadowBox(page, hostSelector, innerSelector);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

module.exports = { withPage, SCRIPTS, messages, shadowBox, hoverShadow, clickShadow };
