// @ts-check

/* The image checker measures the file against the box it is drawn in.

   The whole difficulty is the allowance for high-density displays, so most
   of these are about what must NOT be reported: a 2x asset built correctly,
   an icon that is proportionally large but absolutely tiny, an image that
   has not loaded yet. A checker that cries wolf on a correct page is worse
   than no checker, because the reader learns to skip it. */

const { test } = require("node:test");
const assert = require("node:assert");
const { withPage, SCRIPTS } = require("./support.js");

/**
 * An SVG data URL carries its own intrinsic size, so naturalWidth is known
 * without shipping fixture files around.
 *
 * @param {number} width
 * @param {number} height
 */
const source = (width, height) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#ccc"/></svg>`
  )}`;

/**
 * @param {string} html
 * @param {number} [deviceScaleFactor]
 */
async function check(html, deviceScaleFactor = 1) {
  return withPage(
    { html, checkers: [], width: 1280, height: 900 },
    async (page) => {
      await page.setViewport({
        width: 1280,
        height: 900,
        deviceScaleFactor,
      });

      /* naturalWidth is 0 until the image has arrived, so the checker would
         count everything as unmeasured if it ran first. */
      await page.waitForFunction(() =>
        [...document.images].every((image) => image.complete)
      );

      await page.evaluate(SCRIPTS.imageCheck);

      return page.evaluate(() => {
        const panel = document.getElementById("js-kraftyImageInformation");

        return {
          findings: [...(panel?.querySelectorAll(".kraftyCheck") ?? [])].map(
            (item) => item.textContent ?? ""
          ),
          rows: [...(panel?.querySelectorAll(".kraftyImageList li") ?? [])].map(
            (item) => item.textContent ?? ""
          ),
          notes: [...(panel?.querySelectorAll(".kraftyPanelNote") ?? [])].map(
            (note) => note.textContent ?? ""
          ),
          summary:
            panel?.querySelector(".kraftyChecksSummary")?.textContent ?? "",
        };
      });
    }
  );
}

/**
 * @param {string[]} findings
 * @param {RegExp} pattern
 */
const matching = (findings, pattern) =>
  findings.filter((text) => pattern.test(text));

test("image checker", async (t) => {
  await t.test("reports an image served far larger than it is shown", async () => {
    const result = await check(
      `<img src="${source(3000, 2000)}" width="300" height="200" style="width:300px;height:200px">`
    );

    assert.strictEqual(matching(result.findings, /larger than/).length, 1);
    assert.strictEqual(result.rows.length, 1);
    assert.match(result.rows[0], /3000×2000/);
    assert.match(result.rows[0], /300×200/);
  });

  await t.test("leaves a correctly built retina image alone", async () => {
    /* Twice the CSS size is what a 2x display needs. Reporting this would
       fire on every page that does the right thing. */
    const result = await check(
      `<img src="${source(600, 400)}" width="300" height="200" style="width:300px;height:200px">`
    );

    assert.deepStrictEqual(result.findings, []);
    assert.match(result.summary, /automatically/);
  });

  await t.test("gives the same answer whatever display it runs on", async () => {
    /* The trap this checker exists to avoid. Reading devicePixelRatio
       directly would clear the 2x asset on a retina screen and flag it on a
       1x one - the same page, two verdicts, with nothing on screen saying
       which you are looking at. */
    const markup = `<img src="${source(600, 400)}" width="300" height="200" style="width:300px;height:200px">`;

    const onePlain = await check(markup, 1);
    const onRetina = await check(markup, 2);

    assert.deepStrictEqual(onePlain.findings, []);
    assert.deepStrictEqual(onRetina.findings, []);
  });

  await t.test("ignores an icon that is proportionally but not actually large", async () => {
    /* 64px in a 16px box is four times over, and worth nobody's time. */
    const result = await check(
      `<img src="${source(64, 64)}" width="16" height="16" style="width:16px;height:16px">`
    );

    assert.strictEqual(matching(result.findings, /larger than/).length, 0);
  });

  await t.test("reports missing width and height separately", async () => {
    const result = await check(
      `<img src="${source(400, 300)}" style="width:200px;height:150px">`
    );

    assert.strictEqual(matching(result.findings, /width and height/).length, 1);

    /* 400 into a 200px box is exactly the 2x allowance, so the size finding
       must not appear alongside it. */
    assert.strictEqual(matching(result.findings, /larger than/).length, 0);
  });

  await t.test("says nothing about an image it cannot see", async () => {
    /* display:none has no displayed size to compare against. Guessing one
       would invent a finding. */
    const result = await check(
      `<img src="${source(3000, 2000)}" style="display:none">`
    );

    assert.deepStrictEqual(result.findings, []);
  });

  await t.test("counts what it could not measure rather than passing it", async () => {
    const result = await withPage(
      {
        html: `<img id="pending" width="300" height="200" style="width:300px;height:200px">`,
        checkers: [],
        width: 1280,
        height: 900,
      },
      async (page) => {
        /* Never given a src, so it never loads - standing in for a lazy
           loaded image still below the fold. */
        await page.evaluate(SCRIPTS.imageCheck);

        return page.evaluate(() => {
          const panel = document.getElementById("js-kraftyImageInformation");
          return [...(panel?.querySelectorAll(".kraftyPanelNote") ?? [])].map(
            (note) => note.textContent ?? ""
          );
        });
      }
    );

    assert.ok(
      result.some((note) => /could not be measured/.test(note)),
      "an unmeasured image must be declared, not silently treated as fine"
    );
  });

  await t.test("puts the worst offender first", async () => {
    const result = await check(
      `<img src="${source(1200, 800)}" style="width:300px;height:200px">
       <img src="${source(3000, 2000)}" style="width:300px;height:200px">`
    );

    assert.strictEqual(result.rows.length, 2);
    assert.match(result.rows[0], /3000×2000/);
    assert.match(result.rows[1], /1200×800/);
  });

  await t.test("states the allowance it judged against", async () => {
    /* The threshold is conventional, not measured. Saying so is the same
       promise the head checker's summary makes. */
    const result = await check(
      `<img src="${source(3000, 2000)}" style="width:300px;height:200px">`
    );

    const panelText = [...result.notes, ...result.rows].join("\n");
    assert.ok(
      /2/.test(panelText),
      "the reader cannot argue with a ratio whose basis is hidden"
    );
  });

  await t.test("leaves nothing behind when toggled off", async () => {
    const after = await withPage(
      {
        html: `<img src="${source(3000, 2000)}" style="width:300px;height:200px">`,
        checkers: [],
      },
      async (page) => {
        await page.waitForFunction(() =>
          [...document.images].every((image) => image.complete)
        );

        await page.evaluate(SCRIPTS.imageCheck);
        await page.evaluate(SCRIPTS.imageCheck);

        return page.evaluate(() => ({
          panel:
            document.getElementById("js-kraftyImageInformation") !== null,
          bodyClass: document.body.classList.contains("kraftyImageChecker"),
        }));
      }
    );

    assert.strictEqual(after.panel, false);
    assert.strictEqual(after.bodyClass, false);
  });
});
