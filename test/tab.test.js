// @ts-check

/* The tab checker draws the order Tab walks. It does not compare that order
   to where things sit on the page, and it does not repeat the positive
   tabindex finding the markup checker already makes. */

const { test } = require("node:test");
const assert = require("node:assert");
const { withPage, SCRIPTS } = require("./support.js");

/**
 * @param {string} html
 */
async function check(html) {
  return withPage({ html, checkers: ["tabCheck"] }, async (page) =>
    page.evaluate(() => {
      const panel = document.getElementById("js-kraftyTabInformation");
      const root = kraftyPanelRoot(panel);

      return {
        findings: [...(root?.querySelectorAll(".kraftyCheck") ?? [])].map(
          (item) => item.textContent ?? ""
        ),
        rows: [...(root?.querySelectorAll(".kraftyOutlineItem") ?? [])].map(
          (item) => item.textContent ?? ""
        ),
      };
    })
  );
}

test("tab checker", async (t) => {
  await t.test("lists focusable controls in tab order", async () => {
    const result = await check(`
      <button>Second</button>
      <a href="#a">Third</a>
      <button tabindex="2">Later</button>
      <button tabindex="1">Before</button>
      <button tabindex="-1">Skip</button>
      <button disabled>No</button>
      <div style="display:none"><button>Hidden</button></div>
    `);

    assert.deepStrictEqual(result.findings, []);
    assert.deepStrictEqual(result.rows.map((row) => row.replace(/\s+/g, "")), [
      "buttonBeforetabindex=1",
      "buttonLatertabindex=2",
      "buttonSecond",
      "aThird",
    ]);
  });

  await t.test("names a field by its label", async () => {
    const result = await check(`
      <label for="email">Email address</label>
      <input id="email" type="email">
    `);

    assert.strictEqual(result.rows.length, 1);
    assert.match(result.rows[0], /input email/);
    assert.match(result.rows[0], /Email address/);
  });

  await t.test("says when nothing is reachable", async () => {
    const result = await check(`<p>Just words.</p>`);

    assert.strictEqual(result.rows.length, 0);
    assert.match(result.findings[0], /Nothing on this page can be reached/);
  });

  await t.test("leaves nothing behind when toggled off", async () => {
    const after = await withPage(
      { html: `<button>Go</button>`, checkers: ["tabCheck"] },
      async (page) => {
        await page.evaluate(SCRIPTS.tabCheck);

        return page.evaluate(() => ({
          panel: document.getElementById("js-kraftyTabInformation") !== null,
          bodyClass: document.body.classList.contains("kraftyTabChecker"),
        }));
      }
    );

    assert.strictEqual(after.panel, false);
    assert.strictEqual(after.bodyClass, false);
  });
});
