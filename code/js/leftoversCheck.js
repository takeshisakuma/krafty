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

   The staging hostnames and the dummy text from item 12's list are not here:
   dev.example.com can be a product and "テストです" can be real copy, so those
   are judgements to list rather than defects to assert, and they wait. */

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

    return null;
  };

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
      } else {
        placeholder.push(row);
      }
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
