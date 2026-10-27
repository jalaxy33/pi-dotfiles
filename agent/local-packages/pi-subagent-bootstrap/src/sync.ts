import { spawn } from "node:child_process";
import {
	chmodSync,
	existsSync,
	lstatSync,
	mkdirSync,
	readFileSync,
	renameSync,
	rmSync,
	statSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const VENDOR_DIR = join(PACKAGE_DIR, "vendor");
const UPSTREAM_DIR = join(VENDOR_DIR, "pi-subagent");
const STATE_PATH = join(PACKAGE_DIR, ".sync-state.json");
const LOCK_DIR = join(VENDOR_DIR, ".sync-lock");

const DEFAULT_REPO = "github.com/badlogic/pi-subagent";
const DEFAULT_MIRRORS = ["https://{repo}.git", "https://gh-proxy.org/https://{repo}.git"];
const PROBE_TIMEOUT_MS = 12_000;
const GIT_TIMEOUT_MS = 180_000;
const LOCK_TIMEOUT_MS = 180_000;
const LOCK_STALE_MS = 10 * 60_000;
const DEFAULT_UPDATE_INTERVAL_HOURS = 24;

export interface SyncOptions {
	agentDir: string;
	update?: boolean;
}

export interface SyncResult {
	dir: string;
	entry: string;
	cli: string;
	source: string;
	warning?: string;
}

interface SyncState {
	repo?: string;
	source?: string;
	syncedAt?: string;
	checkedAt?: string;
	lastError?: string;
}

interface RunResult {
	ok: boolean;
	code: number | null;
	stdout: string;
	stderr: string;
	timedOut: boolean;
}

function repoName(): string {
	return process.env.PI_SUBAGENT_REPO?.trim() || DEFAULT_REPO;
}

function updateAutomatic(): boolean {
	const value = (process.env.PI_SUBAGENT_UPDATE ?? "").trim().toLowerCase();
	return !["0", "false", "no", "off"].includes(value);
}

function updateForced(): boolean {
	const value = (process.env.PI_SUBAGENT_UPDATE ?? "").trim().toLowerCase();
	return ["1", "true", "yes", "on"].includes(value);
}

function updateIntervalMs(): number {
	const raw = process.env.PI_SUBAGENT_UPDATE_INTERVAL_HOURS?.trim();
	if (!raw) return DEFAULT_UPDATE_INTERVAL_HOURS * 60 * 60_000;
	const hours = Number(raw);
	return Number.isFinite(hours) && hours >= 0 ? hours * 60 * 60_000 : DEFAULT_UPDATE_INTERVAL_HOURS * 60 * 60_000;
}

function updateDue(): boolean {
	const state = readState();
	const lastCheck = Date.parse(state.checkedAt ?? state.syncedAt ?? "");
	if (!Number.isFinite(lastCheck)) return true;
	return Date.now() - lastCheck >= updateIntervalMs();
}

function errorText(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function sources(): string[] {
	const repo = repoName();
	const templates = process.env.PI_SUBAGENT_MIRRORS
		? process.env.PI_SUBAGENT_MIRRORS.split(",")
		: DEFAULT_MIRRORS;
	const urls = [...new Set(templates.map((template) => template.trim()).filter(Boolean).map((template) => template.replaceAll("{repo}", repo)))];
	const known = readState().source;
	const knownIndex = known ? urls.indexOf(known) : -1;
	if (knownIndex > 0) {
		urls.splice(knownIndex, 1);
		urls.unshift(known);
	}
	return urls;
}

function readState(): SyncState {
	try {
		return JSON.parse(readFileSync(STATE_PATH, "utf8")) as SyncState;
	} catch {
		return {};
	}
}

function writeState(state: SyncState): void {
	try {
		writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, "utf8");
	} catch {
		// State is only a shortcut for picking the next mirror.
	}
}

function isComplete(dir: string): boolean {
	return ["index.ts", "subagent.ts", "shared.ts", join("skills", "subagent", "SKILL.md")].every((file) => existsSync(join(dir, file)));
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function runGit(args: string[], timeoutMs: number): Promise<RunResult> {
	return new Promise((resolve) => {
		const child = spawn("git", args, {
			stdio: ["ignore", "pipe", "pipe"],
			env: {
				...process.env,
				GIT_TERMINAL_PROMPT: "0",
				GCM_INTERACTIVE: "never",
				GIT_HTTP_LOW_SPEED_LIMIT: "1",
				GIT_HTTP_LOW_SPEED_TIME: "20",
			},
		});
		let stdout = "";
		let stderr = "";
		let timedOut = false;
		let settled = false;
		const finish = (code: number | null, error?: Error): void => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			if (error) stderr += `${stderr ? "\n" : ""}${error.message}`;
			resolve({ ok: code === 0 && !error, code, stdout, stderr, timedOut });
		};
		const timer = setTimeout(() => {
			timedOut = true;
			child.kill("SIGKILL");
		}, timeoutMs);
		child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
			stdout += chunk;
		});
		child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
			stderr += chunk;
		});
		child.on("error", (error) => finish(null, error));
		child.on("close", (code) => finish(code));
	});
}

function describeFailure(result: RunResult): string {
	if (result.timedOut) return "timed out";
	const lines = `${result.stderr}\n${result.stdout}`.split("\n").map((line) => line.trim()).filter(Boolean);
	const text = lines.at(-1) ?? `git exited with code ${result.code}`;
	return text.length > 300 ? `${text.slice(0, 300)}...` : text;
}

async function cloneFresh(): Promise<string> {
	const failures: string[] = [];
	for (const url of sources()) {
		const probe = await runGit(["ls-remote", url, "HEAD"], PROBE_TIMEOUT_MS);
		if (!probe.ok) {
			failures.push(`${url}: ${describeFailure(probe)}`);
			continue;
		}
		const tempDir = join(VENDOR_DIR, `.clone-${process.pid}-${Date.now()}`);
		try {
			const clone = await runGit(
				["clone", "--depth", "1", "--single-branch", "--no-tags", url, tempDir],
				GIT_TIMEOUT_MS,
			);
			if (!clone.ok) {
				failures.push(`${url}: ${describeFailure(clone)}`);
				continue;
			}
			if (!isComplete(tempDir)) {
				failures.push(`${url}: clone is missing expected files`);
				continue;
			}
			rmSync(UPSTREAM_DIR, { recursive: true, force: true });
			renameSync(tempDir, UPSTREAM_DIR);
			writeState({
				repo: repoName(),
				source: url,
				syncedAt: new Date().toISOString(),
				checkedAt: new Date().toISOString(),
			});
			return url;
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	}
	throw new Error(`Could not clone pi-subagent.\n${failures.join("\n")}`);
}

async function updateExisting(): Promise<string> {
	const failures: string[] = [];
	for (const url of sources()) {
		const probe = await runGit(["ls-remote", url, "HEAD"], PROBE_TIMEOUT_MS);
		if (!probe.ok) {
			failures.push(`${url}: ${describeFailure(probe)}`);
			continue;
		}
		const fetch = await runGit(["-C", UPSTREAM_DIR, "fetch", "--depth", "1", url, "HEAD"], GIT_TIMEOUT_MS);
		if (!fetch.ok) {
			failures.push(`${url}: ${describeFailure(fetch)}`);
			continue;
		}
		const reset = await runGit(["-C", UPSTREAM_DIR, "reset", "--hard", "FETCH_HEAD"], 30_000);
		if (!reset.ok) {
			failures.push(`${url}: ${describeFailure(reset)}`);
			continue;
		}
		await runGit(["-C", UPSTREAM_DIR, "remote", "set-url", "origin", url], 15_000);
		writeState({
			repo: repoName(),
			source: url,
			syncedAt: new Date().toISOString(),
			checkedAt: new Date().toISOString(),
		});
		return url;
	}
	throw new Error(`Could not update pi-subagent.\n${failures.join("\n")}`);
}

function lockIsStale(): boolean {
	try {
		return Date.now() - statSync(LOCK_DIR).mtimeMs > LOCK_STALE_MS;
	} catch {
		return false;
	}
}

async function acquireLock(): Promise<boolean> {
	const deadline = Date.now() + LOCK_TIMEOUT_MS;
	while (true) {
		try {
			mkdirSync(LOCK_DIR);
			return true;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
			if (lockIsStale()) {
				rmSync(LOCK_DIR, { recursive: true, force: true });
				continue;
			}
			if (Date.now() > deadline) return false;
			await sleep(1000);
		}
	}
}

const LAUNCHER_MARKER = "# generated by pi-subagent-bootstrap";

function shellQuote(value: string): string {
	return `'${value.replaceAll("'", `'\\''`)}'`;
}

/** Runs the upstream CLI on pi's own runtime, so no extra runtime has to be installed. */
function launcherScript(target: string): string {
	const execPath = process.execPath;
	const name = basename(execPath);
	return `#!/bin/sh
${LAUNCHER_MARKER}
runtime=${shellQuote(execPath)}
[ -x "$runtime" ] || runtime=$(command -v ${shellQuote(name)})
if [ -z "$runtime" ]; then
	echo "pi-subagent: ${name} not found" >&2
	exit 127
fi
exec "$runtime" ${shellQuote(target)} "$@"
`;
}

function ensureCliLauncher(linkPath: string, target: string): void {
	mkdirSync(dirname(linkPath), { recursive: true });
	const script = launcherScript(target);
	let stat;
	try {
		stat = lstatSync(linkPath);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}
	if (stat?.isSymbolicLink()) {
		// Migration from older versions that linked subagent.ts directly.
		unlinkSync(linkPath);
	} else if (stat?.isFile()) {
		const current = readFileSync(linkPath, "utf8");
		if (!current.includes(LAUNCHER_MARKER)) {
			throw new Error(`${linkPath} is not managed by pi-subagent-bootstrap. Remove it, then restart pi.`);
		}
		if (current === script) {
			chmodSync(linkPath, 0o755);
			return;
		}
	} else if (stat) {
		throw new Error(`${linkPath} exists and is not a regular file. Remove it, then restart pi.`);
	}
	const tempPath = `${linkPath}.tmp-${process.pid}`;
	writeFileSync(tempPath, script, "utf8");
	chmodSync(tempPath, 0o755);
	renameSync(tempPath, linkPath);
}

export async function syncUpstream(options: SyncOptions): Promise<SyncResult> {
	mkdirSync(VENDOR_DIR, { recursive: true });
	const automatic = updateAutomatic();
	const force = options.update === true || updateForced();
	const due = (): boolean => force || (automatic && updateDue());
	let source = readState().source ?? "";
	let warning: string | undefined;

	if (!isComplete(UPSTREAM_DIR) || due()) {
		const locked = await acquireLock();
		if (!locked) {
			if (!isComplete(UPSTREAM_DIR)) {
				throw new Error("Timed out waiting for another pi-subagent sync");
			}
		} else {
			try {
				if (!isComplete(UPSTREAM_DIR)) {
					source = await cloneFresh();
				} else if (due()) {
					try {
						source = await updateExisting();
					} catch (error) {
						const message = errorText(error);
						warning = `Update failed; using the existing copy. ${message}`;
						writeState({
							...readState(),
							repo: repoName(),
							checkedAt: new Date().toISOString(),
							lastError: message,
						});
					}
				}
				source = readState().source ?? source;
			} finally {
				rmSync(LOCK_DIR, { recursive: true, force: true });
			}
		}
	}

	if (!isComplete(UPSTREAM_DIR)) {
		throw new Error("pi-subagent install is incomplete");
	}

	const cli = join(UPSTREAM_DIR, "subagent.ts");
	ensureCliLauncher(join(options.agentDir, "bin", "subagent"), cli);
	return {
		dir: UPSTREAM_DIR,
		entry: join(UPSTREAM_DIR, "index.ts"),
		cli,
		source: source || "existing clone",
		warning,
	};
}
