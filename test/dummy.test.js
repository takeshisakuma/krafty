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

  await t.test("a background video's patch stays behind the words in front of it", async () => {
    const seen = await withPage(
      {
        html: `
          <div id="ground" style="position:fixed;inset:0;z-index:-1">
            <div id="mov" style="position:absolute;inset:0;transform:translate(-40px,-30px)">
              <video id="bg" style="display:block;width:100vw;height:100vh"></video>
            </div>
          </div>
          <h1 id="title" style="position:relative;margin:16px">Ada launch</h1>
          <video id="back" style="position:fixed;z-index:-1;left:360px;top:220px;width:160px;height:90px"></video>
          <p id="over" style="position:absolute;left:360px;top:220px;margin:0">Ada launch</p>
          <canvas id="plain" width="50" height="30" style="display:block"></canvas>
          <div id="modal" style="position:fixed;z-index:40;left:8px;bottom:8px;width:120px;height:70px;background:#fff">
            <canvas id="modalPaint" width="100" height="50"></canvas>
          </div>
        `,
        checkers: ["dummyCheck"],
      },
      async (page) =>
        page.evaluate(() => {
          /**
           * @param {string} id
           */
          const boxOf = (id) => document.getElementById(id)?.getBoundingClientRect() ?? null;

          /**
           * @param {Element | null} element
           */
          const maskFor = (element) => {
            const next = element?.nextElementSibling;

            return next instanceof HTMLElement && next.classList.contains("kraftyDummyMask")
              ? next
              : null;
          };

          /**
           * @param {DOMRect | null} rect
           * @param {HTMLElement | null} mask
           */
          const delta = (rect, mask) => {
            if (!rect || !mask) {
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

          /**
           * @param {number} x
           * @param {number} y
           * @param {Element | null} front
           * @param {Element | null} back
           */
          const order = (x, y, front, back) => {
            const stack = document.elementsFromPoint(x, y);

            return {
              front: front ? stack.indexOf(front) : -1,
              back: back ? stack.indexOf(back) : -1,
            };
          };

          const title = document.getElementById("title");
          const bg = document.getElementById("bg");
          const back = document.getElementById("back");
          const over = document.getElementById("over");
          const plain = document.getElementById("plain");
          const modalPaint = document.getElementById("modalPaint");
          const bgMask = maskFor(bg);
          const backMask = maskFor(back);
          const plainMask = maskFor(plain);
          const modalMask = maskFor(modalPaint);

          /* The patch does not take hits, so the hit list would skip it and
             the words would look like they had nothing behind them. */
          for (const mask of [bgMask, backMask, plainMask, modalMask]) {
            mask?.style.setProperty("pointer-events", "auto");
          }
          const titleBox = boxOf("title");
          const overBox = boxOf("over");
          const plainBox = boxOf("plain");
          const modalBox = boxOf("modalPaint");

          return {
            title: title?.textContent ?? "",
            over: over?.textContent ?? "",
            bg: delta(boxOf("bg"), bgMask),
            back: delta(boxOf("back"), backMask),
            plain: delta(plainBox, plainMask),
            modal: delta(modalBox, modalMask),
            titleLayer: titleBox
              ? order(titleBox.left + 8, titleBox.top + 8, title, bgMask)
              : null,
            overLayer: overBox ? order(overBox.left + 4, overBox.top + 4, over, backMask) : null,
            plainLayer: plainBox
              ? order(plainBox.left + plainBox.width / 2, plainBox.top + plainBox.height / 2, plainMask, plain)
              : null,
            modalLayer: modalBox
              ? order(
                  modalBox.left + modalBox.width / 2,
                  modalBox.top + modalBox.height / 2,
                  modalMask,
                  modalPaint
                )
              : null,
          };
        })
    );

    assert.strictEqual(seen.title, "xxx xxxxxx");
    assert.strictEqual(seen.over, "xxx xxxxxx");
    assert.ok(seen.bg, "background video was not covered");
    assert.ok(seen.back, "fixed video was not covered");
    assert.ok(seen.plain, "canvas was not covered");
    assert.ok(seen.modal, "canvas in a modal was not covered");

    if (!seen.bg || !seen.back || !seen.plain || !seen.modal) {
      return;
    }

    assert.ok(seen.bg.dw < 2 && seen.bg.dh < 2 && seen.bg.dx < 2 && seen.bg.dy < 2, `background patch ${JSON.stringify(seen.bg)}`);
    assert.ok(
      seen.back.dw < 2 && seen.back.dh < 2 && seen.back.dx < 2 && seen.back.dy < 2,
      `fixed patch ${JSON.stringify(seen.back)}`
    );
    assert.ok(seen.plain.dw < 1 && seen.plain.dh < 1 && seen.plain.dx < 1 && seen.plain.dy < 1);
    assert.ok(seen.modal.dw < 1 && seen.modal.dh < 1 && seen.modal.dx < 1 && seen.modal.dy < 1);
    assert.ok(
      seen.titleLayer && seen.titleLayer.front !== -1 && seen.titleLayer.front < seen.titleLayer.back,
      `title should paint over the background patch, got ${JSON.stringify(seen.titleLayer)}`
    );
    assert.ok(
      seen.overLayer && seen.overLayer.front !== -1 && seen.overLayer.front < seen.overLayer.back,
      `copy should paint over the fixed video's patch, got ${JSON.stringify(seen.overLayer)}`
    );
    assert.ok(
      seen.plainLayer && seen.plainLayer.front !== -1 && seen.plainLayer.front < seen.plainLayer.back,
      `canvas patch should cover the canvas, got ${JSON.stringify(seen.plainLayer)}`
    );
    assert.ok(
      seen.modalLayer && seen.modalLayer.front !== -1 && seen.modalLayer.front < seen.modalLayer.back,
      `modal canvas should stay covered, got ${JSON.stringify(seen.modalLayer)}`
    );
  });
});
