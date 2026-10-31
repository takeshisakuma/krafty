// @ts-check

/* The manuscript checker is a reading skin, not a stylesheet switch. What
   the page hid stays hidden, a box that was off screen stays off screen, and
   a bar that was covering the viewport joins the text. The panel test is
   the brightness checker's: nothing here may become the containing block
   for a fixed panel. */

const { test } = require("node:test");
const assert = require("node:assert");
const { withPage, SCRIPTS } = require("./support.js");

const PAGE = `<style>
  body { margin: 0; color: #fff; background: #111; font-family: "NotARealFont", sans-serif; }
  p { color: #fff !important; background: #111 !important; }
  header { position: fixed; top: 0; left: 0; right: 0; height: 48px; background: #f00; z-index: 5; }
  nav { display: flex; flex-direction: row; gap: 40px; }
  ul { list-style: none; padding: 0; }
  .secret { display: none; }
  .drawer { position: fixed; left: -800px; top: 0; width: 240px; }
  h1 { font-size: 12px; margin: 0; }
  #hero { background-image: linear-gradient(#f00, #00f); color: #fff; }
  #vert { writing-mode: vertical-rl; text-align: center; }
  #band { height: 36px; }
  #band b { display: block; height: 30px; }
  #cols { column-count: 3; column-width: 80px; }
  #slot { height: 16px; overflow: visible; display: flex; flex-direction: column; }
  #bird { width: 1.4rem; height: 1.4rem; }
  #spill { height: 12px; overflow: visible; }
  #row { height: 28px; overflow: hidden; display: flex; flex-direction: row; gap: 16px; }
  #clip { height: 24px; overflow: hidden; }
  #stage { height: 400px; }
  #follow.stuck {
    position: fixed !important;
    top: 0;
    left: 0;
    right: 0;
    height: 80px;
    background: #fff;
    z-index: 9;
  }
  #pill {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    justify-content: center;
    align-items: center;
    background: #7f0000;
    color: #fff;
    border-radius: 40px;
    min-height: 48px;
    height: 48px;
    padding: 8px 32px;
  }
  #pill::before { content: "★"; background: #7f0000; }
</style>
<header id="bar">Site header</header>
<div id="drawer" class="drawer"><p>Off canvas navigation that should stay off the screen even when the line is long enough to fill a column of the manuscript.</p></div>
<div id="secret" class="secret">Hidden menu state</div>
<p id="attr" hidden>Attribute hidden</p>
<nav id="nav"><a id="home" href="#h">Home</a><a id="about" href="#a">About the company</a></nav>
<main>
  <h1 id="title">Page title</h1>
  <p id="lead">A sentence you would copy.</p>
  <ul id="list"><li>First point</li></ul>
  <div id="hero">Hero words</div>
  <img id="pic" alt="A picture" width="40" height="40" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7">
  <details id="more"><summary>More</summary><p id="inside">Inside the disclosure.</p></details>
  <button id="go" type="button">press</button>
  <input id="field" type="text" value="Name">
  <div id="band"><b id="band-a">Logo</b><b id="band-b">Menu</b></div>
  <p id="cols">Words that a page had set in several columns.</p>
  <div id="slot"><a id="icon" href="#i"><svg id="bird" viewBox="0 0 16 16"><rect width="16" height="16"></rect></svg></a></div>
  <p id="under">Under the icon</p>
  <div id="spill"><p id="spill-line">A line that is taller than its bar</p></div>
  <p id="after-spill">After the bar</p>
  <div id="row"><a id="row-a" href="#a">Alpha</a><a id="row-b" href="#b">Beta</a></div>
  <p id="after-row">After the row</p>
  <div id="clip"><p id="clip-a">Visible row</p><p id="clip-b">Already hidden row</p></div>
  <div id="stage"><div id="stage-body" style="height:80px">Picture</div></div>
  <p id="after-stage">After the stage</p>
  <div id="follow">Following bar</div>
  <p id="under-follow">Words underneath the bar</p>
  <p id="vert">縦の文</p>
  <a id="pill" href="#s">詳細を見る</a>
  <div id="ghost" style="position:absolute;top:12px;left:12px;width:80px;height:24px;visibility:hidden">Ghost label</div>
  <a id="below" href="#b" style="position:absolute;top:3200px;left:24px;background:#7f0000;border-radius:40px;height:48px">詳細を見る</a>
</main>`;

test("manuscript checker", async (t) => {
  await t.test("reads as a column and leaves hidden content hidden", async () => {
    const seen = await withPage(
      { html: PAGE, checkers: ["manuscriptCheck"], width: 900, height: 700 },
      async (page) =>
        page.evaluate(() => {
          /**
           * @param {string} id
           */
          const rect = (id) => {
            const el = document.getElementById(id);
            const box = el ? el.getBoundingClientRect() : null;
            return box
              ? { top: box.top, bottom: box.bottom, left: box.left, right: box.right }
              : null;
          };
          /**
           * @param {string} id
           */
          const style = (id) => {
            const el = document.getElementById(id);
            return el ? getComputedStyle(el) : null;
          };
          const lead = style("lead");
          const title = style("title");
          const bar = style("bar");
          const secret = style("secret");
          const attr = style("attr");
          const home = style("home");
          const nav = style("nav");
          const list = style("list");
          const hero = style("hero");
          const body = getComputedStyle(document.body);

          const leadNode = document.getElementById("lead");
          const range = document.createRange();
          if (leadNode) {
            range.selectNodeContents(leadNode);
          }
          const selection = getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);

          return {
            bodyClass: document.body.classList.contains("kraftyManuscriptChecker"),
            rootClass: document.documentElement.classList.contains(
              "kraftyManuscriptRoot"
            ),
            maxWidth: body.maxWidth,
            display: body.display,
            font: lead ? lead.fontFamily : "",
            leadColor: lead ? lead.color : "",
            leadSelect: lead ? lead.userSelect : "",
            selected: selection?.toString() ?? "",
            titleSize: title ? Number.parseFloat(title.fontSize) : 0,
            leadSize: lead ? Number.parseFloat(lead.fontSize) : 0,
            barPosition: bar ? bar.position : "",
            barBox: rect("bar"),
            titleBox: rect("title"),
            drawerBox: rect("drawer"),
            secretDisplay: secret ? secret.display : "",
            attrDisplay: attr ? attr.display : "",
            hiddenInText: (document.body.innerText || "").includes("Hidden menu state"),
            flex: nav ? nav.flexDirection : "",
            homeBox: rect("home"),
            aboutBox: rect("about"),
            listStyle: list ? list.listStyleType : "",
            linkDecoration: home ? home.textDecorationLine : "",
            heroImage: hero ? hero.backgroundImage : "",
            picDisplay: style("pic")?.display ?? "",
            /* Closed <details> hides its body without display:none, so the
               box is what says whether the words stayed out of the page. */
            insideHidden: document.getElementById("inside")?.checkVisibility() === false,
          };
        })
    );

    assert.strictEqual(seen.bodyClass, true);
    assert.strictEqual(seen.rootClass, true);
    assert.strictEqual(seen.display, "block");
    assert.strictEqual(seen.maxWidth, "680px");
    assert.ok(
      seen.font.includes("system-ui"),
      `the page font should be replaced, got ${seen.font}`
    );
    assert.notStrictEqual(seen.leadColor, "rgb(255, 255, 255)");
    assert.strictEqual(seen.leadSelect, "text");
    assert.strictEqual(seen.selected, "A sentence you would copy.");
    assert.ok(
      seen.titleSize > seen.leadSize,
      `a heading should outrank the body, ${seen.titleSize} vs ${seen.leadSize}`
    );
    assert.strictEqual(seen.barPosition, "static");
    assert.ok(seen.barBox && seen.titleBox);
    assert.ok(
      seen.titleBox.top >= seen.barBox.bottom - 1,
      `the header should join the flow above the title, bar ${JSON.stringify(seen.barBox)} title ${JSON.stringify(seen.titleBox)}`
    );
    assert.ok(seen.drawerBox);
    assert.ok(
      seen.drawerBox.right <= 1 && seen.drawerBox.left < -100,
      `an off-screen drawer should stay off screen, got ${JSON.stringify(seen.drawerBox)}`
    );
    assert.strictEqual(seen.secretDisplay, "none");
    assert.strictEqual(seen.attrDisplay, "none");
    assert.strictEqual(seen.hiddenInText, false);
    assert.strictEqual(seen.flex, "column");
    assert.ok(seen.homeBox && seen.aboutBox);
    assert.ok(
      seen.aboutBox.top >= seen.homeBox.bottom - 1,
      `a row of links should stack, ${JSON.stringify(seen.homeBox)} then ${JSON.stringify(seen.aboutBox)}`
    );
    assert.strictEqual(seen.listStyle, "disc");
    assert.strictEqual(seen.linkDecoration, "underline");
    assert.strictEqual(seen.heroImage, "none");
    assert.notStrictEqual(seen.picDisplay, "none");
    assert.strictEqual(seen.insideHidden, true);
  });

  await t.test("drops vertical writing, centering and button chrome", async () => {
    const seen = await withPage(
      { html: PAGE, checkers: ["manuscriptCheck"], width: 900, height: 700 },
      async (page) =>
        page.evaluate(() => {
          const vert = document.getElementById("vert");
          const pill = document.getElementById("pill");
          const go = document.getElementById("go");
          const field = document.getElementById("field");
          const vertStyle = vert ? getComputedStyle(vert) : null;
          const pillStyle = pill ? getComputedStyle(pill) : null;
          const goStyle = go ? getComputedStyle(go) : null;
          const fieldStyle = field ? getComputedStyle(field) : null;
          const before = pill ? getComputedStyle(pill, "::before") : null;
          const below = document.getElementById("below");
          const ghost = document.getElementById("ghost");
          const belowStyle = below ? getComputedStyle(below) : null;
          const body = getComputedStyle(document.body);

          return {
            writing: vertStyle ? vertStyle.writingMode : "",
            align: vertStyle ? vertStyle.textAlign : "",
            margin: body.marginLeft,
            position: pillStyle ? pillStyle.position : "",
            justify: pillStyle ? pillStyle.justifyContent : "",
            radius: pillStyle ? pillStyle.borderRadius : "",
            fill: pillStyle ? pillStyle.backgroundColor : "",
            height: pill ? pill.getBoundingClientRect().height : 0,
            star: before ? before.content : "",
            belowFill: belowStyle ? belowStyle.backgroundColor : "",
            belowRadius: belowStyle ? belowStyle.borderRadius : "",
            ghost: ghost ? getComputedStyle(ghost).position : "",
            goBorder: goStyle ? goStyle.borderTopWidth : "",
            goFill: goStyle ? goStyle.backgroundColor : "",
            fieldBorder: fieldStyle ? fieldStyle.borderTopWidth : "",
          };
        })
    );

    assert.strictEqual(seen.writing, "horizontal-tb");
    assert.strictEqual(seen.align, "start");
    assert.strictEqual(seen.margin, "0px");
    assert.strictEqual(seen.position, "static");
    assert.notStrictEqual(seen.justify, "center");
    assert.strictEqual(seen.radius, "0px");
    assert.strictEqual(seen.fill, "rgba(0, 0, 0, 0)");
    assert.ok(seen.height < 40, `the control should shrink to its words, got ${seen.height}px`);
    assert.strictEqual(seen.star, "none");
    assert.strictEqual(seen.belowFill, "rgba(0, 0, 0, 0)");
    assert.strictEqual(seen.belowRadius, "0px");
    assert.strictEqual(seen.ghost, "absolute");
    assert.strictEqual(seen.goBorder, "0px");
    assert.strictEqual(seen.goFill, "rgba(0, 0, 0, 0)");
    assert.strictEqual(seen.fieldBorder, "1px");
  });

  await t.test("still lets the page open what it had closed", async () => {
    const opened = await withPage(
      { html: PAGE, checkers: ["manuscriptCheck"], width: 900, height: 700 },
      async (page) =>
        page.evaluate(() => {
          const secret = document.getElementById("secret");
          const details = document.getElementById("more");
          const inside = document.getElementById("inside");
          const button = document.getElementById("go");

          if (secret) {
            secret.style.display = "block";
          }
          if (details instanceof HTMLDetailsElement) {
            details.open = true;
          }
          button?.addEventListener("click", () => {
            if (button) {
              button.dataset.pressed = "yes";
            }
          });

          return {
            secret: secret ? getComputedStyle(secret).display : "",
            inside: inside ? inside.checkVisibility() : false,
          };
        })
        .then(async (styles) => {
          await page.click("#go");
          const pressed = await page.evaluate(
            () => document.getElementById("go")?.dataset.pressed ?? "no"
          );
          return { ...styles, pressed };
        })
    );

    assert.strictEqual(opened.secret, "block");
    assert.strictEqual(opened.inside, true);
    assert.strictEqual(opened.pressed, "yes");
  });

  await t.test("does not move a panel or the squint screen", async () => {
    const seen = await withPage(
      {
        html: `<div style="height:3000px"><ul><div>x</div></ul></div>`,
        checkers: ["nestCheck", "squintCheck"],
        width: 900,
        height: 600,
      },
      async (page) => {
        await page.evaluate(() => window.scrollTo(0, 1200));

        const before = await page.evaluate(
          () =>
            document
              .getElementById("js-kraftyNestInformation")
              ?.getBoundingClientRect().top ?? null
        );

        await page.evaluate(SCRIPTS.manuscriptCheck);

        return page.evaluate((top) => {
          const panel = document.getElementById("js-kraftyNestInformation");
          const screen = document.getElementById("js-kraftySquintScreen");
          return {
            before: top,
            after: panel ? panel.getBoundingClientRect().top : null,
            panelPosition: panel ? getComputedStyle(panel).position : "",
            screenPosition: screen ? getComputedStyle(screen).position : "",
            filter: screen ? getComputedStyle(screen).backdropFilter : "",
          };
        }, before);
      }
    );

    assert.strictEqual(seen.panelPosition, "fixed");
    assert.strictEqual(
      Math.round(Number(seen.after)),
      Math.round(Number(seen.before)),
      "a panel is fixed to the viewport and must stay where it was"
    );
    assert.strictEqual(seen.screenPosition, "fixed");
    assert.match(seen.filter, /blur/);
  });

  await t.test("a fixed height does not throw the next block sideways", async () => {
    const seen = await withPage(
      { html: PAGE, checkers: ["manuscriptCheck"], width: 900, height: 700 },
      async (page) =>
        page.evaluate(() => {
          /**
           * @param {string} id
           */
          const rect = (id) => {
            const el = document.getElementById(id);
            const box = el ? el.getBoundingClientRect() : null;

            return box ? { top: box.top, left: box.left, bottom: box.bottom } : null;
          };
          const cols = document.getElementById("cols");
          const colsStyle = cols ? getComputedStyle(cols) : null;

          return {
            a: rect("band-a"),
            b: rect("band-b"),
            columnCount: colsStyle ? colsStyle.columnCount : "",
            columnWidth: colsStyle ? colsStyle.columnWidth : "",
          };
        })
    );

    assert.ok(seen.a && seen.b);
    assert.ok(
      seen.b.top >= seen.a.bottom - 1,
      `the next block should sit under the first, ${JSON.stringify(seen.a)} then ${JSON.stringify(seen.b)}`
    );
    assert.ok(
      Math.abs(seen.b.left - seen.a.left) < 2,
      `the next block should share the column, ${JSON.stringify(seen.a)} then ${JSON.stringify(seen.b)}`
    );
    assert.strictEqual(seen.columnCount, "auto");
    assert.strictEqual(seen.columnWidth, "auto");
  });

  await t.test("a short box does not cover the next line", async () => {
    const seen = await withPage(
      { html: PAGE, checkers: ["manuscriptCheck"], width: 900, height: 700 },
      async (page) =>
        page.evaluate(() => {
          /**
           * @param {string} id
           */
          const rect = (id) => {
            const el = document.getElementById(id);
            const box = el ? el.getBoundingClientRect() : null;

            return box ? { top: box.top, bottom: box.bottom, width: box.width } : null;
          };
          const bird = document.getElementById("bird");

          return {
            birdWidth: bird ? getComputedStyle(bird).width : "",
            icon: rect("icon"),
            under: rect("under"),
            line: rect("spill-line"),
            after: rect("after-spill"),
          };
        })
    );

    assert.ok(Number.parseFloat(seen.birdWidth) < 40, `an icon keeps its size, got ${seen.birdWidth}`);
    assert.ok(seen.icon && seen.under && seen.line && seen.after);
    assert.ok(
      seen.under.top >= seen.icon.bottom - 1,
      `the line under an icon should clear it, ${JSON.stringify(seen.icon)} then ${JSON.stringify(seen.under)}`
    );
    assert.ok(
      seen.after.top >= seen.line.bottom - 1,
      `the next line should clear a short bar, ${JSON.stringify(seen.line)} then ${JSON.stringify(seen.after)}`
    );
  });

  await t.test("a row opens when the column makes it too short, a closed clip stays closed", async () => {
    const seen = await withPage(
      { html: PAGE, checkers: ["manuscriptCheck"], width: 900, height: 700 },
      async (page) =>
        page.evaluate(() => {
          /**
           * @param {string} id
           */
          const rect = (id) => {
            const el = document.getElementById(id);
            const box = el ? el.getBoundingClientRect() : null;

            return box ? { top: box.top, bottom: box.bottom, height: box.height } : null;
          };
          return {
            rowA: rect("row-a"),
            rowB: rect("row-b"),
            after: rect("after-row"),
            clip: rect("clip"),
          };
        })
    );

    assert.ok(seen.rowA && seen.rowB && seen.after && seen.clip);
    assert.ok(
      seen.rowB.top >= seen.rowA.bottom - 1,
      `the second item should sit under the first, ${JSON.stringify(seen.rowA)} then ${JSON.stringify(seen.rowB)}`
    );
    assert.ok(
      seen.after.top >= seen.rowB.bottom - 1,
      `the next line should clear the row, ${JSON.stringify(seen.rowB)} then ${JSON.stringify(seen.after)}`
    );
    assert.ok(seen.clip.height < 40, `a box that already clipped should stay short, got ${seen.clip.height}`);
  });

  await t.test("a stage shrinks to the picture it holds", async () => {
    const seen = await withPage(
      { html: PAGE, checkers: ["manuscriptCheck"], width: 900, height: 700 },
      async (page) =>
        page.evaluate(() => {
          /**
           * @param {string} id
           */
          const rect = (id) => {
            const el = document.getElementById(id);
            const box = el ? el.getBoundingClientRect() : null;

            return box ? { top: box.top, bottom: box.bottom, height: box.height } : null;
          };

          return { stage: rect("stage"), body: rect("stage-body"), after: rect("after-stage") };
        })
    );

    assert.ok(seen.stage && seen.body && seen.after);
    assert.ok(seen.stage.height < 160, `the stage should drop to the picture, got ${seen.stage.height}`);
    assert.ok(
      seen.after.top >= seen.body.bottom - 1 && seen.after.top < seen.body.bottom + 80,
      `the next line should follow the picture, ${JSON.stringify(seen.body)} then ${JSON.stringify(seen.after)}`
    );
  });

  await t.test("a bar pinned on scroll stays in the column", async () => {
    const seen = await withPage(
      { html: PAGE, checkers: ["manuscriptCheck"], width: 900, height: 700 },
      async (page) => {
        const during = await page.evaluate(async () => {
          const follow = document.getElementById("follow");
          const under = document.getElementById("under-follow");
          const drawer = document.getElementById("drawer");

          if (!follow || !under || !drawer) {
            return null;
          }

          follow.classList.add("stuck");
          await new Promise((resolve) => {
            requestAnimationFrame(() => resolve(undefined));
          });
          under.scrollIntoView();
          const box = under.getBoundingClientRect();
          const x = Math.min(Math.max(box.left + 8, 8), window.innerWidth - 8);
          const y = Math.min(Math.max(box.top + 8, 8), window.innerHeight - 8);
          const hit = document.elementFromPoint(x, y);

          return {
            position: getComputedStyle(follow).position,
            covered: hit !== under && !under.contains(hit),
            drawerLeft: drawer.getBoundingClientRect().left,
          };
        });

        await page.evaluate(SCRIPTS.manuscriptCheck);

        const after = await page.evaluate(() => {
          const follow = document.getElementById("follow");

          return {
            position: follow ? getComputedStyle(follow).position : "",
            pin: follow ? follow.hasAttribute("data-krafty-manuscript-pin") : true,
            inline: follow ? follow.style.position : "missing",
          };
        });

        return { during, after };
      }
    );

    assert.ok(seen.during);
    assert.strictEqual(seen.during.position, "static");
    assert.strictEqual(seen.during.covered, false);
    assert.ok(
      seen.during.drawerLeft < -100,
      `an off-screen drawer should stay off screen, got ${seen.during.drawerLeft}`
    );
    assert.deepStrictEqual(seen.after, { position: "fixed", pin: false, inline: "" });
  });

  await t.test("leaves nothing behind when toggled off", async () => {
    const after = await withPage(
      { html: PAGE, checkers: ["manuscriptCheck"], width: 900, height: 700 },
      async (page) => {
        await page.evaluate(SCRIPTS.manuscriptCheck);

        return page.evaluate(() => ({
          bodyClass: document.body.classList.contains("kraftyManuscriptChecker"),
          rootClass: document.documentElement.classList.contains(
            "kraftyManuscriptRoot"
          ),
          flow: document.querySelector("[data-krafty-manuscript-flow]") !== null,
          away: document.querySelector("[data-krafty-manuscript-away]") !== null,
          hold: document.querySelector("[data-krafty-manuscript-hold]") !== null,
          grow: document.querySelector("[data-krafty-manuscript-grow]") !== null,
          fit: document.querySelector("[data-krafty-manuscript-fit]") !== null,
          clip: document.querySelector("[data-krafty-manuscript-clip]") !== null,
          pin: document.querySelector("[data-krafty-manuscript-pin]") !== null,
          bar: (() => {
            const el = document.getElementById("bar");
            return el ? getComputedStyle(el).position : "";
          })(),
          lead: (() => {
            const el = document.getElementById("lead");
            return el ? getComputedStyle(el).color : "";
          })(),
        }));
      }
    );

    assert.deepStrictEqual(
      {
        bodyClass: after.bodyClass,
        rootClass: after.rootClass,
        flow: after.flow,
        away: after.away,
        hold: after.hold,
        grow: after.grow,
        fit: after.fit,
        clip: after.clip,
        pin: after.pin,
        bar: after.bar,
      },
      {
        bodyClass: false,
        rootClass: false,
        flow: false,
        away: false,
        hold: false,
        grow: false,
        fit: false,
        clip: false,
        pin: false,
        bar: "fixed",
      }
    );
    assert.strictEqual(after.lead, "rgb(255, 255, 255)");
  });
});
