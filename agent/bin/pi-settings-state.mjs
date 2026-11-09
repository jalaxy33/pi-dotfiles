// Move the fields listed in "ignoreFields" between settings.json and a side file.
// restore: put stored values back before pi starts, since pi reads them from settings.json.
// strip: take them out again, so the file stays clean while pi is not using them.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

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

function move(mode, settingsPath, statePath) {
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

function moveSafely(mode, settingsPath, statePath) {
  try {
    move(mode, settingsPath, statePath);
  } catch (error) {
    process.stderr.write(`pi settings state: ${error.message}\n`);
  }
}

export function restoreSettings(settingsPath, statePath) {
  moveSafely("restore", settingsPath, statePath);
}

export function stripSettings(settingsPath, statePath) {
  moveSafely("strip", settingsPath, statePath);
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (invokedDirectly) {
  const [mode, settingsPath, statePath] = process.argv.slice(2);
  if ((mode !== "restore" && mode !== "strip") || !settingsPath || !statePath) {
    process.stderr.write("usage: pi-settings-state.mjs <restore|strip> <settings.json> <state.json>\n");
  } else {
    moveSafely(mode, settingsPath, statePath);
  }
}
