// @ts-check

/* The head checker reports what a machine can decide and shows the rest for
   a person to read. These cover the first half - the previews exist because
   the second half cannot be asserted. */

const { test } = require("node:test");
const assert = require("node:assert");
const { withPage } = require("./support.js");

/**
 * setContent gives the document a doctype and a body, so head markup is
 * passed as a script that writes it in. Returns the text of each finding.
 *
 * @param {string} headMarkup
 * @param {{ noDoctype?: boolean }} [options]
 */
async function check(headMarkup, options = {}) {
  return withPage(
    { html: "<p>page</p>", checkers: [] },
    async (page) => {
      await page.evaluate(
        ([markup, quirks]) => {
          document.head.insertAdjacentHTML("beforeend", String(markup));

          if (quirks) {
            /* compatMode is decided at parse time, so a page that must be
               in quirks mode has to be written from scratch. */
            document.open();
            document.write(
              `<html><head>${markup}</head><body><p>page</p></body></html>`
            );
            document.close();
          }
        },
        [headMarkup, Boolean(options.noDoctype)]
      );

      const { SCRIPTS } = require("./support.js");
      await page.evaluate(SCRIPTS.headCheck);

      return page.evaluate(() => {
        const panel = document.getElementById("js-kraftyHeadInformation");

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
          serpTitle:
            panel?.querySelector(".kraftySerpTitle")?.textContent ?? "",
          cardTitle:
            panel?.querySelector(".kraftyCardTitle")?.textContent ?? "",
          cardDescription:
            panel?.querySelector(".kraftyCardDescription")?.textContent ?? "",
          fallbacks: [
            ...(panel?.querySelectorAll(".kraftyFallbackNote") ?? []),
          ].map((n) => n.textContent ?? ""),
        };
      });
    }
  );
}

/**
 * @param {{ level: string, text: string }[]} findings
 * @param {RegExp} pattern
 */
const matching = (findings, pattern) =>
  findings.filter((f) => pattern.test(f.text));

const SOUND_HEAD = `
  <title>A page about something</title>
  <meta name="description" content="A description of the page.">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="canonical" href="/">
`;

test("head checker", async (t) => {
  await t.test("reports noindex as an alert", async () => {
    const { findings } = await check(
      `${SOUND_HEAD}<meta name="robots" content="noindex, nofollow">`
    );

    const noindex = matching(findings, /noindex/);

    assert.strictEqual(noindex.length, 1);
    assert.strictEqual(
      noindex[0].level,
      "alert",
      "noindex on a live page is the worst thing here, not a note"
    );
    assert.strictEqual(matching(findings, /nofollow/).length, 1);
  });

  await t.test("reports a missing title and description", async () => {
    const { findings } = await check(`<meta name="viewport" content="x">`);

    assert.strictEqual(matching(findings, /No title/).length, 1);
    assert.strictEqual(matching(findings, /No description/).length, 1);
  });

  await t.test("reports a canonical pointing elsewhere", async () => {
    const { findings } = await check(
      `<title>t</title><link rel="canonical" href="https://example.com/other">`
    );

    assert.strictEqual(matching(findings, /canonical points at another/).length, 1);
  });

  await t.test("accepts a self-referential canonical", async () => {
    const { findings } = await check(SOUND_HEAD);

    assert.strictEqual(matching(findings, /canonical/).length, 0);
  });

  await t.test("reports duplicated tags", async () => {
    const { findings } = await check(
      `${SOUND_HEAD}<link rel="canonical" href="/elsewhere">`
    );

    const duplicates = matching(findings, /canonical appears 2 times/);
    assert.strictEqual(duplicates.length, 1);
  });

  await t.test("reports a missing lang attribute", async () => {
    const { findings } = await check(SOUND_HEAD);

    assert.strictEqual(matching(findings, /lang attribute/).length, 1);
  });

  await t.test("says only that the automatic checks found nothing", async () => {
    const { summary, findings } = await withPage(
      { html: "<p>page</p>", checkers: [] },
      async (page) => {
        await page.evaluate(() => {
          document.documentElement.setAttribute("lang", "en");
          document.head.insertAdjacentHTML(
            "beforeend",
            `<title>A page about something</title>
             <meta name="description" content="A description.">
             <meta name="viewport" content="width=device-width">
             <link rel="canonical" href="/">`
          );
        });

        const { SCRIPTS } = require("./support.js");
        await page.evaluate(SCRIPTS.headCheck);

        return page.evaluate(() => {
          const panel = document.getElementById("js-kraftyHeadInformation");
          return {
            summary:
              panel?.querySelector(".kraftyChecksSummary")?.textContent ?? "",
            findings: [...(panel?.querySelectorAll(".kraftyCheck") ?? [])].map(
              (i) => i.textContent ?? ""
            ),
          };
        });
      }
    );

    assert.deepStrictEqual(findings, []);

    /* The claim has to stay scoped to what was actually checked: a title
       can be present, well formed, and still be the wrong title. */
    assert.match(summary, /automatically/);
    assert.doesNotMatch(summary, /^No problems\.?$/i);
  });

  await t.test("falls back to title and description on the card, and says so", async () => {
    const result = await check(SOUND_HEAD);

    assert.strictEqual(result.cardTitle, "A page about something");
    assert.strictEqual(result.cardDescription, "A description of the page.");
    assert.strictEqual(
      result.fallbacks.length,
      2,
      "a card that looks fine is not the same fact as og:title being set"
    );
  });

  await t.test("prefers og values on the card when present", async () => {
    const result = await check(
      `${SOUND_HEAD}
       <meta property="og:title" content="Shared title">
       <meta property="og:description" content="Shared description">`
    );

    assert.strictEqual(result.cardTitle, "Shared title");
    assert.strictEqual(result.cardDescription, "Shared description");
    assert.deepStrictEqual(result.fallbacks, []);
    assert.strictEqual(
      result.serpTitle,
      "A page about something",
      "the search preview uses title, not og:title"
    );
  });
});
