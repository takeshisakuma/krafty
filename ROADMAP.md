# Roadmap

Started while fixing the nest checker (2026-07) and kept up since, so the
reasoning survives the next long gap. The ordering is a recommendation, not
a plan — except for "Wanted", which is work that has been asked for.

## Measurements this is based on

The nest checker was measured against real pages after the 0.6.0 rewrite:

| | elements | findings |
|---|---|---|
| MDN | 1,517 | 2 (0.1%) |
| Rakuten | 5,744 | 57 (1.0%) |
| Yahoo! JAPAN | 2,379 | 16 (0.7%) |

Around 1% is a usable signal, and the findings are genuine (`ul > div` ×25,
`span > div` ×15, `section > li`, `ul > ul` on Rakuten). The problem is not
accuracy any more — it is that the output is hard to act on.

## Done

### 1. Explain why an element is flagged — done

Each flagged element carries a `title` naming the violation, and the
permitted children when that list is short enough to be worth reading.

### 2. Report a count and a summary — done

A panel at the bottom right gives the total and a breakdown by
`parent > child`, which reads as a defect list.

Both required deciding where the content model table lives. It moved out of
`content.scss` into `js/nestCheck.js` entirely: CSS can flag an element but
cannot report one, so the table had to exist in JS regardless, and a second
copy kept in SCSS for the colouring would have drifted. The stylesheet now
only presents what the script decides.

### 3. Close button and moving the panels — done

Both panels close themselves. Closing also drops the body class, so the
popup does not keep showing a checker as active with nothing on screen.

They are also draggable by the title bar. Dragging won over a left/right
flip: the panels report on the page while covering part of it, the covered
content can be anywhere, and a handful of preset corners would only move
the problem around. Positions are remembered per panel for the life of the
page, so toggling a checker does not throw it back into the corner.

### 4. Head Check: separate what a machine can decide — done

The panel is in three parts: findings a machine can reach, the values a
person has to read, and everything else for reference.

The split came from noticing that "problems at the top, the rest below"
would have been dishonest. A title can be present, well formed and the
right length while still reading "ホーム | ホーム" or carrying a staging
name. Putting the mechanical checks first under a heading that implies the
rest is fine would present unchecked ground as checked. Hence the summary
says *nothing wrong in what can be checked automatically*, and never
"no problems".

For the values only a person can judge, the panel draws a search result and
a shared-link card rather than printing the strings. Judging "does this look
wrong" is fast; judging a bare string is not. Krafty already did this for
favicon and og:image by showing the picture — this is the same move for
text. The previews are labelled as approximate, because search engines
rewrite titles and truncate by width, and promising a faithful rendering
would be a lie.

Collapsible sections were considered and dropped. Tabs would eat horizontal
room a 420px panel needs for URLs and would hide the very thing an
unfamiliar reader is looking for. Plain headings inside the existing scroll
turned out to be enough. Revisit only if the reference section becomes
unwieldy.

### 5. Keyboard shortcuts — done

Every checker has a command, handled by the service worker. None ship with
a key assigned.

Defaults were tried first: Alt+Shift+H/N/O/A. All four came out unassigned
at chrome://extensions/shortcuts, on a fresh install as well as a reload.
Chrome discards a suggested key that anything else already claims and says
nothing about it anywhere, so from inside the extension a working default
and a discarded one are indistinguishable - and a discarded one looks
exactly like a broken feature. Pressing Alt+Shift+N split the browser
window instead, which is how this surfaced.

Shortcuts need a service worker, which cannot see the popup script, so the
checker table and the injection moved to code/checkers.js and are shared.
A second copy would have drifted the moment a checker was added, and the
symptom would have been quiet: the button working and the shortcut not.

Chrome 137 removed --load-extension, so the worker cannot be booted from a
test. The wiring suite runs background.js against stubs instead, which
catches a command routed to the wrong checker; that the worker registers at
all still needs checking by hand.

### 6. Heading outline — done

A sixth checker rather than an extension of the Outline Checker. That one is
a pure visual overlay with no panel; this one is findings plus a list, and
folding them into one toggle would have made a single button do two
unrelated things. Splitting them also split `allFrames`: boxes are worth
drawing in a subframe, an outline assembled across documents would describe
a page that does not exist.

The mechanical half is more than one level 1 heading, a level skipped, a
heading with no text, and no headings at all. The human half is the outline
itself, indented by level, to be read as a table of contents.

Three decisions that are not obvious from the code:

- ARIA headings count, at their `aria-level`. A page built out of components
  can have no `h1`-`h6` at all, and reporting "no headings" on a page full
  of them is the kind of wrong answer that costs a tool its credibility.
- A heading holding only an image is not empty; its `alt` is its text. The
  logo as the `h1` is a real and correct pattern, and flagging it would
  train the reader to ignore the finding.
- `display:none`, `visibility:hidden` and `aria-hidden` headings are left
  out, because they reach nobody, and the panel says how many were left out
  rather than dropping them silently. Visually hidden headings — clipped,
  offset off-screen — are deliberately kept: they are meant for screen
  readers and do reach someone.

The findings block itself (summary, copy-all, list) moved into
`js/panel.js`. A second checker reporting findings would otherwise have
copied the head checker's wording, including the carefully narrow "nothing
wrong in what can be checked automatically", and the copies would have
drifted the first time one was reworded.

### 7. Images served larger than they are shown — done

`naturalWidth` against `clientWidth`, plus the `width` and `height`
attributes in the same walk. A seventh checker, for the reason the heading
outline became a sixth: it reports into a panel, and the alt checker it
would otherwise have joined is a pure overlay.

The trap named when this was written was high-density displays, and the fix
for it turned out to be one step further than expected. Reading
`window.devicePixelRatio` is not enough, because it makes the answer depend
on the monitor the audit runs on: the same correctly built page comes back
clean on a retina laptop and covered in findings on an external 1x display,
where every 2x asset is twice what the CSS box needs. A checker whose
output changes with the hardware is worse than one that is merely wrong,
because nothing on screen says which reading you are looking at. The
allowance is `max(devicePixelRatio, 2)` — never below the 2x a page should
be ready for — so the answer travels.

Two thresholds are conventional rather than measured, which is the thing
`checkTooLong` is on the watch list for. Both are stated rather than
hidden: the panel names the allowance it judged against, and every row
carries its own ratio, so a reader who disagrees can see exactly what they
are disagreeing with. If they turn out to be noise, the numbers to change
are `WASTE_FACTOR` and `MIN_WASTED_PIXELS` in `js/imageCheck.js`.

Measured against brainpad.co.jp: 60 images, one oversized finding, twelve
missing dimensions. Around the same signal-to-noise as the nest checker's
1%, and the one finding was real — a 1920×1080 file drawn at 300×169.

An image that has not loaded has no natural size, which lazy loading makes
routine below the fold. Those are counted and declared rather than passed
as fine, on the same principle as the head checker's summary.

## Waiting on real use

Neither of these can be settled by reasoning about them, and guessing would
mean building something to fix a problem nobody has. They need the extension
used on real work for a while first.

### 8. Are the Head Check findings the ones worth having?

The checks were chosen from what a machine *can* decide, not from what
turned out to matter in practice. On Rakuten they were: no viewport, a 70
character title, a 600×600 og:image. Whether that is the useful altitude is
unknown.

Things to watch for while using it:

- A finding that is always noise on real pages. `checkTooLong` is the
  likeliest candidate — the thresholds (60 and 160) are conventional rather
  than measured, and the truncation they stand in for is decided by pixel
  width anyway.
- A problem repeatedly found by eye that no check caught, which is the
  argument for adding one.
- Whether the alert/note split matches what actually needs acting on.

Found so far, 2026-07-20, on brainpad.co.jp: "title appears 4 times" on a
page with exactly one title. The duplicate check selected `title`, and in
an HTML document a type selector matches every namespace, so the `<title>`
elements inside inline SVG — the accessible names of the icons — were
counted as document titles. Fixed by scoping to `head > title`.

Also 2026-07-20, on `takeshisakuma.github.io` and then on an Amazon ad
landing URL: the canonical check fired twice on correct pages. First on
`/index.html` read from `/`, which is one document under two spellings.
Then on a URL carrying nineteen advertising parameters whose canonical was
the bare address — which is the most common correct use of the tag there
is. Both fixed; the second by containment, so a canonical that *drops*
parameters is canonicalising while one that changes them still reports.

That fix gives up a canonical from `?page=2` to the bare listing, which is
a real if arguable defect. The trade was deliberate: a finding on every
ad-tracked URL costs more than a missing one on pagination, because a tool
that cries wolf on an ad landing page will be ignored on the day it is
right.

And on `github.com`, which ships three `og:image` tags, each followed by its
own `og:image:type`, `:width` and `:height`. Reported as a duplicated tag.
Open Graph documents a property repeating exactly like that, and `og:image`
is the one everybody uses that way, so this was a defect finding on a page
following the specification. Dropped from the duplicate check — `og:title`
stays, because nothing treats that as an array. The count moved to the
reference row instead, which now reads "(1 of 3)": only the first is
previewed, and a reader looking at one picture should know there were
others.

Worth noting how all four were found, because it argues for this whole
section. Each was a short, readable expression with a test behind it, and
each was wrong on a real site. Nothing short of running them on pages
somebody actually built would have surfaced any of it. The same is true of
the questions above, which is why they are still open rather than guessed
at.

### 9. Overlapping alt labels

The labels are absolutely positioned, so on image-dense pages (EC product
grids, exactly the Rakuten case) they overlap and become unreadable.
Whether this hurts in practice is unconfirmed - check against a real
workload before designing a fix.

## Wanted

Four new checks were asked for on 2026-07-20. The heading outline is item 6
above and the image sizes are item 7; items 10 and 11 are the other two.
Both are things a machine can decide on its own, and both sit inside a page
with no network involved. Item 12 was proposed later the same day and needs
its boundary settling before it is worth building.

Items 13 to 16 came out of a review on the same day and are not all checks:
14 and 15 are about how the checkers are used rather than what they find.
13 is the one to do first.

### 10. Inputs with no label

An `input`, `select` or `textarea` with no `label for`, no wrapping label,
no `aria-label` and no `aria-labelledby`. Exactly the same kind of finding
as a missing alt, equally decidable, and currently missing while alt is
covered — which is half a job.

Skip `hidden`, `submit`, `button` and `reset`, which do not take one.

### 11. Link text

Empty `href`, `href="#"`, and links whose text says only "こちら", "click
here", "詳細" and the like: read out of context in a screen reader's link
list, they say nothing.

The mechanical part is the empty and placeholder hrefs, plus the same text
pointing at different URLs, which is a genuine contradiction. Whether a
given phrase is too vague is a judgement, and the list of vague phrases is
per-language, so lean towards listing the link texts for the reader rather
than asserting which are wrong.

### 12. Development leftovers

Asked for 2026-07-20: find the things that were only ever meant to be there
during the build — `console.log` was the example given. The instinct is
right and it is the kind of defect a director is blamed for. The example is
the weakest member of the family, though, and working out why is most of
the design.

**Why `console.log` itself is close to unreachable.** Two walls, and the
second decides it.

Most `console.log` lives in bundled external JavaScript, and a content
script cannot read the source of a cross-origin script. Inline `<script>`
can be scanned; that is a small minority of the calls on a modern site.

Catching the calls as they happen means wrapping `console` before the
page's own scripts run, which means a content script at `document_start`,
which means host permissions for every site. `activeTab` grants access
after a user gesture, by which time the logging has already happened. The
alternative is reloading the tab with instrumentation in place, which
throws away the scroll position and form state of the page being audited.

So the price of this one check is the permission model. Krafty asks for
`activeTab` and `scripting`, and the store listing says it collects
nothing; trading that for a partial view of one class of defect is not a
trade worth making. If it is ever revisited, that is the cost to weigh, not
the difficulty of the code.

**And the failure would be silent.** A panel that scanned inline scripts
and reported nothing would be read as "no debug output left", when what it
means is "the external bundles were not read". That is the exact claim the
head checker's summary is worded to avoid making. Any version of this that
ships has to say what it did not look at, in the panel, every time.

**What is decidable, and worth more than the original example:**

- **`localhost`, `127.0.0.1`, `::1`, `.local` and RFC1918 addresses** in
  any `src`, `href`, `srcset` or `action`. Unambiguous, and a production
  page pointing at `http://localhost:3000/hero.jpg` is exactly the handover
  embarrassment this idea is aimed at. On its own this would justify the
  checker.
- **Mixed content** — `http://` resources on an `https://` page. Fully
  decidable, and the browser blocks them, so the page is already broken.
- **Placeholder image services** — `placehold.co`, `via.placeholder.com`,
  `dummyimage.com`. A closed list, no judgement involved.
- **Developer markers in HTML comments** — TODO, FIXME, XXX, 仮, 後で,
  後日差し替え. That the comment exists is decidable; whether it matters is
  not, so list them rather than grading them.
- **Inline `console.log`, `debugger`, `alert`** — worth including once the
  panel is honest about only reading inline scripts.

**What has to stay a listing rather than a finding:**

- **Staging-looking hostnames** — `stg.`, `dev.`, `staging.`, `test.`.
  A guess: `dev.example.com` can be a product. Show them, do not assert.
- **Dummy text** — Lorem ipsum, あああ, テストです. Per-language and
  open-ended, the same shape as the vague link text in item 11.

Undecided: whether this is an eighth checker or joins item 11's, since
several of these are link and resource addresses and that walk is the same
one. Worth deciding when item 11 is built rather than now.

### 13. Duplicated `id`

`document.querySelectorAll("[id]")`, counted. No threshold, no judgement,
no per-language list — the cheapest check in the project and the one with
the least room to be wrong about.

The consequences are real and spread out: `label[for]` stops reaching its
field, an in-page anchor lands on the first one and never the second,
`aria-labelledby` resolves to the wrong text, and any script fetching the
element by id silently gets whichever came first. A CMS repeating a
component down a page produces this without anybody writing it.

And it is invisible. That is the argument for it being here rather than in
a validator: the page looks finished. The defects this project is best at
are the ones that look fine — a missing `alt` beside a deliberately empty
one, a canonical pointing somewhere else, an image four times the weight it
needs — and a duplicated `id` is the same shape.

Decided before building: an eighth checker, named Markup Check for the
family rather than for the one check it starts with. Items 10 and 16 report
into the same panel when they are built.

The alternative was folding it into the nest checker, which already
validates HTML and already has a findings panel. Rejected because that
checker is named for nesting specifically, and a duplicated `id` is not
nesting — the name would have started lying to make room. Naming it
narrowly now and renaming later is worse still: a rename is a store listing
change, another review, and a name the people already using it have to
unlearn.

### 14. A re-scan button in each panel

Under Known limitations: a checker judges the document as it stands when it
runs, so anything a single page app inserts afterwards is missed. The note
there proposes a `MutationObserver` and immediately lists what it needs —
teardown, and a guard against reacting to the classes and titles the
checker writes itself.

A button is most of that value for almost none of that cost. No observer to
tear down, nothing to react to its own writes, no risk of a checker that
loops. The nest and image panels already print the time they scanned, for
exactly this reason; that line is half the interface already, and the
button belongs beside it.

The observer stays the better answer for someone watching a page change
under them. This is the answer for someone who scrolled, opened an
accordion, and wants the count again.

### 15. One pass, one report

A delivery review means toggling seven checkers in turn and copying seven
panels. The obvious shape is: run everything, copy once.

The constraint is item "A single score", further down. What is refused
there is a number that reports on the whole page including the parts
nothing looked at. A combined report does not have to make that claim — if
it names each checker and what that checker found, it says exactly as much
as the seven panels do, in one place.

The line to hold is that there must be no total. "12 issues" reads as a
verdict on the page, and it is the same lie as a score with extra steps.
Seven headings with their own counts underneath is not.

### 16. Table header cells

A `table` with no `th` at all, and a `th` with no `scope` where the table
has both a header row and a header column. Decidable, and a real barrier:
a screen reader announces a cell with its headers, or announces it bare.

Same size and shape as item 10, and the same open question about which
panel it reports into.

## Deferred, with reasons

### TypeScript — decided, and re-checked

Not adopted. // ts-check with JSDoc and @types/chrome is used instead:
same output, no build step, and it has caught real mistakes (a .disabled
set on an HTMLElement, unchecked getElementById results, an optional tab
id passed to executeScript).

The original note said to revisit if the reporting work landed, on the
grounds that the intricate part - the content model table - lived in SCSS
where TypeScript could not see it. That trigger has fired and the premise
is gone: the table moved into js/nestCheck.js and is now type checked
along with everything else, and code/ has grown from ~350 lines to ~1450.

Re-checked on those terms, the answer is still no, for a different reason.
ts-check already provides the checking; what full TypeScript adds beyond it
does not pay for putting a build step in front of files that currently ship
exactly as committed, which MV3 injected scripts have to do anyway.

### Contrast ratios — not attempted

The obvious neighbour of the Brightness Checker, and the one to be careful
with. Working out the colour actually behind a piece of text is genuinely
hard: background images, gradients, transparency, and elements overlapping
other elements all defeat a simple read of `background-color`. Plenty of
tools get this wrong and report confidently anyway.

Krafty is built on saying what it cannot decide. A contrast check that is
right most of the time, presented as though it were right always, would
undo that. If it is ever attempted, "cannot tell" has to be a first-class
answer rather than a silent pass.

### Validating HTML and CSS in general — not this tool's job

Asked 2026-07-20: should Krafty report invalid HTML attributes, and invalid
CSS properties and values? The two halves have different answers, and the
CSS half is settled by the browser rather than by preference.

**CSS: the evidence is gone before any script runs.** Measured, writing
`colr: red; display: flexx; color: blue` into both a stylesheet and a
`style` attribute:

| read through | what is there |
|---|---|
| `rule.style.cssText` | `color: blue;` — one of the three |
| `element.style.cssText` | `color: blue;` |
| `<style>`.textContent | all three, as written |
| `getAttribute("style")` | all three, as written |
| `CSS.supports("colr", "red")` | `false` |

The CSSOM keeps only what parsed. Raw text survives in exactly two places,
inline `style` attributes and the text of a `<style>` element. External
stylesheets — where a site's CSS actually lives — are unreachable: cross
origin `cssRules` throws, and same origin gives the post-parse view.

So a CSS check would read a small and arbitrary slice and report "nothing
invalid" without having read the stylesheet at all. That is the same silent
failure as item 12's `console.log`, arrived at by the same route, and it is
the thing this project is least willing to ship.

`CSS.supports` is worth remembering, though: the browser will judge a
declaration, so no property database is needed. Inline `style` attributes
are therefore checkable honestly, and a hand-typed `style` in a CMS is a
plausible place for a typo that shows no symptom. That much is a real
option; the general case is not.

**HTML: reachable, and partly already done.** Attributes are preserved as
written, bogus ones included, and the nest checker already validates the
content model against an 80-element table. An attribute table would be the
same kind of work.

It is still declined, and not for a technical reason. The W3C validator is
authoritative, free, and one paste away. Krafty earns its place on what a
validator does not say — how the page reads as a search result, whether the
heading outline makes sense, whether the images are heavier than the layout
needs. A second-rate validator bolted on would lose on both counts.

**The honest argument against that**, kept because it deserves an answer
rather than a dismissal: the W3C validator cannot reach a page behind a
login, and cannot see a DOM that JavaScript built. Krafty can do both. That
is a genuine gap, and "a validator already exists" does not close it. If
this is ever revisited, that is the case to answer — not the difficulty.

### A single score — deliberately not

The usual next feature: one number, "SEO 78/100". It reads well and it is
the wrong shape for this tool. A score reports on everything at once,
including the parts nothing checked, which is precisely the claim the Head
Check panel is worded to avoid making. Krafty says what it looked at; a
score would say it looked at the page.

### `<style>` in the body stays flagged

Non-conforming per spec, and only 10 occurrences on the noisiest page
measured. Suppressing it would mean building a settings system this
extension does not otherwise have, which would cost more than it saves. If
it turns out to be noisy in practice, the fix is one entry in
the `MODELS` table in `js/nestCheck.js`, not a preferences screen.

## Known limitations

- Both checkers judge the document as it stands when they run, so anything
  a single page app inserts afterwards is neither flagged nor explained.
  Toggling off and on re-scans, and the nest panel states the time it
  scanned for that reason. A `MutationObserver` would follow the page
  properly but needs teardown and a guard against reacting to the classes
  and titles the checker writes itself.
- The checkers write classes onto the page's own `<body>`, so a page that
  rewrites `class` on `<body>` can clear them.
