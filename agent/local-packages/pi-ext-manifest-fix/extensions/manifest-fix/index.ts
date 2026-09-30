/**
 * pi-ext-manifest-fix: rewrites installed extension manifests that pi warns about.
 *
 * Pi supplies some packages to extensions (pi-ai, pi-agent-core, pi-coding-agent,
 * pi-tui, typebox) and maps those specifiers to the host copies. A package that
 * declares them in `dependencies` makes pi warn, because npm may install a second
 * physical copy; the documented fix is `peerDependencies: "*"`.
 *
 * Only the managed npm root is touched: those files come from registries, so
 * rewriting them is safe. Hand-written packages under local-packages/ are left alone.
 *
 * Pi collects these warnings before extensions load, so a manifest that was just
 * (re)installed still warns once; the rewrite takes effect from the next startup.
 */
import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Same names pi uses in HOST_PROVIDED_EXTENSION_PACKAGES
// (dist/core/resource-loader.js). Keep in sync if pi adds more; a name missing
// here only means a warning is left alone, never that a wrong one is moved.
const HOST_PACKAGES = new Set([
	"@earendil-works/pi-agent-core",
	"@earendil-works/pi-ai",
	"@earendil-works/pi-coding-agent",
	"@earendil-works/pi-tui",
	"@mariozechner/pi-agent-core",
	"@mariozechner/pi-ai",
	"@mariozechner/pi-coding-agent",
	"@mariozechner/pi-tui",
	"typebox",
	"@sinclair/typebox",
]);

function packageDirs(root: string): string[] {
	if (!existsSync(root)) return [];
	const dirs: string[] = [];
	for (const entry of readdirSync(root, { withFileTypes: true })) {
		if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
		if (entry.name.startsWith("@")) {
			const scopeDir = join(root, entry.name);
			for (const scoped of readdirSync(scopeDir, { withFileTypes: true })) {
				if (scoped.isDirectory()) dirs.push(join(scopeDir, scoped.name));
			}
			continue;
		}
		dirs.push(join(root, entry.name));
	}
	return dirs;
}

function fixManifest(packageDir: string): void {
	const manifestPath = join(packageDir, "package.json");
	if (!existsSync(manifestPath)) return;

	const raw = readFileSync(manifestPath, "utf8");
	let manifest: any;
	try {
		manifest = JSON.parse(raw);
	} catch {
		return;
	}

	// Only extension packages are checked by pi, so only those are in scope here.
	const isExtensionPackage =
		Array.isArray(manifest.pi?.extensions) || existsSync(join(packageDir, "extensions"));
	if (!isExtensionPackage) return;

	const dependencies = manifest.dependencies;
	if (!dependencies || typeof dependencies !== "object") return;

	const moved = Object.keys(dependencies).filter((name) => HOST_PACKAGES.has(name));
	if (moved.length === 0) return;

	const peerDependencies = { ...(manifest.peerDependencies ?? {}) };
	for (const name of moved) {
		peerDependencies[name] = "*";
		delete dependencies[name];
	}

	const next: any = { ...manifest, peerDependencies };
	if (Object.keys(dependencies).length === 0) delete next.dependencies;

	// Keep the file's own indentation; write via rename so an interrupt cannot
	// leave a half-written manifest behind.
	const indent = raw.includes("\n\t") ? "\t" : "  ";
	const text = `${JSON.stringify(next, null, indent)}${raw.endsWith("\n") ? "\n" : ""}`;
	const tempPath = `${manifestPath}.pi-fix.tmp`;
	writeFileSync(tempPath, text);
	renameSync(tempPath, manifestPath);
}

/**
 * Runs during extension load, so the next startup's manifest check passes.
 * Failures are ignored: a manifest that cannot be rewritten just keeps its warning.
 */
export default function (_pi: ExtensionAPI) {
	for (const packageDir of packageDirs(join(getAgentDir(), "npm", "node_modules"))) {
		try {
			fixManifest(packageDir);
		} catch {
			// Leave it as it is.
		}
	}
}
