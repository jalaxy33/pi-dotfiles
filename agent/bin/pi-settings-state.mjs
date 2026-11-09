// Move the fields listed in "ignoreFields" between settings.json and a side file.
// restore: put stored values back before pi starts, since pi reads them from settings.json.
// strip: take them out after pi exits, so the file stays clean when pi is not running.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

function readJson(path) {
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2), "utf8");
  renameSync(tmp, path);
}

function main() {
  const [mode, settingsPath, statePath] = process.argv.slice(2);
  if ((mode !== "restore" && mode !== "strip") || !settingsPath || !statePath) {
    throw new Error("usage: pi-settings-state.mjs <restore|strip> <settings> <state>");
  }
  const settings = readJson(settingsPath);
  if (!settings) return;
  const ignoreFields = Array.isArray(settings.ignoreFields) ? settings.ignoreFields : [];
  const state = readJson(statePath) ?? {};
  let settingsChanged = false;
  let stateChanged = false;

  for (const field of ignoreFields) {
    if (typeof field !== "string") continue;
    if (mode === "restore") {
      // Keep a value that is already in settings (for example after a crash).
      if (!(field in settings) && field in state) {
        settings[field] = state[field];
        settingsChanged = true;
      }
    } else if (field in settings) {
      state[field] = settings[field];
      delete settings[field];
      settingsChanged = true;
      stateChanged = true;
    }
  }

  if (settingsChanged) writeJson(settingsPath, settings);
  if (stateChanged) writeJson(statePath, state);
}

try {
  main();
} catch (error) {
  process.stderr.write(`pi settings state: ${error.message}\n`);
}
