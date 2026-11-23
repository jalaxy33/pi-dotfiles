import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { patchSettingsCopies } from "./shared/patch-settings.ts";

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

export default function (pi: ExtensionAPI) {
	if (patchSettingsCopies(patchSettingsManager) > 0) return;
	pi.on("session_start", (_event, ctx) => {
		ctx.ui.notify("no-ext-changelog: could not patch Pi, extension changelogs stay enabled.", "warning");
	});
}
