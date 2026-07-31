# Guide Corpus

The production allowlist in `build/prompt.mjs` names every guide `AutoMovieApplication.getGuideDocument` serves by exact filename stem. The build bundles only that set into the generated `src/guides/AutoMovieGuideConstant.ts`; edit markdown, never the constant. Retired legacy markdown remains temporarily unserved only as source material for the #1433 knowledge-recovery rewrite.

## Writing rules

- **Ground every claim in actual behavior.** A guide sentence must be traceable to what the tools do today (service code, facade JSDoc, engine semantics), no aspirational claims, no features that "will" exist. The guides teach the method; tool returns decide correctness.
- English, concise, in the corpus voice: address the agent as "you", state the rule and the reason, stop.
- The guides carry doctrine the MCP JSDoc caps cannot (the 512-character server-instruction lead, the 1023-character tool description), depth belongs here, contracts belong in the JSDoc.

## Anti-drift rule

**A PR that adds or changes an MCP tool checks whether the guide corpus needs the same change.** A guide that does not know a tool teaches only expensive corrections. Pin the served-name closure and distinctive contract phrases in the five-tool application test.
