# krafty

chrome extension for web director

## Checkers

This section and the Japanese one below it are the Chrome Web Store
listing's description, one per locale. Paste them in as they are, minus the
heading markers.

Ten checks you can turn on over any page, from the toolbar or from a keyboard shortcut you assign yourself. Nothing is sent anywhere: every check runs in your own browser, on the tab you are looking at, and Krafty collects no data at all. Available in English and Japanese, following your browser's language.

### Head Checker

Reports the problems in a page's head that software can actually decide: a robots tag asking search engines to ignore the page, a missing viewport, title, description or lang, a missing doctype, a canonical pointing at a different page, duplicated tags, text long enough to be cut off, and an og:image smaller than sharing platforms want.

On a multilingual site it checks the hreflang set too: whether it names the page it is on, since one that does not is ignored entirely, and whether the codes are language codes at all — `jp` and `cn` are countries, and Japanese and Chinese are `ja` and `zh`. A page declaring no hreflang is not reported; one language needs none.

It will not tell you whether the title is the right title. Nothing can — a title can be correctly formed and still say "Home | Home" or carry a staging site's name. So the page is drawn the way visitors meet it, as a search result and as a shared link, for you to read and judge.

Every value in the head is listed underneath, each with a button to copy it, and the URLs open in a new tab.

### Nest Checker

Highlights every element its parent element is not allowed to contain, such as a div directly inside a ul, or an li with no list around it. Hover any highlighted element and it tells you the rule it breaks and what the parent may contain instead.

The panel totals them and breaks them down by pair, and copies the whole list in one go so it can go straight into a ticket.

### Heading Checker

Reports what can be decided about the heading structure: more than one level one heading, a level skipped on the way down, a heading with no text at all, and a page with no headings.

Whether the headings read as a sensible outline of the page is not something software can answer, so they are listed in order and indented by level, as a table of contents to read. Headings hidden from everyone are left out, and the panel says how many. The whole outline copies as one indented block.

### Markup Checker

Reports markup that is wrong in ways the page does not show.

Ids used more than once: nothing looks different, but a `label` stops reaching its field, an in-page link lands on the first one and never the second, and any script asking for that element gets whichever came first. A page template repeated down a listing produces this without anyone writing it.

And tables with no header cells, where a screen reader announces every cell bare, with nothing to say which column it belongs to. Tables marked as layout are left alone.

Then form fields with nothing naming them — no label, wrapping or by `for`, no `aria-label`, no `aria-labelledby` that resolves to anything, and no `title`. The placeholder inside a field says what it is to anyone looking at it and to nobody else. Hidden fields and the button types are not counted; those take no label.

And inline SVGs that are neither named nor hidden. Named, an icon is announced; marked `aria-hidden`, it is skipped; neither, and what a screen reader does with it varies by screen reader. An `aria-hidden` on any element above the icon counts, since wrapping one is the ordinary way to hide it. Where such an icon is the whole of a link or button, that link is flagged as heavier — it is the reason the control has no name.

And links or buttons with no accessible name at all: an icon `<button>` or an `<a>` with only an svg inside is announced as just its role — "button", "link" — and nothing else. Beside them, a link whose `href` is empty, which reloads the page it sits on rather than going anywhere; the same text used for more than one destination, which reads as one word repeated in a screen reader's link list; and the vague texts — "こちら", "read more" — listed for you to weigh rather than asserted, since whether a phrase is too vague is a judgement and depends on the language.

And contradictions in the ARIA already on the page: an interactive `role` on an element that cannot take focus, so the control it promises cannot be reached; `aria-hidden` on something still in the tab order, which takes focus and is then announced as nothing; a `tabindex` above zero, which reorders the whole document's tab sequence. Each is a statement the markup makes twice and disagrees with itself.

Each finding is listed underneath as well as counted, and each list copies in one go. The fields, the icons and the nameless links have nothing to be called — that is the defect — so each row is built from whatever the element does carry: its id, its name, a link's address, its class, or the parent's where it has none of its own. An unlabelled field shows its placeholder beside it, which is both the quickest way to find it on the page and, usually, the reason the label was left off.

Hover a listed row to draw a box over the element on the page, and click it to scroll there and leave the box behind. The short descriptor a row shows is weakest for exactly the elements these checks flag, so the box is the surer way to find them.

Every panel has a check-again button. A check reads the page as it stands when it runs, so press it after opening an accordion or scrolling a list in.

### The review

One button under the checker list runs everything that reports and copies the result as one block, ready for a ticket: the address, then each checker with what it found underneath.

There is no total, on purpose. A single number would be a verdict on the whole page, including everything nothing looked at. Each checker says what it checked and nothing more.

### Image Checker

Finds images served much larger than the space they are drawn in — a 1920×1080 file shown at 300×169 — and lists them worst first, with the file name and the address ready to copy. Also counts the images with no width and height attributes, which is what makes a layout jump while it loads.

High-density displays are allowed for, so an image correctly built at twice the displayed size is never reported, and the allowance does not depend on the monitor you happen to be checking on. The panel states the basis it judged against, and each row carries its own ratio. Hover a row to box the image on the page, and click to scroll to it.

### Leftovers Checker

Finds development leftovers a page shipped with. A `src`, `href`, `srcset` or `action` pointing at a local or private address — `localhost`, a `192.168` or `10.x` host, a `.local` name — that no visitor can reach: the production page still loading its hero image from the machine it was built on. Resources loaded over `http` on an `https` page, which the browser blocks outright. And images still coming from a placeholder service like placehold.co or dummyimage.com, that nobody swapped for the real picture.

Two more are listed rather than asserted, because each can be innocent: a resource whose host reads like a staging environment — `dev.`, `staging.`, `test.` — which may be a link to the test site left in the page or may just be a product's name; and a developer marker left in an HTML comment — TODO, FIXME, 仮 — which may or may not still matter.

The page's own host is left alone, so a site served from localhost is not flagged for its own relative URLs. Each finding is listed with its address, and points at the element on the page where it has one to show.

### Landmark Checker

Reports what can be decided about a page's landmark regions: no `main` for a reader to skip to, or more than one where only one may be exposed; and two landmarks of the same role that a screen reader announces identically, because they share a name or because neither has one — two unlabelled `nav`s read as the same word twice in the list a reader jumps between regions with.

Whether the page marks up the regions it ought to is not something software can answer — one `main` and nothing else may be right, or may be a header and footer built from unmarked divs — so the landmarks are drawn in document order, nested, each with its role and accessible name, for you to read as a map of the page. Regions hidden from everyone are left out, and the whole map copies as one indented block.

### Outline Checker

Draws an outline around every element, so the structure and spacing of a layout can be seen at a glance.

### Alt Checker

Shows the alt text of every image, and separates an image with no alt attribute at all from one deliberately marked decorative with an empty alt. The two look identical in a browser and mean opposite things.

### Brightness Checker

Turns the page monochrome, which shows up anything that relies on colour alone to be understood.

## Checkers (Japanese)

The store's Japanese locale. Written rather than translated, so the two say
the same things without matching sentence for sentence. Both need updating
when a checker changes.

Krafty はページの構造とメタデータを確認するためのブラウザ拡張機能です。10のチェックを、ツールバーから、あるいはご自身で割り当てたキーボードショートカットから、任意のページに重ねて表示できます。処理はすべてお使いのブラウザ内で完結し、どこにも送信しません。データの収集も一切ありません。表示言語はブラウザの設定に追従し、日本語と英語に対応しています。

### ヘッドチェッカー

head の中で機械が判断できる問題を報告します。検索避けの robots 指定、viewport や title、description、lang の欠落、DOCTYPE の不備、canonical が別ページを指している、タグの重複、省略されそうな文字数、SNS で使うには小さすぎる og:image。

多言語サイトでは hreflang も見ます。自身を指す指定があるか（無ければその指定はすべて無視されます）、そして値が言語コードとして成立しているか。`jp` や `cn` は国コードで、日本語と中国語は `ja` と `zh` です。hreflang が無いこと自体は報告しません。単一言語のサイトには不要だからです。

ただし、そのタイトルが適切かどうかまでは分かりません。どんなツールにも分かりません。「ホーム | ホーム」もステージング環境の名前が残ったままのタイトルも、形式としては何も間違っていないからです。そこで、検索結果と SNS で共有したときの見た目をそのまま描画します。判断はご自身の目で。

head の全項目はその下に一覧で並びます。値ごとにコピーボタンが付き、URL は別タブで開けます。

### ネストチェッカー

親要素が含むことのできない要素を強調します。ul の直下に置かれた div、リストの外にある li、といったものです。強調された要素にカーソルを合わせると、どの規則に反しているか、その親に本来置ける要素は何かが表示されます。

パネルには件数と、親子の組み合わせごとの内訳が出ます。まとめてコピーできるので、そのまま不具合票に貼れます。

### 見出しチェッカー

見出し構造について機械が判断できることを報告します。レベル1の見出しが複数ある、レベルが飛んでいる、文字列のない見出しがある、そもそも見出しがない、といったものです。

その見出しがページの構成として筋が通っているかどうかは、ソフトウェアには答えられません。そこで見出しを出現順に、レベルごとに字下げして並べます。目次として読んでご判断ください。誰にも見えない見出しは集計から外し、その件数を明記します。構造全体はそのままの字下げでコピーできます。

### マークアップチェッカー

見た目には現れない形で誤っているマークアップを報告します。

複数回使われている id。表示は何も変わりませんが、label が対応する入力欄に届かなくなり、ページ内リンクは常に最初の要素にしか飛ばず、その id で要素を取得しているスクリプトは先に出てきた方を掴みます。同じテンプレートを一覧で繰り返すと、誰も書いていないのに発生します。

そして見出しセルの無いテーブル。読み上げでは、どの列の値なのかが分からないまま、すべてのセルが読まれます。レイアウト用と明示されたテーブルは対象外です。

続いて、名前を持たない入力欄。for による label も、囲んでいる label も、`aria-label` も、参照先が存在する `aria-labelledby` も、`title` も無いものです。中に書かれたプレースホルダは、見えている人にだけ何の欄かを伝えます。type が hidden とボタン系のものは、そもそも label を取らないので数えません。

そして、名前も `aria-hidden` も無いインライン SVG。名前があれば読み上げられ、`aria-hidden` があれば飛ばされますが、どちらも無いと、どう扱われるかはスクリーンリーダー次第になります。アイコンを包む要素に `aria-hidden` が付いている場合も対象外です。実際にはその書き方が最も一般的だからです。そのアイコンがリンクやボタンの中身のすべてである場合は、より重い指摘として扱います。そのリンクを無名にしている当の原因だからです。

そして、アクセシブルな名前をまったく持たないリンクやボタン。中身が svg だけのアイコン `<button>` や `<a>` は、役割——「ボタン」「リンク」——としか読み上げられません。あわせて、`href` が空で、どこにも遷移せず今のページを再読み込みするだけのリンク、同じテキストで複数の遷移先を持つリンク（スクリーンリーダーのリンク一覧で同じ名前が繰り返されます）、そして「こちら」「read more」のような曖昧なテキスト——曖昧かどうかは言語にもよる判断なので、断定せず一覧にして委ねます。

そして、すでに付いている ARIA の中の矛盾。フォーカスできない要素に付いた操作用の `role`（約束した操作に到達できません）、タブ順に残ったままの `aria-hidden`（フォーカスが当たるのに何も読み上げられません）、0 より大きい `tabindex`（文書全体のタブ順を組み替えます）。いずれもマークアップが二重に、食い違う主張をしているものです。

各項目とも、件数だけでなく該当箇所を一覧にします。各一覧はまとめてコピーできます。入力欄・アイコン・無名のリンクは「呼び名が無いこと」自体が問題なので、各行はその要素が持っているもの——id、name、リンクなら遷移先、class、いずれも無ければ親のもの——から組み立てます。入力欄にはプレースホルダを併記します。ページ上で探す手がかりとして最も速く、そしてたいてい、それがラベルを省いた理由でもあるからです。

一覧の行にカーソルを合わせると、ページ上の該当要素に枠が描かれます。クリックするとそこまでスクロールし、枠を残します。行に出る短い記述子は、これらのチェックが指摘する要素——自前の識別子を持たない要素——ではとりわけ弱いので、枠の方が確実に見つけられます。

各パネルには再チェックのボタンがあります。チェックはボタンを押した時点のページを見るので、開閉したあとやスクロールしたあとに押し直せます。

### レビュー結果のコピー

チェッカー一覧の下のボタンを押すと、報告を行うチェッカーをまとめて実行し、結果を1ブロックでコピーします。アドレスがあり、その下にチェッカーごとの結果が並ぶ形で、そのまま不具合票に貼れます。

**合計は出しません。意図的です。** 1つの数字は、何も見ていない部分まで含めたページ全体への判定として読まれてしまうからです。各チェッカーは、自分が確認した範囲だけを述べます。

### 画像チェッカー

表示領域よりかなり大きく配信されている画像を見つけます。1920×1080 のファイルを 300×169 で表示している、といったものです。無駄の大きい順に並べ、ファイル名と、そのままコピーできるアドレスを添えます。width と height 属性の無い画像の数も出ます。読み込み中にレイアウトがずれる原因です。

高精細ディスプレイ向けの画像は考慮済みで、表示サイズの2倍で正しく用意された画像は指摘しません。判定基準はお使いのモニタに左右されません。どの基準で判定したかはパネルに明記し、各行にその超過倍率を添えます。行にカーソルを合わせるとページ上の画像に枠が描かれ、クリックするとそこまでスクロールします。

### 残骸チェッカー

ページが公開時に残してしまった開発時の痕跡を見つけます。`src`・`href`・`srcset`・`action` が、訪問者の誰も到達できないローカル・プライベートアドレス——`localhost`、`192.168` や `10.x` のホスト、`.local` の名前——を指しているもの。たとえば、本番ページがヒーロー画像を制作環境のマシンから読み込んだままになっている場合です。https ページ上で `http` で読み込まれ、ブラウザにブロックされるリソース。そして、placehold.co や dummyimage.com のようなプレースホルダサービスのままで、本物に差し替えられていない画像です。

さらに2つは、断定せず一覧で示します。どちらも問題ないこともあるからです。ホスト名の先頭がステージング環境らしく読めるリソース——`dev.`、`staging.`、`test.`——は、テスト環境へのリンクが残ったものかもしれませんし、単に製品名かもしれません。そして HTML コメントに残った開発マーカー——TODO、FIXME、仮——も、まだ意味があるとは限りません。

ページ自身のホストは対象外なので、localhost で配信しているサイトが自分の相対 URL で指摘されることはありません。各項目はアドレス付きで一覧にし、ページ上に表示できる要素であればそこを指し示します。

### ランドマークチェッカー

ページのランドマーク領域について機械が判断できることを報告します。読み手が飛べる `main` が無い、あるいは1つしか許されないのに複数ある、といったもの。そして、同じ役割のランドマークがスクリーンリーダーに同一に読み上げられる場合——名前が同じか、どちらも名前が無いか——です。名前の無い `nav` が2つあると、領域を飛び渡る一覧で同じ語が二度読まれます。

ページが本来マークアップすべき領域を備えているかは、ソフトウェアには答えられません。`main` が1つだけで他に何も無いページは、正しいのかもしれませんし、ヘッダーやフッターがマークアップされていない div でできているのかもしれません。そこでランドマークを出現順に、入れ子にして、役割とアクセシブルな名前を添えて並べます。ページの地図として読んでご判断ください。誰にも見えない領域は集計から外します。地図全体はそのままの字下げでコピーできます。

### アウトラインチェッカー

すべての要素に輪郭線を表示します。レイアウトの構造と余白の取り方が一目で分かります。

### alt チェッカー

すべての画像の alt を表示します。alt が未設定の画像と、装飾目的として意図的に空の alt を指定した画像は区別して表示します。ブラウザ上ではまったく同じに見えるのに、意味は正反対だからです。

### 明度チェッカー

ページをモノクロにします。色だけで情報を伝えている箇所が浮かび上がります。

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
