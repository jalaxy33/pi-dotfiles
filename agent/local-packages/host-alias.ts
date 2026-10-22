/**
 * pi-host-alias: makes pi's host packages resolvable from extension modules that
 * load unchanged.
 *
 * pi hands some packages to extensions instead of installing them beside the
 * extension, and applies that mapping while it transforms an extension module. A
 * plain .js/.mjs entry whose own imports all resolve is loaded as-is, so a
 * specifier it resolves later, such as a lazy `await import`, never sees the
 * mapping and fails with ERR_MODULE_NOT_FOUND.
 *
 * The hook below retries such a specifier beside pi's own files, where the host
 * packages actually live. It runs only after normal resolution fails, so a copy
 * installed next to the extension keeps winning.
 *
 * The file belongs in the agent extensions directory: pi loads that directory
 * before any configured package, and the hook has to exist before an affected
 * extension loads.
 */
import { realpathSync } from "node:fs";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

// Same names pi uses in HOST_PROVIDED_EXTENSION_PACKAGES
// (dist/core/resource-loader.js). Subpaths match as well, so `pi-ai/compat` and
// `typebox/compile` are covered too.
const HOST_PACKAGES = [
	"@earendil-works/pi-agent-core",
	"@earendil-works/pi-ai",
	"@earendil-works/pi-coding-agent",
	"@earendil-works/pi-tui",
	"@mariozechner/pi-agent-core",
	"@mariozechner/pi-ai",
	"@mariozechner/pi-coding-agent",
	"@mariozechner/pi-tui",
	"@sinclair/typebox",
	"typebox",
];

// Survives a second load, for example when pi reloads extensions.
const REGISTERED = Symbol.for("pi-host-alias.registered");

function isHostSpecifier(specifier: string): boolean {
	return HOST_PACKAGES.some((name) => specifier === name || specifier.startsWith(`${name}/`));
}

// pi's own files sit in the node_modules tree that holds the host packages.
function findAnchors(): string[] {
	const anchors: string[] = [];
	for (const candidate of [process.argv[1], process.execPath]) {
		if (!candidate) continue;
		try {
			const url = pathToFileURL(realpathSync(candidate)).href;
			if (!anchors.includes(url)) anchors.push(url);
		} catch {
			// Not a real file, nothing to anchor to.
		}
	}
	return anchors;
}

export default function hostAlias(): void {
	const state = globalThis as unknown as Record<symbol, boolean | undefined>;
	if (state[REGISTERED] || typeof registerHooks !== "function") return;

	const anchors = findAnchors();
	if (anchors.length === 0) {
		console.error(
			"[host-alias] pi's own files could not be located, so host packages stay " +
				"unresolvable for extensions that load unchanged.",
		);
		return;
	}

	state[REGISTERED] = true;
	registerHooks({
		resolve(specifier, context, nextResolve) {
			if (!isHostSpecifier(specifier)) return nextResolve(specifier, context);
			try {
				return nextResolve(specifier, context);
			} catch (error) {
				for (const parentURL of anchors) {
					try {
						return nextResolve(specifier, { ...context, parentURL });
					} catch {
						// Try the next anchor.
					}
				}
				throw error;
			}
		},
	});
}
