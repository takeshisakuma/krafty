// @ts-check

/* The markup checker reports what is wrong in ways the page does not show.

   It starts with duplicated ids, which is the cheapest decision in the
   project - so most of these are about the edges where counting could go
   wrong: the checker's own panel, ids in the head, an empty id, and making
   sure a page that is fine says so.

   The two accessibility checks that followed are shaped the other way
   round. Each has several correct spellings and only one defect, so most
   of their tests assert that correct markup says nothing - which is where
   a check like this fails, by being right about the defect and noisy about
   everything else. */

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

/**
 * @param {{ findings: string[] }} result
 * @param {RegExp} pattern
 */
const matchingFindings = (result, pattern) =>
  result.findings.filter((text) => pattern.test(text));

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

  await t.test("reports a table whose cells have no headers", async () => {
    const result = await check(
      `<table>
         <tr><td>Tokyo</td><td>3</td></tr>
         <tr><td>Osaka</td><td>2</td></tr>
       </table>`
    );

    assert.strictEqual(matchingFindings(result, /header cells/).length, 1);
  });

  await t.test("wants a table's shape before it wants its headers", async () => {
    /* Measured on ja.wikipedia.org, which reported twelve tables: the
       succession boxes and navigation boxes - one row, a few cells - were
       layout wearing a table's tags, and amazon.co.jp's single finding was
       a one-cell spacer. A table with one row cannot have a header row, and
       one with a single column is a list. Neither is a data table with
       something missing. */
    const oneRow = await check(
      `<table><tr><td>next</td><td>previous</td><td>index</td></tr></table>`
    );

    const oneColumn = await check(
      `<table><tr><td>first</td></tr><tr><td>second</td></tr></table>`
    );

    const spacer = await check(`<table><tr><td></td></tr></table>`);

    assert.strictEqual(matchingFindings(oneRow, /header cells/).length, 0);
    assert.strictEqual(matchingFindings(oneColumn, /header cells/).length, 0);
    assert.strictEqual(matchingFindings(spacer, /header cells/).length, 0);
  });

  await t.test("does not let a nested table excuse the one around it", async () => {
    /* Wikipedia nests tables inside tables. Asking the outer one whether a
       `th` exists anywhere below it would find the inner one's. */
    const result = await check(
      `<table>
         <tr><td>a</td><td><table><tr><th>inner</th><td>x</td></tr>
                                  <tr><th>also</th><td>y</td></tr></table></td></tr>
         <tr><td>b</td><td>c</td></tr>
       </table>`
    );

    assert.strictEqual(
      matchingFindings(result, /header cells/).length,
      1,
      "the outer table has no headers of its own"
    );
  });

  await t.test("accepts a table that has headers", async () => {
    const result = await check(
      `<table><tr><th>City</th><th>Count</th></tr>
              <tr><td>Tokyo</td><td>3</td></tr></table>`
    );

    assert.strictEqual(matchingFindings(result, /header cells/).length, 0);
  });

  await t.test("leaves a layout table alone", async () => {
    /* A table with a role saying it is not a table is not claiming to have
       headers, and an empty one is somebody's spacer. Flagging either would
       be noise on pages that are doing nothing wrong. */
    const presentation = await check(
      `<table role="presentation"><tr><td>left</td><td>right</td></tr></table>`
    );
    const empty = await check(`<table></table>`);

    assert.strictEqual(matchingFindings(presentation, /header cells/).length, 0);
    assert.strictEqual(matchingFindings(empty, /header cells/).length, 0);
  });

  await t.test("reports a form field with nothing naming it", async () => {
    const result = await check(
      `<form><input type="text" placeholder="Search"></form>`
    );

    assert.strictEqual(matchingFindings(result, /naming it/).length, 1);
  });

  await t.test("accepts every route to a name", async () => {
    /* One of these is enough, and a field needs only one. `title` is here
       although the roadmap item did not list it: it is a real accessible
       name per spec, so reporting a field that has one would be asserting
       the name is bad, which is a judgement. */
    const result = await check(
      `<label for="a">Name</label><input id="a">
       <label>Email <input></label>
       <input aria-label="Phone">
       <span id="l">Postcode</span><input aria-labelledby="l">
       <input title="Search">
       <input type="image" src="s.png" alt="Send">
       <select aria-label="Prefecture"><option>Tokyo</option></select>
       <label for="t">Message</label><textarea id="t"></textarea>`
    );

    assert.strictEqual(matchingFindings(result, /naming/).length, 0);
  });

  await t.test("names each unlabelled field by whatever it does carry", async () => {
    /* The whole defect is that these have nothing to be called, so the row
       is built from the strongest identifier the element has left. */
    const result = await check(
      `<input id="q">
       <input name="email">
       <input class="postcode">
       <input type="tel">
       <form class="search"><input></form>`
    );

    assert.deepStrictEqual(result.rows, [
      "input#q",
      'input[name="email"]',
      "input.postcode",
      'input[type="tel"]',
      "form.search > input",
    ]);
  });

  await t.test("puts the placeholder beside the field it belongs to", async () => {
    /* It is what the field looks like it is called to anyone who can see
       it, which makes it the fastest way to find the row on the page - and
       it is usually the reason the label was left off. */
    const result = await check(`<input name="q" placeholder="Search books">`);

    assert.strictEqual(result.rows.length, 1);
    assert.match(result.rows[0], /Search books/);
  });

  await t.test("lists the svgs that were counted", async () => {
    const result = await check(
      `<svg class="icon-cart"></svg>
       <button class="menu"><svg></svg></button>`
    );

    assert.deepStrictEqual(result.rows, [
      "svg.icon-cart",
      "button.menu > svg",
    ]);
  });

  await t.test("never builds a row out of its own classes", async () => {
    /* Every panel element carries a krafty class. A row labelled with one
       would be describing the checker rather than the page. */
    const result = await check(`<div class="kraftyThing"><input></div>`);

    assert.strictEqual(result.rows.length, 1);
    assert.doesNotMatch(result.rows[0], /krafty/);
  });

  await t.test("wants an aria-labelledby that resolves", async () => {
    /* Pointing at an id that is not on the page names nothing. That is the
       failure this check is for, not an excuse from it. */
    const result = await check(`<input aria-labelledby="missing">`);

    assert.strictEqual(matchingFindings(result, /naming it/).length, 1);
  });

  await t.test("leaves the fields that take no label alone", async () => {
    /* Hidden has no field to label, and the button types are named by
       their own value. */
    const result = await check(
      `<input type="hidden" name="token" value="x">
       <input type="submit" value="Send">
       <input type="button" value="Cancel">
       <input type="reset" value="Clear">`
    );

    assert.strictEqual(matchingFindings(result, /naming/).length, 0);
  });

  await t.test("reports an svg that is neither named nor hidden", async () => {
    const result = await check(`<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>`);

    assert.strictEqual(matchingFindings(result, /SVG/).length, 1);
  });

  await t.test("accepts an svg that is named, and one that is hidden", async () => {
    const result = await check(
      `<svg><title>Home</title><path d="M0 0"/></svg>
       <svg aria-label="Search"></svg>
       <span id="c">Cart</span><svg aria-labelledby="c"></svg>
       <svg role="img"></svg>
       <svg aria-hidden="true"></svg>
       <span aria-hidden="true"><svg></svg></span>`
    );

    assert.strictEqual(matchingFindings(result, /SVG/).length, 0);
  });

  await t.test("reads aria-hidden from above the svg as well as on it", async () => {
    /* An icon wrapped in a hidden span is the ordinary way this is done
       correctly. Reading only the svg's own attribute would report every
       one of them. */
    const result = await check(
      `<button aria-hidden="true"><svg></svg></button>`
    );

    assert.strictEqual(matchingFindings(result, /SVG/).length, 0);
  });

  await t.test("counts one graphic once, not its inner svg too", async () => {
    const result = await check(`<svg><svg></svg></svg>`);

    const found = matchingFindings(result, /SVG/);

    assert.strictEqual(found.length, 1);
    assert.match(found[0], /\b1\b/, "one graphic, not two");
  });

  await t.test("does not read a shape's title as the graphic's", async () => {
    /* The head checker was bitten once by svg titles being read as
       something they were not. A title deeper in belongs to a shape. */
    const result = await check(
      `<svg><g><title>a path</title><path d="M0 0"/></g></svg>`
    );

    assert.strictEqual(matchingFindings(result, /SVG/).length, 1);
  });

  await t.test("checks again on demand, without being re-injected", async () => {
    /* The panels report the document as it stood when they ran, which is
       what the scanned-at line is about. The button is the cheap half of
       the MutationObserver under Known limitations. */
    const counts = await withPage(
      { html: `<div id="d"></div><div id="d"></div>`, checkers: ["markupCheck"] },
      async (page) => {
        /** @returns {Promise<string>} */
        const finding = () =>
          page.evaluate(
            () =>
              document
                .getElementById("js-kraftyMarkupInformation")
                ?.querySelector(".kraftyCheck")?.textContent ?? ""
          );

        const first = await finding();

        /* What a single page app does after the first scan. */
        await page.evaluate(() => {
          for (const id of ["late", "late", "late"]) {
            const node = document.createElement("span");
            node.id = id;
            document.body.appendChild(node);
          }
        });

        const stale = await finding();

        await page.click(".kraftyPanelRescan");

        return { first, stale, fresh: await finding() };
      }
    );

    assert.match(counts.first, /\b1\b/);
    assert.strictEqual(
      counts.stale,
      counts.first,
      "a scan does not follow the page; that is what the button is for"
    );
    assert.match(counts.fresh, /\b2\b/, "the second id should now be counted");
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
