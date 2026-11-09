// Git clean filter for agent/settings.json: drop the fields listed in "ignoreFields".
// Pi keeps reading and writing them in the working tree; git never stores them.
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  let output = input;
  try {
    const settings = JSON.parse(input);
    const ignoreFields = Array.isArray(settings.ignoreFields) ? settings.ignoreFields : [];
    for (const field of ignoreFields) {
      if (typeof field === "string") delete settings[field];
    }
    output = JSON.stringify(settings, null, 2);
  } catch {
    // Malformed input stays as-is so git reports a real diff.
  }
  process.stdout.write(output);
});
