import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import { getAgentDir, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";

// Machine-level tool policy: keep the tools of an installed package out of the model's
// prompt without uninstalling it. Rules live in tool-policy.json next to Pi's own config,
// not in settings.json, because they are this machine's preferences and not Pi's or the
// package's. A rule is keyed by the exact package source from settings.json, and one that
// names a package or tool that no longer exists is reported instead of silently doing
// nothing the way `defaultTools: ["-name"]` does.

interface Rule {
	disable: string[];
	when?: "always" | "interactive" | "headless";
}

interface PolicyFile {
	packages?: Record<string, Rule>;
}

interface SettingsFile {
	packages?: Array<string | { source?: unknown }>;
}

const POLICY_FILE = "tool-policy.json";
const SETTINGS_FILE = "settings.json";

// Global first, then the project file; later entries win for the same package.
function configPaths(): string[] {
	return [getAgentDir(), join(process.cwd(), ".pi")];
}

function readJson(path: string, problems: string[]): unknown {
	if (!existsSync(path)) return undefined;
	try {
		return JSON.parse(readFileSync(path, "utf-8"));
	} catch (error) {
		problems.push(`${path}: ${error instanceof Error ? error.message : String(error)}`);
		return undefined;
	}
}

// Package source → the directory a relative local source resolves against.
function readPackages(): { packages: Map<string, string>; problems: string[] } {
	const packages = new Map<string, string>();
	const problems: string[] = [];
	for (const dir of configPaths()) {
		const settingsPath = join(dir, SETTINGS_FILE);
		const parsed = readJson(settingsPath, problems) as SettingsFile | undefined;
		for (const entry of parsed?.packages ?? []) {
			const source = typeof entry === "string" ? entry : typeof entry?.source === "string" ? entry.source : undefined;
			if (source) packages.set(trimSlash(source), dirname(settingsPath));
		}
	}
	return { packages, problems };
}

function readRules(): { rules: Record<string, Rule>; problems: string[] } {
	const rules: Record<string, Rule> = {};
	const problems: string[] = [];
	for (const dir of configPaths()) {
		const path = join(dir, POLICY_FILE);
		const parsed = readJson(path, problems) as PolicyFile | undefined;
		if (!parsed) continue;
		for (const [source, rule] of Object.entries(parsed.packages ?? {})) {
			// An empty list is a valid rule: it clears a global entry from a project file.
			if (!Array.isArray(rule?.disable)) {
				problems.push(`${path}: "${source}" has no "disable" list`);
				continue;
			}
			const disable = rule.disable.filter((name) => typeof name === "string");
			if (disable.length !== rule.disable.length) {
				problems.push(`${path}: "${source}" drops non-string entries from "disable"`);
			}
			rules[trimSlash(source)] = { disable, when: rule.when };
		}
	}
	return { rules, problems };
}

function npmName(source: string): string {
	const spec = source.slice("npm:".length);
	const at = spec.lastIndexOf("@");
	return at > 0 ? spec.slice(0, at) : spec;
}

function trimSlash(path: string): string {
	return path.length > 1 && path.endsWith(sep) ? path.slice(0, -sep.length) : path;
}

// npm and git packages install under a node_modules directory named after the package;
// local sources are declared by path, relative to the settings file that holds them.
function sourceOwnsTool(source: string, baseDir: string, toolPath: string): boolean {
	if (!toolPath) return false;
	if (source.startsWith("npm:")) {
		return toolPath.includes(`${sep}node_modules${sep}${npmName(source)}${sep}`);
	}
	if (source.startsWith("git:") || /^https?:\/\//.test(source)) {
		const repo = source.replace(/^(git:|https?:\/\/)/, "").replace(/^github\.com\//, "").replace(/@[^/]*$/, "");
		const candidates = [repo, repo.split("/").slice(-2).join("/"), repo.split("/").pop() ?? ""];
		return candidates.some((name) => name.length > 0 && toolPath.includes(`${sep}node_modules${sep}${name}${sep}`));
	}
	const dir = trimSlash(isAbsolute(source) ? source : resolve(baseDir, source));
	return toolPath === dir || toolPath.startsWith(dir + sep);
}

function appliesToSession(rule: Rule, hasUI: boolean): boolean {
	if (rule.when === "interactive") return hasUI;
	if (rule.when === "headless") return !hasUI;
	return true;
}

// Returns the problems worth telling the user about once per session.
function applyPolicy(pi: ExtensionAPI, hasUI: boolean): string[] {
	const rules = readRules();
	const installed = readPackages();
	const problems = [...rules.problems, ...installed.problems];
	const tools = new Map(pi.getAllTools().map((tool) => [tool.name, tool]));
	const disable = new Set<string>();
	for (const [source, rule] of Object.entries(rules.rules)) {
		if (!appliesToSession(rule, hasUI)) continue;
		if (rule.disable.length === 0) continue;
		const baseDir = installed.packages.get(source);
		if (baseDir === undefined) {
			problems.push(`${source}: not a package in settings.json`);
			continue;
		}
		for (const name of rule.disable) {
			const tool = tools.get(name);
			if (!tool) {
				problems.push(`${source}: no tool named "${name}"`);
				continue;
			}
			const toolPath = tool.sourceInfo?.path ?? "";
			if (!sourceOwnsTool(source, baseDir, toolPath)) {
				problems.push(`${source}: "${name}" is registered by ${toolPath || "an unknown source"}`);
				continue;
			}
			disable.add(name);
		}
	}
	const active = pi.getActiveTools();
	const kept = active.filter((name) => !disable.has(name));
	if (kept.length !== active.length) pi.setActiveTools(kept);
	return problems;
}

export default function (pi: ExtensionAPI) {
	// agent_start repeats the pass because packages and MCP servers can register tools after
	// session_start; its problems are skipped there so a warning is not repeated every turn.
	const run = (ctx: ExtensionContext, warn: boolean) => {
		const problems = applyPolicy(pi, ctx.hasUI);
		if (warn && problems.length > 0 && ctx.hasUI) {
			ctx.ui.notify(`tool-policy:\n${problems.join("\n")}`, "warning");
		}
	};
	pi.on("session_start", (_event, ctx) => run(ctx, true));
	pi.on("session_tree", (_event, ctx) => run(ctx, true));
	pi.on("agent_start", (_event, ctx) => run(ctx, false));
}
