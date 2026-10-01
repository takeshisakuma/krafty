// @ts-check

/* Sizes are reported as measurements. A control at 24px or above says
   nothing, and a link in a sentence is not a control whose box we measured
   into a finding. */

const { test } = require("node:test");
const assert = require("node:assert");
const { withPage, SCRIPTS } = require("./support.js");

/**
 * @param {string} html
 */
async function check(html) {
  return withPage({ html, checkers: ["targetCheck"] }, async (page) =>
    page.evaluate(() => {
      const panel = document.getElementById("js-kraftyTargetInformation");
      const root = kraftyPanelRoot(panel);

      return {
        findings: [...(root?.querySelectorAll(".kraftyCheck") ?? [])].map(
          (item) => item.textContent ?? ""
        ),
        rows: [...(root?.querySelectorAll(".kraftyPanelList li") ?? [])].map(
          (item) => item.textContent ?? ""
        ),
        note: root?.querySelector(".kraftyNote")?.textContent ?? "",
      };
    })
  );
}

test("target checker", async (t) => {
  await t.test("leaves out a control whose only short side is its line", async () => {
    const result = await check(`
      <a href="/news" style="display:inline-block;width:120px;height:18px">News</a>
      <a id="icon" href="/x" style="display:inline-block;width:16px;height:16px"></a>
    `);

    assert.match(result.findings.join(" "), /1 control/);
    assert.ok(result.rows.some((row) => /a#icon/.test(row)));
    assert.ok(!result.rows.some((row) => /News/.test(row)));
  });

  await t.test("puts the same wording on one row, with a count", async () => {
    const box =
      "display:inline-block;box-sizing:border-box;padding:0;border:0;min-width:0;width:16px;height:16px";
    const result = await check(`
      <a id="one" href="/a" style="${box}">Jump</a>
      <a id="two" href="/b" style="${box}">Jump</a>
      <a id="three" href="/c" style="${box}">Jump</a>
      <button style="${box}">Close</button>
    `);

    assert.match(result.findings.join(" "), /4 controls/);
    assert.strictEqual(result.rows.length, 2);
    assert.ok(result.rows.some((row) => /Jump/.test(row) && / ×3/.test(row)));
    assert.ok(result.rows.some((row) => /Close/.test(row) && !/ ×/.test(row)));
    assert.ok(!result.rows.some((row) => /#one|#two|#three/.test(row)));
  });

  await t.test("groups an unnamed control only when the size matches", async () => {
    /** @param {number} size */
    const bare = (size) =>
      `<button style="box-sizing:border-box;padding:0;border:0;min-width:0;width:${size}px;height:${size}px"></button>`;
    const result = await check(`
      ${bare(10)}
      ${bare(10)}
      ${bare(16)}
    `);

    assert.match(result.findings.join(" "), /3 controls/);
    assert.strictEqual(result.rows.length, 2);
    assert.ok(result.rows.some((row) => /10×10/.test(row) && / ×2/.test(row)));
    assert.ok(result.rows.some((row) => /16×16/.test(row) && !/×2/.test(row)));
  });

  await t.test("lists buttons and links under 24px on both sides", async () => {
    const result = await check(`
      <a id="icon" href="/x" style="display:inline-block;width:16px;height:16px"></a>
      <p>Read the <a href="/docs">docs</a> now.</p>
      <button id="ok" style="display:block;box-sizing:border-box;padding:0;border:0;min-width:0;width:40px;height:40px">Ok</button>
      <button id="go" aria-label="Go" style="display:block;box-sizing:border-box;padding:0;border:0;min-width:0;width:20px;height:18px"></button>
    `);

    assert.match(result.findings.join(" "), /2 controls/);
    assert.match(result.note, /sentence/);
    assert.ok(result.rows.some((row) => /a#icon/.test(row) && /16×16/.test(row)));
    assert.ok(
      result.rows.some((row) => /button#go/.test(row) && /20×18/.test(row)),
      result.rows.join(" | ")
    );
    assert.ok(!result.rows.some((row) => /docs/.test(row)));
    assert.ok(!result.rows.some((row) => /Ok/.test(row)));
  });

  await t.test("lists a small link that is not in a sentence", async () => {
    const result = await check(`
      <li><a href="/home" style="display:inline-block;width:16px;height:16px">Home</a></li>
    `);

    assert.strictEqual(result.rows.length, 1);
    assert.match(result.rows[0], /Home/);
  });

  await t.test("says nothing when every control is large enough", async () => {
    const result = await check(`
      <button style="box-sizing:border-box;padding:0;border:0;width:48px;height:48px">Send</button>
      <a href="/next" style="display:inline-block;width:24px;height:24px">Next</a>
    `);

    assert.deepStrictEqual(result.findings, []);
    assert.deepStrictEqual(result.rows, []);
  });

  await t.test("leaves nothing behind when toggled off", async () => {
    const after = await withPage(
      {
        html: `<button style="width:10px;height:10px">Go</button>`,
        checkers: ["targetCheck"],
      },
      async (page) => {
        await page.evaluate(SCRIPTS.targetCheck);

        return page.evaluate(() => ({
          panel: document.getElementById("js-kraftyTargetInformation") !== null,
          bodyClass: document.body.classList.contains("kraftyTargetChecker"),
        }));
      }
    );

    assert.strictEqual(after.panel, false);
    assert.strictEqual(after.bodyClass, false);
  });
});
