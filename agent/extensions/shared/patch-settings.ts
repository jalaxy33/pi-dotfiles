import { closeSync, existsSync, fstatSync, openSync, readFileSync, readdirSync, readSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { getPackageDir } from "@earendil-works/pi-coding-agent";

// Pi may run from the bundled chunks or from plain dist modules, and every extension that
// patches SettingsManager needs the copy this process already loaded. Find and require those
// modules once, then let each caller patch the methods it owns. This file lives in a
// subdirectory without index.ts or package.json, so Pi's extension discovery skips it.

const TAIL_BYTES = 8 * 1024;
// Bundlers emit the export statement last, so reading the tail settles almost every chunk
// without loading the whole 9 MB directory into memory.
const EXPORT_PATTERN = /export\{[^}]*\bSettingsManager\b/;

let cached: { dir: string; modules: any[]; files: number } | undefined;

/** The last `bytes` of the file, or undefined when it cannot be read. */
function readTail(file: string, bytes: number): string | undefined {
	let fd: number | undefined;
	try {
		fd = openSync(file, "r");
		const size = fstatSync(fd).size;
		const length = Math.min(bytes, size);
		const buffer = Buffer.alloc(length);
		readSync(fd, buffer, 0, length, size - length);
		return buffer.toString("utf8");
	} catch {
		return undefined;
	} finally {
		if (fd !== undefined) {
			try {
				closeSync(fd);
			} catch {
				// closing failed: the descriptor is gone either way
			}
		}
	}
}

function exportsSettingsManager(file: string): boolean {
	const tail = readTail(file, TAIL_BYTES);
	if (tail !== undefined && EXPORT_PATTERN.test(tail)) return true;
	if (tail !== undefined && tail.length < TAIL_BYTES) return false;
	try {
		return EXPORT_PATTERN.test(readFileSync(file, "utf8"));
	} catch {
		return false;
	}
}

/** The loaded SettingsManager modules, discovered once per package directory. */
export function settingsCopies(): any[] {
	const dir = getPackageDir();
	if (cached?.dir === dir) return cached.modules;
	const requireCopy = createRequire(join(dir, "package.json"));
	const files: string[] = [];

	const chunksDir = join(dir, "dist", "bundle", "chunks");
	if (existsSync(chunksDir)) {
		try {
			for (const name of readdirSync(chunksDir)) {
				if (!name.endsWith(".js")) continue;
				const file = join(chunksDir, name);
				if (exportsSettingsManager(file)) files.push(file);
			}
		} catch {
			// unreadable chunks directory: the core module below is still worth trying
		}
	}
	const coreFile = join(dir, "dist", "core", "settings-manager.js");
	if (existsSync(coreFile)) files.push(coreFile);

	const modules: any[] = [];
	for (const file of files) {
		try {
			modules.push(requireCopy(file));
		} catch {
			// not the copy this process loaded
		}
	}
	cached = { dir, modules, files: files.length };
	return modules;
}

/** Applies the patcher to every copy and returns how many copies it changed. */
export function patchSettingsCopies(apply: (module: any) => boolean): number {
	let patched = 0;
	for (const module of settingsCopies()) {
		try {
			if (apply(module)) patched++;
		} catch {
			// a copy whose shape differs from the expected one
		}
	}
	return patched;
}

/** Diagnostic for tests: what the last discovery scanned. */
export function settingsCopyStats(): { dir: string; files: number } | undefined {
	return cached ? { dir: cached.dir, files: cached.files } : undefined;
}
