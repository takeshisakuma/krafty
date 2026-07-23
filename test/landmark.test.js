// @ts-check

/* The landmark checker reports what a machine can decide - the missing or
   duplicated main, and regions of one role a screen reader cannot tell apart
   - and draws the rest for a person to read. Most of these assert that
   correct markup says nothing, because that is where a check like this fails:
   by being right about the defect and noisy about a page that is fine. The
   rules about what counts as a landmark at all - a header inside a section, a
   nameless section - are the other half, where a wrong answer is invisible. */

const { test } = require("node:test");
const assert = require("node:assert");
const { withPage, SCRIPTS } = require("./support.js");

/**
 * @param {string} html
 */
async function check(html) {
  return withPage({ html, checkers: ["landmarkCheck"] }, async (page) => {
    const state = await page.evaluate(() => {
      const panel = document.getElementById("js-kraftyLandmarkInformation");

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
          role: item.querySelector(".kraftyOutlineLevel")?.textContent ?? "",
          text: item.textContent ?? "",
          indent: /** @type {HTMLElement} */ (item).style.paddingLeft,
        })),
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
    await page.evaluate(SCRIPTS.landmarkCheck);

    const after = await page.evaluate(() => ({
      panel: document.getElementById("js-kraftyLandmarkInformation") !== null,
      bodyClass: document.body.classList.contains("kraftyLandmarkChecker"),
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

test("landmark checker", async (t) => {
  await t.test("accepts a well formed set of landmarks", async () => {
    const result = await check(
      `<header>Logo</header>
       <nav aria-label="Primary">links</nav>
       <main>content</main>
       <footer>fine print</footer>`
    );

    assert.deepStrictEqual(result.findings, []);

    assert.deepStrictEqual(
      result.outline.map((entry) => entry.role),
      ["banner", "navigation", "main", "contentinfo"]
    );

    /* The claim stays scoped to what was checked: the regions can all be
       present and still be the wrong regions. */
    assert.match(result.summary, /automatically/);
  });

  await t.test("reports no main as a note", async () => {
    const { findings } = await check(`<header>h</header><footer>f</footer>`);
    const found = matching(findings, /main/i);

    assert.strictEqual(found.length, 1);
    assert.strictEqual(
      found[0].level,
      "note",
      "a missing main is common enough to be a note, not an error"
    );
  });

  await t.test("reports more than one main as an alert", async () => {
    const { findings } = await check(`<main>a</main><main>b</main>`);
    const found = matching(findings, /main/i);

    assert.strictEqual(found.length, 1);
    assert.match(found[0].text, /\b2\b/);
    assert.strictEqual(
      found[0].level,
      "alert",
      "only one main may be exposed, so two is a broken rule"
    );
  });

  await t.test("reports two navs with no name to tell them apart", async () => {
    const { findings } = await check(
      `<main>c</main><nav>one</nav><nav>two</nav>`
    );
    const found = matching(findings, /navigation/);

    assert.strictEqual(found.length, 1);
    assert.match(found[0].text, /\b2\b/);
    assert.strictEqual(found[0].level, "alert");
  });

  await t.test("reports two navs that share a name", async () => {
    const { findings } = await check(
      `<main>c</main>
       <nav aria-label="Menu">one</nav>
       <nav aria-label="Menu">two</nav>`
    );
    const found = matching(findings, /Menu/);

    assert.strictEqual(found.length, 1);
    assert.match(found[0].text, /navigation/);
  });

  await t.test("accepts two navs with different names", async () => {
    const { findings } = await check(
      `<main>c</main>
       <nav aria-label="Primary">one</nav>
       <nav aria-label="Secondary">two</nav>`
    );

    assert.strictEqual(matching(findings, /navigation/).length, 0);
  });

  await t.test("does not treat a header inside a section as the page banner", async () => {
    /* A card's header is the header of that card, not of the page. Mapping it
       to banner would report a landmark that is not there. */
    const result = await check(
      `<main><section aria-label="Card"><header>Card title</header></section></main>`
    );

    assert.strictEqual(
      result.outline.filter((entry) => entry.role === "banner").length,
      0,
      "a scoped header is not a banner"
    );
  });

  await t.test("counts a section as a region only when it is named", async () => {
    const named = await check(
      `<main>c</main><section aria-label="Rates">table</section>`
    );
    assert.strictEqual(
      named.outline.filter((entry) => entry.role === "region").length,
      1,
      "a named section is a region landmark"
    );

    const bare = await check(`<main>c</main><section>table</section>`);
    assert.strictEqual(
      bare.outline.filter((entry) => entry.role === "region").length,
      0,
      "a nameless section is generic, not a landmark"
    );
  });

  await t.test("reads a landmark declared by role attribute", async () => {
    const result = await check(
      `<div role="main">c</div><div role="navigation" aria-label="Nav">links</div>`
    );

    assert.deepStrictEqual(
      result.outline.map((entry) => entry.role).sort(),
      ["main", "navigation"]
    );
  });

  await t.test("nests a landmark inside another and indents it", async () => {
    const result = await check(
      `<main>c<nav aria-label="In page">links</nav></main>`
    );

    const [main, nav] = result.outline;

    assert.strictEqual(main.role, "main");
    assert.strictEqual(main.indent, "0px");
    assert.strictEqual(nav.role, "navigation");
    assert.notStrictEqual(nav.indent, "0px", "a nested landmark is indented");

    /* The copy keeps the shape, so the nested nav is indented in the text. */
    assert.match(result.copied ?? "", /\n {2}navigation "In page"/);
  });

  await t.test("leaves a landmark hidden from everyone out", async () => {
    /* A display:none mobile nav beside the desktop one would otherwise both
       count, and be reported as two navs that cannot be told apart. */
    const result = await check(
      `<main>c</main>
       <nav aria-label="Desktop">shown</nav>
       <nav aria-label="Desktop" style="display:none">hidden</nav>`
    );

    assert.strictEqual(
      result.outline.filter((entry) => entry.role === "navigation").length,
      1,
      "only the exposed nav is drawn"
    );
    assert.strictEqual(
      matching(result.findings, /navigation/).length,
      0,
      "so there is no false clash between them"
    );
  });

  await t.test("reports a page with no landmarks and shows no list", async () => {
    const result = await check(`<div>Just some divs.</div>`);

    assert.strictEqual(matching(result.findings, /No landmark/).length, 1);
    assert.strictEqual(
      result.hasReview,
      false,
      "there is no structure to put in front of anyone"
    );
  });

  await t.test("shows a nameless landmark as such in the list", async () => {
    const result = await check(`<main>c</main><nav>links</nav>`);
    const nav = result.outline.find((entry) => entry.role === "navigation");

    assert.ok(nav);
    assert.match(nav.text, /name/i, "the nameless nav says it has no name");
  });

  await t.test("leaves nothing behind when toggled off", async () => {
    const result = await check(`<main>c</main>`);

    assert.strictEqual(result.after.panel, false);
    assert.strictEqual(result.after.bodyClass, false);
  });
});
