// @ts-check

/* The leftovers checker reports development artefacts a page shipped with -
   the decidable half of roadmap item 12: resource addresses, which are on
   the element as written and need no judgement.

   Most of these are about not reporting a page that is fine, which is where
   a check like this fails: a relative URL on a page served from localhost
   resolves to localhost, and flagging it would fill the panel on the
   developer's own screen.

   Mixed content is checked in the code but not here: the positive case needs
   an https origin, which the http test harness cannot serve. The negative -
   that an http resource on an http page is not called mixed - rides the
   clean-page test below. */

const { test } = require("node:test");
const assert = require("node:assert");
const { withPage, SCRIPTS } = require("./support.js");

/**
 * @param {string} html
 * @param {string} [serve]
 */
async function check(html, serve) {
  return withPage(
    { html, checkers: ["leftoversCheck"], serve },
    async (page) =>
      page.evaluate(() => {
        const panel = document.getElementById("js-kraftyLeftoversInformation");

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

/**
 * @param {{ findings: string[] }} result
 * @param {RegExp} pattern
 */
const matchingFindings = (result, pattern) =>
  result.findings.filter((text) => pattern.test(text));

test("leftovers checker", async (t) => {
  await t.test("reports a resource pointing at localhost", async () => {
    /* The handover embarrassment this is aimed at: a production page loading
       from the developer's own machine. */
    const result = await check(`<img src="http://localhost:3000/hero.png">`);

    assert.strictEqual(matchingFindings(result, /local or private/).length, 1);
    assert.strictEqual(result.rows.length, 1);
    assert.match(result.rows[0], /localhost:3000/);
  });

  await t.test("reports a private network address", async () => {
    const result = await check(
      `<link rel="stylesheet" href="http://192.168.1.5/app.css">`
    );

    assert.strictEqual(matchingFindings(result, /local or private/).length, 1);
    assert.match(result.rows[0], /192\.168\.1\.5/);
  });

  await t.test("reports a placeholder image service", async () => {
    const result = await check(`<img src="https://placehold.co/600x400">`);

    assert.strictEqual(matchingFindings(result, /placeholder service/).length, 1);
  });

  await t.test("does not flag the page's own local host", async () => {
    /* Served from 127.0.0.1, so a relative URL resolves there. That is where
       the page is, not a leftover; only a local host that is not the page's
       own is one. An ordinary external resource is fine too, and an http one
       on this http page is not mixed content. */
    const result = await check(
      `<img src="/logo.png">
       <a href="https://example.com/about">About</a>
       <script src="http://cdn.example.com/app.js"></script>`,
      "/"
    );

    assert.deepStrictEqual(result.findings, []);
    assert.match(result.summary, /automatically/);
  });

  await t.test("leaves a fragment or mailto alone", async () => {
    /* new URL throws on these against about:blank, and there is nothing to
       classify anyway. They must not become findings or errors. */
    const result = await check(
      `<a href="#main">Skip</a><a href="mailto:x@example.com">Mail</a>`
    );

    assert.deepStrictEqual(result.findings, []);
  });

  await t.test("leaves nothing behind when toggled off", async () => {
    const after = await withPage(
      {
        html: `<img src="http://localhost:3000/x.png">`,
        checkers: ["leftoversCheck"],
      },
      async (page) => {
        await page.evaluate(SCRIPTS.leftoversCheck);

        return page.evaluate(() => ({
          panel:
            document.getElementById("js-kraftyLeftoversInformation") !== null,
          bodyClass: document.body.classList.contains("kraftyLeftoversChecker"),
        }));
      }
    );

    assert.strictEqual(after.panel, false);
    assert.strictEqual(after.bodyClass, false);
  });
});
