// @ts-check

/* The heading checker reports what a machine can decide about the outline
   and shows the outline itself for a person to read. These cover the first
   half, plus the rules about which headings count at all - that part is
   where a wrong answer would be invisible and wrong in the reader's favour,
   which is the worst kind. */

const { test } = require("node:test");
const assert = require("node:assert");
const { withPage, SCRIPTS } = require("./support.js");

/**
 * @param {string} html
 */
async function check(html) {
  return withPage({ html, checkers: ["headingCheck"] }, async (page) => {
    const state = await page.evaluate(() => {
      const panel = document.getElementById("js-kraftyHeadingInformation");

      return {
        findings: [...(panel?.querySelectorAll(".kraftyCheck") ?? [])].map(
          (item) => ({
            level: item.classList.contains("kraftyCheck-alert")
              ? "alert"
              : "note",
            text: item.textContent ?? "",
          })
        ),
        summary:
          panel?.querySelector(".kraftyChecksSummary")?.textContent ?? "",
        outline: [
          ...(panel?.querySelectorAll(".kraftyOutlineItem") ?? []),
        ].map((item) => ({
          tag: item.querySelector(".kraftyOutlineLevel")?.textContent ?? "",
          text: item.textContent ?? "",
          indent: /** @type {HTMLElement} */ (item).style.paddingLeft,
          skipped: item.classList.contains("kraftyOutlineSkip"),
        })),
        notes: [...(panel?.querySelectorAll(".kraftyPanelNote") ?? [])].map(
          (note) => note.textContent ?? ""
        ),
        hasReview: panel?.querySelector(".kraftyOutline") !== null,
      };
    });

    /* Catch what the copy button actually writes, rather than rebuilding the
       expected text from the DOM - that would pass even if the button
       assembled something else entirely. */
    const copied = await page.evaluate(async () => {
      const button = document.querySelector(".kraftyOutline")
        ? [...document.querySelectorAll(".kraftyCopyAll")].at(-1)
        : null;

      if (!(button instanceof HTMLElement)) {
        return null;
      }

      /** @type {string | null} */
      let written = null;

      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (/** @type {string} */ text) => {
            written = text;
          },
        },
      });

      button.click();
      await new Promise((resolve) => setTimeout(resolve, 50));
      return written;
    });

    /* Toggle off and confirm the page is left as it was found. */
    await page.evaluate(SCRIPTS.headingCheck);

    const after = await page.evaluate(() => ({
      panel: document.getElementById("js-kraftyHeadingInformation") !== null,
      bodyClass: document.body.classList.contains("kraftyHeadingChecker"),
    }));

    return { ...state, copied, after };
  });
}

/**
 * @param {{ level: string, text: string }[]} findings
 * @param {RegExp} pattern
 */
const matching = (findings, pattern) =>
  findings.filter((f) => pattern.test(f.text));

test("heading checker", async (t) => {
  await t.test("accepts a well formed outline", async () => {
    const result = await check(
      `<h1>Page</h1><h2>One</h2><h3>Detail</h3><h2>Two</h2>`
    );

    assert.deepStrictEqual(result.findings, []);

    /* The claim has to stay scoped to what was actually checked: an outline
       can be structurally perfect and still describe the wrong page. */
    assert.match(result.summary, /automatically/);
    assert.doesNotMatch(result.summary, /^No problems\.?$/i);
  });

  await t.test("reports more than one level 1 heading", async () => {
    const { findings } = await check(`<h1>One</h1><h1>Two</h1>`);
    const found = matching(findings, /level 1/i);

    assert.strictEqual(found.length, 1);
    assert.match(found[0].text, /\b2\b/);
    assert.strictEqual(
      found[0].level,
      "note",
      "the spec allows it, so it cannot be reported as an error"
    );
  });

  await t.test("reports a missing level 1 heading", async () => {
    const { findings } = await check(`<h2>One</h2><h3>Two</h3>`);

    assert.strictEqual(matching(findings, /No level 1/).length, 1);
  });

  await t.test("reports a skipped level, and marks it in the outline", async () => {
    const result = await check(`<h1>Page</h1><h2>One</h2><h4>Deep</h4>`);
    const found = matching(result.findings, /skipping a level/);

    assert.strictEqual(found.length, 1);
    assert.match(found[0].text, /h2/);
    assert.match(found[0].text, /h4/);

    assert.deepStrictEqual(
      result.outline.map((entry) => entry.skipped),
      [false, false, true],
      "the jump is marked on the heading it jumps to"
    );
  });

  await t.test("does not report a skip when climbing back up", async () => {
    const { findings } = await check(
      `<h1>Page</h1><h2>One</h2><h3>Detail</h3><h2>Two</h2>`
    );

    assert.strictEqual(matching(findings, /skipping a level/).length, 0);
  });

  await t.test("says nothing about the start twice", async () => {
    /* A page opening at h3 has no h1. Reporting a skip on top of that would
       be the same fact said differently. */
    const { findings } = await check(`<h3>Only</h3>`);

    assert.strictEqual(matching(findings, /No level 1/).length, 1);
    assert.strictEqual(matching(findings, /skipping a level/).length, 0);
  });

  await t.test("reports an empty heading as an alert", async () => {
    const { findings } = await check(`<h1>Page</h1><h2>   </h2>`);
    const found = matching(findings, /no text/);

    assert.strictEqual(found.length, 1);
    assert.match(found[0].text, /h2/);
    assert.strictEqual(
      found[0].level,
      "alert",
      "a heading that announces nothing is broken, not a matter of taste"
    );
  });

  await t.test("counts an image-only heading as having text", async () => {
    /* The logo as the h1 is a real and correct pattern. Flagging it would
       train the reader to ignore the finding. */
    const result = await check(
      `<h1><img src="data:image/gif;base64,R0lGOD" alt="Acme"></h1>`
    );

    assert.strictEqual(matching(result.findings, /no text/).length, 0);
    assert.match(result.outline[0].text, /Acme/);
  });

  await t.test("takes aria-label as the heading's text", async () => {
    const { findings } = await check(`<h1 aria-label="Acme"><span></span></h1>`);

    assert.strictEqual(matching(findings, /no text/).length, 0);
  });

  await t.test("reports a page with no headings at all", async () => {
    const result = await check(`<p>Just prose.</p>`);

    assert.strictEqual(matching(result.findings, /No headings/).length, 1);
    assert.strictEqual(
      result.hasReview,
      false,
      "there is no outline to put in front of anyone"
    );
  });

  await t.test("includes ARIA headings, at their declared level", async () => {
    const result = await check(
      `<div role="heading" aria-level="1">Page</div>
       <div role="heading" aria-level="2">One</div>`
    );

    assert.deepStrictEqual(result.findings, []);
    assert.deepStrictEqual(
      result.outline.map((entry) => entry.tag),
      ["div", "div"]
    );
  });

  await t.test("leaves out headings nobody can reach, and says how many", async () => {
    const result = await check(
      `<h1>Page</h1>
       <h2 style="display:none">Hidden</h2>
       <h2 style="visibility:hidden">Invisible</h2>
       <div aria-hidden="true"><h2>Ignored</h2></div>`
    );

    assert.strictEqual(result.outline.length, 1);
    assert.ok(
      result.notes.some((note) => /\b3\b/.test(note)),
      "the count of what was left out has to be stated, not silently dropped"
    );
  });

  await t.test("counts one left-out heading in the singular", async () => {
    const result = await check(`<h1>Page</h1><h2 hidden>Hidden</h2>`);

    assert.ok(
      result.notes.some((note) => /\b1 heading is\b/.test(note)),
      "expected the singular wording, not '1 headings are'"
    );
  });

  await t.test("keeps a visually hidden heading in the outline", async () => {
    /* Clipped off-screen is a deliberate pattern for a heading meant only
       for screen readers. It reaches somebody, so it counts. */
    const result = await check(
      `<h1 style="position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)">Page</h1>
       <h2>One</h2>`
    );

    assert.deepStrictEqual(result.findings, []);
    assert.strictEqual(result.outline.length, 2);
  });

  await t.test("indents the outline by level", async () => {
    const result = await check(`<h1>Page</h1><h2>One</h2><h3>Detail</h3>`);

    assert.deepStrictEqual(
      result.outline.map((entry) => entry.indent),
      ["0px", "14px", "28px"]
    );
  });

  await t.test("never counts another panel's own headings", async () => {
    /* Every panel is built from sections with h2 titles. A checker that
       reported those would invent findings out of its own interface. */
    const result = await withPage(
      { html: "<h1>Page</h1>", checkers: ["headCheck", "headingCheck"] },
      async (page) =>
        page.evaluate(() => {
          const panel = document.getElementById("js-kraftyHeadingInformation");
          return [
            ...(panel?.querySelectorAll(".kraftyOutlineItem") ?? []),
          ].length;
        })
    );

    assert.strictEqual(result, 1);
  });

  await t.test("offers the outline as one indented block to copy", async () => {
    const result = await check(`<h1>Page</h1><h2>One</h2><h3>Detail</h3>`);

    assert.ok(result.copied, "expected the button to write something");

    /* The address leads: an outline means nothing without knowing which
       page produced it. */
    const lines = String(result.copied).split("\n");

    assert.match(lines[0], /^https?:\/\/|^about:/);
    assert.deepStrictEqual(lines.slice(1), [
      "h1 Page",
      "  h2 One",
      "    h3 Detail",
    ]);
  });

  await t.test("leaves nothing behind when toggled off", async () => {
    const result = await check(`<h1>Page</h1>`);

    assert.strictEqual(result.after.panel, false);
    assert.strictEqual(result.after.bodyClass, false);
  });
});
