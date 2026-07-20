/* Globals the parts of the extension share.

   Chrome loads each of these as a plain script rather than a module: the
   injected checkers must be standalone files, and the service worker pulls
   checkers.js in with importScripts. Declaring the globals here keeps
   `npm run typecheck` honest at both the definition and every call site.

   This file lives outside code/ so it is not packaged. */

/* js/i18n.js, injected ahead of every checker. */
declare var kraftyMessage: (
  key: string,
  substitutions?: string | string[]
) => string;

/* js/panel.js builds the floating panels. */
declare var kraftyPanel: (options: {
  id: string;
  className: string;
  title: string;
  onClose: () => void;
}) => { panel: HTMLElement; body: HTMLElement };

/* The findings block inside a panel: summary, copy-all button, and the list
   every reported finding is appended to. Shared so a second checker that
   reports findings does not grow a second copy of the wording. */
declare var kraftyFindings: (into: HTMLElement) => {
  report: (
    level: "alert" | "note",
    key: string,
    substitutions?: string[]
  ) => void;
};

/* A button that copies what its callback returns, with a fallback for
   http:// pages where navigator.clipboard does not exist. */
declare var kraftyCopyButton: (
  label: string,
  read: () => string
) => HTMLButtonElement;

/* Remembered panel positions, kept in the isolated world for the lifetime
   of the page. */
declare var kraftyPanelPositions:
  | Record<string, { left: number; top: number }>
  | undefined;

/* Set once panel.js has attached its resize listener, so re-injecting the
   file does not stack another one. */
declare var kraftyResizeBound: boolean | undefined;

/* checkers.js, shared by the popup and the service worker. */
interface Checker {
  /** Element id of the popup button that toggles it. */
  id: string;
  /** Name of the matching entry in the manifest's commands. */
  command: string;
  /** Script injected into the page. */
  file: string;
  /** Class the script toggles on <body>. */
  bodyClass: string;
  /** Whether subframes are checked too. */
  allFrames: boolean;
}

declare var kraftyCheckers: Checker[];
declare var kraftyEnsureStyles: (tabId: number) => Promise<void>;
declare var kraftyRunChecker: (
  tabId: number,
  checker: Checker
) => Promise<void>;
declare var kraftyActiveTabId: () => Promise<number | null>;

/* Available to the service worker, which is a classic worker rather than a
   module. lib.webworker cannot be pulled in alongside lib.dom. */
declare function importScripts(...urls: string[]): void;
