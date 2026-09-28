/**
 * pi-model-inherit
 *
 * models.json `default.providers["*"]` (and `["<providerId>"]`) supplies values that every
 * provider inherits; explicit values always win, including `false`.
 *
 *   "default": { "providers": { "*": { "compat": { "sendSessionAffinityHeaders": true } } } }
 *
 * Silent: no commands, no output. Without a `default` block this is a no-op; a broken one
 * produces at most one warning per session.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Same location pi uses for models.json (type-only import above keeps this package dependency-free).
const modelsJsonPath = (): string => {
	const dir = process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
	return join(dir.startsWith("~") ? join(homedir(), dir.slice(1)) : dir, "models.json");
};

type Dict = Record<string, any>;

// Keys pi reads while composing a provider, so they need the provider config layer.
const CONFIG_KEYS = ["name", "baseUrl", "apiKey", "api", "oauth", "authHeader"];
// Keys we can supply without touching provider composition: compat on models, headers on requests.
const LOW_KEYS = ["compat", "headers"];
const REJECTED_KEYS = ["models", "modelOverrides"];
const ALLOWED_KEYS = [...CONFIG_KEYS, ...LOW_KEYS];
// Deep-merged object fields; everything else is replaced wholesale.
const NESTED_KEYS = ["compat", "headers", "openRouterRouting", "vercelGatewayRouting", "chatTemplateKwargs", "chatTemplateArgs"];

// pi's compat vocabulary: the three compat schemas plus multi-turn keys the api layer reads.
const COMPAT_KEYS = [
	"supportsStore", "supportsDeveloperRole", "supportsReasoningEffort", "supportsUsageInStreaming", "supportsFinishReason",
	"maxTokensField", "requiresToolResultName", "requiresAssistantAfterToolResult", "requiresThinkingAsText",
	"requiresReasoningContentOnAssistantMessages", "thinkingFormat", "chatTemplateKwargs", "chatTemplateArgs",
	"cacheControlFormat", "openRouterRouting", "vercelGatewayRouting", "supportsOpenAIGrammarTools", "supportsStrictMode",
	"sendSessionAffinityHeaders", "sessionAffinityFormat", "supportsLongCacheRetention", "vllmPriority",
	"supportsMaxOutputTokens", "supportsEagerToolInputStreaming", "supportsCacheControlOnTools", "supportsTemperature",
	"forceAdaptiveThinking", "allowEmptySignature", "supportsStrictTools", "supportsMidConvoEffort", "allowedFallbackModels",
	"supportsMidConvoSystemMessages", "supportsMidConvoToolAdditions", "supportsMidConvoToolChanges",
];
const OBJECT_COMPAT = new Set(["chatTemplateKwargs", "chatTemplateArgs", "openRouterRouting", "vercelGatewayRouting"]);
const ARRAY_COMPAT = new Set(["allowedFallbackModels"]);
const STRING_COMPAT = new Set(["maxTokensField", "thinkingFormat", "cacheControlFormat", "sessionAffinityFormat"]);

interface Defaults {
	star?: Dict;
	exact: Map<string, Dict>;
	issues: string[];
}

const isObj = (value: unknown): value is Dict => typeof value === "object" && value !== null && !Array.isArray(value) && !Buffer.isBuffer(value);

/** Same tolerance as pi's models.json reader: strip comments and trailing commas. */
const stripJsonComments = (input: string): string =>
	input
		.replace(/"(?:\\.|[^"\\])*"|\/\/[^\n]*/g, (m) => (m[0] === '"' ? m : ""))
		.replace(/"(?:\\.|[^"\\])*"|,(\s*[}\]])/g, (m: string, tail: string) => tail ?? (m[0] === '"' ? m : ""));

function distance(a: string, b: string): number {
	let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
	for (let i = 1; i <= a.length; i++) {
		const next = [i];
		for (let j = 1; j <= b.length; j++) {
			next[j] = Math.min(prev[j] + 1, next[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
		}
		prev = next;
	}
	return prev[b.length];
}

/** Only suggest when the key clearly resembles a known one, so future pi keys never trigger noise. */
function suggest(key: string, known: readonly string[]): string | undefined {
	let best: string | undefined;
	let score = Infinity;
	for (const candidate of known) {
		const d = distance(key.toLowerCase(), candidate.toLowerCase());
		if (d < score) {
			score = d;
			best = candidate;
		}
	}
	if (best === undefined) return undefined;
	if (score <= 2) return best;
	const a = key.toLowerCase();
	const b = best.toLowerCase();
	return a.length >= 6 && (b.startsWith(a) || a.startsWith(b)) ? best : undefined;
}

function checkCompat(where: string, value: unknown, issues: string[]): void {
	if (!isObj(value)) {
		issues.push(`${where} must be an object.`);
		return;
	}
	for (const [key, entry] of Object.entries(value)) {
		if (!COMPAT_KEYS.includes(key)) {
			const hint = suggest(key, COMPAT_KEYS);
			if (hint) issues.push(`${where}.${key} is ignored; did you mean "${hint}"?`);
			continue;
		}
		if (OBJECT_COMPAT.has(key)) {
			if (!isObj(entry)) issues.push(`${where}.${key} must be an object.`);
			continue;
		}
		if (ARRAY_COMPAT.has(key)) {
			if (!Array.isArray(entry)) issues.push(`${where}.${key} must be an array.`);
			continue;
		}
		const want = STRING_COMPAT.has(key) ? "string" : "boolean";
		if (typeof entry !== want) issues.push(`${where}.${key} must be a ${want}.`);
	}
}

function checkProvider(id: string, entry: unknown, out: Defaults): void {
	const where = `default.providers["${id}"]`;
	if (!isObj(entry)) {
		out.issues.push(`${where} must be an object.`);
		return;
	}
	if (Object.keys(entry).length === 0) {
		out.issues.push(`${where} is empty.`);
		return;
	}
	for (const [key, value] of Object.entries(entry)) {
		if (REJECTED_KEYS.includes(key)) {
			out.issues.push(`${where}.${key} is ignored: default supplies values, not model definitions or overrides.`);
			continue;
		}
		if (!ALLOWED_KEYS.includes(key)) {
			const hint = suggest(key, ALLOWED_KEYS);
			out.issues.push(`${where}.${key} is ignored${hint ? `; did you mean "${hint}"` : ""} (valid: ${ALLOWED_KEYS.join(", ")})`);
			continue;
		}
		if (key === "headers") {
			if (!isObj(value) || Object.values(value).some((v) => typeof v !== "string")) out.issues.push(`${where}.headers must map strings to strings.`);
			continue;
		}
		if (key === "compat") {
			checkCompat(`${where}.compat`, value, out.issues);
			continue;
		}
		if (key === "authHeader") {
			if (typeof value !== "boolean") out.issues.push(`${where}.authHeader must be a boolean.`);
			continue;
		}
		if (typeof value !== "string" || value === "") out.issues.push(`${where}.${key} must be a non-empty string.`);
	}
	if (id === "*") out.star = entry;
	else out.exact.set(id, entry);
}

/** Read and validate the `default` block. Never throws. */
function load(): Defaults {
	const out: Defaults = { exact: new Map(), issues: [] };
	let parsed: unknown;
	try {
		parsed = JSON.parse(stripJsonComments(readFileSync(modelsJsonPath(), "utf8").replace(/^\uFEFF/, "")));
	} catch {
		return out; // missing or unparseable file: pi reports that itself
	}
	if (!isObj(parsed) || !("default" in parsed)) return out;
	if (!isObj(parsed.default)) {
		out.issues.push('"default" must be an object.');
		return out;
	}
	for (const key of Object.keys(parsed.default)) {
		if (key !== "providers") out.issues.push(`"default.${key}" is not supported; only "providers" is.`);
	}
	const providers = parsed.default.providers;
	if (providers === undefined) return out;
	if (!isObj(providers)) {
		out.issues.push('"default.providers" must be an object.');
		return out;
	}
	for (const [id, entry] of Object.entries(providers)) checkProvider(id, entry, out);
	return out;
}

function merge(base: Dict, override: Dict): Dict {
	const merged: Dict = { ...base, ...override };
	for (const key of NESTED_KEYS) {
		if (isObj(base[key]) && isObj(override[key])) merged[key] = { ...base[key], ...override[key] };
	}
	return merged;
}

function pick(source: Dict | undefined, keys: readonly string[]): Dict | undefined {
	if (!source) return undefined;
	const out: Dict = {};
	for (const key of keys) if (source[key] !== undefined) out[key] = source[key];
	return Object.keys(out).length > 0 ? out : undefined;
}

/** `"*"` first, then the exact provider id. */
function inherited(defaults: Defaults, providerId: string | undefined): Dict | undefined {
	if (!providerId) return undefined;
	const star = defaults.star;
	const exact = defaults.exact.get(providerId);
	if (!star) return exact;
	if (!exact) return star;
	return merge(star, exact);
}

const needsConfigLayer = (defaults: Defaults): boolean =>
	[defaults.star, ...defaults.exact.values()].some((entry) => entry && CONFIG_KEYS.some((key) => entry[key] !== undefined));

export default function piModelInherit(pi: ExtensionAPI): void {
	let defaults = load();
	let installed = false;
	let configLayer = false;
	const warned = new Set<string>();

	/** Fill compat keys nobody set. Returns the same object when nothing is missing. */
	const fillCompat = <T extends { compat?: Dict }>(model: T, providerId?: string): T => {
		const compat = pick(inherited(defaults, providerId), ["compat"])?.compat;
		if (!model || !compat) return model;
		const current = isObj(model.compat) ? model.compat : undefined;
		if (!Object.keys(compat).some((key) => current?.[key] === undefined)) return model;
		return { ...model, compat: { ...compat, ...current } };
	};

	const defaultHeaders = (providerId?: string): Dict | undefined => pick(inherited(defaults, providerId), ["headers"])?.headers;

	/** Model layer for compat, request layer for headers. */
	const install = (registry: any): void => {
		if (installed) return;
		installed = true;
		try {
			const runtime = registry?.runtime;
			const store = runtime?.models;
			for (const name of ["getModel", "getModels", "getAvailable"]) {
				const original = store?.[name];
				if (typeof original !== "function") continue;
				store[name] = (providerId?: any, ...rest: any[]) => {
					const result = original.call(store, providerId, ...rest);
					const fill = (model: any) => fillCompat(model, model?.provider);
					if (result && typeof result.then === "function") return result.then((list: any) => (Array.isArray(list) ? list.map(fill) : fill(list)));
					return Array.isArray(result) ? result.map(fill) : fill(result);
				};
			}
			const getAuth = runtime?.getAuth;
			if (typeof getAuth === "function") {
				runtime.getAuth = async (providerOrModel: any, overrides?: any) => {
					const resolution = await getAuth.call(runtime, providerOrModel, overrides);
					const extra = defaultHeaders(typeof providerOrModel === "string" ? providerOrModel : providerOrModel?.provider);
					if (!resolution?.auth || !extra) return resolution;
					return { ...resolution, auth: { ...resolution.auth, headers: { ...extra, ...resolution.auth.headers } } };
				};
			}
			const getCompat = runtime?.getCompatibilityRequestConfig;
			if (typeof getCompat === "function") {
				runtime.getCompatibilityRequestConfig = (model: any) => {
					const result = getCompat.call(runtime, model);
					const extra = defaultHeaders(model?.provider);
					if (!result || !extra) return result;
					return { ...result, headers: { ...extra, ...result.headers } };
				};
			}
		} catch {
			/* internals changed: stay silent */
		}
	};

	/** Only needed for keys pi reads while composing a provider. */
	const installConfigLayer = (registry: any): void => {
		if (configLayer) return;
		const runtime = registry?.runtime;
		const prototype = runtime?.config ? Object.getPrototypeOf(runtime.config) : undefined;
		if (typeof prototype?.getProvider !== "function") return;
		try {
			const getProvider = prototype.getProvider;
			const isReal = (id: string) =>
				Boolean(runtime?.builtins?.has?.(id) || runtime?.nativeExtensionProviders?.has?.(id) || runtime?.extensionProviders?.has?.(id));
			prototype.getProvider = function (this: unknown, providerId: string) {
				const explicit = getProvider.call(this, providerId);
				const overrides = pick(inherited(defaults, providerId), CONFIG_KEYS);
				if (!overrides) return explicit;
				const base = explicit ?? (isReal(providerId) ? {} : undefined);
				if (base === undefined) return explicit; // never invent providers
				const merged = merge(overrides, base);
				if (!["baseUrl", "headers", "compat", "apiKey", "oauth", "authHeader"].some((key) => merged[key] !== undefined)) merged.compat = {};
				return merged;
			};
			configLayer = true;
		} catch {
			/* internals changed: stay silent */
		}
	};

	/** Models resolved before install keep their own object; patch it in place. */
	const adopt = (model: any): void => {
		if (!model?.provider) return;
		const filled = fillCompat(model, model.provider);
		if (filled !== model) try { model.compat = filled.compat; } catch { /* frozen: model layer still covers it */ }
	};

	const warn = (ctx: any): void => {
		if (defaults.issues.length === 0) return;
		const message = `pi-model-inherit: ${defaults.issues.join(" ")}`;
		if (warned.has(message)) return;
		warned.add(message);
		if (ctx?.hasUI && typeof ctx.ui?.notify === "function") ctx.ui.notify(message, "warning");
	};

	pi.on("session_start", (_event, ctx) => {
		defaults = load();
		install((ctx as any)?.modelRegistry);
		if (needsConfigLayer(defaults)) installConfigLayer((ctx as any)?.modelRegistry);
		// The model and request layers need no recomposition; only the config layer does.
		if (configLayer && (defaults.star || defaults.exact.size > 0)) (ctx as any)?.modelRegistry?.runtime?.rebuildProviders?.();
		adopt((ctx as any)?.model);
		warn(ctx);
	});

	pi.on("model_select", (event, ctx) => {
		defaults = load();
		if (needsConfigLayer(defaults)) installConfigLayer((ctx as any)?.modelRegistry);
		adopt((event as any)?.model);
	});
}
