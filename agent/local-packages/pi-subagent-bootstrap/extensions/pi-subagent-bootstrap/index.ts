import { pathToFileURL } from "node:url";
import { getAgentDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { syncUpstream } from "../../src/sync.ts";

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

async function loadUpstream(pi: ExtensionAPI, entry: string): Promise<void> {
	const module = (await import(/* @vite-ignore */ pathToFileURL(entry).href)) as {
		default?: (pi: ExtensionAPI) => void | Promise<void>;
	};
	if (typeof module.default !== "function") {
		throw new Error(`${entry} does not export a default extension function`);
	}
	await module.default(pi);
}

export default async function piSubagentBootstrap(pi: ExtensionAPI): Promise<void> {
	try {
		const result = await syncUpstream({ agentDir: getAgentDir() });
		if (result.warning) console.warn(`[pi-subagent] ${result.warning}`);
		await loadUpstream(pi, result.entry);
	} catch (error) {
		const message = messageOf(error);
		console.error(`[pi-subagent] ${message}`);
		pi.on("session_start", (_event, ctx) => {
			ctx.ui.notify(`pi-subagent unavailable: ${message}. Restart pi to retry.`, "warning");
		});
	}
}
