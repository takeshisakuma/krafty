// @ts-check

/* The outline checker is a body class and a stylesheet rule. The failure
   mode is quiet: the class toggles, the page looks unchanged, because a
   focus-ring reset of `* { outline: none !important }` beats a normal
   declaration. */

const { test } = require("node:test");
const assert = require("node:assert");
const { withPage, SCRIPTS } = require("./support.js");

test("outline checker", async (t) => {
  await t.test("draws a red outline on page elements", async () => {
    const outline = await withPage(
      {
        html: `<main><p>copy</p></main>`,
        checkers: ["outlineCheck"],
      },
      async (page) =>
        page.evaluate(() => {
          const sample = document.querySelector("p");
          const cs = sample ? getComputedStyle(sample) : null;

          return {
            bodyClass: document.body.classList.contains("kraftyOutlineChecker"),
            style: cs?.outlineStyle ?? null,
            color: cs?.outlineColor ?? null,
            width: cs?.outlineWidth ?? null,
          };
        })
    );

    assert.strictEqual(outline.bodyClass, true);
    assert.strictEqual(outline.style, "solid");
    assert.strictEqual(outline.color, "rgb(255, 0, 0)");
    assert.strictEqual(outline.width, "1px");
  });

  await t.test("beats a page-wide outline none !important reset", async () => {
    /* scalermusic.com. Without !important on Krafty's rule the checker
       appears to do nothing. */
    const outline = await withPage(
      {
        html: `<style>* { outline: none !important; outline-style: none !important; }</style>
               <main><p>copy</p></main>`,
        checkers: ["outlineCheck"],
      },
      async (page) =>
        page.evaluate(() => {
          const sample = document.querySelector("p");
          const cs = sample ? getComputedStyle(sample) : null;

          return {
            style: cs?.outlineStyle ?? null,
            color: cs?.outlineColor ?? null,
          };
        })
    );

    assert.strictEqual(outline.style, "solid");
    assert.strictEqual(outline.color, "rgb(255, 0, 0)");
  });

  await t.test("leaves nothing behind when toggled off", async () => {
    const after = await withPage(
      {
        html: `<p>copy</p>`,
        checkers: ["outlineCheck"],
      },
      async (page) => {
        await page.evaluate(SCRIPTS.outlineCheck);

        return page.evaluate(() => {
          const sample = document.querySelector("p");

          return {
            bodyClass: document.body.classList.contains("kraftyOutlineChecker"),
            style: sample ? getComputedStyle(sample).outlineStyle : null,
          };
        });
      }
    );

    assert.strictEqual(after.bodyClass, false);
    assert.strictEqual(after.style, "none");
  });
});
