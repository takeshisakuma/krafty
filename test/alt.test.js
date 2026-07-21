// @ts-check

/* The alt checker draws its labels on top of the page, which is the whole
   difficulty. Measured on amazon.co.jp, where alt text is the product name:
   an opaque box of a hundred characters in a grid cell grew tall enough to
   hide the image underneath it, and 33 of 92 labels sat on another label.

   Hiding the image defeats the checker. Whether an alt describes its image
   is the one question here a person has to answer, and they cannot answer
   it about an image they cannot see. So these are mostly about size. */

const { test } = require("node:test");
const assert = require("node:assert");
const { withPage, SCRIPTS } = require("./support.js");

const LONG =
  "[Yezai] Tシャツ メンズ 半袖 夏服 接触冷感 オーバーサイズ 通気性 " +
  "吸汗 速乾 7分袖 ゆったり 大きいサイズ 無地 トップス ティーシャツ " +
  "greyblue-XXL 360度全方位UVカット 認証済み";

const PIXEL =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"></svg>`
  );

/** @param {string} html */
const measure = (html) =>
  withPage({ html, checkers: ["altCheck"], width: 1280, height: 900 }, (page) =>
    page.evaluate(() => {
      const labels = [...document.querySelectorAll(".kraftyAltContent")];

      return labels.map((label) => ({
        height: label.getBoundingClientRect().height,
        clipped: label.scrollHeight > label.clientHeight,
        title: label.getAttribute("title") ?? "",
        text: label.textContent ?? "",
      }));
    })
  );

test("alt checker", async (t) => {
  await t.test("clips a long alt rather than growing over the image", async () => {
    const [label] = await measure(
      `<img src="${PIXEL}" alt="${LONG}" width="200" height="200">`
    );

    /* scrollHeight past clientHeight is the clamp doing its job, with no
       threshold to argue about. */
    assert.strictEqual(
      label.clipped,
      true,
      "a product name's worth of alt has to be cut, not drawn in full"
    );

    /* And the box that remains has to be small enough to leave the picture
       visible: two lines and its padding, well under a 200px image. */
    assert.ok(
      label.height < 70,
      `expected a short label, got ${Math.round(label.height)}px`
    );
  });

  await t.test("leaves a short alt alone", async () => {
    const [label] = await measure(
      `<img src="${PIXEL}" alt="マウス" width="200" height="200">`
    );

    assert.strictEqual(
      label.clipped,
      false,
      "nothing to clip, so nothing should be clipped"
    );
  });

  await t.test("keeps the whole alt reachable from the label", async () => {
    /* Clipping must not lose the text. It is the thing being reviewed. */
    const [label] = await measure(
      `<img src="${PIXEL}" alt="${LONG}" width="200" height="200">`
    );

    assert.match(label.title, /greyblue-XXL/);
    assert.match(label.text, /Yezai/);
  });

  await t.test("opens to the full text on hover, and grows into it", async () => {
    /* The label is drawn over somebody else's page, where anything that
       jumps reads as a rendering fault - as though the text had been broken
       and the pointer happened to reveal it. Growing says the label meant
       to be folded. */
    const run = await withPage(
      {
        html: `<img src="${PIXEL}" alt="${LONG}" width="200" height="200">`,
        checkers: ["altCheck"],
        width: 640,
        height: 480,
      },
      async (page) => {
        /** @returns {Promise<number>} */
        const height = () =>
          page.evaluate(
            () =>
              document
                .querySelector(".kraftyAltContent")
                ?.getBoundingClientRect().height ?? 0
          );

        const closed = await height();

        /* The target is measured from the label's own content. A fixed one
           would be far past what most labels need, and the box would reach
           its height in the first tenth of the transition - the snap this
           replaces, with a duration attached. */
        const target = await page.evaluate(() => {
          const label = document.querySelector(".kraftyAltContent");
          return label instanceof HTMLElement
            ? label.style.getPropertyValue("--kraftyAltFull")
            : "";
        });

        await page.hover(".kraftyAltContent");

        /* What is actually running, rather than a frame caught part way.

           Sampling the height was tried and abandoned. A transition is
           sampled once per rendered frame, so reading it in a tight loop
           starves the renderer and returns the same number for hundreds of
           reads and then the final one - indistinguishable from an
           animation that never ran. Spacing the reads did not fix it
           either: the growth here finishes inside about 60ms, and the
           pointer can take longer than that to register. The code was right
           and the measurement was wrong, twice.

           getAnimations reports the transition itself, which is the thing
           being claimed. It is present or it is not. */
        const running = await page.evaluate(() => {
          const label = document.querySelector(".kraftyAltContent");
          if (!label) return [];

          return label.getAnimations().map((animation) => ({
            property:
              animation instanceof CSSTransition
                ? animation.transitionProperty
                : "",
            duration: Number(animation.effect?.getTiming().duration ?? 0),
          }));
        });

        /* Waited out rather than slept through. A fixed pause was enough
           alone and not enough with the rest of the suite running beside
           it, which is a test that fails on how busy the machine is. */
        let open = closed;
        let previous = -1;
        const deadline = Date.now() + 3000;

        while (Date.now() < deadline) {
          const now = await height();

          if (now > closed && now === previous) {
            open = now;
            break;
          }

          previous = now;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }

        return { closed, target, running, open };
      }
    );

    const growth = run.running.find(
      (animation) => animation.property === "max-height"
    );

    assert.ok(
      growth,
      `expected a transition on max-height, since line-clamp cannot be transitioned; saw ${JSON.stringify(
        run.running
      )}`
    );

    assert.ok(
      growth.duration > 0,
      `expected the growth to take time, got ${growth.duration}ms`
    );

    assert.match(
      run.target,
      /^\d+px$/,
      "the hover target has to be the label's own height, not a guess"
    );

    assert.ok(
      run.open > run.closed,
      `hovering should show the rest: ${Math.round(
        run.closed
      )}px then ${Math.round(run.open)}px`
    );

  });

  await t.test("keeps a folded label inside its own image", async () => {
    /* A row of book covers, which is where this went wrong: a label wider
       than its cover reached across the next one and ended up under that
       cover's label - unreadable, and unhoverable, so the way to open it
       was behind the thing covering it. */
    const row = Array.from(
      { length: 6 },
      (_, index) =>
        `<img src="${PIXEL}" alt="${index} ${LONG}" width="120" height="180"
              style="width:120px;height:180px">`
    ).join("");

    const state = await withPage(
      {
        html: `<div style="display:flex;gap:8px">${row}</div>`,
        checkers: ["altCheck"],
        width: 1280,
        height: 900,
      },
      (page) =>
        page.evaluate(() => {
          const labels = [...document.querySelectorAll(".kraftyAltContent")];
          const boxes = labels.map((label) =>
            label.getBoundingClientRect()
          );

          let overlaps = 0;

          for (let i = 0; i < boxes.length; i += 1) {
            for (let j = i + 1; j < boxes.length; j += 1) {
              const a = boxes[i];
              const b = boxes[j];

              if (
                a.left < b.right &&
                b.left < a.right &&
                a.top < b.bottom &&
                b.top < a.bottom
              ) {
                overlaps += 1;
              }
            }
          }

          return { widths: boxes.map((box) => box.width), overlaps };
        })
    );

    assert.strictEqual(state.widths.length, 6);

    for (const width of state.widths) {
      assert.ok(
        width <= 120,
        `a folded label must not be wider than its 120px image, got ${Math.round(
          width
        )}px`
      );
    }

    assert.strictEqual(
      state.overlaps,
      0,
      "labels that stay inside their images cannot cover each other"
    );
  });

  await t.test("says nothing about an image its own page has clipped away", async () => {
    /* A carousel keeps its off-screen items in the document at real
       coordinates and hides them with an ancestor's overflow. Appending the
       labels to the body took them out of that clipping, and the section
       came back showing the alt of every image except the ones on screen.

       Four covers of 120px in a 260px window: two visible, two past the
       edge. */
    const row = Array.from(
      { length: 4 },
      (_, index) =>
        `<img src="${PIXEL}" alt="cover ${index}" width="120" height="180"
              style="width:120px;height:180px;flex:none">`
    ).join("");

    const shown = await withPage(
      {
        html: `<div style="width:260px;overflow:hidden">
                 <div style="display:flex;gap:10px;width:900px">${row}</div>
               </div>`,
        checkers: ["altCheck"],
        width: 1280,
        height: 900,
      },
      (page) =>
        page.evaluate(() =>
          [...document.querySelectorAll(".kraftyAltContent")].map(
            (label) => label.textContent ?? ""
          )
        )
    );

    assert.deepStrictEqual(
      shown.map((text) => text.replace("alt: ", "")),
      ["cover 0", "cover 1"],
      "a label for an item the page is hiding lands on whatever is there instead"
    );
  });

  await t.test("keeps a fixed banner's label on the banner when the page scrolls", async () => {
    /* A label sits at the document coordinates its image had, which rides
       with the page - right for an image that scrolls. A banner fixed to the
       viewport does not scroll: it holds its place on screen while the page
       runs under it, and a document-pinned label slides off it and ends up
       over whatever the scroll brought past. Such a label is fixed too. */
    const gap = await withPage(
      {
        html: `<div style="position:fixed;top:0;left:0">
                 <img src="${PIXEL}" alt="banner" width="200" height="60"
                      style="width:200px;height:60px">
               </div>
               <div style="height:3000px"></div>`,
        checkers: ["altCheck"],
        width: 800,
        height: 600,
      },
      async (page) => {
        /** @returns {Promise<number>} */
        const distance = () =>
          page.evaluate(() => {
            const image = document.querySelector("img");
            const label = document.querySelector(".kraftyAltContent");
            if (!image || !label) return -1;

            /* How far the label's top-left sits from the image's, on screen.
               A label that tracks the banner keeps this constant; one left
               behind at document coordinates grows it by the scroll. */
            const a = image.getBoundingClientRect();
            const b = label.getBoundingClientRect();
            return Math.round(Math.hypot(b.left - a.left, b.top - a.top));
          });

        const before = await distance();
        await page.evaluate(() => window.scrollTo(0, 1500));
        const after = await distance();

        return { before, after };
      }
    );

    assert.ok(gap.before >= 0, "expected a fixed banner with a label");
    assert.strictEqual(
      gap.after,
      gap.before,
      `the label should ride the banner, but it drifted ${
        gap.after - gap.before
      }px on a 1500px scroll`
    );
  });

  await t.test("still separates a missing alt from a deliberately empty one", async () => {
    /* The two look identical in a browser and mean opposite things, which
       is the reason this checker exists. */
    const states = await withPage(
      {
        html: `<img src="${PIXEL}" width="10" height="10">
               <img src="${PIXEL}" alt="" width="10" height="10">`,
        checkers: ["altCheck"],
      },
      (page) =>
        page.evaluate(() => ({
          missing: document.querySelectorAll(".kraftyAltMissing").length,
          empty: document.querySelectorAll(".kraftyAltEmpty").length,
        }))
    );

    assert.deepStrictEqual(states, { missing: 1, empty: 1 });
  });

  await t.test("leaves nothing behind when toggled off", async () => {
    const after = await withPage(
      {
        html: `<img src="${PIXEL}" alt="x" width="10" height="10">`,
        checkers: ["altCheck"],
      },
      async (page) => {
        await page.evaluate(SCRIPTS.altCheck);

        return page.evaluate(() => ({
          labels: document.querySelectorAll(".kraftyAltContent").length,
          bodyClass: document.body.classList.contains("kraftyAltChecker"),
        }));
      }
    );

    assert.strictEqual(after.labels, 0);
    assert.strictEqual(after.bodyClass, false);
  });
});
