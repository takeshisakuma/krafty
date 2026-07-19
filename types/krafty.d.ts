/* Globals the injected checkers share. js/i18n.js is injected ahead of each
   checker and defines kraftyMessage; declaring it here keeps `npm run
   typecheck` honest at both the definition and every call site.

   This file lives outside code/ so it is not packaged. */

declare var kraftyMessage: (
  key: string,
  substitutions?: string | string[]
) => string;

/* js/panel.js, injected the same way, builds the floating panels. */

declare var kraftyPanel: (options: {
  id: string;
  className: string;
  title: string;
  onClose: () => void;
}) => { panel: HTMLElement; body: HTMLElement };

/* Remembered panel positions, kept in the isolated world for the lifetime
   of the page. */
declare var kraftyPanelPositions:
  | Record<string, { left: number; top: number }>
  | undefined;
