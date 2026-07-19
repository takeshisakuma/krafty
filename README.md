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

`test/support.js` builds the page and injects the checkers in the order the
popup does. It is not a test file itself, which is why `npm test` matches
`test/*.test.js` rather than the whole directory.

Cases go through the HTML parser, so they must describe trees the parser
actually produces. Writing `<p><div></div></p>` in a case would silently
test two siblings, because the parser closes the `<p>` first.

### Localisation

Strings live in `code/_locales/<lang>/messages.json` and are looked up with
`chrome.i18n`, which follows the browser's UI language, not the language of
the page being checked. `en` is the default, so an unlisted language falls
back to it.

The injected checkers call `kraftyMessage` from `js/i18n.js`, which the
popup injects ahead of each of them. It falls back to returning the key
when `chrome.i18n` is absent, which is what happens when the test suite
runs a checker in a plain page.

Judging and phrasing are kept apart on purpose: `judge()` returns
`{ parent, child, allowed }` and the wording is applied only at the point
of display. That is why the tests can assert behaviour without pinning any
particular English sentence, and why adding a locale cannot break them.

Element and attribute names inside messages stay literal. `title`,
`og:image` and `ul > div` are not words to translate.

### How the nest checker works

`code/js/nestCheck.js` holds a `MODELS` table mapping each element to the
child elements it may contain. It walks the document, and `judge()` returns
either `null` or `{ parent, child, allowed }` for every element its parent
is not allowed to contain. Offending elements get a class and a `title`
explaining why. To change what counts as valid nesting, edit that table.

A parent absent from the table is not checked at all. Transparent content
models — `a`, `ins`, `del`, `video`, `map`, `svg`, `button`, `template` and
the rest — depend on the context of their own parent, which a flat table
cannot express, so guessing would be worse than staying quiet.

The exceptions live in `judge()` as ordinary conditions: a `dl` wrapping
each `dt`/`dd` group in a `div`, an `area` anywhere inside a `map`, `meta`
and `link` carrying microdata or a body-ok `rel`, and autonomous custom
elements, which are flow and phrasing content per spec and would otherwise
bury every real finding on a component based page.

The judging used to be done by CSS, generating one rule per element from a
map in `content.scss`. That is worth knowing only because of why it moved:
a checker has to be able to explain a finding, CSS can flag an element but
cannot report one, and keeping a second copy of the table in SCSS for the
colouring would have let the two drift. The stylesheet now only colours what
the script marks, which also retired a `:where()` wrapper and a set of
exception rules that existed purely to win specificity fights.

### Keyboard shortcuts

Declared as `commands` in the manifest and handled by the service worker.
**No `suggested_key` is shipped**, deliberately.

Defaults were tried first — `Alt+Shift+H/N/O/A` — and every one of them came
out unassigned at `chrome://extensions/shortcuts`, on a fresh install as well
as a reload. Chrome drops a suggested key that anything else already claims
and reports nothing: not in the manifest, not in the service worker console,
not on the shortcuts page beyond the empty field. There is no way from inside
the extension to tell a working default from a discarded one, and a discarded
one is indistinguishable from a broken feature.

Two related behaviours are worth knowing if defaults are ever reconsidered:
suggested keys are applied when an extension is **installed**, not when it is
reloaded, and Chrome caps them at four per extension.

Users assign their own keys at `chrome://extensions/shortcuts`, which the
manual page in `code/option/option.html` points them to.

`--load-extension` was removed in Chrome 137, so the service worker cannot
be started from a test. `test/wiring.test.js` runs `background.js` against
stubs to prove a command reaches the checker it names; that the worker
registers at all still has to be checked by hand.

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
