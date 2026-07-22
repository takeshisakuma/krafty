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
    /* The button is named so this stays a test of the svg list; a nameless
       one is item 11's business, covered on its own below. */
    const result = await check(
      `<svg class="icon-cart"></svg>
       <button class="menu" aria-label="Menu"><svg></svg></button>`
    );

    assert.deepStrictEqual(result.rows, [
      "svg.icon-cart",
      "button.menu > svg",
    ]);
  });

  await t.test("tells a row of identical icons apart", async () => {
    /* Item 21's collapse, measured: a nameless svg inside a link with no
       class of its own, eight of them, all `a > svg`. The href is the one
       identifier such a link still carries, and it is what the copied report
       needs to point at one row rather than at "eight". The links are named
       here so this stays a test of the descriptor; the nameless case is item
       11's, below. */
    const result = await check(
      `<a href="/twitter">Twitter <svg></svg></a>
       <a href="/facebook">Facebook <svg></svg></a>`
    );

    assert.deepStrictEqual(result.rows, [
      'a[href="/twitter"] > svg',
      'a[href="/facebook"] > svg',
    ]);
  });

  await t.test("positions icons a shared class cannot separate", async () => {
    /* The other half of the collapse: `i.icon-blank > svg` repeated, where
       the class is real but identical down the row. A class is a weak
       identifier when it is borrowed as an svg's context, so the sibling
       position is added to keep the rows distinct. */
    const result = await check(
      `<span>
         <i class="icon"><svg></svg></i>
         <i class="icon"><svg></svg></i>
         <i class="icon"><svg></svg></i>
       </span>`
    );

    assert.deepStrictEqual(result.rows, [
      "i.icon:nth-of-type(1) > svg",
      "i.icon:nth-of-type(2) > svg",
      "i.icon:nth-of-type(3) > svg",
    ]);
  });

  await t.test("leaves a lone borrowed identity unpositioned", async () => {
    /* A position tells one sibling from the next; with a single icon there
       is nothing to tell it from, so the suffix would be noise. */
    const result = await check(`<i class="icon"><svg></svg></i>`);

    assert.deepStrictEqual(result.rows, ["i.icon > svg"]);
  });

  await t.test("positions icons whose link has nothing at all", async () => {
    /* No class and no href either - a link built as a button. The bare tag
       is as weak as a shared class, so it is positioned the same way. */
    const result = await check(
      `<nav><a><svg></svg></a><a><svg></svg></a></nav>`
    );

    assert.deepStrictEqual(result.rows, [
      "a:nth-of-type(1) > svg",
      "a:nth-of-type(2) > svg",
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

  await t.test("reports a link with no accessible name", async () => {
    /* An icon link - an svg and nothing else inside an `a href` - is silent
       and looks finished. A screen reader announces "link" and stops. */
    const result = await check(`<a href="/cart"><svg></svg></a>`);

    assert.strictEqual(matchingFindings(result, /accessible name/).length, 1);
  });

  await t.test("reports a button that is only an icon", async () => {
    const result = await check(`<button><svg></svg></button>`);

    assert.strictEqual(matchingFindings(result, /accessible name/).length, 1);
  });

  await t.test("accepts every route to a link or button's name", async () => {
    /* Text, aria-label, an aria-labelledby that resolves, the alt of an
       image inside, or title. One is enough. */
    const result = await check(
      `<a href="/a">Home</a>
       <a href="/b" aria-label="Search"><svg></svg></a>
       <span id="ln">Cart</span><a href="/c" aria-labelledby="ln"><svg></svg></a>
       <a href="/d"><img src="i.png" alt="Basket"></a>
       <button title="Menu"><svg></svg></button>
       <button>Send</button>`
    );

    assert.strictEqual(matchingFindings(result, /accessible name/).length, 0);
  });

  await t.test("honours aria-label over text a link cannot read", async () => {
    /* A labelled icon link is named, and its svg is decoration rather than
       the reason the link is unnamed - so no alert on either end. */
    const result = await check(`<a href="/x" aria-label="Home"><svg></svg></a>`);

    assert.strictEqual(matchingFindings(result, /accessible name/).length, 0);
    assert.strictEqual(matchingFindings(result, /leaving it unnamed/).length, 0);
    assert.strictEqual(
      matchingFindings(result, /neither named nor hidden/).length,
      1
    );
  });

  await t.test("leaves an aria-hidden link alone", async () => {
    /* Removed from the accessibility tree, it is announced as nothing at
       all, so a missing name on it reaches nobody. */
    const result = await check(`<a href="/x" aria-hidden="true"><svg></svg></a>`);

    assert.strictEqual(matchingFindings(result, /accessible name/).length, 0);
  });

  await t.test("splits svgs by whether they leave a control unnamed", async () => {
    /* Item 21's weight split. The svg inside a nameless link is the reason
       it has no name - the heavier fault, an alert - while the one in a
       plain `<i>` is undeclared decoration, a note. */
    const result = await check(
      `<a href="/x"><svg></svg></a>
       <i class="deco"><svg></svg></i>`
    );

    assert.strictEqual(matchingFindings(result, /leaving it unnamed/).length, 1);
    assert.strictEqual(
      matchingFindings(result, /neither named nor hidden/).length,
      1
    );
    /* And the link itself is reported from the other end. */
    assert.strictEqual(matchingFindings(result, /accessible name/).length, 1);
  });

  await t.test("a named button's icon is decoration, not the reason", async () => {
    const result = await check(`<button aria-label="Menu"><svg></svg></button>`);

    assert.strictEqual(matchingFindings(result, /accessible name/).length, 0);
    assert.strictEqual(matchingFindings(result, /leaving it unnamed/).length, 0);
    assert.strictEqual(
      matchingFindings(result, /neither named nor hidden/).length,
      1
    );
  });

  await t.test("lists a nameless link with its address", async () => {
    /* The address is what a nameless link is otherwise mute about. */
    const result = await check(`<a class="cart" href="/basket"><svg></svg></a>`);

    const row = result.rows.find((text) => text.includes("/basket"));

    assert.ok(row, "the link is listed with its address");
    assert.match(row, /a\.cart/);
  });

  await t.test("reports a link that points nowhere", async () => {
    /* An empty href or a bare # goes nowhere. A real fragment like #section
       is an in-page jump and is left alone. */
    const result = await check(
      `<a href="">Empty</a>
       <a href="#">Hash</a>
       <a href="#section">Real jump</a>`
    );

    const dead = matchingFindings(result, /point nowhere/);

    assert.strictEqual(dead.length, 1);
    assert.match(dead[0], /\b2\b/, "the two dead ones, not the real jump");
  });

  await t.test("reports one name that leads to different places", async () => {
    /* In a screen reader's link list the same word appears twice and goes
       somewhere different, with nothing to tell them apart. */
    const result = await check(
      `<a href="/tokyo">Our office</a><a href="/osaka">Our office</a>`
    );

    assert.strictEqual(
      matchingFindings(result, /more than one place/).length,
      1
    );
  });

  await t.test("accepts one name reused for the same destination", async () => {
    /* Two links with the same text and the same href are one link written
       twice, not a contradiction. */
    const result = await check(
      `<a href="/x">Home</a><a href="/x">Home</a>`
    );

    assert.strictEqual(
      matchingFindings(result, /more than one place/).length,
      0
    );
  });

  await t.test("lists a vague link text without asserting it is wrong", async () => {
    /* Whether a phrase is too vague is a judgement, so these are listed for
       the reader rather than reported as a finding - the summary stays
       clean. */
    const result = await check(
      `<a href="/a">詳細</a><a href="/b">こちら</a>`
    );

    assert.deepStrictEqual(result.findings, [], "a listing, not a finding");
    assert.ok(result.rows.some((text) => text.includes("詳細")));
    assert.ok(result.rows.some((text) => text.includes("こちら")));
  });

  await t.test("reports an interactive role that cannot take focus", async () => {
    /* The role promises a control and the element cannot be reached to use
       it: no tabindex, not natively focusable. */
    const result = await check(`<div role="button">Go</div>`);

    assert.strictEqual(matchingFindings(result, /cannot take focus/).length, 1);
  });

  await t.test("accepts an interactive role that can be reached", async () => {
    /* A tabindex, a native element under the role, or a resting item of a
       roving-tabindex widget (tabindex=-1, or a composite role) are all
       correct and must not be flagged. */
    const result = await check(
      `<div role="button" tabindex="0">Go</div>
       <a href="/x" role="button">Home</a>
       <button role="switch">On</button>
       <div role="checkbox" tabindex="-1">Roving</div>
       <span role="option">One</span>`
    );

    assert.strictEqual(matchingFindings(result, /cannot take focus/).length, 0);
  });

  await t.test("reports aria-hidden left in the tab order", async () => {
    /* Removed from the accessibility tree but still tabbable, so focus lands
       on it and it is announced as nothing. */
    const result = await check(
      `<div aria-hidden="true"><a href="/x">Home</a></div>`
    );

    assert.strictEqual(matchingFindings(result, /tab order/).length, 1);
  });

  await t.test("accepts aria-hidden with nothing focusable inside", async () => {
    const result = await check(
      `<div aria-hidden="true"><svg></svg><span>decoration</span></div>`
    );

    assert.strictEqual(matchingFindings(result, /tab order/).length, 0);
  });

  await t.test("reports a tabindex above zero", async () => {
    /* It reorders the whole document, not the local run it looks like it
       sits in. Zero and negative are left alone. */
    const result = await check(
      `<div tabindex="5">x</div><a href="/y" tabindex="0">ok</a>`
    );

    assert.strictEqual(matchingFindings(result, /tab sequence/).length, 1);
  });

  await t.test("points at a flagged element on hover and click", async () => {
    /* Item 23. The row's descriptor is weakest for exactly these elements,
       so the box over the real element is the way to find it. It is drawn in
       the page body, not the panel, so item 24's shadow roots cannot carry
       it off. */
    await withPage(
      {
        html: `<button style="width:40px;height:40px"><svg></svg></button>`,
        checkers: ["markupCheck"],
      },
      async (page) => {
        const row = ".kraftyPanelList li.kraftyLocatable";

        await page.hover(row);

        const hover = await page.evaluate(() => {
          const box = document.getElementById("js-kraftyPointerHover");
          return {
            exists: box !== null,
            inBody: box?.parentElement === document.body,
            shown: box instanceof HTMLElement && box.hidden === false,
          };
        });

        assert.ok(hover.exists, "a hover box is drawn");
        assert.ok(hover.inBody, "in the page body, not inside a panel");
        assert.ok(hover.shown, "and shown while the row is hovered");

        await page.click(row);

        const pinned = await page.evaluate(() => {
          const box = document.getElementById("js-kraftyPointerPin");
          return {
            exists: box !== null,
            inBody: box?.parentElement === document.body,
          };
        });

        assert.ok(pinned.exists && pinned.inBody, "clicking pins a box");
      }
    );
  });

  await t.test("does not offer to point at a row naming several elements", async () => {
    /* A duplicated id names every element that carries it, so there is no
       single thing to point at. The row stays inert. */
    const locatable = await withPage(
      {
        html: `<div id="d"></div><div id="d"></div>`,
        checkers: ["markupCheck"],
      },
      async (page) =>
        page.evaluate(() =>
          [...document.querySelectorAll(".kraftyPanelList li")].map((li) =>
            li.classList.contains("kraftyLocatable")
          )
        )
    );

    assert.deepStrictEqual(locatable, [false]);
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
