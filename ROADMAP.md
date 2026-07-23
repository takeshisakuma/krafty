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

Items 10 and 21 were measured the same way on 2026-07-21, the day they were
built, before anything is stacked on top of them for 0.11.0. Six pages: the
three above, plus the two that turned up the head checker's false positives
(amazon.co.jp, brainpad.co.jp) and `takeshisakuma.github.io`.

| | elements | fields | 10 | svg | 21 |
|---|---|---|---|---|---|
| MDN | 760 | 0 | 0 | 5 | 1 |
| Rakuten | 4,899 | 6 | 1 | 3 | 2 |
| Yahoo! JAPAN | 2,012 | 1 | 0 | 19 | 0 |
| amazon.co.jp | 2,313 | 2 | 0 | 0 | 0 |
| brainpad.co.jp | 1,290 | 0 | 0 | 38 | 38 |
| takeshisakuma.github.io | 267 | 0 | 0 | 13 | 13 |

(The element counts are lower than the nest checker's above because these
were read at a fixed wait rather than after full settle; the ratios are what
matter, not the denominators against the older run.)

**Item 10 ships as it is.** One finding across nine eligible fields, and it
is real: Rakuten's `input#common-header-search-input`, a search box named by
its placeholder "キーワード検索" and nothing a machine reads. The other
eight fields said nothing. The placeholder shown beside the row is what
found it on the page. This is the missing-alt shape exactly — decidable,
rare, and a genuine defect wherever it fires.

**Item 21 is right and unusable, which is a different problem from being
wrong.** Yahoo! is the proof it does not fire blindly: nineteen svgs, zero
findings, every one named or hidden. But brainpad's 38 and the personal
site's 13 are a true finding repeated until it is noise — the `checkTooLong`
worry from further down, arrived at by a real page. Two things the rows
showed, to fix before 0.11.0 stacks on this:

- **The descriptor collapses.** `a > svg` eight times, `i.icon-blank > svg`
  eight times: an element with no identifier of its own and a parent with
  none either produces the same string for every row, so the list says "38"
  and nothing more. A weakness in what was built, not in the check. Fix
  before release — it is small (a position, or an `href` where the parent is
  a link). *Done 2026-07-22: a classless link reads its `href`, and a weakly
  identified borrowed parent gets an `:nth-of-type` position.*
- **Two defects of different weight are flagged as one.** `a.twitter > svg`
  is a link with no accessible name, item 11's territory and the heavier
  fault; `i.icon-blank > svg` is a decorative icon one `aria-hidden` from
  correct. All thirteen of the personal site's are the former, all links
  with only a nameless svg inside. Splitting them needs the accessible-name
  computation that item 11 builds, so it waits for 0.11.0 and rides that
  work rather than being written twice. *Done 2026-07-22 with item 11: the
  svg that is the only content of an unnamed control is an alert, the
  decorative rest a note.*

Two by-products of the run, both already on the list. Rakuten ships ids like
`##GENRELINKEVENT#` — a template placeholder left unsubstituted, which is
item 12's quarry exactly. And brainpad's `#logo ×3` is the same element as
its `svg#logo` duplicate, an id collision that item 13 already reports.

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

### 9. Overlapping alt labels — confirmed, and fixed

Confirmed on amazon.co.jp 2026-07-20. 92 images, 33 labels sitting on top
of another one.

Measuring the overlap undersold the problem, and the note above named the
wrong thing. Label against label was the smaller half. The damage was label
against *picture*: alt text on a shop is the product name, fifty to a
hundred characters, and an opaque box of it in a grid cell grows tall
enough to hide the image completely. Rows of products were solid columns of
red text with nothing visible behind them.

That defeats the checker rather than merely crowding it. Whether an alt
describes its image is the one question here a person has to answer, and
they cannot answer it about an image they cannot see.

Capped at two lines, opening to the full text on hover, with the whole
string in a `title` so it is reachable without one. The colours carry the
mechanical half — present, empty, missing — so that stays readable across
a whole page at a glance, and the half that needs reading is one pointer
away. Same split as everywhere else in the tool.

After: 2 labels in a collision, from 33. The pictures are visible.

Then a report from a carousel of book covers turned up the deeper fault,
which the overlap counting had been describing without explaining. The
labels were positioned `absolute` with no offsets, which places them at
their static position — where each would have sat had it stayed in the
flow. It does not stay in the flow, so the next label's static position
never advances. Measured on five covers in a row: images at 8, 136, 264,
392 and 520, and all five labels at 18. Only the last was visible. The rest
were beneath it, unreadable and — the part that actually broke — unhoverable,
so the way to open one was behind the thing covering it. They were not
overlapping their neighbours so much as never leaving the first image.

Positions are measured from each image now and written as coordinates, and
the label is appended to the body so those coordinates resolve against the
document rather than whichever ancestor the page happened to position.
Folded, a label is also capped to its own image's width, so it stays inside
the picture it belongs to; opened, it is above everything and may spread.

Measured on amazon.co.jp afterwards: worst horizontal drift from its image,
0px.

Appending to the body then cost the clipping the labels used to inherit. A
carousel keeps its off-screen items in the document at real coordinates and
hides them with an ancestor's overflow, so the section came back showing the
alt of every image except the ones on screen. An image its own page has
clipped away now gets no label — checked by walking the ancestors that
clip, with their boxes and styles kept, since ninety images share most of
their ancestors.

And the background is translucent, with a blur, going solid on hover. This
contradicts the rule at the top of `content.scss`, and the reasoning there
is what says it should: panels are opaque because a panel can be dragged
off whatever it covers. A label cannot. It is pinned to the one thing you
need to look at, and judging whether an alt describes its image is
impossible with the image behind a white box. Blurred rather than only
faded, because plain translucency lays the text over whatever the
photograph is doing, and a tool that reports unreadable text has no
business shipping any.

Two hours of the fix went into a test that was wrong rather than code that
was. A transition is sampled once per rendered frame, so measuring the
height in a tight loop starves the renderer and returns one number for
hundreds of reads and then the last — indistinguishable from an animation
that never ran. Spacing the reads did not settle it either: the growth
finishes inside about 60ms and the pointer can take longer than that to
register. `getAnimations()` reports the transition itself, which is what
was being claimed, and it is either there or it is not.

Opening is animated, which is not decoration. Snapping open read as a
rendering fault — as though the text had been broken and the pointer
happened to reveal it — and this label is drawn over somebody else's page,
where a glitch is the first thing they will assume. Growing says the label
meant to be folded.

`-webkit-line-clamp` cannot be transitioned, so the height is what moves.
That needs a target, and a fixed one does not work: any value large enough
for the longest alt is far past what most need, so the box reaches its
content height in the first fraction of the transition and the rest plays
out invisibly. Measured, it finished in about 30ms of 200ms — the same snap
with a duration attached. The script measures each label and hands its own
height to the stylesheet as a custom property. Read every label first, then
write every label, or a page of ninety pays for ninety layouts.

The heavier redesign is still available if two lines turns out to be too
few — a small badge per image with the text in a panel, the shape the other
checkers converged on. It was not needed to make the checker work again,
and it would have traded away the thing this one is good at, which is
reading alt text *beside* the picture it belongs to.

## Wanted

Four new checks were asked for on 2026-07-20. The heading outline is item 6
above and the image sizes are item 7; items 10 and 11 are the other two.
Both are things a machine can decide on its own, and both sit inside a page
with no network involved. Item 12 was proposed later the same day and needs
its boundary settling before it is worth building.

Items 13 to 16 came out of a review on the same day and are not all checks:
14 and 15 are about how the checkers are used rather than what they find.
13 was the one to do first and is done, in 0.9.0.

Item 19 came from a list of head tags proposed on 2026-07-21, and is the
only one of that list worth a check. It is built.

Items 20 to 22 came from a list of eight accessibility problems proposed
later on 2026-07-21. Three of the eight are declined outright and are in
"Deferred, with reasons" below; a fourth is already item 11 and was folded
into it. What is left is two checks and one collection of contradictions.
The split was made on the usual line rather than on how worthwhile the
problem is: all eight are real defects, and the question asked of each was
whether a script reading the DOM can tell it has found one.

Nothing here goes into 0.9.0. That release already carries two new
checkers, the alt checker rebuilt, four false positives found by real use,
the rescan button and the review button, and a store listing rewritten in
both languages — measured against the published 0.7.0, over two thousand
lines of `code/`. Review time follows the size of a submission: 0.6.0 to
0.7.0 was roughly three times the code and took fourteen hours, and 0.8.0
is still in review with a listing change attached. Item 10 is the next one
to build and it waits for 0.10.0, because a bigger 0.9.0 buys nothing and
costs another few days of queue.

### The order to build them in

Set 2026-07-21, once items 20 to 22 made the list long enough that "what is
next" stopped being obvious. It follows from the paragraph above rather
than from how interesting the items are: review time follows submission
size, so the constraint is how much goes in each release, not how much is
ready.

| | items |
|---|---|
| 0.10.0 | 19 hreflang · 10 inputs with no label · 21 svg — shipped |
| 0.11.0 | 11 link text, incl. the missing name · 22 ARIA contradictions · 23 point at the element · 12 leftovers, resource subset — built |
| 0.12.0 | 20 landmarks · 12 comment markers + staging hosts — built |
| 0.13.0 | 12 the rest — the staging/dummy listings, and inline console.log if ever |

0.10.0 starts with a debt: item 19 was committed after 0.9.0 was submitted
and is not in the build under review, so it ships whatever else does. The
other two are the cheapest left — item 10 reports into item 13's panel and
needs no new one, and item 21 is a single condition. Deliberately small,
because the release after a long review is the wrong place to be ambitious.

11 and 22 are together because they walk the same elements. Computing an
accessible name is item 11's work, and it is also what decides item 21's
svg and half of item 22, so building them apart would write it twice and
then have to agree with itself. The double-reporting question in item 11 —
the same icon button found from both ends — gets settled once, there.

20 is alone because it is shaped differently. It draws a structure to be
read rather than a list of findings, which is item 6's design over again
and is most of the work in it.

12 was last because it was the one still undecided: the checker-or-not
question waited until item 11 was built. With 11 built, its decidable half —
resource addresses — was pulled forward into 0.11.0 as a checker of its own,
the Leftovers checker, on the reasoning that a localhost URL is a deployment
leftover rather than markup wrong in a way the page hides, so the Markup
family would have had to stretch to hold it. What is left of 12 is the
judgement half — staging hostnames and dummy text, listed not asserted — and
inline console.log, which the entry below still argues is barely worth the
reach; those keep 0.13.0, if they are done at all.

23 and 24 were added 2026-07-22, left out of the table at first because where
they fell against 11, 22, 20 and 12 was not settled. What was settled is 23
before 24 — pointing at an element is small and stands alone, isolating the
panels is the larger job and the one 23 is built to survive. Neither is a
check, so neither competes for the accessible-name work the accessibility
items share; they slot in wherever a release has room. 23 took that room in
0.11.0 the day it was proposed, riding the link and ARIA findings it points
at; 24 is still unplaced.

Two things to settle before building, not now: which panel items 21 and 22
report into, and whether 22 belongs under a checker named Markup at all.

Settled for 21 on 2026-07-21, when it was built: the Markup panel, because
the alt checker draws over the page and has no findings panel to take it.
Settled the same way for both 11 and 22 on 2026-07-22, when they were built:
the Markup panel, on the grounds the checker was named for the family rather
than for its first check, so a link or an ARIA contradiction belongs there
as much as a duplicated id does — and the accessible-name computation the
three share stays in one file that way.

0.10.0 is code complete as of 2026-07-21 — items 19, 10 and 21 are in
`release/0.9.0` and none of them is in the build under review. The version
in `code/manifest.json` is still 0.9.0 and is bumped at release, per the
rule that a version is only bumped once the previous one is live.

0.11.0 is code complete as of 2026-07-22 — items 11 and 22 in the Markup
Checker, item 23 shared across the markup and image panels, and item 12's
resource subset as a new Leftovers checker. Five branches stacked on
`fix/svg-descriptor-collapse`: `feature/link-text`,
`feature/aria-contradictions`, `feature/point-at-element`,
`feature/leftovers-check`. The manifest still reads 0.10.0, bumped at release
by the same rule. It grew past the two items the table first planned because
23 and 12 were both asked for and both small; the release-size caution still
holds, and is the reason 20 and 24 were left for later.

An item keeps its number once it is written down, and is marked done where
it stands rather than moved up. Moving one renumbers everything after it,
which rewrites every reference to any of them - done twice in a day before
anyone noticed that the ordering was never the point.

### 10. Inputs with no label — done

An `input`, `select` or `textarea` with no `label for`, no wrapping label,
no `aria-label` and no `aria-labelledby`. Exactly the same kind of finding
as a missing alt, equally decidable, and currently missing while alt is
covered — which is half a job.

Skip `hidden`, `submit`, `button` and `reset`, which do not take one.

Built 2026-07-21, into the Markup Checker's panel as item 13 planned.

Two things were added to the specification above while building, both to
stop it reporting correct markup. `title` counts as a name, because it is
one per spec — a field carrying one is not nameless, and whether it is a
*good* name is the kind of judgement this project does not make. And an
`aria-labelledby` only counts if it resolves to an element with text: a
reference to an id that is not on the page names nothing, which is the
failure being looked for rather than an excuse from it.

`input type="image"` is named by its `alt`, so `alt` is a naming route too.
That one is drawn by the alt checker as well, and both are right to show
it — the same argument as item 11's overlap, from the other side.

Listed as well as counted, decided the same day and after shipping the
count alone was considered. A count of unlabelled fields is a number with
nowhere to go: the table check can be count-only because a table is
visible on the page, and an unlabelled field looks exactly like a labelled
one. So each is given a row built from whatever identifier it still
carries — id, then `name`, then class, then `type`, then the parent's
descriptor when the element itself offers nothing.

That descriptor is a label to read, not a selector, and is deliberately
not promised to be one. Making it paste into `querySelector` would mean
escaping and uniqueness work that nothing here asks for, and would invite
it to be trusted for something it was not built for.

### 11. Link text — done

Empty `href`, `href="#"`, and links whose text says only "こちら", "click
here", "詳細" and the like: read out of context in a screen reader's link
list, they say nothing.

The mechanical part is the empty and placeholder hrefs, plus the same text
pointing at different URLs, which is a genuine contradiction. Whether a
given phrase is too vague is a judgement, and the list of vague phrases is
per-language, so lean towards listing the link texts for the reader rather
than asserting which are wrong.

Extended 2026-07-21, from the accessibility list: a link or button with no
accessible name at all. That is the same finding one step further along —
not text too vague to place, but nothing to read out, so a screen reader
announces "link" or "button" and stops. It belongs here rather than in a
checker of its own, because it is decided from the same computation the
vague-text listing needs anyway.

The name comes from the element's text, then `aria-label`, then
`aria-labelledby`, then the `alt` of an image inside it, then `title`.
Empty on all of them is the finding, and an icon-only button is where it
happens: an inline `svg` and nothing else inside a `button` is silent, and
looks finished on screen. Note the overlap with item 21 — the same button
appears in both, once for having no name and once for the svg being the
reason. Neither should be suppressed for the other; they are the same
defect described from the two ends, and a director fixing it needs the end
nearest the markup.

Built 2026-07-22, in the Markup Checker, in two commits. The accessible name
came out first, in an order the note above got loose about: the ARIA
computation reads `aria-labelledby`, then `aria-label`, then the text or an
inner image's `alt`, then `title` — `aria-label` above the text on purpose,
so a link labelled "Home" whose visible text is "こちら" is named rather than
called vague. That one helper decides the nameless link or button (an
alert), item 21's weight split, and half of item 22. The empty and `#`
hrefs are an alert too — they fail everyone who clicks, not only a reader —
and a `#section` fragment is left alone. One name pointing at several URLs
is a note. The vague phrases are listed, English and Japanese together,
because a page mixes them, and never asserted, so the summary stays clean
over a page whose only fault is a soft one.

The double-reporting question settled as the note said it should: the button
and its svg both report, from the two ends, neither suppressed.

### 12. Development leftovers — decidable parts built

Asked for 2026-07-20: find the things that were only ever meant to be there
during the build — `console.log` was the example given. The instinct is
right and it is the kind of defect a director is blamed for. The example is
the weakest member of the family, though, and working out why is most of
the design.

Built 2026-07-22, in 0.11.0, the decidable resource half only, as the
Leftovers checker: a local or private host in a `src`/`href`/`srcset`/
`action` (an alert, the page's own host excluded so a page served from
localhost does not flag its own relative URLs), mixed content (an alert), and
a placeholder image service from the closed list (a note). Its own checker,
not the Markup family — the reasoning below on "an eighth checker or joins
item 11's" settled here, once item 11 was built, on the side of its own: a
localhost URL is a deployment leftover, not markup wrong in a way the page
hides. The mixed-content positive case has no browser test — the http harness
cannot serve https — so it is code and reasoning without a fixture, noted
rather than hidden.

Extended 2026-07-23, in 0.12.0, with two more from the list below — the
developer markers in HTML comments, and the staging-looking hostnames — both
as notes rather than alerts, because each is a guess a person weighs rather
than a defect to assert, the same treatment item 11 gives its vague link
text. The comment markers are item 12's own list (TODO, FIXME, XXX, 仮, 後で,
後日差し替え), read from the whole document and listed by their text, since a
comment is not an element with a box to point at. The staging hosts are
matched on the first label only — dev. and staging. lead the address when
they lead at all, and matching the word anywhere would catch latest. and
contest. by their letters — and the page's own host is spared, the same way a
local one is. Two of the list stay unbuilt: the dummy text, per-language and
open-ended, and the inline `console.log`/`debugger`/`alert`, which cannot be
reported honestly while the bundles it mostly lives in are unreadable; the
rest of this entry is why.

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

### 13. Duplicated `id` — done

Shipped in 0.9.0 as the Markup Checker, on the design below. Item 16 landed
in the same panel as planned; item 10 is still to come and goes there too.
Marked done late — it was built while the heading here still read as
Wanted, which is worth noticing rather than quietly correcting: an item
that ships without its entry changing is an item the roadmap stopped
describing.

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

### 14. A re-scan button in each panel — done

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

Built into `kraftyPanel` as an optional `onRescan`, so a panel gets the
button by passing one. Each checker's work moved inside a `run()` the
button calls again; the on/off toggle stayed outside it, because pressing
rescan must not turn the checker off. The nest checker's `run` starts with
its existing `clear()`, which undoes the marks it writes on the page as
well as the panel.

The alt checker has no panel and so has no button, which is a pity: its
labels are placed by measurement and are the ones most likely to want
re-placing. Toggling still does it.

### 15. One pass, one report — done

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

Built as a button under the checker list. It runs the checkers that report
— only the ones that are off, since running one that is already on would
toggle it off and take its panel with it — then reads the panels rather
than deciding anything again, so the report cannot drift from what is on
screen.

The line is held as a shape, not a wording, and the test says so: at the
top level there are checker names and nothing else. Every count is indented
beneath the checker that arrived at it and is that checker's claim. A total
would have to sit unindented, owned by nobody.

`panelId` in the checker table is what the popup collects, and there is a
test that each one is the id its checker actually builds — nothing else
links them, so a rename would have left the review quietly missing a
checker. The three that only draw over the page have no `panelId`, and a
test holds that they build no panel either.

### 16. Table header cells — done

A `table` with no `th` at all, and a `th` with no `scope` where the table
has both a header row and a header column. Decidable, and a real barrier:
a screen reader announces a cell with its headers, or announces it bare.

Built as the second check in the Markup Checker, which is what that name
was chosen for. Only the missing-`th` half: a table with no header cells at
all, and only where there are cells to have them. A table marked
`role="presentation"` is not claiming to be a table, and an empty one is
somebody's spacer.

`scope` was left out. A table with a header row and no header column does
not need it, so requiring it would have been a finding on the ordinary
case — the sort of threshold item 8 is on the watch for.

Measured before shipping, which is the lesson of the four false positives
found the same day. The first version reported twelve tables on
ja.wikipedia.org and one on amazon.co.jp, and reading them showed the rule
was wrong rather than the pages: the succession boxes and navigation boxes
were one row and a handful of cells, and Amazon's was a single empty cell.
Layout wearing a table's tags.

So the shape has to be a table's before missing headers mean anything: at
least two rows, since one row cannot have a header row, and at least two
columns, since one column is a list. Amazon went to zero and Wikipedia to
seven of thirty-three — the population table and the climate table among
them, which are real findings.

The rows and cells counted are the table's own. Wikipedia nests tables, and
a nested one's `th` would otherwise excuse the table around it.

What is left on Wikipedia is genuinely arguable — a positional map of
neighbouring prefectures reads as a table to a machine and as a diagram to
a person. Watch it under item 8. If it turns out noisy, the numbers to
change are the two thresholds in `js/markupCheck.js`.

### 17. Brightness greyed the panels off the screen — done

Reported 2026-07-20: turning the brightness checker on made some panels
disappear and left others alone.

Both halves were the same fault. `filter` on an element makes it the
containing block for every fixed-position descendant, and every panel here
is fixed, so greying `<body>` re-anchored them to the document. Measured
with the page scrolled 1200px: the nest panel went from 418px down the
viewport to 1634px — off the screen, not deleted. The head panel really was
deleted, by name, in `brightnessCheck.js`.

That line was written when there was one panel and the two checkers were
made mutually exclusive to work around it. Four panels were built after it
and none were added there, so which of the two symptoms a panel got
depended on whether anyone had remembered it. **One checker knowing another
by name was the bug**, and the workaround aged into it.

The page is greyed by a fixed screen with `backdrop-filter` now, sitting
below the panels and above everything the page draws. Nothing is
re-anchored, no checker names another, and the panels keep their colours -
which is the right answer anyway, since the question is whether the *page*
relies on colour.

The screen takes no pointer events. It is a viewing mode, not a modal, and
a reviewer has to be able to open the thing they are looking at.

### 18. Eight checkers is a wall of text — done

Asked 2026-07-20, once the menu had doubled: is the order right, and should
the entries have icons?

Icons were declined, and the reason is not effort. Three of the eight can be
drawn — image, brightness, alt. The other five are *head*, *nest*,
*heading*, *markup*, *outline*, which have no conventional picture between
them. An icon for those is something to be learned, and the person who has
learned it already knows the list; the reader who cannot tell the entries
apart at a glance is exactly the reader an invented icon does not help. A
picture that has to be explained is decoration wearing the clothes of
information.

Three cheaper things were done instead.

The menu was the last surface still in English. The listing, the manual,
every finding and every panel had been in both languages for a while, and
the eight labels a reader looks at most often had not - which made the
listing's "available in English and Japanese" not quite true. Eight lines of
a language that is not yours is a slow thing to scan, and that alone was
most of the complaint.

Each checker already had a colour, appearing only on hover or while
running - no use at all to somebody looking for the right one. It shows at
rest now, as a bar down the left edge. No new vocabulary, and it is already
this extension's way of saying which checker you are looking at.

And the list is split under two headings: five that report findings, three
that draw over the page. That answers "which of these do I want" with
structure rather than with names, and it matches the review button
underneath, which runs the first group.

The headings did not read as headings at first, because the entries under
them began at the same left edge, so a heading was just one more line in the
same column. The entries are indented now, with the colour bar landing on
the heading's own left edge and the labels sitting in from it. The hierarchy
is in the layout rather than asked of the wording.

A checker's menu label is now the same message as its panel's title, so the
two cannot come to call one checker different things. A test holds it.

The order within each group was left alone. It is the order they were
built in, and choosing a better one needs to know which gets reached for
most - a question for use, like item 8, not for reasoning.

### 19. The hreflang set — built, and waiting for 0.10.0

Asked 2026-07-21, out of a longer list of head tags to consider adding. Most
of that list was declined and the reasons are worth keeping, because they
are the same reason each time: a checker earns its place by deciding
something, and none of these decide anything.

`robots` was already covered. A `sitemap.xml` is not in the head at all and
cannot be seen from the DOM — `rel="sitemap"` exists and nobody uses it.
`rel="author"` pointing at humans.txt has done nothing since Google dropped
rel=author in 2014. An RSS `rel="alternate"` and `format-detection` are real
tags, but their presence or absence is neither right nor wrong, so they
could only ever be reference rows.

hreflang was the one left, and it has genuine findings in it. A set that
does not name the page it sits on is discarded whole, which is an alert. A
value that does not parse as a language tag is an alert too, and so is a
country code standing in for a language — `jp` for `ja`, `cn` for `zh`,
which is the mistake everybody makes. One code given two addresses is a note
because nothing can resolve it.

Two decisions in it are the same trade as item 8's canonical fixes. `uk` and
`se` are absent from the country-code table although they are the same
confusion, because both are real languages — Ukrainian and Northern Sami —
and a page written in either would be told its correct markup was wrong.
Being wrong about Ukrainian to be right about Denmark is the worse trade.
And a page declaring no hreflang at all is not reported: one language needs
none, so that finding would fire on most of the web.

`x-default`'s absence is not reported either. Google's advice for it is
conditional on having a page for unmatched languages, and plenty of correct
sites have none.

Note that this does not replace `checkLangMissing`, and neither replaces the
other. Search engines take language from the content and from these tags
rather than from `<html lang>`; a screen reader takes its voice from the
attribute and knows nothing about hreflang.

Committed to `release/0.9.0` on 2026-07-21, after 0.9.0 was already
submitted, so it is not in the build under review. It rides 0.10.0 with item
10 — the paragraph above applies again, unchanged: uploading over a pending
draft restarts the queue, and a feature addition is not worth a second
cancelled review when the withdrawal of 0.8.0 has already paid that cost
once.

### 20. Landmarks — done

Asked 2026-07-21. The best fit of the eight, and it takes the shape of the
heading outline rather than of an alert list, for the same reason.

What a machine can decide: no `main` on the page, or more than one; and two
landmarks of the same role that cannot be told apart, because they share an
accessible name or because neither has one. Two `nav` elements with no
labels are announced identically, and a screen reader user listing the
landmarks to jump between them is given the same word twice.

What it cannot decide is the part the proposal led with — whether the page
defines the landmark regions it ought to. That is the outline problem
again. A page with one `main` and nothing else may be correct or may have a
header and a footer built out of unmarked divs, and nothing in the DOM
separates those two. So draw the landmarks in document order, nested, with
each one's role and accessible name, and let it be read. The alerts sit
above it; the structure below it is the thing worth having.

Take roles from both directions, the elements and the explicit `role`
attributes: `main`, `nav`, `header`, `footer`, `aside`, `section` with a
name, `form` with a name, plus `role="main"` and the rest. `header` and
`footer` are only landmarks when they are not inside a sectioning element,
which is a rule to implement rather than a judgement, and getting it wrong
in the lenient direction would report a card's footer as a page footer.

Built 2026-07-23, in 0.12.0, as the Landmark Checker — its own panel, shaped
like the heading checker's, because the two are the same idea: findings a
machine can decide above, a structure only a person can judge below. The
findings are the missing or duplicated `main`, and landmarks of one role a
screen reader announces identically — the nameless of a role falling
together under one empty key, so two unlabelled `nav`s and two `nav`s both
named "Menu" are the same collision found the same way. `main` is left out
of that grouping: more than one is already its own finding, and reporting
the pair again as indistinguishable would be the same fault said twice.

Three decisions came out of building it, all about not drawing a region that
is not there. An explicit `role` wins outright, so a `role="presentation"`
on a `header` takes it out rather than falling through to the banner mapping.
`region` and `form` are landmarks only with a name, matching the platform,
so a bare `<section>` wrapper is not reported as a region. And a landmark
hidden from everyone — `display:none`, `visibility:hidden`, `aria-hidden` —
is left out, which is not only correct but stops a `display:none` mobile nav
beside the desktop one from being reported as two navs that cannot be told
apart. No `main` is a note and more than one is an alert, splitting a common
best-practice gap from a hard rule broken, the same call the heading checker
makes for the `h1`.

### 21. SVG with no accessible name and no `aria-hidden` — done

Asked 2026-07-21. Small, cheap, decidable: an inline `svg` with no
`<title>`, no `aria-label`, no `aria-labelledby`, no `role="img"` and no
`aria-hidden="true"`. It is announced inconsistently across screen readers,
which is worse than either a name or silence, because it cannot be
predicted from the markup.

Worth doing partly because this project has already been bitten by exactly
this markup from the other side: the duplicate-tag bug in item 8 was `title`
elements inside inline icons being counted as document titles. The svg
`<title>` is the icon's accessible name and the checker read it as the
page's. Whatever is written here should not repeat that — scope every
selector, and remember that in an HTML document a type selector crosses
namespaces.

Built 2026-07-21, in the Markup Checker's panel. That settles the open
question of where it reports: the alt checker was the other candidate and
cannot take it, because it draws labels over the page and has no findings
panel to report into. The markup panel's own description — wrong in ways
the page does not show — fits an icon whose announcement varies by screen
reader about as exactly as it fits a duplicated id.

Two things came out of building it, both about not reporting correct
pages. `aria-hidden` is read with `closest` rather than off the svg,
because an icon inside a hidden wrapper is the ordinary correct spelling
and reading only the element itself would report every one of them. And an
svg inside another svg is one graphic, counted once.

The `<title>` is matched as a direct child only. A title deeper in belongs
to a shape inside the graphic, not to the graphic — which is the same
distinction item 8's bug got wrong, arrived at deliberately this time.

### 22. Contradictions in the ARIA already there — done

Asked 2026-07-21, as two separate proposals — invalid ARIA attributes, and
custom controls that cannot be focused. Both proposals as stated are
declined below. What survives from them is this: cases where the attributes
present on an element disagree with each other, which needs no table of
what should have been there and no guess about intent.

- `role="button"`, `link`, `checkbox` or another interactive role on an
  element that cannot take focus — no `tabindex`, and not natively
  focusable. The role promises a control and the element cannot be reached
  to use it.
- `aria-hidden="true"` on an element that is focusable, or that contains
  one. The element is removed from the accessibility tree and left in the
  tab order, so it takes focus and is announced as nothing.
- `tabindex` above zero, which reorders the whole document's tab sequence
  against its reading order rather than the local one it looks like.

Each of these is a statement the page makes twice, differently. That is the
same kind of finding as a canonical pointing elsewhere or an `id` used
twice, and it is why they are worth having when the general ARIA validation
they were carved out of is not.

Built 2026-07-22 with item 11, in the Markup Checker. Two of the three are
alerts — the unreachable role and the still-tabbable `aria-hidden` — and the
positive `tabindex` a note. Where it could report correct markup it does not:
the composite roles that a roving `tabindex` manages (radio, tab, option,
menuitem, treeitem) are left out of the interactive-role set, since a resting
child with no `tabindex` is right there, not wrong; and the role check wants
no `tabindex` at all rather than a non-negative one, because a `-1` is the
roving pattern's own spelling and the author having addressed focus. The
`aria-hidden` check reports only the outermost, so a hidden subtree is one
finding and not one per focusable inside it.

### 23. Point at the flagged element on the page — done

Asked 2026-07-22. The markup and image checkers already hold the real
elements they report — `namelessSvg`, `unlabelled`, the headerless tables,
the oversized and dimensionless images — but a row shows only the text
`locate()` builds from them: `svg.svg`, `a > svg`. That descriptor is
weakest for exactly the elements these checks flag, the ones whose whole
fault is having no identifier of their own; item 21's descriptor collapse is
the same weakness named from the other side.

Pointing at the element sidesteps it. A good descriptor stops being the only
way to find the row's element once the tool can draw a box over it, which is
what Lighthouse and axe do. Keep the descriptor — it is still what the copy
button puts in the ticket, where there is no page to point at — and attach
the element to its row.

The box is absolutely positioned from `getBoundingClientRect()`, not an
`outline` on the page element. The outline checker sets outlines on the page
directly and is right to, because it marks every element at once and a
one-pixel shift across all of them is invisible; a single box asked to sit
exactly on one element must not move that element or be restyled by the
page's own rules, and an overlay owes nothing to either. It also has to live
in the page rather than inside any panel — the same place the alt labels
go — so that item 24's shadow-rooted panels do not carry it off. Put it
there from the first line written.

Interaction is hover to preview, click to travel. Moving down the list draws
a light box under each row in turn; clicking a row scrolls its element into
view and draws a stronger box that stays. Click-only with no scroll was the
alternative and is declined for the population it serves: the flagged
elements are small and scattered — nine images with no dimensions, thirteen
nameless icons — and most are below the fold on the page as first seen. A
highlight with no scroll would light an element the reader cannot see, and
read as doing nothing at the worst moment.

This eases item 21 rather than replacing it. The descriptor still has to be
legible in the copied report, so the collapse is still worth fixing; it just
stops being the only thing standing between a finding and the element it
names.

Built 2026-07-22, in 0.11.0, as `kraftyPointAt` in `panel.js` so the markup
and image checkers share one implementation. Every single-element findings
row is wired to it — the markup checker's fields, links, dead links, svgs,
unreachable roles, focus traps and positive tabindex, and the image checker's
oversized rows. A row that names several elements — a duplicated id, a reused
link text — has no one thing to point at and stays inert, which decided
against pointing from those rows rather than guessing which element they
meant. The box went in the page from the first line, as specified, and both
checkers drop it when the panel is rebuilt or closed so a pinned box never
outlives its findings. The dimensionless images and the headerless tables are
counted rather than listed, so they have no row to point from yet; when they
grow one, it points the same way.

### 24. Panels isolated from the page's CSS

Asked 2026-07-22, from https://timetechnologies.ltd/, where a panel came up
with the wrong font size and padding. The panels live in the page's own DOM,
styled by the global `content.css` through prefixed classes and a handful of
`!important`s. That protects only what is stated: a property the stylesheet
sets is safe, an inherited one it does not set is taken from the page, and a
page rule specific or `!important` enough to match a `div`, `span` or `ul li`
inside the panel reaches in. `panel.js` already marks left/top/right/bottom
`!important` for this exact reason — the page is "not to be trusted" — but
doing it a property at a time is a list that is never finished.

The answer is a shadow root per panel, styled inside it, with
`:host { all: initial }` to cut the inheritance the prefixes cannot reach. An
`all: initial` reset without a shadow was the lighter option and is declined:
it is verbose and still loses to a page `!important`, which a shadow boundary
does not.

The cost is that `content.css` has to split. The panel rules move inside the
shadow, delivered as a string rather than as a global stylesheet, which is a
change to how the SCSS is built. The rest — the alt labels, the outline and
nest marks, the brightness screen — stay global, because they draw on the
page's own elements and cannot be moved into a panel's shadow. `panel.js`
reads the host's rectangle to drag and place it, so the drag logic is mostly
untouched, and the clipboard and i18n paths do not change.

Bigger than item 23 and after it. It is also why item 23's box is specified
to live in the page rather than in a panel.

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

### `div` and `span` used as buttons — the handlers are not there to read

Proposed 2026-07-21, and the one it hurts most to decline, because it names
a defect that is everywhere and genuinely harmful.

The check as proposed is "an element with an `onClick` but no `role` and no
`tabindex`". The trouble is the first half. An inline `onclick` attribute is
in the DOM and can be read; a handler attached with `addEventListener` is
not, and is not reachable from a content script at all. `getEventListeners`
belongs to the devtools console, not to the page. And a `div` acting as a
button on a site built this decade was almost certainly given its handler by
a framework, through `addEventListener`, from a bundle.

So the check would walk a React page, find no inline handlers, and report
that it found nothing wrong — having been unable to look at the place the
handlers live. That is the CSS argument above and item 12's `console.log`
arriving a third time by the same road, and the answer does not change for
being asked about accessibility: a checker that cannot distinguish "clean"
from "could not see" must not report either.

What is salvageable from it went into item 22, from the other direction.
Where the author did add `role="button"` and stopped, the contradiction is
in the DOM and needs no handler to prove it. That catches the half-converted
case and misses the untouched `div` entirely, which is worth saying plainly
rather than letting the panel imply otherwise.

### `aria-required` and `aria-invalid` — would report correct pages

Proposed 2026-07-21. Declined because both halves fire on markup that is
right.

`aria-required="true"` is not what makes a field required; the HTML
`required` attribute is, and the browser maps it to the same state in the
accessibility tree. A form using `required` correctly needs no ARIA at all,
and a check for the missing attribute would flag every one of them. It would
be reporting a redundancy as a defect.

`aria-invalid` is worse, because it is a state and not a property. It is
correct only while the field actually is in error, and correct to be absent
otherwise. A script reading the DOM cannot tell which of those it is looking
at — it would need to know what the user typed and what the validation
concluded. Absent is the right answer almost every time it is checked.

The useful form-field finding is the one already written down as item 10: no
label by any of the four routes. That is decidable, it is a defect whenever
it is found, and it is the missing half of the alt checker.

### Keyboard operability of custom controls — needs the page driven

Proposed 2026-07-21: whether a hand-built dropdown or modal can be reached
with Tab. Declined as a check because answering it means operating the page
— pressing keys, watching where focus lands, opening the thing first —
and a checker reads a page as it stands. Krafty's rescan button exists
precisely because the DOM at rest is all any of these get to see.

Focusability itself, as opposed to operability, is in item 22.

### `outline: none` — reachable in part, and the part is the wrong part

Proposed 2026-07-21. Declined, and the reason is not the one the CSS
section above would suggest. `outline: none` is a valid declaration, so
unlike `colr: red` it survives parsing and is present in the CSSOM. Rules
in same-origin stylesheets can be walked and matched.

Two things stop it anyway. Cross-origin stylesheets still throw on
`cssRules`, and a site serving its CSS from a CDN is the ordinary case, not
the exotic one — so the coverage would be silently partial in the same way
again. Not measured; it did not need to be, because of the second thing.

The second is that the finding is a judgement even when the rule is found.
`outline: none` is correct wherever a visible replacement is provided, and
`:focus-visible` with a ring, a border, a background change or a shadow are
all normal ways to provide one. Deciding whether what replaced it is
visible enough is a contrast question, which is the one thing already
refused above. A check that flagged every `outline: none` would be telling
well-built sites they are wrong, and one that tried to judge the
replacement would be guessing.

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
- The alt checker places its labels by measuring where the images are when
  it runs. A page that reflows afterwards — lazy loaded images arriving
  below the fold is the everyday case — leaves them where they were.
  Toggling off and on re-measures. The alternative was leaving them at their
  static position, which put every label in a row on top of the first image,
  so this is the better of the two snapshots rather than a fix for both.
