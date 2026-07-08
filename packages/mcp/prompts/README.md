# Guide Corpus

Each `SCREAMING_SNAKE_CASE.md` here is one guide `AutoMovieApplication.getGuideDocument` serves by exact filename stem. `build/prompt.mjs` bundles them into the gitignored `src/guides/AutoMovieGuideConstant.ts` on every install (`prepare`) and build — edit the markdown, never the constant. This `README.md` documents the corpus and is excluded from the bundle.

## Writing rules

- **Ground every claim in actual behavior.** A guide sentence must be traceable to what the tools do today (service code, facade JSDoc, engine semantics) — no aspirational claims, no features that "will" exist. The guides teach the method; tool returns decide correctness.
- English, concise, in the corpus voice: address the agent as "you", state the rule and the reason, stop.
- The guides carry doctrine the MCP JSDoc caps cannot (the 512-character server-instruction lead, the 1023-character tool description) — depth belongs here, contracts belong in the JSDoc.

## Anti-drift rule

**A PR that adds or changes an MCP tool checks whether the guide corpus needs the same change.** The corpus was written against a tool surface that keeps growing; a guide that does not know a tool teaches only the expensive corrections. When a guide changes, pin its new content with a distinctive phrase in `test/src/features/mcp/test_mcp_guide_documents.ts`.
