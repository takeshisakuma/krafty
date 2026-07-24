// @ts-check

/* Builds the ZIP that gets uploaded to the Chrome Web Store.
   manifest.json is at the root of the archive, because the store rejects
   packages where it is nested inside a folder. */

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const source = path.join(root, "code");
const dist = path.join(root, "dist");
const staging = path.join(dist, "krafty");

const manifest = JSON.parse(
  fs.readFileSync(path.join(source, "manifest.json"), "utf8")
);
const archive = path.join(dist, `krafty-${manifest.version}.zip`);

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(staging, { recursive: true });

/* content.scss / panel.scss are build inputs. panel.css is embedded into
   js/panelCss.js and is not loaded on its own. */
fs.cpSync(source, staging, {
  recursive: true,
  filter: (entry) => {
    const ext = path.extname(entry);
    const base = path.basename(entry);
    return ext !== ".scss" && base !== "panel.css";
  },
});

if (!fs.existsSync(path.join(staging, "content.css"))) {
  throw new Error("code/content.css is missing - run `npm run build` first.");
}

if (!fs.existsSync(path.join(staging, "js", "panelCss.js"))) {
  throw new Error("code/js/panelCss.js is missing - run `npm run build` first.");
}

if (process.platform === "win32") {
  /** @param {string} value */
  const quote = (value) => `'${value.replace(/'/g, "''")}'`;

  execFileSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `Compress-Archive -Path ${quote(
        path.join(staging, "*")
      )} -DestinationPath ${quote(archive)} -Force`,
    ],
    { stdio: "inherit" }
  );
} else {
  execFileSync("zip", ["-r", "-q", archive, "."], {
    cwd: staging,
    stdio: "inherit",
  });
}

console.log(`Packaged ${path.relative(root, archive)}`);
