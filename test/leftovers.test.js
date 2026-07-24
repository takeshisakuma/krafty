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
   clean-page test below. The staging check's own-host exclusion is the same
   blind spot: the harness serves from 127.0.0.1, not from a staging host, so
   the code that spares a page served from staging.example.com its own
   relative URLs is reasoning without a fixture, like the local one it copies. */

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

  await t.test("reports a staging-looking host as a note", async () => {
    const result = await check(
      `<script src="https://staging.example.com/app.js"></script>`
    );

    const found = matchingFindings(result, /staging-looking/);
    assert.strictEqual(found.length, 1);
    assert.match(result.rows[0], /staging\.example\.com/);
  });

  await t.test("does not call an ordinary host staging by its letters", async () => {
    /* Only the first label counts: latest. and contest. carry the letters of
       test. but are not it. */
    const result = await check(
      `<img src="https://latest.example.com/a.png">
       <a href="https://contest.example.com/b">b</a>`
    );

    assert.strictEqual(matchingFindings(result, /staging-looking/).length, 0);
  });

  await t.test("reports a developer marker left in an HTML comment", async () => {
    const result = await check(
      `<!-- TODO: swap the placeholder copy --><p>Text</p><!-- 後日差し替え -->`
    );

    const found = matchingFindings(result, /developer marker/);
    assert.strictEqual(found.length, 1);
    assert.match(found[0], /\b2\b/);
    assert.ok(
      result.rows.some((row) => /TODO/.test(row)),
      "the marked comment is listed by its text"
    );
  });

  await t.test("leaves an ordinary comment alone", async () => {
    const result = await check(`<!-- header starts here --><p>Text</p>`);
    assert.strictEqual(matchingFindings(result, /developer marker/).length, 0);
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

  await t.test("reports Lorem ipsum as dummy text", async () => {
    const result = await check(
      `<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>`
    );

    const found = matchingFindings(result, /dummy or placeholder/);
    assert.strictEqual(found.length, 1);
    assert.ok(
      result.rows.some((row) => /Lorem ipsum/.test(row)),
      "the fragment is listed by its text"
    );
  });

  await t.test("reports a repeated-letter run as dummy text", async () => {
    /* あああ - the everyday Japanese keyboard-mash placeholder. */
    const result = await check(`<h2>あああ</h2>`);
    assert.strictEqual(matchingFindings(result, /dummy or placeholder/).length, 1);
  });

  await t.test("reports a filler word that is the whole of an element", async () => {
    const result = await check(`<p>テストです</p>`);
    assert.strictEqual(matchingFindings(result, /dummy or placeholder/).length, 1);
  });

  await t.test("leaves a filler word alone inside real copy", async () => {
    /* サンプル is dummy only when it is the whole text; inside a phrase it is
       an ordinary word, and 無料サンプル is real copy. */
    const result = await check(`<p>無料サンプルを請求する</p>`);
    assert.strictEqual(matchingFindings(result, /dummy or placeholder/).length, 0);
  });

  await t.test("spares a comparison table of single marks", async () => {
    /* ○ and × alone, and different marks side by side, are a real legend;
       only the same mark repeated (○○) reads as a placeholder. */
    const result = await check(
      `<table><tbody><tr><td>○</td><td>×</td><td>△</td></tr></tbody></table>`
    );
    assert.strictEqual(matchingFindings(result, /dummy or placeholder/).length, 0);
  });

  await t.test("reports a repeated placeholder mark", async () => {
    const result = await check(`<p>○○について</p>`);
    assert.strictEqual(matchingFindings(result, /dummy or placeholder/).length, 1);
  });

  await t.test("does not read dummy text from a script or a hidden element", async () => {
    /* Script text is code, a display:none fragment reaches nobody, and an
       aria-hidden one is out of the accessibility tree - none is copy a
       reader was left looking at. */
    const result = await check(
      `<script>var placeholder = "あああ";</script>
       <p style="display:none">テストです</p>
       <span aria-hidden="true">Lorem ipsum dolor</span>`
    );
    assert.strictEqual(matchingFindings(result, /dummy or placeholder/).length, 0);
  });

  await t.test("leaves ordinary copy alone", async () => {
    const result = await check(
      `<h1>会社概要</h1><p>私たちは1998年の創業以来、地域に根ざしたサービスを提供しています。</p>`
    );
    assert.strictEqual(matchingFindings(result, /dummy or placeholder/).length, 0);
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
