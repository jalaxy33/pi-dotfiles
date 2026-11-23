import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Deferred-exposure tools are never declared to the model, so a missing
// capability looks like a missing tool. Computed per prompt build from the live
// registry so the list follows the installed config instead of a stale copy.
export default function undeclaredTools(pi: ExtensionAPI) {
	pi.on("before_agent_start", (event) => {
		const names = pi
			.getAllTools()
			.filter((tool) => tool.exposure === "deferred")
			.map((tool) => tool.name)
			.sort();

		if (names.length === 0) {
			delete event.systemPromptOptions.sections.undeclared_tools;
			return;
		}

		event.systemPromptOptions.sections.undeclared_tools = `${reach(pi.getActiveTools())}\n${names.join(", ")}`;
	});
}

// Registered is not active: a registered reach tool that the session did not
// select cannot be called, so the wording must follow the active set.
function reach(activeTools: string[]): string {
	if (activeTools.includes("codemode")) return "Callable from codemode scripts, not declared as tools:";
	if (activeTools.includes("tool_search")) return "Not declared as tools; load them with tool_search:";
	return "Not declared as tools and not reachable in this session:";
}
