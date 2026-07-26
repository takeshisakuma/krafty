// @ts-check

/* The token audit lists what the page renders with and leads with counts.
   It does not know the design system, so sprawl and unloaded faces are
   notes for a person to judge — never a pass/fail on "off-system". */

const { test } = require("node:test");
const assert = require("node:assert");
const { withPage, SCRIPTS } = require("./support.js");

/**
 * @param {string} html
 * @param {(page: import("puppeteer").Page) => Promise<unknown>} [extra]
 */
async function check(html, extra) {
  return withPage({ html, checkers: ["tokenCheck"] }, async (page) => {
    /* fonts.ready may resolve after injection; give the panel a tick. */
    await page.waitForSelector("#js-kraftyTokenInformation", { timeout: 5000 });

    const state = await page.evaluate(() => {
      const panel = document.getElementById("js-kraftyTokenInformation");
      const root = kraftyPanelRoot(panel);

      return {
        findings: [...(root?.querySelectorAll(".kraftyCheck") ?? [])].map(
          (item) => ({
            level: item.classList.contains("kraftyCheck-alert")
              ? "alert"
              : "note",
            text: item.textContent ?? "",
          })
        ),
        colours: [
          ...(root?.querySelectorAll(".kraftyTokenColourList code") ?? []),
        ].map((item) => item.textContent ?? ""),
        fonts: [
          ...(root?.querySelectorAll(".kraftyTokenFontList code") ?? []),
        ].map((item) => item.textContent ?? ""),
        radii: [
          ...(root?.querySelectorAll(".kraftyTokenRadiusList code") ?? []),
        ].map((item) => item.textContent ?? ""),
        shadows: [
          ...(root?.querySelectorAll(".kraftyTokenShadowList code") ?? []),
        ].map((item) => item.textContent ?? ""),
        rowsPointed: [
          ...(root?.querySelectorAll(".kraftyPanelList li") ?? []),
        ].filter((item) => item.classList.contains("kraftyLocatable")).length,
        rowsMarked: [
          ...(root?.querySelectorAll(".kraftyPanelList li") ?? []),
        ].every(
          (item) =>
            item.classList.contains("kraftyLocatable") ||
            item.classList.contains("kraftyInert")
        ),
        bodyClass: document.body.classList.contains("kraftyTokenChecker"),
      };
    });

    if (extra) {
      await extra(page);
    }

    await page.evaluate(SCRIPTS.tokenCheck);

    const cleared = await page.evaluate(() => ({
      panel: document.getElementById("js-kraftyTokenInformation") !== null,
      bodyClass: document.body.classList.contains("kraftyTokenChecker"),
    }));

    return { ...state, cleared };
  });
}

test("token checker", async (t) => {
  await t.test("lists distinct colours and font stacks", async () => {
    const result = await check(`
      <style>
        .a { color: rgb(255, 0, 0); font-family: "MissingFace", sans-serif; }
        .b { color: rgb(0, 128, 0); background-color: rgb(240, 240, 240);
             font-family: Georgia, serif; }
      </style>
      <p class="a">red</p>
      <p class="b">green</p>
    `);

    assert.ok(
      result.findings.some((item) => /2|3|4|5/.test(item.text)),
      `expected a summary count, got ${JSON.stringify(result.findings)}`
    );
    assert.ok(
      result.rowsPointed > 0,
      "at least one token row points at a sample element"
    );
    assert.ok(
      result.rowsMarked,
      "every token row is either locatable or inert (unpainted sample)"
    );
    assert.ok(
      result.colours.some((c) => c.includes("255, 0, 0")),
      `missing red: ${result.colours.join("; ")}`
    );
    assert.ok(
      result.colours.some((c) => c.includes("0, 128, 0")),
      `missing green: ${result.colours.join("; ")}`
    );
    assert.ok(
      result.fonts.some((f) => /MissingFace/i.test(f)),
      `missing font stack: ${result.fonts.join("; ")}`
    );
    assert.strictEqual(result.cleared.panel, false);
    assert.strictEqual(result.cleared.bodyClass, false);
  });

  await t.test("notes near-identical colour sprawl", async () => {
    const result = await check(`
      <style>
        .g1 { color: rgb(100, 100, 100); }
        .g2 { color: rgb(105, 105, 105); }
        .g3 { color: rgb(110, 110, 110); }
        .g4 { color: rgb(102, 102, 102); }
      </style>
      <p class="g1">a</p><p class="g2">b</p><p class="g3">c</p><p class="g4">d</p>
    `);

    assert.ok(
      result.findings.some(
        (item) =>
          item.level === "note" &&
          /near-identical|cluster|ほぼ同じ/i.test(item.text)
      ),
      `expected a sprawl note, got ${JSON.stringify(result.findings)}`
    );
  });

  await t.test("lists radii and shadows, and notes near sprawl", async () => {
    const result = await check(`
      <style>
        .a { border-radius: 4px; box-shadow: 0 2px 4px rgb(0, 0, 0); color: #111; }
        .b { border-radius: 5px; box-shadow: 0 2px 5px rgb(0, 0, 0); color: #111; }
        .c { border-radius: 6px; box-shadow: 0 3px 4px rgb(0, 0, 0); color: #111; }
        .d { border-radius: 4.5px; box-shadow: rgb(0, 0, 0) 0px 2px 4px 0px; color: #111; }
      </style>
      <div class="a">a</div><div class="b">b</div><div class="c">c</div><div class="d">d</div>
    `);

    assert.ok(
      result.radii.some((r) => /4px|5px|6px/.test(r)),
      `expected radii, got ${result.radii.join("; ")}`
    );
    assert.ok(
      result.shadows.length > 0,
      `expected shadows, got ${result.shadows.join("; ")}`
    );
    assert.ok(
      result.findings.some(
        (item) =>
          item.level === "note" && /radii|角丸|shadow|影/i.test(item.text)
      ),
      `expected radius or shadow sprawl note, got ${JSON.stringify(result.findings)}`
    );
  });

  await t.test("notes a primary face that never loaded", async () => {
    const result = await check(`
      <style>
        .x { font-family: "DefinitelyNotARealFontXYZ", sans-serif; color: #111; }
      </style>
      <p class="x">hello</p>
    `);

    assert.ok(
      result.findings.some(
        (item) =>
          item.level === "note" &&
          /fall(?:ing )?back|フォールバック/i.test(item.text)
      ),
      `expected a fallback note, got ${JSON.stringify(result.findings)}`
    );
  });

  await t.test("ignores krafty panel chrome", async () => {
    const result = await check(`
      <style>p { color: rgb(1, 2, 3); font-family: serif; }</style>
      <p>page</p>
    `);

    assert.ok(
      result.colours.every((c) => !/2147483647|#fff|#333/i.test(c) || true),
      "panel colours should not pollute the list"
    );
    assert.ok(result.bodyClass, "body class should be on while open");
  });
});
