// @ts-check

/* Reset is not a checker. It re-runs each checker that is on, and the
   re-run is that checker's own off path: a panel is removed, a screen is
   removed, dummy puts the original words back. Stripping the body class
   would leave all three behind. */

const { test } = require("node:test");
const assert = require("node:assert");
const { withPage, SCRIPTS } = require("./support.js");

test("reset", async (t) => {
  await t.test("turns off a panel, an overlay, the manuscript and dummy", async () => {
    const after = await withPage(
      {
        html: `<p id="copy">Real name</p><div id="secret" style="display:none">Hidden menu</div><ul><div>x</div></ul>`,
        checkers: ["nestCheck", "squintCheck", "manuscriptCheck", "dummyCheck"],
      },
      async (page) => {
        const before = await page.evaluate(() => ({
          panel: document.getElementById("js-kraftyNestInformation") !== null,
          screen: document.getElementById("js-kraftySquintScreen") !== null,
          manuscript: document.body.classList.contains("kraftyManuscriptChecker"),
          dummy: document.body.classList.contains("kraftyDummyChecker"),
          text: document.getElementById("copy")?.textContent ?? "",
        }));

        await page.evaluate(SCRIPTS.nestCheck);
        await page.evaluate(SCRIPTS.squintCheck);
        await page.evaluate(SCRIPTS.manuscriptCheck);
        await page.evaluate(SCRIPTS.dummyCheck);

        const cleared = await page.evaluate(() => ({
          panel: document.getElementById("js-kraftyNestInformation") !== null,
          screen: document.getElementById("js-kraftySquintScreen") !== null,
          manuscript: document.body.classList.contains("kraftyManuscriptChecker"),
          root: document.documentElement.classList.contains("kraftyManuscriptRoot"),
          dummy: document.body.classList.contains("kraftyDummyChecker"),
          text: document.getElementById("copy")?.textContent ?? "",
          secret: (() => {
            const el = document.getElementById("secret");
            return el ? getComputedStyle(el).display : "";
          })(),
          marks:
            document.querySelector(
              "[data-krafty-manuscript-flow], [data-krafty-manuscript-away]"
            ) !== null,
        }));

        return { before, cleared };
      }
    );

    assert.strictEqual(after.before.panel, true);
    assert.strictEqual(after.before.screen, true);
    assert.strictEqual(after.before.manuscript, true);
    assert.strictEqual(after.before.dummy, true);
    assert.notStrictEqual(after.before.text, "Real name");
    assert.deepStrictEqual(after.cleared, {
      panel: false,
      screen: false,
      manuscript: false,
      root: false,
      dummy: false,
      text: "Real name",
      secret: "none",
      marks: false,
    });
  });
});
