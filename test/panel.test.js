// @ts-check

/* The panels report on the page while covering part of it, so they can be
   dragged out of the way by their title bar. */

const { test } = require("node:test");
const assert = require("node:assert");
const { withPage, SCRIPTS, shadowBox, clickShadow } = require("./support.js");

const PAGE = `<ul><div>a div directly inside ul</div></ul>`;
const PANEL = "#js-kraftyNestInformation";

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
 * Drag the title bar by the given offset. The bar lives in the panel's
 * shadow root, so the handle is resolved there rather than via a light
 * selector under the host.
 *
 * @param {import("puppeteer").Page} page
 * @param {number} byX
 * @param {number} byY
 */
async function dragBar(page, byX, byY) {
  const bar = await shadowBox(page, PANEL, ".kraftyPanelBar");
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

  /* The title bar is the only handle and carries the close button, so a
     panel whose bar is off screen is stranded - not merely awkward. */
  await t.test("keeps the title bar reachable on a short viewport", async () => {
    for (const height of [320, 240, 180]) {
      const bar = await withPage(
        { html: PAGE, checkers: ["nestCheck"], width: 1000, height },
        async (page) =>
          page.evaluate(() => {
            const panel = document.getElementById("js-kraftyNestInformation");
            const handle = kraftyPanelRoot(panel)?.querySelector(".kraftyPanelBar");
            const box = handle?.getBoundingClientRect();

            return box
              ? { top: box.top, bottom: box.bottom, viewport: window.innerHeight }
              : null;
          })
      );

      assert.ok(bar, `no panel at ${height}px`);
      assert.ok(bar.top >= 0, `bar above the top at ${height}px: ${bar.top}`);
      assert.ok(
        bar.bottom <= bar.viewport,
        `bar below the fold at ${height}px: ${bar.bottom}`
      );
    }
  });

  /* Docking devtools is the everyday version of this: the page viewport
     shrinks under a panel that was dragged near the bottom, and it drops out
     of sight with no handle left to grab. */
  await t.test("pulls a moved panel back when the viewport shrinks", async () => {
    const after = await withPage(
      { html: PAGE, checkers: ["nestCheck"], width: 1200, height: 900 },
      async (page) => {
        await dragBar(page, 0, 260);
        await page.setViewport({ width: 1200, height: 300 });
        /* The handler coalesces onto an animation frame. */
        await new Promise((resolve) => setTimeout(resolve, 250));

        return page.evaluate(() => {
          const panel = document.getElementById("js-kraftyNestInformation");
          const handle = kraftyPanelRoot(panel)?.querySelector(".kraftyPanelBar");
          const box = handle?.getBoundingClientRect();

          return box
            ? { top: box.top, bottom: box.bottom, viewport: window.innerHeight }
            : null;
        });
      }
    );

    assert.ok(after, "the panel disappeared entirely");
    assert.ok(after.top >= 0, `bar left above the viewport: ${after.top}`);
    assert.ok(
      after.bottom <= after.viewport,
      `bar left below the viewport: ${after.bottom}`
    );
  });

  /* With devtools open the browser can treat input as touch, and a bar
     without touch-action lets it claim the gesture as a scroll: the panel
     jumps once, then sits still while the page pans behind it. Reported as
     "the window cannot be grabbed once devtools is showing". */
  await t.test("drags rather than scrolling the page under touch", async () => {
    const result = await withPage(
      {
        html: `<div style="height:4000px">${PAGE}</div>`,
        checkers: ["nestCheck"],
        width: 1000,
        height: 600,
        hasTouch: true,
      },
      async (page) => {
        const bar = await shadowBox(page, PANEL, ".kraftyPanelBar");
        const startX = Math.round(bar.x + bar.width / 2);
        const startY = Math.round(bar.y + bar.height / 2);

        const before = await page.evaluate(() => ({
          top: document
            .querySelector("#js-kraftyNestInformation")
            ?.getBoundingClientRect().top,
          scrollY: window.scrollY,
        }));

        /* page.mouse would not exercise this; the gesture has to arrive as
           touch for the browser to consider scrolling instead. */
        const cdp = await page.createCDPSession();
        /**
         * @param {"touchStart" | "touchMove" | "touchEnd"} type
         * @param {number} y
         */
        const send = (type, y) =>
          cdp.send("Input.dispatchTouchEvent", {
            type,
            touchPoints: type === "touchEnd" ? [] : [{ x: startX, y }],
          });

        await send("touchStart", startY);
        for (let step = 1; step <= 6; step += 1) {
          await send("touchMove", startY - step * 30);
          await new Promise((resolve) => setTimeout(resolve, 16));
        }
        await send("touchEnd", 0);
        await new Promise((resolve) => setTimeout(resolve, 150));

        const after = await page.evaluate(() => ({
          top: document
            .querySelector("#js-kraftyNestInformation")
            ?.getBoundingClientRect().top,
          scrollY: window.scrollY,
        }));

        return {
          moved: (after.top ?? 0) - (before.top ?? 0),
          scrolled: after.scrollY - before.scrollY,
        };
      }
    );

    assert.strictEqual(
      result.scrolled,
      0,
      "the page scrolled, so the browser took the gesture"
    );
    assert.ok(
      result.moved < -100,
      `the panel barely moved: ${result.moved}px of an intended -180`
    );
  });

  await t.test("closing does not drag, and closes", async () => {
    const result = await withPage(
      { html: PAGE, checkers: ["nestCheck"], width: 1000, height: 700 },
      async (page) => {
        await clickShadow(page, PANEL, ".kraftyPanelClose");

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

  /* Item 24: open shadow on the host. The host stays in the light DOM for
     getElementById; chrome and findings live under shadowRoot. */
  await t.test("hosts findings in an open shadow root", async () => {
    const state = await withPage(
      { html: PAGE, checkers: ["nestCheck"] },
      async (page) =>
        page.evaluate(() => {
          const panel = document.getElementById("js-kraftyNestInformation");
          const root = panel?.shadowRoot;

          return {
            host: panel !== null,
            hostClass: panel?.classList.contains("kraftyPanel") ?? false,
            hasShadow: root !== null && root !== undefined,
            bar: root?.querySelector(".kraftyPanelBar") !== null,
            lightBar: panel?.querySelector(".kraftyPanelBar") !== null,
          };
        })
    );

    assert.ok(state.host, "panel host should stay in the light DOM");
    assert.ok(state.hostClass, "host should keep kraftyPanel");
    assert.ok(state.hasShadow, "panel.shadowRoot should be non-null");
    assert.ok(state.bar, "chrome should live in the shadow");
    assert.strictEqual(
      state.lightBar,
      false,
      "chrome must not remain a light-DOM child of the host"
    );
  });

  /* After the shadow split, max-height on the host alone was not enough: the
     shell grew with its content and painted past the host (overflow visible).
     Tall findings must scroll inside .kraftyPanelBody instead. */
  await t.test("scrolls tall findings inside the panel", async () => {
    const tall = Array.from(
      { length: 40 },
      () => `<button type="button"><svg></svg></button>`
    ).join("");

    const size = await withPage(
      {
        html: tall,
        checkers: ["markupCheck"],
        width: 1000,
        height: 600,
      },
      async (page) =>
        page.evaluate(() => {
          const panel = document.getElementById("js-kraftyMarkupInformation");
          const body = panel?.shadowRoot?.querySelector(".kraftyPanelBody");
          const box = panel?.getBoundingClientRect();

          return {
            panelHeight: box?.height ?? 0,
            viewport: window.innerHeight,
            bodyScroll: body
              ? {
                  scrollHeight: body.scrollHeight,
                  clientHeight: body.clientHeight,
                }
              : null,
          };
        })
    );

    assert.ok(size.bodyScroll, "panel body should exist");
    assert.ok(
      size.panelHeight <= size.viewport * 0.8 + 1,
      `panel grew past 80% of the viewport: ${size.panelHeight} in ${size.viewport}`
    );
    assert.ok(
      size.bodyScroll.scrollHeight > size.bodyScroll.clientHeight,
      `body should scroll when findings are tall: scroll=${size.bodyScroll.scrollHeight} client=${size.bodyScroll.clientHeight}`
    );
  });

  /* The host is still a light-DOM div. Pages with a reset like
     timetechnologies.ltd set `div { background: transparent }`, which would
     clear a white background painted on :host. Paint lives on the shell
     inside the shadow, which that rule cannot reach. */
  await t.test("page div background reset does not clear the panel shell", async () => {
    const colors = await withPage(
      {
        html: `<style>div { background: transparent !important; }</style>
               <ul><div>a div directly inside ul</div></ul>`,
        checkers: ["nestCheck"],
      },
      async (page) =>
        page.evaluate(() => {
          const panel = document.getElementById("js-kraftyNestInformation");
          const shell = panel?.shadowRoot?.querySelector(".kraftyPanelShell");

          return {
            host: panel ? getComputedStyle(panel).backgroundColor : null,
            shell: shell ? getComputedStyle(shell).backgroundColor : null,
          };
        })
    );

    assert.ok(colors.shell, "shell should exist");
    assert.notStrictEqual(
      colors.shell,
      "rgba(0, 0, 0, 0)",
      `shell must stay opaque, got ${colors.shell}`
    );
    assert.notStrictEqual(
      colors.shell,
      "transparent",
      `shell must stay opaque, got ${colors.shell}`
    );
  });

  /* Amazon and similar pages set ul, ol { list-style: disc !important }. Before
     the shadow, that overrode the panel's list-style:none. Shadow styles are
     local, so the page rule must not put bullets on findings lists. */
  await t.test("page list-style does not put bullets on shadow findings", async () => {
    const styles = await withPage(
      {
        html: `<style>ul, ol { list-style: disc !important; }</style>
               <div id="d"></div><div id="d"></div>`,
        checkers: ["markupCheck"],
      },
      async (page) =>
        page.evaluate(() => {
          const panel = document.getElementById("js-kraftyMarkupInformation");
          const root = panel?.shadowRoot;
          const checks = root?.querySelector(".kraftyChecks");
          const list = root?.querySelector(".kraftyPanelList");

          return {
            hasShadow: root != null,
            checks: checks ? getComputedStyle(checks).listStyleType : null,
            list: list ? getComputedStyle(list).listStyleType : null,
          };
        })
    );

    assert.ok(styles.hasShadow, "expected an open shadow root");
    assert.strictEqual(styles.checks, "none");
    assert.strictEqual(styles.list, "none");
  });
});
