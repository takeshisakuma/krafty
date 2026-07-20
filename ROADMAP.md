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

## Waiting on real use

Neither of these can be settled by reasoning about them, and guessing would
mean building something to fix a problem nobody has. They need the extension
used on real work for a while first.

### 7. Are the Head Check findings the ones worth having?

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

Worth noting how it was found, because it argues for this whole section.
The check is a one-line `querySelectorAll` that reads correctly, has a test
behind it, and was wrong on the first real site it met. Nothing short of
running it on a page somebody actually built would have surfaced it. The
same is true of the questions above, which is why they are still open
rather than guessed at.

### 8. Overlapping alt labels

The labels are absolutely positioned, so on image-dense pages (EC product
grids, exactly the Rakuten case) they overlap and become unreadable.
Whether this hurts in practice is unconfirmed - check against a real
workload before designing a fix.

## Wanted

Four new checks were asked for on 2026-07-20. The heading outline is item 6
above; these are the other three. All are things a machine can decide on its
own, and all sit inside a page with no network involved. Roughly in the
order they seem worth doing.

### 9. Images served larger than they are shown

`naturalWidth` against `clientWidth` finds a 3000px image displayed at
300px. No network needed, nothing ambiguous about it, and it is a common
enough defect that directors get blamed for the page weight.

`width` and `height` attributes missing is the same walk, and is what causes
the layout to jump while images load.

One trap: `srcset` and high-DPR displays legitimately serve larger than the
CSS size, so a flat "twice the size" rule would fire on every correctly
built retina image. The threshold has to account for
`window.devicePixelRatio`.

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
