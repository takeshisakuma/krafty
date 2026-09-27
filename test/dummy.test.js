// @ts-check

/* Stand-ins for a screenshot. Spaces and wide characters keep their width,
   everything else is replaced, and turning the checker off puts the
   originals back. A canvas and a frame the script cannot open are covered,
   not edited. A frame it can open is that frame's own document. */

const { test } = require("node:test");
const assert = require("node:assert");
const { withPage, SCRIPTS } = require("./support.js");

const gif =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const pageHtml = `
  <style>
    #note::before { content: "Secret"; }
    #hero {
      width: 80px;
      height: 40px;
      background-image: url("${gif}");
    }
  </style>
  <p id="copy">Call Ada at ada@acme.test about 2026 発売</p>
  <input id="field" value="ada@acme.test" placeholder="Your name">
  <input id="send" type="submit" value="Send Ada">
  <picture>
    <source id="source" srcset="${gif}">
    <img id="pic" alt="secret product" width="120" height="80" src="${gif}" srcset="${gif} 1x">
  </picture>
  <div id="hero"></div>
  <div class="kraftyPanel" id="panel">Do not touch</div>
  <script id="code">window.kept = "Ada";</script>
  <svg id="drawing" width="40" height="40"><text id="svgtext" y="20">Ada</text><path d="M0 0 H40 V40 Z"/></svg>
  <span id="note"></span>
  <canvas id="paint" width="60" height="40"></canvas>
  <iframe id="sealed" sandbox srcdoc="<p>Ada launch</p>" width="180" height="50"></iframe>
`;

test("dummy checker", async (t) => {
  await t.test("swaps text and pictures and covers what it cannot edit", async () => {
    const seen = await withPage(
      { html: pageHtml, checkers: ["dummyCheck"] },
      async (page) =>
        page.evaluate(() => {
          const copy = document.getElementById("copy");
          const field = /** @type {HTMLInputElement | null} */ (
            document.getElementById("field")
          );
          const send = /** @type {HTMLInputElement | null} */ (
            document.getElementById("send")
          );
          const pic = /** @type {HTMLImageElement | null} */ (
            document.getElementById("pic")
          );
          const source = document.getElementById("source");
          const hero = document.getElementById("hero");
          const note = document.getElementById("note");
          const paint = document.getElementById("paint");
          const sealed = document.getElementById("sealed");
          const picRect = pic ? pic.getBoundingClientRect() : null;
          const paintRect = paint ? paint.getBoundingClientRect() : null;
          const sealedRect = sealed ? sealed.getBoundingClientRect() : null;

          /**
           * @param {DOMRect | null} rect
           * @param {string} label
           */
          const cover = (rect, label) => {
            if (!rect) {
              return null;
            }

            const mask = [...document.querySelectorAll(".kraftyDummyMask")].find(
              (element) => element.getAttribute("data-label") === label
            );

            if (!(mask instanceof HTMLElement)) {
              return null;
            }

            const box = mask.getBoundingClientRect();

            return {
              dw: Math.abs(box.width - rect.width),
              dh: Math.abs(box.height - rect.height),
              dx: Math.abs(box.left - rect.left),
              dy: Math.abs(box.top - rect.top),
            };
          };

          return {
            bodyClass: document.body.classList.contains("kraftyDummyChecker"),
            text: copy ? copy.textContent : "",
            value: field ? field.value : "",
            placeholder: field ? field.placeholder : "",
            send: send ? send.value : "",
            src: pic ? pic.getAttribute("src") : "",
            srcset: pic ? pic.getAttribute("srcset") : "",
            sourceSrcset: source ? source.getAttribute("srcset") : "",
            alt: pic ? pic.getAttribute("alt") : "",
            width: picRect ? picRect.width : 0,
            height: picRect ? picRect.height : 0,
            hero: hero ? getComputedStyle(hero).backgroundImage : "",
            before: note ? getComputedStyle(note, "::before").content : "",
            panel: document.getElementById("panel")?.textContent ?? "",
            script: document.getElementById("code")?.textContent ?? "",
            svg: document.getElementById("svgtext")?.textContent ?? "",
            path: Boolean(document.querySelector("#drawing path")),
            canvas: cover(paintRect, "canvas"),
            frame: cover(sealedRect, "frame"),
          };
        })
    );

    assert.strictEqual(seen.bodyClass, true);
    assert.strictEqual(seen.text, "xxxx xxx xx xxxxxxxxxxxxx xxxxx xxxx ああ");
    assert.strictEqual(seen.value, "xxxxxxxxxxxxx");
    assert.strictEqual(seen.placeholder, "xxxx xxxx");
    assert.strictEqual(seen.send, "xxxx xxx");
    assert.ok(seen.src?.includes("krafty-dummy"), `src should be a stand-in, got ${seen.src}`);
    assert.strictEqual(seen.srcset, null);
    assert.strictEqual(seen.sourceSrcset, null);
    assert.ok(!seen.alt?.includes("secret"), `alt still names the picture: ${seen.alt}`);
    assert.ok(Math.abs(seen.width - 120) < 1, `image width moved to ${seen.width}`);
    assert.ok(Math.abs(seen.height - 80) < 1, `image height moved to ${seen.height}`);
    assert.ok(!seen.hero.includes("R0lGODlh"), "the background url is still the picture");
    assert.ok(seen.hero.includes("krafty-dummy"), `background was not swapped: ${seen.hero}`);
    assert.strictEqual(seen.before, '"xxxxxx"');
    assert.strictEqual(seen.panel, "Do not touch");
    assert.ok(seen.script.includes("Ada"), "a script was rewritten");
    assert.strictEqual(seen.svg, "xxx");
    assert.strictEqual(seen.path, true);
    assert.ok(seen.canvas, "canvas was not covered");
    assert.ok(seen.frame, "unreadable frame was not covered");

    if (!seen.canvas || !seen.frame) {
      return;
    }

    assert.ok(seen.canvas.dw < 1 && seen.canvas.dh < 1, `canvas patch size ${seen.canvas.dw}×${seen.canvas.dh}`);
    assert.ok(seen.canvas.dx < 1 && seen.canvas.dy < 1, `canvas patch offset ${seen.canvas.dx},${seen.canvas.dy}`);
    assert.ok(seen.frame.dw < 1 && seen.frame.dh < 1, `frame patch size ${seen.frame.dw}×${seen.frame.dh}`);
  });

  await t.test("puts the originals back when toggled off", async () => {
    const seen = await withPage(
      { html: pageHtml, checkers: ["dummyCheck"] },
      async (page) => {
        await page.evaluate(SCRIPTS.dummyCheck);

        return page.evaluate(() => {
          const field = /** @type {HTMLInputElement | null} */ (
            document.getElementById("field")
          );
          const pic = document.getElementById("pic");
          const source = document.getElementById("source");
          const hero = document.getElementById("hero");
          const note = document.getElementById("note");

          return {
            bodyClass: document.body.classList.contains("kraftyDummyChecker"),
            text: document.getElementById("copy")?.textContent ?? "",
            value: field ? field.value : "",
            placeholder: field ? field.placeholder : "",
            src: pic ? pic.getAttribute("src") : "",
            srcset: pic ? pic.getAttribute("srcset") : "",
            sourceSrcset: source ? source.getAttribute("srcset") : "",
            alt: pic ? pic.getAttribute("alt") : "",
            hero: hero ? getComputedStyle(hero).backgroundImage : "",
            before: note ? getComputedStyle(note, "::before").content : "",
            masks: document.querySelectorAll(".kraftyDummyMask").length,
            width: pic instanceof HTMLElement ? pic.style.width : "locked",
          };
        });
      }
    );

    assert.strictEqual(seen.bodyClass, false);
    assert.strictEqual(seen.text, "Call Ada at ada@acme.test about 2026 発売");
    assert.strictEqual(seen.value, "ada@acme.test");
    assert.strictEqual(seen.placeholder, "Your name");
    assert.strictEqual(seen.src, gif);
    assert.strictEqual(seen.srcset, `${gif} 1x`);
    assert.strictEqual(seen.sourceSrcset, gif);
    assert.strictEqual(seen.alt, "secret product");
    assert.ok(seen.hero.includes("R0lGODlh"), `background was not restored: ${seen.hero}`);
    assert.strictEqual(seen.before, '"Secret"');
    assert.strictEqual(seen.masks, 0);
    assert.strictEqual(seen.width, "");
  });

  await t.test("leaves a frame it can open for that frame to redact", async () => {
    const seen = await withPage(
      {
        html: `<p id="top">Ada launch</p><iframe id="inner" srcdoc="<p id=&quot;secret&quot;>Ada launch</p>"></iframe>`,
        checkers: ["dummyCheck"],
      },
      async (page) => {
        const before = await page.evaluate(() => {
          const iframe = document.querySelector("iframe");
          const secret =
            iframe instanceof HTMLIFrameElement
              ? (iframe.contentDocument?.getElementById("secret")?.textContent ?? "")
              : "";
          const masked = [...document.querySelectorAll(".kraftyDummyMask")].some(
            (mask) => mask.getAttribute("data-label") === "frame"
          );

          return {
            top: document.getElementById("top")?.textContent ?? "",
            secret,
            masked,
          };
        });

        const handle = await page.$("#inner");
        const frame = await handle?.contentFrame();

        if (!frame) {
          throw new Error("missing frame");
        }

        await frame.evaluate(SCRIPTS.dummyCheck);
        const secret = await frame.evaluate(
          () => document.getElementById("secret")?.textContent ?? ""
        );
        await frame.evaluate(SCRIPTS.dummyCheck);
        const restored = await frame.evaluate(
          () => document.getElementById("secret")?.textContent ?? ""
        );

        return { before, secret, restored };
      }
    );

    assert.strictEqual(seen.before.top, "xxx xxxxxx");
    assert.strictEqual(seen.before.secret, "Ada launch");
    assert.strictEqual(seen.before.masked, false);
    assert.strictEqual(seen.secret, "xxx xxxxxx");
    assert.strictEqual(seen.restored, "Ada launch");
  });
});
