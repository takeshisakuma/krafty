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

/* A count and its message, picking the "…One" variant of the key when the
   count is exactly one. */
declare var kraftyCount: (key: string, count: number) => string;

/* js/panel.js builds the floating panels. */
declare var kraftySection: (into: HTMLElement, key: string) => HTMLElement;

declare var kraftyListHead: (
  into: HTMLElement,
  labelKey: string,
  copyLabel: string,
  read: () => string
) => void;

declare var kraftyPanel: (options: {
  id: string;
  className: string;
  title: string;
  onClose: () => void;
  /** Adds a button that runs the check again over the page as it is now. */
  onRescan?: () => void;
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
  /** For a caller holding text it has already resolved, such as a count. */
  reportText: (level: "alert" | "note", text: string) => void;
};

/* A button that copies what its callback returns, with a fallback for
   http:// pages where navigator.clipboard does not exist. */
declare var kraftyCopyButton: (
  label: string,
  read: () => string
) => HTMLButtonElement;

/* Wire a findings row to the element it names: hover previews a box over it,
   click scrolls to it and pins the box (item 23). */
declare var kraftyPointAt: (row: HTMLElement, target: Element) => void;

/* Remove both pointer boxes, so a pinned one does not outlive the findings
   it belonged to. Called when a panel is rebuilt or closed. */
declare var kraftyClearPointer: () => void;

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
  /**
   * Element id of the panel this checker builds, for the ones that report
   * findings. Absent on the three that only draw over the page.
   */
  panelId?: string;
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
