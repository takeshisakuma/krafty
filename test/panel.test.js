// @ts-check

/* The panels report on the page while covering part of it, so they can be
   dragged out of the way by their title bar. */

const { test } = require("node:test");
const assert = require("node:assert");
const { withPage, SCRIPTS } = require("./support.js");

const PAGE = `<ul><div>a div directly inside ul</div></ul>`;
const PANEL = "#js-kraftyNestInformation";
const BAR = `${PANEL} .kraftyPanelBar`;

/**
 * @param {import("puppeteer").Page} page
 * @param {string} selector
 */
async function boxOf(page, selector) {
  const handle = await page.$(selector);
  assert.ok(handle, `missing element: ${selector}`);

  const box = await handle.boundingBox();
  assert.ok(box, `element has no box: ${selector}`);
  return box;
}

/**
 * Drag the title bar by the given offset.
 *
 * @param {import("puppeteer").Page} page
 * @param {number} byX
 * @param {number} byY
 */
async function dragBar(page, byX, byY) {
  const bar = await boxOf(page, BAR);
  const fromX = bar.x + bar.width / 2;
  const fromY = bar.y + bar.height / 2;

  await page.mouse.move(fromX, fromY);
  await page.mouse.down();
  await page.mouse.move(fromX + byX, fromY + byY, { steps: 8 });
  await page.mouse.up();
}

test("panel dragging", async (t) => {
  await t.test("moves the panel by the drag distance", async () => {
    const { before, after } = await withPage(
      { html: PAGE, checkers: ["nestCheck"], width: 1000, height: 700 },
      async (page) => {
        const before = await boxOf(page, PANEL);
        await dragBar(page, -300, -200);
        const after = await boxOf(page, PANEL);

        return { before, after };
      }
    );

    assert.ok(
      Math.abs(after.x - (before.x - 300)) <= 2,
      `expected x near ${before.x - 300}, got ${after.x}`
    );
    assert.ok(
      Math.abs(after.y - (before.y - 200)) <= 2,
      `expected y near ${before.y - 200}, got ${after.y}`
    );
  });

  await t.test("keeps the panel inside the viewport", async () => {
    const result = await withPage(
      { html: PAGE, checkers: ["nestCheck"], width: 1000, height: 700 },
      async (page) => {
        /* Far past the bottom right corner. */
        await dragBar(page, 5000, 5000);
        const box = await boxOf(page, PANEL);

        return {
          box,
          viewport: await page.evaluate(() => ({
            width: window.innerWidth,
            height: window.innerHeight,
          })),
        };
      }
    );

    assert.ok(result.box.x >= 0, `x went negative: ${result.box.x}`);
    assert.ok(result.box.y >= 0, `y went negative: ${result.box.y}`);
    assert.ok(
      result.box.x + result.box.width <= result.viewport.width + 1,
      "panel ran off the right edge"
    );
    assert.ok(
      result.box.y + result.box.height <= result.viewport.height + 1,
      "panel ran off the bottom edge"
    );
  });

  await t.test("remembers where it was put", async () => {
    const { moved, reopened } = await withPage(
      { html: PAGE, checkers: ["nestCheck"], width: 1000, height: 700 },
      async (page) => {
        await dragBar(page, -250, -150);
        const moved = await boxOf(page, PANEL);

        /* Toggle off, then on again. */
        await page.evaluate(SCRIPTS.nestCheck);
        await page.evaluate(SCRIPTS.nestCheck);
        /* The remembered position is applied in a microtask. */
        await new Promise((resolve) => setTimeout(resolve, 50));

        return { moved, reopened: await boxOf(page, PANEL) };
      }
    );

    assert.ok(
      Math.abs(reopened.x - moved.x) <= 2 && Math.abs(reopened.y - moved.y) <= 2,
      `reopened at ${reopened.x},${reopened.y} instead of ${moved.x},${moved.y}`
    );
  });

  await t.test("closing does not drag, and closes", async () => {
    const result = await withPage(
      { html: PAGE, checkers: ["nestCheck"], width: 1000, height: 700 },
      async (page) => {
        const close = await boxOf(page, `${PANEL} .kraftyPanelClose`);

        await page.mouse.click(
          close.x + close.width / 2,
          close.y + close.height / 2
        );

        return page.evaluate(() => ({
          panel: document.querySelector("#js-kraftyNestInformation") !== null,
          errors: document.querySelectorAll(".kraftyNestError").length,
          bodyClass:
            document.body.classList.contains("kraftyNestChecker"),
        }));
      }
    );

    assert.strictEqual(result.panel, false, "panel was not removed");
    assert.strictEqual(result.errors, 0, "highlights were left behind");
    assert.strictEqual(
      result.bodyClass,
      false,
      "body class stayed, so the popup would still show this as active"
    );
  });
});
