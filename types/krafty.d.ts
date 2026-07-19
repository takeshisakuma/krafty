/* Globals the injected checkers share. js/i18n.js is injected ahead of each
   checker and defines kraftyMessage; declaring it here keeps `npm run
   typecheck` honest at both the definition and every call site.

   This file lives outside code/ so it is not packaged. */

declare var kraftyMessage: (
  key: string,
  substitutions?: string | string[]
) => string;
