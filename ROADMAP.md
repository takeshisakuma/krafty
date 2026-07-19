# Roadmap

Improvements considered while fixing the nest checker (2026-07), kept here
so the reasoning survives the next long gap. Nothing below is committed to;
the ordering is a recommendation, not a plan.

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

## Waiting on real use

Neither of these can be settled by reasoning about them, and guessing would
mean building something to fix a problem nobody has. They need the extension
used on real work for a while first.

### 6. Are the Head Check findings the ones worth having?

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

### 7. Overlapping alt labels

The labels are absolutely positioned, so on image-dense pages (EC product
grids, exactly the Rakuten case) they overlap and become unreadable.
Whether this hurts in practice is unconfirmed - check against a real
workload before designing a fix.

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
