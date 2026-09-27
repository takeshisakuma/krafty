// @ts-check

/* Spacing is a body class and a stylesheet, the same shape as the outline
   checker. The values are the ones a reader is allowed to force. The panel
   host has to stay at normal, because letter-spacing inherits into the
   shadow tree. */

const { test } = require("node:test");
const assert = require("node:assert");
const { withPage, SCRIPTS } = require("./support.js");

test("spacing checker", async (t) => {
  await t.test("widens line, letter, word and paragraph spacing", async () => {
    const seen = await withPage(
      {
        html: `<p id="copy" style="font-size:16px">A sentence.</p>`,
        checkers: ["spacingCheck"],
      },
      async (page) =>
        page.evaluate(() => {
          const sample = document.getElementById("copy");
          const cs = sample ? getComputedStyle(sample) : null;
          const font = cs ? Number.parseFloat(cs.fontSize) : 0;

          return {
            bodyClass: document.body.classList.contains("kraftySpacingChecker"),
            letter: cs ? Number.parseFloat(cs.letterSpacing) : 0,
            word: cs ? Number.parseFloat(cs.wordSpacing) : 0,
            line: cs ? Number.parseFloat(cs.lineHeight) : 0,
            margin: cs ? Number.parseFloat(cs.marginBottom) : 0,
            font,
          };
        })
    );

    assert.strictEqual(seen.bodyClass, true);
    assert.ok(seen.letter > 1, `letter-spacing should be 0.12em, got ${seen.letter}`);
    assert.ok(seen.word > 1, `word-spacing should be 0.16em, got ${seen.word}`);
    assert.ok(
      seen.line >= seen.font * 1.5 - 0.5,
      `line-height should be 1.5, got ${seen.line} on ${seen.font}`
    );
    assert.ok(
      seen.margin >= seen.font * 2 - 0.5,
      `paragraph spacing should be 2em, got ${seen.margin}`
    );
  });

  await t.test("beats a page letter-spacing reset", async () => {
    const letter = await withPage(
      {
        html: `<style>p { letter-spacing: 0px !important; }</style><p id="copy">A sentence.</p>`,
        checkers: ["spacingCheck"],
      },
      async (page) =>
        page.evaluate(() => {
          const sample = document.getElementById("copy");

          return sample ? getComputedStyle(sample).letterSpacing : "normal";
        })
    );

    assert.notStrictEqual(letter, "0px");
    assert.notStrictEqual(letter, "normal");
  });

  await t.test("leaves a panel host at normal spacing", async () => {
    /* letter-spacing: normal is used as 0, so getComputedStyle reports 0px.
       The page beside it is the proof the stress is on and the host is not. */
    const host = await withPage(
      {
        html: `<p id="copy" style="font-size:16px">A sentence.</p><div class="kraftyPanel" id="host">panel</div>`,
        checkers: ["spacingCheck"],
      },
      async (page) =>
        page.evaluate(() => {
          const panel = document.getElementById("host");
          const copy = document.getElementById("copy");

          return {
            letter: panel ? getComputedStyle(panel).letterSpacing : "",
            word: panel ? getComputedStyle(panel).wordSpacing : "",
            page: copy ? Number.parseFloat(getComputedStyle(copy).letterSpacing) : 0,
          };
        })
    );

    /**
     * Chrome reports an explicit `normal` as either the keyword or 0px.
     * @param {string} value
     */
    const unset = (value) => value === "normal" || Number.parseFloat(value) === 0;

    assert.ok(unset(host.letter), `host letter-spacing should stay normal, got ${host.letter}`);
    assert.ok(unset(host.word), `host word-spacing should stay normal, got ${host.word}`);
    assert.ok(host.page > 1, `the page should still be stressed, got ${host.page}`);
  });

  await t.test("leaves nothing behind when toggled off", async () => {
    const after = await withPage(
      { html: `<p id="copy">A sentence.</p>`, checkers: ["spacingCheck"] },
      async (page) => {
        await page.evaluate(SCRIPTS.spacingCheck);

        return page.evaluate(() => {
          const sample = document.getElementById("copy");

          return {
            bodyClass: document.body.classList.contains("kraftySpacingChecker"),
            letter: sample ? getComputedStyle(sample).letterSpacing : "",
          };
        });
      }
    );

    assert.strictEqual(after.bodyClass, false);
    assert.strictEqual(after.letter, "normal");
  });
});
