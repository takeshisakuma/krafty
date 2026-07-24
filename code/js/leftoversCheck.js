// @ts-check

/* Things that were only ever meant to be there during the build, left in the
   page that shipped. Item 12, the decidable half of it.

   The example that started the idea was console.log, and it turned out to be
   the weakest member of the family: it lives in bundled cross-origin scripts
   a content script cannot read, so a panel scanning what it can reach would
   report "nothing" while never having read the code. This checker takes only
   the part that has no such blind spot - resource addresses, which are on the
   element as written and fully readable.

   Three of them, each decidable without judgement:

   A resource pointing at a local or private address - localhost, 127.x, a
   192.168 or 10.x host, a .local name - that no visitor can reach. A
   production page loading its hero image from http://localhost:3000 is the
   handover embarrassment this whole idea is aimed at. A page's own host is
   left out: on a machine serving from localhost every relative URL resolves
   there, and flagging them would be noise on the developer's own screen.

   Mixed content - an http resource on an https page. The browser blocks it,
   so the page is already broken; there is nothing to weigh.

   A placeholder image service - placehold.co, dummyimage.com and the like -
   an image nobody swapped for the real one. A closed list, no guessing.

   Three more from item 12's list are here, but as listings rather than
   assertions - notes, not alerts, because each is a guess a person has to
   weigh. A hostname whose first label reads like an environment nobody meant
   to ship - dev., staging. - which can equally be a real product. A developer
   marker left in an HTML comment - TODO, FIXME, 仮 - where that the comment
   exists is decidable but whether it still matters is not. And dummy text
   left in the visible copy - Lorem ipsum, あああ, テストです - where "テスト"
   is a real word as often as it is filler, so only the reader knows which
   this one is. All three are the same shape as item 11's vague link text:
   shown for the reader to judge, never asserted to be wrong.

   The dummy text is why this checker is per-language and open-ended, and the
   reason it is listed the way it is. Two shapes are distinctive enough to
   catch anywhere in a fragment - Lorem ipsum, and one letter repeated
   (あああ, aaaa) - and the rest are a closed list of filler words matched
   only when they are the whole of an element's text, because "無料サンプル"
   is real copy where "サンプル" alone on a line is not. It cannot be
   exhaustive and does not try; it catches the common cases and leaves the
   judgement to the note.

   Only the inline console.log from item 12's list is still not here. It
   cannot be read honestly - most of it lives in bundled cross-origin scripts
   a content script cannot see, so a panel scanning the inline minority and
   reporting nothing would claim "no debug output" while never having read the
   code - so it waits. */

(() => {
  const PANEL_ID = "js-kraftyLeftoversInformation";
  const BODY_CLASS = "kraftyLeftoversChecker";

  /* Always start from a clean slate: the previous panel must go, otherwise
     repeated runs stack duplicate elements sharing the same id. */
  document.getElementById(PANEL_ID)?.remove();

  if (!document.body) {
    return;
  }

  if (!document.body.classList.toggle(BODY_CLASS)) {
    return;
  }

  /* Image services whose whole purpose is to stand in until the real picture
     arrives. A closed list, so there is no judgement in it - a host is on it
     or it is not. */
  const PLACEHOLDER_HOSTS = new Set([
    "placehold.co",
    "placeholder.com",
    "via.placeholder.com",
    "www.placeholder.com",
    "dummyimage.com",
    "www.dummyimage.com",
    "placekitten.com",
    "placeimg.com",
    "baconmockup.com",
    "loremflickr.com",
  ]);

  /* Hostnames whose first label reads like an environment that was never
     meant to face the public - a link to the staging site left in the
     production page. Only the first label, and only these words: dev. and
     staging. lead the address when they lead at all, and matching the word
     anywhere would catch latest.example.com and contest.example.com by their
     letters. A guess even so - dev.example.com can be a real product - so it
     is listed as a note, never asserted. */
  const STAGING_LABELS = new Set(["stg", "dev", "staging", "test"]);

  /** @param {string} host */
  const isStagingHost = (host) => STAGING_LABELS.has(host.split(".")[0]);

  /** A host nobody on the public internet can reach: loopback, link-local,
     the RFC1918 private ranges, and the .local mDNS names.
     @param {string} host */
  const isLocalHost = (host) =>
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "::1" ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^f[cd][0-9a-f]{2}:/.test(host) ||
    /^fe80:/.test(host);

  /** Classify one address, or return null when there is nothing wrong with
     it. The order is the priority: an unreachable host is worth saying before
     the protocol it used, and a placeholder before that it happens to be
     http.
     @param {string} value */
  const classify = (value) => {
    /** @type {URL} */
    let url;

    try {
      url = new URL(value, document.baseURI);
    } catch (error) {
      /* Not an address this checker can read - a bare fragment, a mailto,
         a malformed value. Nothing to say. */
      return null;
    }

    /* URL.hostname keeps the brackets on an IPv6 literal; strip them so the
       loopback and private tests see a bare address. */
    const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();

    /* A page served from a local host resolves its own relative URLs there,
       and those are not leftovers - they are where the page is. Only a host
       that is local and not the page's own is one. */
    if (isLocalHost(host) && host !== location.hostname.toLowerCase()) {
      return { kind: "local", url: url.href };
    }

    if (PLACEHOLDER_HOSTS.has(host)) {
      return { kind: "placeholder", url: url.href };
    }

    if (location.protocol === "https:" && url.protocol === "http:") {
      return { kind: "mixed", url: url.href };
    }

    /* Checked last and lowest: a broken or unreachable address is worth
       saying before a merely staging-looking one, and mixed content on a
       staging host is the browser's problem before it is a guess. The page's
       own host is left out for the same reason a local one is - a page served
       from staging.example.com resolves its relative URLs there. */
    if (isStagingHost(host) && host !== location.hostname.toLowerCase()) {
      return { kind: "staging", url: url.href };
    }

    return null;
  };

  /* Developer markers left in an HTML comment. The Latin ones are matched
     whole and case-insensitively; the Japanese ones have no word boundary to
     lean on, so they are matched as they are. Kept to item 12's own list
     rather than grown, because every addition is another word that might mean
     something innocent in a comment nobody meant as a marker. */
  const MARKER = /\b(?:TODO|FIXME|XXX)\b|仮|後で|後日差し替え/i;

  /* Dummy copy left where the real text should be. Two shapes are distinctive
     enough to match anywhere in a fragment: Lorem ipsum, and a run of one
     letter (あああ, aaaa - three or more, so an ordinary double letter is
     spared) or one placeholder mark (○○, ××, △△ - two or more of the *same*
     mark, so a ○ / × comparison table is spared). The alternation carries two
     capture groups because a placeholder mark repeats from two while a letter
     needs three. */
  const DUMMY_RUN = /lorem ipsum|([\p{L}])\1{2,}|([○◯×✕△▲□■])\2+/iu;

  /* The rest are ordinary words as often as they are filler - "サンプル" is
     real copy inside "無料サンプル" - so they count only when they are the
     whole of an element's text, never as a substring. A closed list, matched
     case-insensitively against the collapsed text; the Latin entries are the
     ones with no innocent meaning (dummy, hoge, asdf), the everyday words
     (test, sample, foo) left out because as a whole label they are ordinary
     English. Japanese keeps テスト and サンプル: a line that is only that word
     reads as filler far more often than the English does. */
  const DUMMY_WHOLE = new Set([
    "dummy",
    "dummy text",
    "placeholder",
    "hoge",
    "hogehoge",
    "fuga",
    "piyo",
    "foobar",
    "asdf",
    "ダミー",
    "ダミーテキスト",
    "サンプル",
    "サンプルテキスト",
    "テスト",
    "テストです",
    "テストテキスト",
    "てすと",
    "仮",
    "仮テキスト",
    "ここにテキスト",
    "ここにテキストが入ります",
  ]);

  /** Whether a fragment of collapsed, trimmed text reads as dummy copy.
     @param {string} text */
  const isDummy = (text) =>
    DUMMY_RUN.test(text) || DUMMY_WHOLE.has(text.toLowerCase());

  /** Every address an element carries. src, href and action are one each;
     srcset is a comma-separated list, each entry a URL and an optional
     descriptor.
     @param {Element} element */
  const addressesOf = (element) => {
    const out = [];

    for (const attribute of ["src", "href", "action"]) {
      const value = element.getAttribute(attribute);
      if (value) {
        out.push(value);
      }
    }

    const srcset = element.getAttribute("srcset");

    if (srcset) {
      for (const part of srcset.split(",")) {
        const url = part.trim().split(/\s+/)[0];
        if (url) {
          out.push(url);
        }
      }
    }

    return out;
  };

  /* Everything below runs again when the panel's rescan button is pressed,
     which is why the toggle is not part of it. */
  const run = () => {
    document.getElementById(PANEL_ID)?.remove();
    /* A pinned pointer box belongs to the last scan; the rows about to be
       rebuilt are its only way home. */
    kraftyClearPointer();

    /* --- reading the document --- */

    /** @type {{ element: Element, url: string }[]} */
    const local = [];
    /** @type {{ element: Element, url: string }[]} */
    const mixed = [];
    /** @type {{ element: Element, url: string }[]} */
    const placeholder = [];
    /** @type {{ element: Element, url: string }[]} */
    const staging = [];

    for (const element of document.querySelectorAll(
      "[src], [href], [srcset], [action]"
    )) {
      if (element.closest(".kraftyPanel")) {
        continue;
      }

      /* One finding per element: the first address it carries that is wrong,
         in the priority classify() decides. An element is a place to look,
         and listing it once per bad attribute would only pad the count. */
      let found = null;

      for (const address of addressesOf(element)) {
        found = classify(address);
        if (found) {
          break;
        }
      }

      if (!found) {
        continue;
      }

      const row = { element, url: found.url };

      if (found.kind === "local") {
        local.push(row);
      } else if (found.kind === "mixed") {
        mixed.push(row);
      } else if (found.kind === "placeholder") {
        placeholder.push(row);
      } else {
        staging.push(row);
      }
    }

    /* Developer markers in HTML comments, read from the whole document so a
       marker in the head is caught too. A comment is not an element with a
       box on the page, so these are listed by their text rather than pointed
       at, the way a script or link address already is. */
    /** @type {string[]} */
    const markers = [];

    const walker = document.createTreeWalker(
      document.documentElement,
      NodeFilter.SHOW_COMMENT
    );

    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.parentElement?.closest(".kraftyPanel")) {
        continue;
      }

      const text = (node.nodeValue ?? "").replace(/\s+/g, " ").trim();

      if (text !== "" && MARKER.test(text)) {
        /* Enough to recognise it, not the whole block: a commented-out
           section can run long, and the panel is not where it is read. */
        markers.push(text.length > 100 ? `${text.slice(0, 100)}…` : text);
      }
    }

    /* Dummy text left in the visible copy. Unlike a comment, this is on the
       page and has an element to point at, so each row carries its element the
       way the resource rows do. The isDummy test is cheap and runs first;
       whether the fragment reaches anyone is checked only once it matches, so
       a hidden template or an aria-hidden icon font is not listed and the
       visibility work is paid for the few matches, not every text node. */
    /** @type {{ element: Element, text: string }[]} */
    const dummy = [];

    const textWalker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT
    );

    for (let node = textWalker.nextNode(); node; node = textWalker.nextNode()) {
      const parent = node.parentElement;

      if (!parent || parent.closest(".kraftyPanel")) {
        continue;
      }

      const tag = parent.localName;

      /* The text inside these is code or is not shown, so it is not copy a
         reader would ever see filler in. */
      if (
        tag === "script" ||
        tag === "style" ||
        tag === "noscript" ||
        tag === "template"
      ) {
        continue;
      }

      const text = (node.nodeValue ?? "").replace(/\s+/g, " ").trim();

      if (text === "" || !isDummy(text)) {
        continue;
      }

      /* Reaches nobody, so it is not filler anyone was left looking at - and
         this is where an icon font's private-use glyphs and a hidden template
         would otherwise turn up. */
      if (
        parent.closest('[aria-hidden="true"]') ||
        !parent.checkVisibility({
          contentVisibilityAuto: true,
          visibilityProperty: true,
        })
      ) {
        continue;
      }

      dummy.push({
        element: parent,
        text: text.length > 100 ? `${text.slice(0, 100)}…` : text,
      });
    }

    /* --- the panel --- */

    const { panel, body } = kraftyPanel({
      id: PANEL_ID,
      className: "kraftyLeftoversInformation",
      title: kraftyMessage("checkerLeftovers"),
      onRescan: run,
      onClose: () => {
        panel.remove();
        kraftyClearPointer();
        /* Drop the class too, or the popup would keep showing this checker
           as active with nothing on screen. */
        document.body.classList.remove(BODY_CLASS);
      },
    });

    const { reportText } = kraftyFindings(kraftySection(body, "sectionChecks"));

    if (local.length > 0) {
      reportText("alert", kraftyCount("leftoversLocal", local.length));
    }

    if (mixed.length > 0) {
      reportText("alert", kraftyCount("leftoversMixed", mixed.length));
    }

    if (placeholder.length > 0) {
      reportText("note", kraftyCount("leftoversPlaceholder", placeholder.length));
    }

    if (staging.length > 0) {
      reportText("note", kraftyCount("leftoversStaging", staging.length));
    }

    if (dummy.length > 0) {
      reportText("note", kraftyCount("leftoversDummy", dummy.length));
    }

    if (markers.length > 0) {
      reportText("note", kraftyCount("leftoversComment", markers.length));
    }

    /** A titled section holding one row per offending address: the address
       itself, with the element's tag beside it and a box that points at it on
       the page (item 23) when the element has one to point at.

       @param {string} sectionKey
       @param {string} labelKey
       @param {{ element: Element, url: string }[]} rows */
    const listOf = (sectionKey, labelKey, rows) => {
      const section = kraftySection(body, sectionKey);

      kraftyListHead(section, labelKey, kraftyMessage("copyFindings"), () =>
        [location.href, ...rows.map((row) => `- ${row.url}`)].join("\n")
      );

      const list = document.createElement("ul");
      list.className = "kraftyPanelList";

      for (const row of rows) {
        const item = document.createElement("li");

        const address = document.createElement("code");
        /* textContent, not insertAdjacentHTML: the address is the page's own
           and must never be parsed as markup. */
        address.textContent = row.url;
        item.appendChild(address);

        const tag = document.createElement("span");
        tag.className = "kraftyPanelHint";
        tag.textContent = row.element.localName;
        item.appendChild(tag);

        /* Only a rendered element has a box to point at; a <script> or
           <link> would light nothing, so it gets no locatable affordance. */
        const rect = row.element.getBoundingClientRect();
        if (rect.width > 0 || rect.height > 0) {
          kraftyPointAt(item, row.element);
        }

        list.appendChild(item);
      }

      section.appendChild(list);
    };

    if (local.length > 0) {
      listOf("leftoversSectionLocal", "leftoversLocalListLabel", local);
    }

    if (mixed.length > 0) {
      listOf("leftoversSectionMixed", "leftoversMixedListLabel", mixed);
    }

    if (placeholder.length > 0) {
      listOf(
        "leftoversSectionPlaceholder",
        "leftoversPlaceholderListLabel",
        placeholder
      );
    }

    if (staging.length > 0) {
      listOf("leftoversSectionStaging", "leftoversStagingListLabel", staging);
    }

    /* One row per fragment: the text, the element's tag, and a box that points
       at it - the same row as a resource address, since dummy text has an
       element on the page where a comment marker does not. */
    if (dummy.length > 0) {
      const section = kraftySection(body, "leftoversSectionDummy");

      kraftyListHead(
        section,
        "leftoversDummyListLabel",
        kraftyMessage("copyFindings"),
        () => [location.href, ...dummy.map((row) => `- ${row.text}`)].join("\n")
      );

      const list = document.createElement("ul");
      list.className = "kraftyPanelList";

      for (const row of dummy) {
        const item = document.createElement("li");

        const code = document.createElement("code");
        /* textContent, not insertAdjacentHTML: the fragment is the page's own
           text and must never be parsed as markup. */
        code.textContent = row.text;
        item.appendChild(code);

        const tag = document.createElement("span");
        tag.className = "kraftyPanelHint";
        tag.textContent = row.element.localName;
        item.appendChild(tag);

        const rect = row.element.getBoundingClientRect();
        if (rect.width > 0 || rect.height > 0) {
          kraftyPointAt(item, row.element);
        }

        list.appendChild(item);
      }

      section.appendChild(list);
    }

    if (markers.length > 0) {
      const section = kraftySection(body, "leftoversSectionComment");

      kraftyListHead(
        section,
        "leftoversCommentListLabel",
        kraftyMessage("copyFindings"),
        () =>
          [location.href, ...markers.map((text) => `- ${text}`)].join("\n")
      );

      const list = document.createElement("ul");
      list.className = "kraftyPanelList";

      for (const text of markers) {
        const item = document.createElement("li");

        const code = document.createElement("code");
        /* textContent, not insertAdjacentHTML: the comment is the page's own
           text and must never be parsed as markup. */
        code.textContent = text;
        item.appendChild(code);

        list.appendChild(item);
      }

      section.appendChild(list);
    }

    const scanned = document.createElement("div");
    scanned.className = "kraftyPanelNote";
    scanned.textContent = kraftyMessage("panelScannedAt", [
      new Date().toLocaleTimeString(),
    ]);
    body.appendChild(scanned);

    document.body.appendChild(panel);
  };

  run();
})();
