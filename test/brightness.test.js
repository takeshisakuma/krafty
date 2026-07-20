// @ts-check

/* The brightness checker used to grey the page with a filter on <body>.

   `filter` makes an element the containing block for every fixed-position
   descendant, and every panel here is fixed, so greying the body re-anchored
   them to the document and scrolled them off the screen. That was known for
   the one panel that existed at the time, and the answer was for this
   checker to delete the head panel by name. Four panels were built
   afterwards and none of them were added to that line, so whether a panel
   vanished or was flung away depended on whether anyone had remembered it.

   These pin the fix: the page greys, and no panel notices. */

const { test } = require("node:test");
const assert = require("node:assert");
const { withPage, SCRIPTS } = require("./support.js");

const TALL = `<div style="height:3000px"><ul><div>x</div></ul></div>`;

test("brightness checker", async (t) => {
  await t.test("greys the page without moving a panel", async () => {
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

        /* Scrolled, because the fault only showed once the document and the
           viewport disagreed about where the top was. */
        await page.evaluate(() => window.scrollTo(0, 1200));

        const before = await panelTop();

        await page.evaluate(SCRIPTS.brightnessCheck);

        return {
          before,
          after: await panelTop(),
          greyed: await page.evaluate(() => {
            const screen = document.getElementById(
              "js-kraftyBrightnessScreen"
            );
            return screen
              ? getComputedStyle(screen).backdropFilter
              : "no screen";
          }),
        };
      }
    );

    assert.match(seen.greyed, /grayscale/);
    assert.strictEqual(
      Math.round(Number(seen.after)),
      Math.round(Number(seen.before)),
      "a panel is fixed to the viewport and must stay where it was"
    );
  });

  await t.test("no longer deletes the head panel by name", async () => {
    const survived = await withPage(
      { html: "<p>page</p>", checkers: [] },
      async (page) => {
        await page.evaluate(() =>
          document.head.insertAdjacentHTML("beforeend", "<title>t</title>")
        );

        await page.evaluate(SCRIPTS.headCheck);
        await page.evaluate(SCRIPTS.brightnessCheck);

        return page.evaluate(() => ({
          panel: document.getElementById("js-kraftyHeadInformation") !== null,
          active: document.body.classList.contains("kraftyHeadChecker"),
        }));
      }
    );

    assert.deepStrictEqual(survived, { panel: true, active: true });
  });

  await t.test("leaves the page underneath usable", async () => {
    /* A viewing mode, not a modal. A screen that swallowed clicks would
       stop the reviewer opening the very thing they wanted to look at. */
    const events = await withPage(
      { html: `<button id="under">press</button>`, checkers: [] },
      async (page) => {
        await page.evaluate(SCRIPTS.brightnessCheck);

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
        await page.evaluate(SCRIPTS.brightnessCheck);
        await page.evaluate(SCRIPTS.brightnessCheck);

        return page.evaluate(() => ({
          screen: document.getElementById("js-kraftyBrightnessScreen") !== null,
          bodyClass: document.body.classList.contains(
            "kraftyBrightnessChecker"
          ),
        }));
      }
    );

    assert.deepStrictEqual(after, { screen: false, bodyClass: false });
  });
});
