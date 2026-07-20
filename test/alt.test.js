// @ts-check

/* The alt checker draws its labels on top of the page, which is the whole
   difficulty. Measured on amazon.co.jp, where alt text is the product name:
   an opaque box of a hundred characters in a grid cell grew tall enough to
   hide the image underneath it, and 33 of 92 labels sat on another label.

   Hiding the image defeats the checker. Whether an alt describes its image
   is the one question here a person has to answer, and they cannot answer
   it about an image they cannot see. So these are mostly about size. */

const { test } = require("node:test");
const assert = require("node:assert");
const { withPage, SCRIPTS } = require("./support.js");

const LONG =
  "[Yezai] Tシャツ メンズ 半袖 夏服 接触冷感 オーバーサイズ 通気性 " +
  "吸汗 速乾 7分袖 ゆったり 大きいサイズ 無地 トップス ティーシャツ " +
  "greyblue-XXL 360度全方位UVカット 認証済み";

const PIXEL =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"></svg>`
  );

/** @param {string} html */
const measure = (html) =>
  withPage({ html, checkers: ["altCheck"], width: 1280, height: 900 }, (page) =>
    page.evaluate(() => {
      const labels = [...document.querySelectorAll(".kraftyAltContent")];

      return labels.map((label) => ({
        height: label.getBoundingClientRect().height,
        clipped: label.scrollHeight > label.clientHeight,
        title: label.getAttribute("title") ?? "",
        text: label.textContent ?? "",
      }));
    })
  );

test("alt checker", async (t) => {
  await t.test("clips a long alt rather than growing over the image", async () => {
    const [label] = await measure(
      `<img src="${PIXEL}" alt="${LONG}" width="200" height="200">`
    );

    /* scrollHeight past clientHeight is the clamp doing its job, with no
       threshold to argue about. */
    assert.strictEqual(
      label.clipped,
      true,
      "a product name's worth of alt has to be cut, not drawn in full"
    );

    /* And the box that remains has to be small enough to leave the picture
       visible: two lines and its padding, well under a 200px image. */
    assert.ok(
      label.height < 70,
      `expected a short label, got ${Math.round(label.height)}px`
    );
  });

  await t.test("leaves a short alt alone", async () => {
    const [label] = await measure(
      `<img src="${PIXEL}" alt="マウス" width="200" height="200">`
    );

    assert.strictEqual(
      label.clipped,
      false,
      "nothing to clip, so nothing should be clipped"
    );
  });

  await t.test("keeps the whole alt reachable from the label", async () => {
    /* Clipping must not lose the text. It is the thing being reviewed. */
    const [label] = await measure(
      `<img src="${PIXEL}" alt="${LONG}" width="200" height="200">`
    );

    assert.match(label.title, /greyblue-XXL/);
    assert.match(label.text, /Yezai/);
  });

  await t.test("opens to the full text on hover", async () => {
    const heights = await withPage(
      {
        html: `<img src="${PIXEL}" alt="${LONG}" width="200" height="200">`,
        checkers: ["altCheck"],
        width: 1280,
        height: 900,
      },
      async (page) => {
        const closed = await page.evaluate(
          () =>
            document
              .querySelector(".kraftyAltContent")
              ?.getBoundingClientRect().height ?? 0
        );

        await page.hover(".kraftyAltContent");

        const open = await page.evaluate(
          () =>
            document
              .querySelector(".kraftyAltContent")
              ?.getBoundingClientRect().height ?? 0
        );

        return { closed, open };
      }
    );

    assert.ok(
      heights.open > heights.closed,
      `hovering should show the rest: ${Math.round(
        heights.closed
      )}px then ${Math.round(heights.open)}px`
    );
  });

  await t.test("still separates a missing alt from a deliberately empty one", async () => {
    /* The two look identical in a browser and mean opposite things, which
       is the reason this checker exists. */
    const states = await withPage(
      {
        html: `<img src="${PIXEL}" width="10" height="10">
               <img src="${PIXEL}" alt="" width="10" height="10">`,
        checkers: ["altCheck"],
      },
      (page) =>
        page.evaluate(() => ({
          missing: document.querySelectorAll(".kraftyAltMissing").length,
          empty: document.querySelectorAll(".kraftyAltEmpty").length,
        }))
    );

    assert.deepStrictEqual(states, { missing: 1, empty: 1 });
  });

  await t.test("leaves nothing behind when toggled off", async () => {
    const after = await withPage(
      {
        html: `<img src="${PIXEL}" alt="x" width="10" height="10">`,
        checkers: ["altCheck"],
      },
      async (page) => {
        await page.evaluate(SCRIPTS.altCheck);

        return page.evaluate(() => ({
          labels: document.querySelectorAll(".kraftyAltContent").length,
          bodyClass: document.body.classList.contains("kraftyAltChecker"),
        }));
      }
    );

    assert.strictEqual(after.labels, 0);
    assert.strictEqual(after.bodyClass, false);
  });
});
