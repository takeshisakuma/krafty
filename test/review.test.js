// @ts-check

/* The popup's review button: run the checkers that report, and put what
   their panels say in one block.

   The constraint worth testing is what it must NOT do. A total - "12
   issues" - reads as a verdict on the whole page including the parts
   nothing looked at, which is the single score the roadmap refuses under
   "A single score - deliberately not". Each checker names itself and says
   what it found, which claims exactly as much as the panels do. */

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { withPage, SCRIPTS } = require("./support.js");

/* The real function out of the real file, so this cannot pass against a
   copy that has drifted from what the popup ships. */
const popup = fs
  .readFileSync(path.join(__dirname, "..", "code", "popup", "popup.js"), "utf8")
  /* Checked out with CRLF on Windows, and the brace this looks for is at the
     start of a line. */
  .replace(/\r\n/g, "\n");

const start = popup.indexOf("function collectReview");
const end = popup.indexOf("\n}\n", start);

const collectReview = popup.slice(start, end + 2);

assert.ok(start !== -1 && end !== -1, "collectReview is not in popup.js");

const PANELS = [
  { id: "js-kraftyHeadInformation", title: "Head Check" },
  { id: "js-kraftyNestInformation", title: "Nest Check" },
  { id: "js-kraftyMarkupInformation", title: "Markup Check" },
];

const IMAGE_PANEL = {
  id: "js-kraftyImageInformation",
  title: "Image Check",
};

/**
 * An SVG data URL carries its own intrinsic size, so naturalWidth is known
 * without shipping fixture files around.
 *
 * @param {number} width
 * @param {number} height
 */
const imageSource = (width, height) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#ccc"/></svg>`
  )}`;

test("the review the popup copies", async (t) => {
  /** @type {string} */
  const review = await withPage(
    {
      html: `<h1>Delivery</h1>
             <ul><div>wrong</div></ul>
             <p id="dup"></p><p id="dup"></p>`,
      checkers: ["nestCheck", "markupCheck"],
      serve: "/",
    },
    async (page) => {
      await page.evaluate(() => {
        document.head.insertAdjacentHTML(
          "beforeend",
          `<title>Delivery</title>`
        );
      });

      await page.evaluate(SCRIPTS.headCheck);

      return page.evaluate(
        ([source, panels]) =>
          new Function(`${source}; return collectReview(${JSON.stringify(
            panels
          )});`)(),
        /** @type {[string, typeof PANELS]} */ ([collectReview, PANELS])
      );
    }
  );

  await t.test("leads with the address and the title", () => {
    const [first, second] = review.split("\n");

    assert.match(first, /^https?:\/\//);
    assert.strictEqual(second, "Delivery");
  });

  await t.test("names every checker that reported", () => {
    for (const { title } of PANELS) {
      assert.ok(review.includes(title), `${title} is missing from the review`);
    }
  });

  await t.test("carries what the panels said", () => {
    assert.match(review, /ul > div/, "the nest breakdown belongs in it");
    assert.match(review, /#dup/, "so does the duplicated id");
    assert.match(review, /No description/, "and the head checker's findings");
  });

  await t.test("says what each checker checked, not what the page scored", () => {
    /* The line to hold, expressed as a shape rather than a wording: at the
       top level there are checker names and nothing else. Every count is
       indented beneath the checker that arrived at it and is that
       checker's claim. A page total would have to sit unindented, owned by
       nobody, covering the parts nothing looked at. */
    const unowned = review
      .split("\n")
      .slice(2)
      .filter((line) => line !== "" && !line.startsWith("  "))
      .filter((line) => !PANELS.some(({ title }) => title === line));

    assert.deepStrictEqual(
      unowned,
      [],
      "a line at the top level belongs to no checker and claims more than any of them"
    );

    /* And every heading is answered. A checker named with nothing under it
       would read as a clean bill of health it never gave. */
    const lines = review.split("\n");

    for (const { title } of PANELS) {
      const at = lines.indexOf(title);

      assert.ok(at !== -1, `${title} is missing`);
      assert.ok(
        (lines[at + 1] ?? "").startsWith("  "),
        `${title} says nothing, which reads as a verdict it did not give`
      );
    }
  });
});

test("the review includes image detail rows", async () => {
  /* Oversized rows live in .kraftyImageList, not .kraftyPanelList. The review
     used to copy only the latter, so a pasted report named Image Check and
     then dropped the filenames. */
  const review = await withPage(
    {
      html: `<img src="${imageSource(800, 600)}" width="100" height="75" alt="">`,
      checkers: [],
      width: 1280,
      height: 900,
      serve: "/",
    },
    async (page) => {
      await page.waitForFunction(() =>
        [...document.images].every((image) => image.complete)
      );
      await page.evaluate(SCRIPTS.imageCheck);

      return page.evaluate(
        ([source, panels]) =>
          new Function(`${source}; return collectReview(${JSON.stringify(
            panels
          )});`)(),
        /** @type {[string, typeof IMAGE_PANEL[]]} */ ([
          collectReview,
          [IMAGE_PANEL],
        ])
      );
    }
  );

  assert.ok(review.includes(IMAGE_PANEL.title), "Image Check is named");
  assert.match(
    review,
    /800\s*[×x]\s*600/,
    `oversized measurement belongs in the review, got:\n${review}`
  );
});
