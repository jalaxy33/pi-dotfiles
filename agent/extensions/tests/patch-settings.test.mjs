import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const changelog = await import("../changelog-version-file.ts");
const noExt = await import("../no-ext-changelog.ts");
const shared = await import("../shared/patch-settings.ts");

const CORE = `class SettingsManager {
  setLastChangelogVersion() { throw new Error("core setLastChangelogVersion ran"); }
  getLastChangelogVersion() { return "core"; }
  setExtensionChangelogVersion() { throw new Error("core setExtensionChangelogVersion ran"); }
  getExtensionChangelogVersion() { return "core"; }
}
export{SettingsManager};
`;

const CORE_WITHOUT_EXTENSION = `class SettingsManager {
  setLastChangelogVersion() { throw new Error("core setLastChangelogVersion ran"); }
  getLastChangelogVersion() { return "core"; }
}
export{SettingsManager};
`;

let root;
function fixture({ settings, state, core, chunks = {}, readOnly = false }) {
	root = mkdtempSync(join(tmpdir(), "ext-robust-"));
	const agent = join(root, "agent");
	const pkg = join(root, "pkg");
	mkdirSync(agent, { recursive: true });
	mkdirSync(join(pkg, "dist", "core"), { recursive: true });
	writeFileSync(join(pkg, "package.json"), JSON.stringify({ name: "fake-pi", version: "0.0.0" }));
	if (settings !== undefined) writeFileSync(join(agent, "settings.json"), settings);
	if (state !== undefined) writeFileSync(join(agent, ".changelog-version"), state);
	if (core !== undefined) writeFileSync(join(pkg, "dist", "core", "settings-manager.js"), core);
	for (const [name, text] of Object.entries(chunks)) {
		mkdirSync(join(pkg, "dist", "bundle", "chunks"), { recursive: true });
		writeFileSync(join(pkg, "dist", "bundle", "chunks", name), text);
	}
	process.env.PI_CODING_AGENT_DIR = agent;
	process.env.PI_PACKAGE_DIR = pkg;
	if (readOnly) chmodSync(agent, 0o500);
	return { root, agent, pkg };
}

function stub() {
	const events = [];
	return {
		events,
		pi: { on: (event) => { events.push(event); return () => {}; }, registerTool() {}, registerCommand() {}, registerShortcut() {}, appendEntry() {} },
	};
}

function load(pkg, relative) {
	const requireFromPkg = createRequire(join(pkg, "package.json"));
	return requireFromPkg(join(pkg, relative));
}

function readState(agent) {
	return readFileSync(join(agent, ".changelog-version"), "utf8");
}

let failures = 0;
function check(name, fn) {
	try {
		fn();
		console.log(`PASS  ${name}`);
	} catch (error) {
		failures++;
		console.log(`FAIL  ${name}\n      ${String(error.message).split("\n")[0]}`);
	} finally {
		if (root) {
			try { chmodSync(join(root, "agent"), 0o700); } catch {}
			rmSync(root, { recursive: true, force: true });
			root = undefined;
		}
	}
}

check("migrates lastChangelogVersion out of settings.json", () => {
	const { agent } = fixture({
		settings: `${JSON.stringify({ theme: "dark", lastChangelogVersion: "0.1.0" }, null, 2)}\n`,
		core: CORE,
	});
	changelog.default(stub().pi);
	assert.equal(readState(agent), "0.1.0\n");
	const settings = JSON.parse(readFileSync(join(agent, "settings.json"), "utf8"));
	assert.deepEqual(settings, { theme: "dark" });
});

check("migration preserves a byte order mark free rewrite and rewrites only once", () => {
	const { agent } = fixture({ settings: `\uFEFF${JSON.stringify({ lastChangelogVersion: "0.2.0" })}`, core: CORE });
	changelog.default(stub().pi);
	assert.equal(readState(agent), "0.2.0\n");
	assert.ok(!readFileSync(join(agent, "settings.json"), "utf8").includes("lastChangelogVersion"));
	writeFileSync(join(agent, "settings.json"), JSON.stringify({ lastChangelogVersion: "9.9.9" }));
	changelog.default(stub().pi);
	assert.equal(readState(agent), "0.2.0\n", "an existing state file stops the migration");
});

check("does not migrate when a state file exists", () => {
	const { agent } = fixture({ settings: JSON.stringify({ lastChangelogVersion: "0.3.0" }), state: "0.1.0\n", core: CORE });
	changelog.default(stub().pi);
	assert.equal(readState(agent), "0.1.0\n");
	assert.ok(readFileSync(join(agent, "settings.json"), "utf8").includes("lastChangelogVersion"));
});

check("survives a settings file that is not JSON", () => {
	const { agent } = fixture({ settings: "{ broken", core: CORE });
	changelog.default(stub().pi);
	assert.throws(() => readState(agent), /ENOENT/);
	assert.equal(readFileSync(join(agent, "settings.json"), "utf8"), "{ broken");
});

check("ignores a non-string lastChangelogVersion", () => {
	const { agent } = fixture({ settings: JSON.stringify({ lastChangelogVersion: 5 }), core: CORE });
	changelog.default(stub().pi);
	assert.throws(() => readState(agent), /ENOENT/);
	assert.ok(readFileSync(join(agent, "settings.json"), "utf8").includes("lastChangelogVersion"));
});

check("patches the core module so the version lands in the state file", () => {
	const { agent, pkg } = fixture({ core: CORE, state: "0.1.0\n" });
	const { events, pi } = stub();
	changelog.default(pi);
	assert.deepEqual(events, [], "a successful patch registers no warning handler");
	const { SettingsManager } = load(pkg, "dist/core/settings-manager.js");
	const manager = new SettingsManager();
	assert.equal(manager.getLastChangelogVersion(), "0.1.0");
	manager.setLastChangelogVersion("0.4.0");
	assert.equal(readState(agent), "0.4.0\n");
});

check("patches a chunk that exports SettingsManager even without the core module", () => {
	const { agent, pkg } = fixture({ chunks: { "chunk-a.js": CORE }, state: "0.5.0\n" });
	const { events, pi } = stub();
	changelog.default(pi);
	assert.deepEqual(events, []);
	const { SettingsManager } = load(pkg, "dist/bundle/chunks/chunk-a.js");
	assert.equal(new SettingsManager().getLastChangelogVersion(), "0.5.0");
	writeFileSync(join(agent, ".changelog-version"), "0.6.0\n");
	assert.equal(new SettingsManager().getLastChangelogVersion(), "0.6.0");
});

check("ignores a chunk that does not export SettingsManager", () => {
	const { pkg } = fixture({
		chunks: { "chunk-b.js": "class SomethingElse { setLastChangelogVersion() { throw new Error('unpatched'); } }\nexport{SomethingElse};\n" },
		state: "0.1.0\n",
	});
	const { events, pi } = stub();
	changelog.default(pi);
	assert.deepEqual(events, ["session_start"], "nothing to patch, so the warning handler is registered");
	const { SomethingElse } = load(pkg, "dist/bundle/chunks/chunk-b.js");
	assert.throws(() => new SomethingElse().setLastChangelogVersion("1"), /unpatched/);
});

check("survives a matching chunk that cannot be loaded", () => {
	const { pkg } = fixture({
		chunks: { "chunk-throws.js": "class SettingsManager {}\nexport{SettingsManager};\nthrow new Error('boom');\n" },
		core: CORE,
		state: "0.7.0\n",
	});
	const { events, pi } = stub();
	changelog.default(pi);
	assert.deepEqual(events, [], "the good core copy still patches");
	const { SettingsManager } = load(pkg, "dist/core/settings-manager.js");
	assert.equal(new SettingsManager().getLastChangelogVersion(), "0.7.0");
	assert.throws(() => load(pkg, "dist/bundle/chunks/chunk-throws.js"), /boom/);
});

check("warns when no copy can be patched", () => {
	const { events, pi } = stub();
	fixture({ settings: JSON.stringify({ lastChangelogVersion: "0.1.0" }) });
	changelog.default(pi);
	assert.deepEqual(events, ["session_start"]);
});

check("survives a read-only agent directory", () => {
	const { pkg } = fixture({ core: CORE, readOnly: true });
	const { events, pi } = stub();
	changelog.default(pi);
	assert.deepEqual(events, []);
	const { SettingsManager } = load(pkg, "dist/core/settings-manager.js");
	assert.doesNotThrow(() => new SettingsManager().setLastChangelogVersion("0.8.0"));
});

check("no-ext-changelog turns the extension bookkeeping into no-ops", () => {
	const { pkg } = fixture({ core: CORE });
	const { events, pi } = stub();
	noExt.default(pi);
	assert.deepEqual(events, []);
	const { SettingsManager } = load(pkg, "dist/core/settings-manager.js");
	const manager = new SettingsManager();
	assert.doesNotThrow(() => manager.setExtensionChangelogVersion("1.0.0"));
	assert.equal(manager.getExtensionChangelogVersion(), undefined);
});

check("no-ext-changelog warns when Pi has no extension version methods", () => {
	const { events, pi } = stub();
	fixture({ core: CORE_WITHOUT_EXTENSION });
	noExt.default(pi);
	assert.deepEqual(events, ["session_start"]);
});

check("both extensions patch the same copy without interfering", () => {
	const { pkg, agent } = fixture({ core: CORE, state: "0.9.0\n" });
	changelog.default(stub().pi);
	noExt.default(stub().pi);
	const { SettingsManager } = load(pkg, "dist/core/settings-manager.js");
	const manager = new SettingsManager();
	assert.equal(manager.getLastChangelogVersion(), "0.9.0");
	assert.doesNotThrow(() => manager.setExtensionChangelogVersion("1.2.3"));
	manager.setLastChangelogVersion("1.0.0");
	assert.equal(readState(agent), "1.0.0\n");
});

check("finds the export statement at the start of a large chunk", () => {
	const padding = "// filler ".repeat(2000);
	const large = `export{SettingsManager};\nclass SettingsManager {\n  setLastChangelogVersion() { throw new Error("unpatched"); }\n  getLastChangelogVersion() { return "unpatched"; }\n}\n${padding}\n`;
	const { agent, pkg } = fixture({ chunks: { "chunk-large.js": large }, state: "0.2.0\n" });
	const { events, pi } = stub();
	changelog.default(pi);
	assert.deepEqual(events, [], "the full read finds the export the tail misses");
	const { SettingsManager } = load(pkg, "dist/bundle/chunks/chunk-large.js");
	assert.equal(new SettingsManager().getLastChangelogVersion(), "0.2.0");
	assert.ok(readFileSync(join(agent, ".changelog-version"), "utf8").length > 0);
});

check("scans the package directory once for both extensions", () => {
	const { pkg } = fixture({
		chunks: { "chunk-a.js": CORE, "chunk-skip.js": "class Other {}\nexport{Other};\n" },
		core: CORE,
		state: "0.1.0\n",
	});
	changelog.default(stub().pi);
	noExt.default(stub().pi);
	const stats = shared.settingsCopyStats();
	assert.equal(stats?.dir, pkg);
	assert.equal(stats?.files, 2, "chunk-a and the core module, discovered once");
	const { SettingsManager } = load(pkg, "dist/core/settings-manager.js");
	const manager = new SettingsManager();
	assert.equal(manager.getLastChangelogVersion(), "0.1.0");
	assert.doesNotThrow(() => manager.setExtensionChangelogVersion("1.0.0"));
});

check("skips a chunk it cannot read and still patches the core module", () => {
	const { pkg } = fixture({ chunks: { "chunk-locked.js": CORE }, core: CORE, state: "0.3.0\n" });
	chmodSync(join(pkg, "dist/bundle/chunks/chunk-locked.js"), 0o000);
	const { events, pi } = stub();
	assert.doesNotThrow(() => changelog.default(pi));
	assert.deepEqual(events, [], "the core module still patches");
	const { SettingsManager } = load(pkg, "dist/core/settings-manager.js");
	assert.equal(new SettingsManager().getLastChangelogVersion(), "0.3.0");
});

console.log(failures === 0 ? "\nall cases passed" : `\n${failures} case(s) failed`);
process.exit(failures === 0 ? 0 : 1);
