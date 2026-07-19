# krafty

chrome extension for web director

## Checkers

### Head Checker

Display title, description, OGP and other head metadata.

### Nest Checker

Highlight elements that their parent element is not allowed to contain.
If nothing turns red, the nesting is valid.

### Outline Checker

Display an outline around every element.

### Alt Checker

Display the alt attribute of every image, and flag images whose alt is
missing or empty.

### Brightness Checker

Make the page monochrome.

## Development

The extension itself lives in `code/`. That directory is the extension
root: `code/manifest.json` is the manifest, so load `code/` (not the
repository root) as an unpacked extension.

```sh
npm install
npm run build     # compile code/content.scss -> code/content.css
npm run watch     # same, but recompile on save
```

`code/content.css` is generated and committed, so a fresh clone can be
loaded without building. Rebuild it whenever `code/content.scss` changes.

To try a change: open `chrome://extensions`, enable developer mode, load
`code/` via "Load unpacked", and press reload (⟳) after each edit.

### Type checking

```sh
npm run typecheck
```

The source stays plain JavaScript — MV3 injected scripts must be, and the
files ship exactly as they are committed. Type checking comes from
`// @ts-check` at the top of each file plus `tsconfig.json` with `checkJs`,
so `@types/chrome` catches a wrong `chrome.scripting` argument before it
reaches a browser, with no build step and no change to the output.

`strict` is on deliberately. Turning it down would mostly silence the
null checks around `getElementById`, which is exactly the class of mistake
worth catching in a popup whose markup and script must agree.

### Testing

```sh
npm test          # builds, type checks, then runs the suite
```

The nest checker is entirely CSS, so its behaviour depends on selector
matching and specificity that only a browser resolves correctly. The suite
therefore drives a real Chrome through puppeteer rather than a DOM shim,
and asserts the computed background colour of each element under test.

It uses the Chrome already installed on the machine (`channel: "chrome"`),
so `npm install` does not download a browser. It also runs in a clean
profile, which matters: a Krafty build installed in your own Chrome
injects its CSS into every page and will otherwise skew the results.

Cases go through the HTML parser, so they must describe trees the parser
actually produces. Writing `<p><div></div></p>` in a case would silently
test two siblings, because the parser closes the `<p>` first.

### How the nest checker works

`code/content.scss` defines a `$content-models` map from each element to
the child elements it may contain, and generates one rule per entry that
highlights every child outside that list. To change what counts as valid
nesting, edit the map rather than the generated selectors.

The generated `:not()` chains are wrapped in `:where()` so they carry no
specificity. Without that, a chain of ~80 `:not()` clauses would outweigh
the hand written exceptions at the bottom of the file (`dl > div > dt`,
`map area`, and the checker's own UI) and silently override them.

Autonomous custom elements are the one case CSS cannot express, since no
selector matches "tag name contains a hyphen". `nestCheck.js` marks them
with a class and the stylesheet excludes that class. They are flow and
phrasing content per spec, so leaving them flagged buries everything else
on a component based page.

## Release

```sh
npm run package   # builds, then writes dist/krafty-<version>.zip
```

The version comes from `code/manifest.json`, which is the single source of
truth — bump it there before packaging, since the Chrome Web Store rejects
an upload that reuses a published version number.

The archive contains the contents of `code/` at its root (with
`content.scss` excluded); the store rejects packages where `manifest.json`
sits inside a subfolder. Load `dist/krafty/` as an unpacked extension to
verify exactly what is about to be uploaded.

Before submitting, check the Developer Dashboard's privacy tab: the data
usage disclosure is mandatory and blocks submission when left empty.
Krafty collects and transmits nothing.
