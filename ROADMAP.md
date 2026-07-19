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

## High value

### 1. Explain why an element is flagged

A flagged element turns red and says nothing else. Only someone who has
memorised the HTML content models can act on it. On Rakuten that means
walking 57 red boxes and inspecting each parent by hand.

`nestCheck.js` already walks the DOM to mark custom elements, so it can set
a `title` on each violation in the same pass ("div is not allowed inside
ul"). Hover-to-explain would be a large gain for a small change.

Doing this well means the content model table has to exist in JS as well as
in SCSS, or move to JS entirely. Decide that before starting — two copies
of the table will drift.

### 2. Report a count and a summary

There is no way to know how many problems a page has, or to get a list. The
only method is scrolling and looking. A panel in the same style as the head
checker, listing `ul > div × 25`, would double as a defect report a
director could hand to a developer.

This is the same feature as (1) and should be built with it.

## Medium value

### 3. Close button on the head panel

Dismissing the panel currently requires reopening the popup and pressing
Head Check again. The panel is `position: fixed` at the bottom left and
covers whatever is there, so it also wants a way to move or flip sides.

### 4. Keyboard shortcuts

The checkers are toggled repeatedly during a review. `commands` in the
manifest would remove a two-click round trip each time.

### 5. Overlapping alt labels

The labels are absolutely positioned, so on image-dense pages (EC product
grids, exactly the Rakuten case) they overlap and become unreadable.
Whether this hurts in practice is unconfirmed - check against a real
workload before designing a fix.

## Deferred, with reasons

### TypeScript

Full TypeScript is not recommended at this size. The JavaScript is about
350 lines and mostly DOM manipulation; the genuinely complex part is the
content model table in `content.scss`, which TypeScript cannot check at
all. MV3 injected scripts must be plain JS, so adopting TS adds a build
step to the one part of the pipeline that currently ships as-is.

Recommended instead: a `tsconfig.json` with `checkJs`, `// @ts-check` in
each file, and `@types/chrome`. Same output, no build step, and mistakes in
`chrome.scripting` arguments get caught before runtime. Roughly 15 minutes
of work.

Revisit full TypeScript if (1) and (2) land, since those add several
hundred lines and real data structures.

### `<style>` in the body stays flagged

Non-conforming per spec, and only 10 occurrences on the noisiest page
measured. Suppressing it would mean building a settings system this
extension does not otherwise have, which would cost more than it saves. If
it turns out to be noisy in practice, the fix is one entry in
`$content-models`, not a preferences screen.

## Known limitations

- `nestCheck.js` marks custom elements at the moment it runs, so elements
  a single page app inserts afterwards are not marked and will be flagged.
  Toggling the checker off and on re-scans. A `MutationObserver` would fix
  it properly but needs teardown handling.
- The checkers write classes onto the page's own `<body>`, so a page that
  rewrites `class` on `<body>` can clear them.
