import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { stripSettings } from "../bin/pi-settings-state.mjs";

// Same default as pi's agent directory.
const agentDir = process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent");
const settingsPath = join(agentDir, "settings.json");
const statePath = join(agentDir, "tmp", "ignored-settings.json");

// Pi reads the ignored fields from settings.json at startup. Take them out again
// once the session is up, so the file stays clean while pi runs.
export default function (pi: ExtensionAPI) {
  const strip = () => stripSettings(settingsPath, statePath);
  pi.on("session_start", strip);
  pi.on("before_agent_start", strip);
  pi.on("session_shutdown", strip);
}
