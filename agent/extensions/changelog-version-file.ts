import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { patchSettingsCopies } from "./shared/patch-settings.ts";

// Pi stores the last shown changelog version in settings.json, so the file
// changes on every update. Keep the behaviour, but keep the version in a
// separate file: settings.json stays untouched and the changelog still shows
// once after each update.

function stateFile(): string {
	return join(getAgentDir(), ".changelog-version");
}

function readVersion(): string | undefined {
	try {
		const value = readFileSync(stateFile(), "utf8").trim();
		return value.length > 0 ? value : undefined;
	} catch {
		return undefined;
	}
}

function writeVersion(version: string): void {
	try {
		writeFileSync(stateFile(), `${version}\n`);
	} catch {
		// read-only home: behave like a fresh install
	}
}

// Take over the version Pi already recorded, then drop it from settings.json.
function migrateFromSettings(): void {
	if (existsSync(stateFile())) return;
	const settingsPath = join(getAgentDir(), "settings.json");
	try {
		const settings = JSON.parse(readFileSync(settingsPath, "utf8").replace(/^\uFEFF/, ""));
		if (typeof settings.lastChangelogVersion !== "string") return;
		writeVersion(settings.lastChangelogVersion);
		delete settings.lastChangelogVersion;
		writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
	} catch {
		// no settings file or bad JSON: nothing to migrate
	}
}

function patchSettingsManager(mod: any): boolean {
	const manager = mod?.SettingsManager;
	if (typeof manager?.prototype?.setLastChangelogVersion !== "function") return false;
	manager.prototype.getLastChangelogVersion = () => readVersion();
	manager.prototype.setLastChangelogVersion = (version: string) => writeVersion(version);
	return true;
}

export default function (pi: ExtensionAPI) {
	migrateFromSettings();
	if (patchSettingsCopies(patchSettingsManager) > 0) return;
	pi.on("session_start", (_event, ctx) => {
		ctx.ui.notify("changelog-version-file: could not patch Pi, settings.json keeps lastChangelogVersion.", "warning");
	});
}
