## Working rules

- Be brief and plain in replies, comments, and docs. No jargon, no invented terms.
- Write code and comments in English.
- Keep code plain: direct constructs over clever tricks.
- A caller should use a function correctly without reading its body. Name things for the caller; split the function when its name needs "and", when it takes a boolean flag, or when it mixes computation with side effects. Don't wrap three lines in a single-use function that only restates the call site.
- Use comments for what code can't say: constraints, invariants, workarounds for external quirks, non-obvious tradeoffs. Never narrate what the code already shows. Before writing one, try a name or a boundary; if that fails, write the comment. Business rules and protocol quirks are real complexity: keep the comment, don't split code just to avoid it.
- Before writing a one-off script (e.g. batch-editing files), check codemode first and batch the tool calls there. Write a script only for logic you will rerun.
- Keep commit messages to one short sentence; add a body only when necessary.
- Don't add tests unless they guard real regressions.
