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

### How the nest checker works

`code/content.scss` defines a `$content-models` map from each element to
the child elements it may contain, and generates one rule per entry that
highlights every child outside that list. To change what counts as valid
nesting, edit the map rather than the generated selectors.

The generated `:not()` chains are wrapped in `:where()` so they carry no
specificity. Without that, a chain of ~80 `:not()` clauses would outweigh
the hand written exceptions at the bottom of the file (`dl > div > dt`,
`map area`, and the checker's own UI) and silently override them.

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
