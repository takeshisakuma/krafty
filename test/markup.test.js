// @ts-check

/* The markup checker reports what is wrong in ways the page does not show.

   It starts with duplicated ids, which is the cheapest decision in the
   project - so most of these are about the edges where counting could go
   wrong: the checker's own panel, ids in the head, an empty id, and making
   sure a page that is fine says so. */

const { test } = require("node:test");
const assert = require("node:assert");
const { withPage, SCRIPTS } = require("./support.js");

/** @param {string} html */
async function check(html) {
  return withPage({ html, checkers: ["markupCheck"] }, async (page) =>
    page.evaluate(() => {
      const panel = document.getElementById("js-kraftyMarkupInformation");

      return {
        findings: [...(panel?.querySelectorAll(".kraftyCheck") ?? [])].map(
          (item) => item.textContent ?? ""
        ),
        rows: [...(panel?.querySelectorAll(".kraftyPanelList li") ?? [])].map(
          (item) => item.textContent ?? ""
        ),
        summary:
          panel?.querySelector(".kraftyChecksSummary")?.textContent ?? "",
      };
    })
  );
}

test("markup checker", async (t) => {
  await t.test("reports an id used more than once", async () => {
    const result = await check(
      `<div id="main">a</div><div id="main">b</div>`
    );

    assert.strictEqual(result.findings.length, 1);
    assert.match(result.findings[0], /\b1\b/);
    assert.strictEqual(result.rows.length, 1);
    assert.match(result.rows[0], /#main/);
    assert.match(result.rows[0], /2/);
  });

  await t.test("says nothing about a page whose ids are unique", async () => {
    const result = await check(
      `<div id="a">a</div><div id="b">b</div><p>no id at all</p>`
    );

    assert.deepStrictEqual(result.findings, []);

    /* Same narrow claim as every other panel: what was checked, not the
       page. */
    assert.match(result.summary, /automatically/);
  });

  await t.test("counts each duplicated id once, worst first", async () => {
    const result = await check(
      `<i id="x"></i><i id="x"></i><i id="x"></i>
       <i id="y"></i><i id="y"></i>
       <i id="z"></i>`
    );

    assert.strictEqual(result.findings.length, 1);
    assert.match(result.findings[0], /\b2\b/, "two ids, not five elements");

    assert.strictEqual(result.rows.length, 2);
    assert.match(result.rows[0], /#x/);
    assert.match(result.rows[1], /#y/);
  });

  await t.test("never counts its own panel", async () => {
    /* The panel carries an id, and so does every other panel. A checker
       that reported those would invent findings out of its own interface -
       and running it twice would grow the count. */
    const result = await withPage(
      { html: `<div id="only">a</div>`, checkers: ["headCheck", "markupCheck"] },
      async (page) => {
        await page.evaluate(SCRIPTS.markupCheck);
        await page.evaluate(SCRIPTS.markupCheck);

        return page.evaluate(() => {
          const panel = document.getElementById("js-kraftyMarkupInformation");
          return [
            ...(panel?.querySelectorAll(".kraftyCheck") ?? []),
          ].map((item) => item.textContent ?? "");
        });
      }
    );

    assert.deepStrictEqual(result, []);
  });

  await t.test("sees an id in the head as well as the body", async () => {
    const result = await withPage(
      { html: `<div id="shared">a</div>`, checkers: [] },
      async (page) => {
        await page.evaluate(() => {
          document.head.insertAdjacentHTML(
            "beforeend",
            `<meta id="shared" name="x" content="y">`
          );
        });

        await page.evaluate(SCRIPTS.markupCheck);

        return page.evaluate(() => {
          const panel = document.getElementById("js-kraftyMarkupInformation");
          return [
            ...(panel?.querySelectorAll(".kraftyPanelList li") ?? []),
          ].map((item) => item.textContent ?? "");
        });
      }
    );

    assert.strictEqual(result.length, 1);
    assert.match(result[0], /#shared/);
  });

  await t.test("does not treat two empty ids as a collision", async () => {
    /* id="" is its own defect and not this one. Counting them together
       would report a duplicate whose name is nothing. */
    const result = await check(`<div id="">a</div><div id="">b</div>`);

    assert.deepStrictEqual(result.findings, []);
  });

  await t.test("leaves nothing behind when toggled off", async () => {
    const after = await withPage(
      { html: `<div id="d"></div><div id="d"></div>`, checkers: ["markupCheck"] },
      async (page) => {
        await page.evaluate(SCRIPTS.markupCheck);

        return page.evaluate(() => ({
          panel:
            document.getElementById("js-kraftyMarkupInformation") !== null,
          bodyClass: document.body.classList.contains("kraftyMarkupChecker"),
        }));
      }
    );

    assert.strictEqual(after.panel, false);
    assert.strictEqual(after.bodyClass, false);
  });
});
