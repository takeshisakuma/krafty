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
 * @param {{ noDoctype?: boolean, serve?: string }} [options]
 */
async function check(headMarkup, options = {}) {
  return withPage(
    { html: "<p>page</p>", checkers: [], serve: options.serve },
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
    /* Served, not set: on about:blank the href cannot be resolved at all,
       so this passed for as long as it existed without measuring anything. */
    const { findings } = await check(SOUND_HEAD, { serve: "/" });

    assert.strictEqual(matching(findings, /canonical/).length, 0);
  });

  await t.test("accepts a canonical that only spells this page differently", async () => {
    /* Found on takeshisakuma.github.io: read at "/", canonical "/index.html".
       The same document on every static host, and choosing one spelling is
       what the tag is for - but it was reported as the page disowning
       itself, which is the most serious thing this checker says about a
       canonical. */
    const cases = [
      ["/index.html", "a directory index"],
      ["/index.htm", "the other index extension"],
      ["/index.php", "an index served by php"],
      [".", "the directory itself"],
    ];

    /* One page, one browser, the canonical rewritten between runs. Four
       calls to check() would be four Chrome launches to vary one
       attribute. */
    const reported = await withPage(
      { html: "<p>page</p>", checkers: [], serve: "/" },
      async (page) => {
        const { SCRIPTS } = require("./support.js");

        /** @type {string[]} */
        const found = [];

        for (const [href] of cases) {
          await page.evaluate((value) => {
            document.head.innerHTML = `<title>t</title><link rel="canonical" href="${value}">`;
          }, href);

          await page.evaluate(SCRIPTS.headCheck);

          const findings = await page.evaluate(() =>
            [
              ...(document
                .getElementById("js-kraftyHeadInformation")
                ?.querySelectorAll(".kraftyCheck") ?? []),
            ].map((item) => item.textContent ?? "")
          );

          found.push(findings.join("\n"));

          /* Toggle off, or the next run finds the checker already on and
             tears its own panel down instead of building one. */
          await page.evaluate(SCRIPTS.headCheck);
        }

        return found;
      }
    );

    for (const [index, [, what]] of cases.entries()) {
      assert.doesNotMatch(
        reported[index],
        /canonical points at another/,
        `${what} is not another page`
      );
    }
  });

  await t.test("accepts a canonical that drops tracking parameters", async () => {
    /* Found on an Amazon ad landing URL: nineteen advertising parameters in
       the address, canonical set to the bare page. Naming the clean address
       is the most common correct use of the tag there is, and it was being
       reported as the page disowning itself. */
    const { findings } = await check(
      `<title>t</title><link rel="canonical" href="/">`,
      { serve: "/?tag=hydraamazonav-22&ref=pd_sl_7ibq2d37on_e&hvadid=675114138690" }
    );

    assert.strictEqual(
      matching(findings, /canonical points at another/).length,
      0,
      "dropping an ad's parameters is canonicalising, not disowning"
    );
  });

  await t.test("still reports a canonical that changes a parameter", async () => {
    /* The query cannot simply be ignored: ?id=2 is not ?id=1. The rule is
       containment, and a changed value is not contained. */
    const { findings } = await check(
      `<title>t</title><link rel="canonical" href="/?id=2">`,
      { serve: "/?id=1" }
    );

    assert.strictEqual(
      matching(findings, /canonical points at another/).length,
      1
    );
  });

  await t.test("still reports a canonical on a genuinely different page", async () => {
    /* The normalising must not have swallowed the check. */
    const { findings } = await check(
      `<title>t</title><link rel="canonical" href="/elsewhere/">`,
      { serve: "/" }
    );

    assert.strictEqual(
      matching(findings, /canonical points at another/).length,
      1
    );
  });

  await t.test("reports duplicated tags", async () => {
    const { findings } = await check(
      `${SOUND_HEAD}<link rel="canonical" href="/elsewhere">`
    );

    const duplicates = matching(findings, /canonical appears 2 times/);
    assert.strictEqual(duplicates.length, 1);
  });

  await t.test("does not count SVG titles as duplicate document titles", async () => {
    /* Found on a real site: an icon set drawn as inline SVG, each icon
       carrying its own <title> as an accessible name. A bare "title"
       selector matches every namespace in an HTML document, so all of them
       were counted and the page was told its title was duplicated. */
    const findings = await withPage(
      {
        html: `<p>page</p>
          <svg viewBox="0 0 16 16"><title>Search</title><path d="M0 0"/></svg>
          <svg viewBox="0 0 16 16"><title>Menu</title><path d="M0 0"/></svg>
          <svg viewBox="0 0 16 16"><title>Close</title><path d="M0 0"/></svg>`,
        checkers: [],
      },
      async (page) => {
        await page.evaluate(() => {
          document.head.insertAdjacentHTML(
            "beforeend",
            `<title>A page about something</title>`
          );
        });

        const { SCRIPTS } = require("./support.js");
        await page.evaluate(SCRIPTS.headCheck);

        return page.evaluate(() =>
          [
            ...(document
              .getElementById("js-kraftyHeadInformation")
              ?.querySelectorAll(".kraftyCheck") ?? []),
          ].map((item) => item.textContent ?? "")
        );
      }
    );

    assert.deepStrictEqual(
      findings.filter((text) => /title appears/.test(text)),
      [],
      "an icon's <title> is its accessible name, not a second document title"
    );
  });

  await t.test("still reports a genuinely duplicated title", async () => {
    /* The narrower selector must not have turned the check off. */
    const { findings } = await check(
      `<title>First</title><title>Second</title>`
    );

    assert.strictEqual(matching(findings, /title appears 2 times/).length, 1);
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

  await t.test("links URL rows, and only over http(s)", async () => {
    const links = await withPage(
      { html: "<p>page</p>", checkers: [] },
      async (page) => {
        await page.evaluate(() => {
          document.head.insertAdjacentHTML(
            "beforeend",
            `<title>t</title>
             <link rel="canonical" href="https://example.com/here">
             <meta property="og:url" content="javascript:alert(1)">
             <meta property="og:image" content="data:image/gif;base64,R0lGOD">`
          );
        });

        const { SCRIPTS } = require("./support.js");
        await page.evaluate(SCRIPTS.headCheck);

        return page.evaluate(() => {
          const panel = document.getElementById("js-kraftyHeadInformation");
          const rows = [...(panel?.querySelectorAll(".kraftyRow") ?? [])];

          /** @param {string} label */
          const row = (label) =>
            rows.find(
              (candidate) =>
                candidate.querySelector("strong")?.textContent === label
            );

          /** @param {string} label */
          const linkIn = (label) => {
            const anchor = row(label)?.querySelector("a.kraftyLink");
            return anchor
              ? {
                  href: /** @type {HTMLAnchorElement} */ (anchor).href,
                  target: anchor.getAttribute("target"),
                  rel: anchor.getAttribute("rel"),
                  text: anchor.textContent,
                }
              : null;
          };

          return {
            canonical: linkIn("canonical"),
            ogUrl: linkIn("og:url"),
            ogImage: linkIn("og:image"),
          };
        });
      }
    );

    assert.ok(links.canonical, "canonical should be a link");
    assert.strictEqual(links.canonical.target, "_blank");
    assert.strictEqual(links.canonical.rel, "noopener noreferrer");

    /* The value is written by the page. Turning a javascript: or data: URL
       into something clickable would make an inert row execute on click. */
    assert.strictEqual(
      links.ogUrl,
      null,
      "a javascript: URL must never become a link"
    );
    assert.strictEqual(
      links.ogImage,
      null,
      "a data: URL must never become a link"
    );
  });

  await t.test("offers to copy a value, and the findings", async () => {
    const state = await withPage(
      { html: "<p>page</p>", checkers: [] },
      async (page) => {
        await page.evaluate(() => {
          document.head.insertAdjacentHTML(
            "beforeend",
            `<title>A title</title><meta name="robots" content="noindex">`
          );
        });

        const { SCRIPTS } = require("./support.js");
        await page.evaluate(SCRIPTS.headCheck);

        return page.evaluate(() => {
          const panel = document.getElementById("js-kraftyHeadInformation");
          const rows = [...(panel?.querySelectorAll(".kraftyRow") ?? [])];

          const titleRow = rows.find(
            (row) => row.querySelector("strong")?.textContent === "title"
          );
          const missingRow = rows.find(
            (row) => row.querySelector(".kraftyMissing") !== null
          );

          return {
            onValue: titleRow?.querySelector(".kraftyCopy") !== null,
            onMissing: missingRow?.querySelector(".kraftyCopy") !== null,
            findingsShown:
              panel?.querySelector(".kraftyCopyAll") instanceof HTMLElement &&
              !(/** @type {HTMLElement} */ (
                panel.querySelector(".kraftyCopyAll")
              ).hidden),
          };
        });
      }
    );

    assert.strictEqual(state.onValue, true, "a value should be copyable");
    assert.strictEqual(
      state.onMissing,
      false,
      "there is nothing to copy from a row with no value"
    );
    assert.strictEqual(
      state.findingsShown,
      true,
      "the findings button should appear once there are findings"
    );
  });

  await t.test("hides the findings copy when there is nothing to copy", async () => {
    const hidden = await withPage(
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
          const button = document.querySelector(".kraftyCopyAll");
          return button instanceof HTMLElement ? button.hidden : null;
        });
      }
    );

    assert.strictEqual(hidden, true);
  });

  await t.test("keeps the character count beside the label it describes", async () => {
    const layout = await withPage(
      { html: "<p>page</p>", checkers: [], width: 1280, height: 900 },
      async (page) => {
        await page.evaluate(() => {
          document.head.insertAdjacentHTML(
            "beforeend",
            `<title>A page about something</title>`
          );
        });

        const { SCRIPTS } = require("./support.js");
        await page.evaluate(SCRIPTS.headCheck);

        return page.evaluate(() => {
          const panel = document.getElementById("js-kraftyHeadInformation");
          const row = [...(panel?.querySelectorAll(".kraftyRow") ?? [])].find(
            (candidate) =>
              candidate.querySelector("strong")?.textContent === "title"
          );

          const head = row?.querySelector(".kraftyRowHead");
          const label = row?.querySelector("strong");
          const count = row?.querySelector(".kraftyRowCount");
          const copy = row?.querySelector(".kraftyCopy");

          if (!head || !label || !count || !copy) {
            return null;
          }

          const headBox = head.getBoundingClientRect();

          return {
            gap:
              count.getBoundingClientRect().left -
              label.getBoundingClientRect().right,
            copyFromRight: headBox.right - copy.getBoundingClientRect().right,
            rowWidth: headBox.width,
            text: count.textContent ?? "",
          };
        });
      }
    );

    assert.ok(layout, "expected a title row with a label, a count and a copy");

    /* justify-content: space-between used to push the count into the middle
       of the row, tens of pixels from the label it belongs to, because it
       was a third child in a rule written for two. */
    assert.ok(
      layout.gap < 20,
      `the count should sit beside its label, but it is ${Math.round(
        layout.gap
      )}px away in a ${Math.round(layout.rowWidth)}px row`
    );

    /* The other half of the same fix: the button still reaches the edge. */
    assert.ok(
      layout.copyFromRight < 2,
      `the copy button should stay at the right edge, but it is ${Math.round(
        layout.copyFromRight
      )}px short of it`
    );

    /* Spacing is the stylesheet's job. A full width space hard coded in the
       script would widen this again and be invisible from the CSS. */
    assert.doesNotMatch(
      layout.text,
      /^　/,
      "the count should not carry its own leading space"
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
