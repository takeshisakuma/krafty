// @ts-check

/* Markup that is wrong in ways the page does not show.

   It starts with two checks, and is named for the family rather than for
   either of them, because unlabelled form fields report into this same
   panel when they are built. Renaming a checker after it ships costs a
   store listing, another review, and a name its users have to unlearn.

   A duplicated id is the cheapest thing this project can decide - count the
   ids, look for a number above one - and among the most consequential.
   `label[for]` stops reaching its field. An in-page anchor lands on the
   first one and never the second. `aria-labelledby` resolves to the wrong
   text. Any script asking for the element by id silently gets whichever
   came first in the document.

   A table with no header cells is the same kind of quiet. It looks like a
   table and reads as one, and a screen reader announces every cell bare,
   with nothing to say which column or row it belongs to.

   And none of it shows. That is why it belongs in a tool used to review a
   page that looks finished, rather than being left to a validator nobody
   opens once the layout is right. */

(() => {
  const PANEL_ID = "js-kraftyMarkupInformation";
  const BODY_CLASS = "kraftyMarkupChecker";

  /* Always start from a clean slate: the previous panel must go, otherwise
     repeated runs stack duplicate elements sharing the same id. */
  document.getElementById(PANEL_ID)?.remove();

  if (!document.body) {
    return;
  }

  if (!document.body.classList.toggle(BODY_CLASS)) {
    return;
  }

  /* Everything below runs again when the panel's rescan button is pressed,
     which is why the toggle is not part of it. */
  const run = () => {
    document.getElementById(PANEL_ID)?.remove();

    /* --- reading the document --- */

    /** @type {Map<string, number>} */
    const seen = new Map();

    /* The whole document, not just the body: an id in the head is rarer but
       collides exactly the same way. */
    for (const element of document.querySelectorAll("[id]")) {
      /* Never report the checker's own UI. closest matches the element
         itself, so the panel's own id is covered by this too. */
      if (element.closest(".kraftyPanel")) {
        continue;
      }

      const id = element.id;

      if (id === "") {
        continue;
      }

      seen.set(id, (seen.get(id) ?? 0) + 1);
    }

    /* Worst first: an id used five times is five places to look. */
    const duplicated = [...seen]
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

    /* A table whose cells have no headers to be announced with. Layout
       tables - the ones with a role saying so - are excluded, because a
       table used for layout is not claiming to have headers. */
    const headerless = [...document.querySelectorAll("table")].filter(
      (table) => {
        if (table.closest(".kraftyPanel")) {
          return false;
        }

        const role = (table.getAttribute("role") ?? "").toLowerCase();

        if (role === "presentation" || role === "none") {
          return false;
        }

        /* An empty table is somebody's spacer, not a data table missing its
           headers. */
        return (
          table.querySelector("th") === null &&
          table.querySelector("td") !== null
        );
      }
    );

    /* --- the panel --- */

    const { panel, body } = kraftyPanel({
      id: PANEL_ID,
      className: "kraftyMarkupInformation",
      title: kraftyMessage("markupPanelTitle"),
      onRescan: run,
      onClose: () => {
        panel.remove();
        /* Drop the class too, or the popup would keep showing this checker
           as active with nothing on screen. */
        document.body.classList.remove(BODY_CLASS);
      },
    });

    const { reportText } = kraftyFindings(kraftySection(body, "sectionChecks"));

    if (duplicated.length > 0) {
      reportText("note", kraftyCount("markupDuplicateId", duplicated.length));
    }

    if (headerless.length > 0) {
      reportText("note", kraftyCount("markupTableNoHeader", headerless.length));
    }

    if (duplicated.length > 0) {
      const listSection = kraftySection(body, "markupSectionIds");

      kraftyListHead(
        listSection,
        "markupIdListLabel",
        kraftyMessage("copyFindings"),
        () =>
          [
            location.href,
            ...duplicated.map(([id, count]) => `- #${id} × ${count}`),
          ].join("\n")
      );

      const list = document.createElement("ul");
      list.className = "kraftyPanelList";

      for (const [id, count] of duplicated) {
        const item = document.createElement("li");

        const label = document.createElement("code");
        /* textContent, not insertAdjacentHTML: the id comes from the page
           and must never be parsed as markup. */
        label.textContent = `#${id}`;
        item.appendChild(label);

        const times = document.createElement("span");
        times.className = "kraftyPanelCount";
        times.textContent = `× ${count}`;
        item.appendChild(times);

        list.appendChild(item);
      }

      listSection.appendChild(list);
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
