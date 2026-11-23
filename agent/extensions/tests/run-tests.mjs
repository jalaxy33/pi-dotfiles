import { spawnSync } from "node:child_process";
import { existsSync, symlinkSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Runs the test files next to this one. The extensions import host packages by bare name,
// which only resolve inside Pi, so the run borrows the installed copy through a temporary
// node_modules symlink and removes it again. Pi skips node_modules during extension
// discovery, so a leftover link cannot turn into an extension.

const here = dirname(fileURLToPath(import.meta.url));
const agentDir = join(here, "..", "..");
const link = join(agentDir, "node_modules");
const target = join(agentDir, "npm", "node_modules");
const tests = ["patch-settings.test.mjs", "tool-policy.test.mjs", "undeclared-tools.test.mjs"];

if (!existsSync(target)) {
	console.error(`cannot run: ${target} does not exist, install the packages first`);
	process.exit(1);
}
const created = !existsSync(link);
if (created) symlinkSync(target, link, "dir");

let failures = 0;
try {
	for (const file of tests) {
		const result = spawnSync(process.execPath, [join(here, file)], { stdio: "inherit" });
		if (result.status !== 0) failures++;
	}
} finally {
	if (created) {
		try {
			unlinkSync(link);
		} catch {
			// removed already
		}
	}
}
process.exit(failures === 0 ? 0 : 1);
