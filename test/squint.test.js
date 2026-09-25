// @ts-check

/* The squint checker (item 27) is the brightness screen with blur in place
   of grayscale, so it inherits that checker's tests: no panel moves, the
   page stays usable, nothing is left behind.

   What is its own is that the two combine. Squinting in monochrome is the
   common way to do it, and neither checker knows the other exists, so the
   only proof they compose is the pixels - read here from a real screenshot
   rather than from computed style, which would say both screens are there
   without saying the page looks any different. */

const { test } = require("node:test");
const assert = require("node:assert");
const { withPage, SCRIPTS } = require("./support.js");

const TALL = `<div style="height:3000px"><ul><div>x</div></ul></div>`;

/* A hard edge down the middle: red on the left, white on the right. Sharp,
   the pixel beside the edge is pure red; blurred, it is a mix; greyed, the
   middle of the red is no longer red. */
const EDGE = `<style>html,body{margin:0}</style>
  <div style="position:fixed;inset:0 50% 0 0;background:#f00"></div>
  <div style="position:fixed;inset:0 0 0 50%;background:#fff"></div>`;

/**
 * Read pixels out of a screenshot of the page, by loading it into a canvas.
 * The screens are fixed overlays and a canvas is not painted, so the page
 * itself is where the decoding is done.
 *
 * @param {import("puppeteer").Page} page
 * @param {[number, number][]} points
 * @returns {Promise<number[][]>}
 */
async function pixels(page, points) {
  const shot = await page.screenshot({ encoding: "base64" });

  return page.evaluate(
    async (/** @type {string} */ data, /** @type {[number, number][]} */ at) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();

      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = /** @type {CanvasRenderingContext2D} */ (
        canvas.getContext("2d")
      );
      context.drawImage(image, 0, 0);

      return at.map(([x, y]) => [...context.getImageData(x, y, 1, 1).data]);
    },
    shot,
    points
  );
}

/* One pixel inside the red, beside the edge; and one in the middle of it. */
const BESIDE_EDGE = /** @type {[number, number]} */ ([198, 150]);
const MIDDLE_OF_RED = /** @type {[number, number]} */ ([100, 150]);

test("squint checker", async (t) => {
  await t.test("blurs the page without moving a panel", async () => {
    const seen = await withPage(
      { html: TALL, checkers: ["nestCheck"], width: 900, height: 600 },
      async (page) => {
        const panelTop = () =>
          page.evaluate(
            () =>
              document
                .getElementById("js-kraftyNestInformation")
                ?.getBoundingClientRect().top ?? null
          );

        await page.evaluate(() => window.scrollTo(0, 1200));

        const before = await panelTop();

        await page.evaluate(SCRIPTS.squintCheck);

        return {
          before,
          after: await panelTop(),
          filter: await page.evaluate(() => {
            const screen = document.getElementById("js-kraftySquintScreen");
            return screen ? getComputedStyle(screen).backdropFilter : "no screen";
          }),
        };
      }
    );

    assert.match(seen.filter, /blur/);
    assert.strictEqual(
      Math.round(Number(seen.after)),
      Math.round(Number(seen.before)),
      "a panel is fixed to the viewport and must stay where it was"
    );
  });

  await t.test("softens an edge that was sharp", async () => {
    const [sharp, blurred] = await withPage(
      { html: EDGE, width: 400, height: 300 },
      async (page) => {
        const [before] = await pixels(page, [BESIDE_EDGE]);
        await page.evaluate(SCRIPTS.squintCheck);
        const [after] = await pixels(page, [BESIDE_EDGE]);
        return [before, after];
      }
    );

    assert.deepStrictEqual(sharp.slice(0, 3), [255, 0, 0]);
    assert.ok(
      blurred[1] > 40 && blurred[2] > 40,
      `the white beside it should bleed in, got ${blurred}`
    );
  });

  await t.test("combines with brightness in either order", async () => {
    for (const order of [
      ["squintCheck", "brightnessCheck"],
      ["brightnessCheck", "squintCheck"],
    ]) {
      const [edge, middle] = await withPage(
        { html: EDGE, width: 400, height: 300 },
        async (page) => {
          for (const name of order) {
            await page.evaluate(SCRIPTS[/** @type {"squintCheck"} */ (name)]);
          }
          return pixels(page, [BESIDE_EDGE, MIDDLE_OF_RED]);
        }
      );

      const [r, g, b] = middle;
      assert.ok(
        Math.abs(r - g) < 8 && Math.abs(g - b) < 8,
        `${order.join(" then ")}: the red should be grey, got ${middle}`
      );
      assert.ok(
        edge[0] > middle[0] + 20,
        `${order.join(" then ")}: the edge should still be blurred, got ${edge} beside ${middle}`
      );
    }
  });

  await t.test("leaves the page underneath usable", async () => {
    const events = await withPage(
      { html: `<button id="under">press</button>`, checkers: [] },
      async (page) => {
        await page.evaluate(SCRIPTS.squintCheck);

        await page.evaluate(() => {
          const button = document.getElementById("under");
          button?.addEventListener("click", () => {
            button.dataset.pressed = "yes";
          });
        });

        await page.click("#under");

        return page.evaluate(
          () => document.getElementById("under")?.dataset.pressed ?? "no"
        );
      }
    );

    assert.strictEqual(events, "yes");
  });

  await t.test("leaves nothing behind when toggled off", async () => {
    const after = await withPage(
      { html: "<p>page</p>", checkers: [] },
      async (page) => {
        await page.evaluate(SCRIPTS.squintCheck);
        await page.evaluate(SCRIPTS.squintCheck);

        return page.evaluate(() => ({
          screen: document.getElementById("js-kraftySquintScreen") !== null,
          bodyClass: document.body.classList.contains("kraftySquintChecker"),
        }));
      }
    );

    assert.deepStrictEqual(after, { screen: false, bodyClass: false });
  });
});
