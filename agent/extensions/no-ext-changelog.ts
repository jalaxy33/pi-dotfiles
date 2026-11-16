import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { getPackageDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Pi records package changelog versions in settings.json and shows
// "Extension Updates" on startup. Neither is configurable, so turn the
// bookkeeping methods of the running SettingsManager into no-ops.

function patchSettingsManager(mod: any): boolean {
	const manager = mod?.SettingsManager;
	if (typeof manager?.prototype?.setExtensionChangelogVersion !== "function") return false;
	manager.prototype.setExtensionChangelogVersion = () => {};
	manager.prototype.getExtensionChangelogVersion = () => undefined;
	return true;
}

// Pi may run from the bundled chunks or from plain dist modules.
// Load the copy this process already uses so the prototype patch applies.
function patchLoadedCopies(): number {
	const packageDir = getPackageDir();
	const requireCopy = createRequire(join(packageDir, "package.json"));
	const files: string[] = [];

	const chunksDir = join(packageDir, "dist", "bundle", "chunks");
	if (existsSync(chunksDir)) {
		for (const name of readdirSync(chunksDir)) {
			if (!name.endsWith(".js")) continue;
			const file = join(chunksDir, name);
			if (/export\{[^}]*\bSettingsManager\b/.test(readFileSync(file, "utf8"))) files.push(file);
		}
	}
	const coreFile = join(packageDir, "dist", "core", "settings-manager.js");
	if (existsSync(coreFile)) files.push(coreFile);

	let patched = 0;
	for (const file of files) {
		try {
			if (patchSettingsManager(requireCopy(file))) patched++;
		} catch {
			// not the copy this process loaded
		}
	}
	return patched;
}

export default function (pi: ExtensionAPI) {
	if (patchLoadedCopies() > 0) return;
	pi.on("session_start", (_event, ctx) => {
		ctx.ui.notify("no-ext-changelog: could not patch Pi, extension changelogs stay enabled.", "warning");
	});
}
