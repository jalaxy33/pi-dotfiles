import assert from "node:assert/strict";

const mod = await import("../undeclared-tools.ts");

let tools = [];
let active = [];
const handlers = {};
const pi = {
	getAllTools: () => tools,
	getActiveTools: () => active,
	on: (event, fn) => {
		(handlers[event] ??= []).push(fn);
		return () => {};
	},
};
await mod.default(pi);

function section() {
	const options = { sections: {} };
	for (const fn of handlers.before_agent_start ?? []) fn({ systemPromptOptions: options });
	return options.sections.undeclared_tools;
}

const deferred = (name) => ({ name, exposure: "deferred" });

let failures = 0;
function check(name, fn) {
	try {
		fn();
		console.log(`ok   ${name}`);
	} catch (error) {
		failures++;
		console.log(`FAIL ${name}: ${error.message}`);
	}
}

check("no deferred tool leaves no section", () => {
	tools = [{ name: "read", exposure: "direct" }];
	active = ["read", "codemode"];
	assert.equal(section(), undefined);
});

check("codemode wording", () => {
	tools = [deferred("web_search"), deferred("subagent")];
	active = ["read", "codemode"];
	assert.equal(
		section(),
		'Callable from codemode scripts, not declared as tools:\nsubagent, web_search',
	);
});

check("registration does not count as reachable", () => {
	tools = [deferred("web_search"), { name: "codemode", exposure: "model-only" }];
	active = ["read", "tool_search"];
	assert.equal(
		section(),
		"Not declared as tools; load them with tool_search:\nweb_search",
	);
});

check("no reach tool at all", () => {
	tools = [deferred("web_search")];
	active = ["read"];
	assert.equal(section(), "Not declared as tools and not reachable in this session:\nweb_search");
});

check("direct and model-only tools are not listed", () => {
	tools = [
		deferred("web_search"),
		{ name: "preview_export", exposure: "direct" },
		{ name: "tool_search", exposure: "model-only" },
	];
	active = ["read", "codemode"];
	assert.equal(
		section(),
		"Callable from codemode scripts, not declared as tools:\nweb_search",
	);
});

process.exit(failures === 0 ? 0 : 1);
