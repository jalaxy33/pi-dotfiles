import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const mod = await import("../tool-policy.ts");

let tools = [];
let active = [];
let notices = [];
const handlers = {};
const pi = {
	getAllTools: () => tools,
	getActiveTools: () => active,
	setActiveTools: (value) => {
		active = value;
	},
	on: (event, fn) => {
		(handlers[event] ??= []).push(fn);
		return () => {};
	},
	registerTool() {},
	registerCommand() {},
	registerShortcut() {},
	appendEntry() {},
};
await mod.default(pi);

const ctx = (hasUI) => ({ hasUI, ui: { notify: (message) => notices.push(message) } });

function setup({ settings, projectSettings, policy, projectPolicy, packages = [] }) {
	const root = mkdtempSync(join(tmpdir(), "policy-test-"));
	const agentDir = join(root, "agent");
	const projectDir = join(root, "project");
	mkdirSync(agentDir, { recursive: true });
	mkdirSync(join(projectDir, ".pi"), { recursive: true });
	if (settings) writeFileSync(join(agentDir, "settings.json"), JSON.stringify(settings));
	if (policy) writeFileSync(join(agentDir, "tool-policy.json"), JSON.stringify(policy));
	if (projectSettings) writeFileSync(join(projectDir, ".pi", "settings.json"), JSON.stringify(projectSettings));
	if (projectPolicy) writeFileSync(join(projectDir, ".pi", "tool-policy.json"), JSON.stringify(projectPolicy));
	for (const { path, name } of packages) {
		mkdirSync(path, { recursive: true });
		writeFileSync(join(path, "package.json"), JSON.stringify({ name }));
		writeFileSync(join(path, "index.ts"), "export default () => {};\n");
	}
	process.env.PI_CODING_AGENT_DIR = agentDir;
	process.chdir(projectDir);
	tools = [];
	active = [];
	notices = [];
	return { root, agentDir, projectDir };
}

function run(hasUI = true, event = "session_start") {
	for (const fn of handlers[event] ?? []) fn({}, ctx(hasUI));
	return { active: [...active], notices: [...notices] };
}

const empty = { packages: [] };
let failures = 0;
function check(name, fn) {
	try {
		fn();
		console.log(`PASS  ${name}`);
	} catch (error) {
		failures++;
		console.log(`FAIL  ${name}\n      ${error.message.split("\n")[0]}`);
	}
}

// 1. npm key, tool under node_modules
check("npm key hides a tool under node_modules", () => {
	const root = mkdtempSync(join(tmpdir(), "policy-x-"));
	setup({ settings: { packages: ["npm:alpha"] }, policy: { packages: { "npm:alpha": { disable: ["alpha_tool"] } } } });
	const install = join(process.env.PI_CODING_AGENT_DIR, "npm", "node_modules", "alpha");
	mkdirSync(install, { recursive: true });
	tools = [{ name: "alpha_tool", sourceInfo: { path: join(install, "index.ts") } }, { name: "keep", sourceInfo: { path: join(install, "index.ts") } }];
	active = ["alpha_tool", "keep"];
	const result = run();
	assert.deepEqual(result.active, ["keep"]);
	assert.deepEqual(result.notices, []);
	rmSync(root, { recursive: true, force: true });
});

// 2. npm key where the path is outside node_modules (store layout): package.json name decides
check("npm key matches by package.json name outside node_modules", () => {
	const root = mkdtempSync(join(tmpdir(), "policy-x-"));
	const store = join(root, "store", "alpha@1.0.0");
	mkdirSync(store, { recursive: true });
	writeFileSync(join(store, "package.json"), JSON.stringify({ name: "alpha" }));
	writeFileSync(join(store, "index.ts"), "");
	setup({ settings: { packages: ["npm:alpha"] }, policy: { packages: { "npm:alpha": { disable: ["alpha_tool"] } } } });
	tools = [{ name: "alpha_tool", sourceInfo: { path: join(store, "index.ts") } }];
	active = ["alpha_tool"];
	assert.deepEqual(run().active, []);
	rmSync(root, { recursive: true, force: true });
});

// 3. tool owned by another package
check("reports a tool owned by another package", () => {
	const root = mkdtempSync(join(tmpdir(), "policy-x-"));
	const other = join(root, "store", "beta");
	mkdirSync(other, { recursive: true });
	writeFileSync(join(other, "package.json"), JSON.stringify({ name: "beta" }));
	writeFileSync(join(other, "index.ts"), "");
	setup({ settings: { packages: ["npm:alpha", "npm:beta"] }, policy: { packages: { "npm:alpha": { disable: ["beta_tool"] } } } });
	tools = [{ name: "beta_tool", sourceInfo: { path: join(other, "index.ts") } }];
	active = ["beta_tool"];
	const result = run();
	assert.deepEqual(result.active, ["beta_tool"]);
	assert.match(result.notices.join("\n"), /"beta_tool" is registered by/);
	rmSync(root, { recursive: true, force: true });
});

// 4. object form in settings
check("accepts the object form of a package entry", () => {
	setup({ settings: { packages: [{ source: "npm:alpha" }] }, policy: { packages: { "npm:alpha": { disable: ["alpha_tool"] } } } });
	const install = join(process.env.PI_CODING_AGENT_DIR, "npm", "node_modules", "alpha");
	mkdirSync(install, { recursive: true });
	tools = [{ name: "alpha_tool", sourceInfo: { path: join(install, "index.ts") } }];
	active = ["alpha_tool"];
	const result = run();
	assert.deepEqual(result.active, []);
	assert.deepEqual(result.notices, []);
});

// 5. local path key, settings has a trailing slash
check("local path key ignores a trailing slash", () => {
	const root = mkdtempSync(join(tmpdir(), "policy-x-"));
	const pkg = join(root, "local-pkg");
	mkdirSync(pkg, { recursive: true });
	writeFileSync(join(pkg, "package.json"), JSON.stringify({ name: "local-pkg" }));
	writeFileSync(join(pkg, "index.ts"), "");
	setup({ settings: { packages: [`${pkg}/`] }, policy: { packages: { [pkg]: { disable: ["local_tool"] } } } });
	tools = [{ name: "local_tool", sourceInfo: { path: join(pkg, "index.ts") } }];
	active = ["local_tool"];
	assert.deepEqual(run().active, []);
	rmSync(root, { recursive: true, force: true });
});

// 6. relative local path resolves against the settings file directory
check("relative local path resolves from the settings directory", () => {
	setup({ settings: { packages: ["./ext"] }, policy: { packages: { "./ext": { disable: ["rel_tool"] } } } });
	const dir = join(process.env.PI_CODING_AGENT_DIR, "ext");
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "ext" }));
	tools = [{ name: "rel_tool", sourceInfo: { path: join(dir, "index.ts") } }];
	active = ["rel_tool"];
	assert.deepEqual(run().active, []);
});

// 7. scoped npm package
check("scoped npm key hides its tool", () => {
	setup({ settings: { packages: ["npm:@scope/alpha"] }, policy: { packages: { "npm:@scope/alpha": { disable: ["scoped_tool"] } } } });
	const dir = join(process.env.PI_CODING_AGENT_DIR, "npm", "node_modules", "@scope", "alpha");
	mkdirSync(dir, { recursive: true });
	tools = [{ name: "scoped_tool", sourceInfo: { path: join(dir, "index.ts") } }];
	active = ["scoped_tool"];
	assert.deepEqual(run().active, []);
});

// 8. versioned spec does not match an unversioned settings entry
check("reports a versioned key that settings does not declare", () => {
	setup({ settings: { packages: ["npm:alpha"] }, policy: { packages: { "npm:alpha@1.2.3": { disable: ["alpha_tool"] } } } });
	const dir = join(process.env.PI_CODING_AGENT_DIR, "npm", "node_modules", "alpha");
	mkdirSync(dir, { recursive: true });
	tools = [{ name: "alpha_tool", sourceInfo: { path: join(dir, "index.ts") } }];
	active = ["alpha_tool"];
	const result = run();
	assert.deepEqual(result.active, ["alpha_tool"]);
	assert.match(result.notices.join("\n"), /not a package in settings\.json/);
});

// 9. unknown when value
check("reports an unknown when value and applies the rule", () => {
	setup({ settings: { packages: ["npm:alpha"] }, policy: { packages: { "npm:alpha": { disable: ["alpha_tool"], when: "sometimes" } } } });
	const dir = join(process.env.PI_CODING_AGENT_DIR, "npm", "node_modules", "alpha");
	mkdirSync(dir, { recursive: true });
	tools = [{ name: "alpha_tool", sourceInfo: { path: join(dir, "index.ts") } }];
	active = ["alpha_tool"];
	const result = run();
	assert.deepEqual(result.active, []);
	assert.match(result.notices.join("\n"), /has no valid "when"/);
});

// 10. when: interactive
check("when interactive hides only in an interactive session", () => {
	setup({ settings: { packages: ["npm:alpha"] }, policy: { packages: { "npm:alpha": { disable: ["alpha_tool"], when: "interactive" } } } });
	const dir = join(process.env.PI_CODING_AGENT_DIR, "npm", "node_modules", "alpha");
	mkdirSync(dir, { recursive: true });
	tools = [{ name: "alpha_tool", sourceInfo: { path: join(dir, "index.ts") } }];
	active = ["alpha_tool"];
	assert.deepEqual(run(false).active, ["alpha_tool"]);
	active = ["alpha_tool"];
	assert.deepEqual(run(true).active, []);
});

// 11. when: headless
check("when headless hides only in a headless session", () => {
	setup({ settings: { packages: ["npm:alpha"] }, policy: { packages: { "npm:alpha": { disable: ["alpha_tool"], when: "headless" } } } });
	const dir = join(process.env.PI_CODING_AGENT_DIR, "npm", "node_modules", "alpha");
	mkdirSync(dir, { recursive: true });
	tools = [{ name: "alpha_tool", sourceInfo: { path: join(dir, "index.ts") } }];
	active = ["alpha_tool"];
	assert.deepEqual(run(true).active, ["alpha_tool"]);
	active = ["alpha_tool"];
	assert.deepEqual(run(false).active, []);
});

// 12. project file clears a global rule
check("a project rule with an empty list clears the global rule", () => {
	setup({
		settings: { packages: ["npm:alpha"] },
		policy: { packages: { "npm:alpha": { disable: ["alpha_tool"] } } },
		projectPolicy: { packages: { "npm:alpha": { disable: [] } } },
	});
	const dir = join(process.env.PI_CODING_AGENT_DIR, "npm", "node_modules", "alpha");
	mkdirSync(dir, { recursive: true });
	tools = [{ name: "alpha_tool", sourceInfo: { path: join(dir, "index.ts") } }];
	active = ["alpha_tool"];
	const result = run();
	assert.deepEqual(result.active, ["alpha_tool"]);
	assert.deepEqual(result.notices, []);
});

// 13. broken policy file still lets a valid one through
check("an unreadable policy file is reported and skipped", () => {
	const { agentDir } = setup({ settings: { packages: ["npm:alpha"] } });
	writeFileSync(join(agentDir, "tool-policy.json"), "{ nope");
	const dir = join(agentDir, "npm", "node_modules", "alpha");
	mkdirSync(dir, { recursive: true });
	tools = [{ name: "alpha_tool", sourceInfo: { path: join(dir, "index.ts") } }];
	active = ["alpha_tool"];
	const result = run();
	assert.deepEqual(result.active, ["alpha_tool"]);
	assert.match(result.notices.join("\n"), /tool-policy\.json: /);
});

// 14. non-string entries
check("non-string disable entries are dropped with a report", () => {
	setup({ settings: { packages: ["npm:alpha"] }, policy: { packages: { "npm:alpha": { disable: ["alpha_tool", 5] } } } });
	const dir = join(process.env.PI_CODING_AGENT_DIR, "npm", "node_modules", "alpha");
	mkdirSync(dir, { recursive: true });
	tools = [{ name: "alpha_tool", sourceInfo: { path: join(dir, "index.ts") } }];
	active = ["alpha_tool"];
	const result = run();
	assert.deepEqual(result.active, []);
	assert.match(result.notices.join("\n"), /drops non-string entries/);
});

// 15. built-in tool named in a package rule
check("refuses to hide a built-in tool through a package rule", () => {
	setup({ settings: { packages: ["npm:alpha"] }, policy: { packages: { "npm:alpha": { disable: ["read"] } } } });
	const dir = join(process.env.PI_CODING_AGENT_DIR, "npm", "node_modules", "alpha");
	mkdirSync(dir, { recursive: true });
	tools = [{ name: "read", sourceInfo: { path: "builtin:read" } }];
	active = ["read"];
	const result = run();
	assert.deepEqual(result.active, ["read"]);
	assert.match(result.notices.join("\n"), /"read" is registered by builtin:read/);
});

// 16. package declared only in project settings
check("accepts a package declared only in project settings", () => {
	setup({
		settings: empty,
		projectSettings: { packages: ["npm:alpha"] },
		policy: { packages: { "npm:alpha": { disable: ["alpha_tool"] } } },
	});
	const dir = join(process.env.PI_CODING_AGENT_DIR, "npm", "node_modules", "alpha");
	mkdirSync(dir, { recursive: true });
	tools = [{ name: "alpha_tool", sourceInfo: { path: join(dir, "index.ts") } }];
	active = ["alpha_tool"];
	assert.deepEqual(run().active, []);
});

// 17. a tool registered after session_start is caught by the next pass
check("hides a tool that registers after session_start", () => {
	setup({ settings: { packages: ["npm:alpha"] }, policy: { packages: { "npm:alpha": { disable: ["late_tool"] } } } });
	const dir = join(process.env.PI_CODING_AGENT_DIR, "npm", "node_modules", "alpha");
	mkdirSync(dir, { recursive: true });
	active = ["keep"];
	assert.deepEqual(run().active, ["keep"]);
	tools = [{ name: "late_tool", sourceInfo: { path: join(dir, "index.ts") } }];
	active = ["keep", "late_tool"];
	assert.deepEqual(run(true, "before_agent_start").active, ["keep"]);
});

// 18. no policy file at all
check("does nothing without a policy file", () => {
	setup({ settings: { packages: ["npm:alpha"] } });
	const dir = join(process.env.PI_CODING_AGENT_DIR, "npm", "node_modules", "alpha");
	mkdirSync(dir, { recursive: true });
	tools = [{ name: "alpha_tool", sourceInfo: { path: join(dir, "index.ts") } }];
	active = ["alpha_tool"];
	const result = run();
	assert.deepEqual(result.active, ["alpha_tool"]);
	assert.deepEqual(result.notices, []);
});

// 19. the configuration installed on this machine, when it is there
check("the installed configuration hides preview_export only when interactive", () => {
	const agentDir = join(homedir(), ".pi", "agent");
	const installed = join(agentDir, "npm", "node_modules", "pi-markdown-preview", "index.ts");
	if (!existsSync(join(agentDir, "tool-policy.json")) || !existsSync(installed)) {
		throw new Error("skipped: no local tool-policy.json or pi-markdown-preview install");
	}
	process.env.PI_CODING_AGENT_DIR = agentDir;
	process.chdir(tmpdir());
	tools = [{ name: "preview_export", sourceInfo: { path: installed } }];
	notices = [];
	active = ["preview_export"];
	assert.deepEqual(run(true).active, []);
	active = ["preview_export"];
	notices = [];
	assert.deepEqual(run(false).active, ["preview_export"]);
	assert.deepEqual(notices, []);
});

// 20. missing tool name
check("reports a tool name that no package provides", () => {
	setup({ settings: { packages: ["npm:alpha"] }, policy: { packages: { "npm:alpha": { disable: ["ghost_tool"] } } } });
	const dir = join(process.env.PI_CODING_AGENT_DIR, "npm", "node_modules", "alpha");
	mkdirSync(dir, { recursive: true });
	tools = [{ name: "alpha_tool", sourceInfo: { path: join(dir, "index.ts") } }];
	active = ["alpha_tool"];
	const result = run();
	assert.deepEqual(result.active, ["alpha_tool"]);
	assert.match(result.notices.join("\n"), /no tool named "ghost_tool"/);
});

// 21. home-relative local package
check("resolves a home-relative local package", () => {
	const home = process.env.HOME;
	const pkg = join(home, ".policy-test-pkg-" + process.pid);
	mkdirSync(join(pkg, "sub"), { recursive: true });
	writeFileSync(join(pkg, "package.json"), JSON.stringify({ name: "home-pkg" }));
	setup({ settings: { packages: ["~/" + pkg.slice(home.length + 1)] }, policy: { packages: { ["~/" + pkg.slice(home.length + 1)]: { disable: ["home_tool"] } } } });
	tools = [{ name: "home_tool", sourceInfo: { path: join(pkg, "sub", "index.ts") } }];
	active = ["home_tool"];
	const result = run();
	assert.deepEqual(result.active, []);
	assert.deepEqual(result.notices, []);
	rmSync(pkg, { recursive: true, force: true });
});

console.log(failures === 0 ? "\nall cases passed" : `\n${failures} case(s) failed`);
process.exit(failures === 0 ? 0 : 1);
