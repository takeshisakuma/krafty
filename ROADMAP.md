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

## Medium value

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
