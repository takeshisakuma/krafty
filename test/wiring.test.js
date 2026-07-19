// @ts-check

/* Nothing here needs a browser. These catch the mistakes that make a part of
   the extension quietly stop working rather than fail: a checker whose
   command is missing from the manifest still has a working button, so the
   only symptom is a shortcut that does nothing. */

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const code = path.join(root, "code");

/** @param {string[]} parts */
const readJson = (...parts) =>
  JSON.parse(fs.readFileSync(path.join(root, ...parts), "utf8"));

const manifest = readJson("code", "manifest.json");

/* checkers.js assigns to globals, so it is read and run rather than
   required. Running the real file is the point: a copy would not catch a
   change to it. */
function loadCheckers() {
  const source = fs.readFileSync(path.join(code, "checkers.js"), "utf8");
  /** @type {any} */
  const sandbox = { chrome: { scripting: {}, tabs: {}, runtime: {} } };

  new Function("globalThis", "chrome", source)(sandbox, sandbox.chrome);

  return sandbox.kraftyCheckers;
}

/** @type {Checker[]} */
const checkers = loadCheckers();

test("wiring", async (t) => {
  await t.test("every checker script exists", () => {
    for (const checker of checkers) {
      assert.ok(
        fs.existsSync(path.join(code, checker.file)),
        `missing ${checker.file}`
      );
    }
  });

  await t.test("every checker has a command in the manifest", () => {
    for (const checker of checkers) {
      assert.ok(
        manifest.commands[checker.command],
        `${checker.command} is not declared in the manifest`
      );
    }
  });

  await t.test("every manifest command has a checker", () => {
    for (const command of Object.keys(manifest.commands)) {
      assert.ok(
        checkers.some((checker) => checker.command === command),
        `${command} has no checker, so pressing it does nothing`
      );
    }
  });

  await t.test("stays within Chrome's four suggested keys", () => {
    const suggested = Object.values(manifest.commands).filter(
      (command) => /** @type {any} */ (command).suggested_key
    );

    assert.ok(
      suggested.length <= 4,
      `${suggested.length} suggested keys; Chrome rejects a manifest with more than 4`
    );
  });

  await t.test("every popup button has a checker", () => {
    const html = fs.readFileSync(
      path.join(code, "popup", "popup.html"),
      "utf8"
    );
    const ids = [...html.matchAll(/id="(js-\w+Button)"/g)].map((m) => m[1]);

    assert.deepStrictEqual(
      ids.sort(),
      checkers.map((checker) => checker.id).sort()
    );
  });

  await t.test("the popup loads the shared table before its own script", () => {
    const html = fs.readFileSync(
      path.join(code, "popup", "popup.html"),
      "utf8"
    );

    assert.ok(
      html.indexOf("checkers.js") < html.indexOf("popup.js"),
      "popup.js reads kraftyCheckers at load, so it has to come second"
    );
  });

  /* Chrome removed --load-extension, so the service worker cannot be booted
     from a test. Running it against stubs is the next best thing: it catches
     a command routed to the wrong checker, which is otherwise only visible
     by pressing the key and watching nothing happen. */
  await t.test("a command runs the checker it names", async () => {
    /** @type {{ tabId: number, files: string[] }[]} */
    const injected = [];

    /** @type {any} */
    let onCommand;

    const chrome = {
      commands: {
        onCommand: {
          addListener: (/** @type {any} */ fn) => {
            onCommand = fn;
          },
        },
      },
      runtime: { getManifest: () => ({ version: "0.0.0" }) },
      tabs: { query: async () => [{ id: 7 }], TAB_ID_NONE: -1 },
      scripting: {
        executeScript: async (/** @type {any} */ options) => {
          if (options.files) {
            injected.push({ tabId: options.target.tabId, files: options.files });
          }
          return [{ result: false }];
        },
        insertCSS: async () => {},
      },
    };

    const sandbox = /** @type {any} */ ({ chrome });
    sandbox.globalThis = sandbox;
    sandbox.importScripts = () => {
      const source = fs.readFileSync(path.join(code, "checkers.js"), "utf8");
      new Function("globalThis", "chrome", source)(sandbox, chrome);
    };

    const background = fs.readFileSync(path.join(code, "background.js"), "utf8");
    new Function("globalThis", "chrome", "importScripts", background)(
      sandbox,
      chrome,
      sandbox.importScripts
    );

    assert.ok(onCommand, "background.js registered no command listener");

    await onCommand("alt-check");

    assert.strictEqual(injected.length, 1);
    assert.strictEqual(injected[0].tabId, 7);
    assert.deepStrictEqual(injected[0].files, [
      "js/i18n.js",
      "js/panel.js",
      "js/altCheck.js",
    ]);

    /* An unknown command must be ignored rather than throw. */
    await onCommand("no-such-command");
    assert.strictEqual(injected.length, 1);
  });

  await t.test("locales carry the same keys", () => {
    const en = readJson("code", "_locales", "en", "messages.json");
    const ja = readJson("code", "_locales", "ja", "messages.json");

    assert.deepStrictEqual(Object.keys(en).sort(), Object.keys(ja).sort());
  });

  await t.test("every message the manifest names exists", () => {
    const en = readJson("code", "_locales", "en", "messages.json");
    const referenced = [
      ...JSON.stringify(manifest).matchAll(/__MSG_(\w+)__/g),
    ].map((m) => m[1]);

    assert.ok(referenced.length > 0, "expected the manifest to be localised");

    for (const key of referenced) {
      assert.ok(en[key], `manifest references __MSG_${key}__, which is not defined`);
    }
  });

  await t.test("every message the source looks up exists", () => {
    const en = readJson("code", "_locales", "en", "messages.json");
    const sources = fs
      .readdirSync(path.join(code, "js"))
      .filter((name) => name.endsWith(".js"))
      .map((name) => fs.readFileSync(path.join(code, "js", name), "utf8"))
      .join("\n");

    const keys = [...sources.matchAll(/kraftyMessage\(\s*"(\w+)"/g)].map(
      (m) => m[1]
    );

    assert.ok(keys.length > 0, "expected the checkers to look up messages");

    for (const key of new Set(keys)) {
      assert.ok(en[key], `kraftyMessage("${key}") has no entry`);
    }
  });
});
