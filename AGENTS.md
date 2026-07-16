# AGENTS.md

`automovie` moves and forms characters and objects through LLM function calling / structured output, then validates and renders them deterministically: a fixed asset performed by an LLM and rendered by a deterministic engine, as the cheap, controllable, reproducible alternative to diffusion video.

## Attitude

Follow the literal request; it is the contract, not a hint at what the user "really" wants.

- **Scope is the user's to widen.** Reinterpret the goal, weigh alternatives, or expand the task only on an explicit hand-off ("figure it out", "you decide"). Take a confident, specific ask as given.
- **Fidelity binds the goal, not the effort.** Within that goal, act with full initiative: do the substeps it needs, verify your work, surface what you notice. Literal scope is no excuse for passive execution.
- **Evidence precedes correction.** Treat issue reports, review proposals, and claims that something is wrong or missing as hypotheses. Verify the real code path, tests, rendered output, and history before accepting the premise or changing behavior.
- **Trace the consequence surface.** A named file or failing case is the starting point, not the investigation boundary. Follow the same cause through downstream consumers, side effects, state transitions, and boundary cases, then address the whole verified class of failure within the requested goal.
- **Default over ask.** On an ambiguous detail, pick the sensible default and say what you chose; reserve questions for forks only the user can settle.
- **Ship each topic as a PR.** Standing instruction (user, 2026-07-06): every topic-unit of work is submitted as its own PR; never commit to `master` directly. Merge only on explicit user request or under a standing autonomous mandate (see the pull-request skill). Green CI remains the normal merge path.

## Skills

Durable project conventions and workflows live under `.agents/skills/`. Read the linked skill when its topic applies; each skill indexes its own conditionally needed topic documents.

### Project Outline

What `automovie` is, the long-haul mission, the workspace layout, and the canonical commands, `.agents/skills/project/SKILL.md`.

### Development

Work rules, testing, the always-100% coverage mandate, validation, consequence analysis, change integrity, `.agents/skills/development/SKILL.md`. Read before writing or modifying code.

### Documentation

The `.wiki/` working knowledge base, package READMEs, code JSDoc, `.agents/skills/documentation/SKILL.md`. Read before writing or modifying docs, and revise the wiki as the work proceeds.

### Review

Solo review, team Review Cycle, Research Review Round, and exhaustive issue-discovery rounds, `.agents/skills/review/SKILL.md`. Every agent inspects the whole declared surface independently; Self-Review and any unqualified review request are always solo. Read the Briefing Review Agents rule before delegating to any subagent. The reference study that precedes each major `interface`/`engine` push runs as a Research Review Round or a Discussion.

### Discussion

Structured multi-agent topic discussion with persistent research notes and transcripts, `.agents/skills/discussion/SKILL.md`. Read only when the user explicitly asks for a discussion; review and issue discovery do not imply discussion.

### Issue Campaign

Repository-wide issue discovery, lead-vetted issue publication, batched implementation pull requests, and campaign closure — the conquest loop, `.agents/skills/issue-campaign/SKILL.md`. Read when the user asks for a broad audit, many issue candidates, or an issue-to-implementation campaign; do not use it for one already-defined issue.

### 3D Modeling

Working rules for parametric head/face modeling — verification discipline, anthropometric fitting, derived-data cascades, texture/morph craft, `.agents/skills/3d-modeling/SKILL.md`. Read before any 3D model, likeness, or pipeline work.

### Viewer Verification

Driving the viewer/playground through Playwright MCP to inspect renders, poses, and motion against expectation, `.agents/skills/viewer-verification/SKILL.md`. Read before claiming a viewer or render change works.

### MCP Server Design

Designing `packages/mcp` — server/tool arrangement as an ongoing experiment, and the hard JSDoc-length constraints MCP clients impose (the 512-character server-instruction lead, the 1023-character tool-description cap), `.agents/skills/mcp/SKILL.md`. Read before adding or reshaping an MCP tool.

### Pull Request Submission

Branch, commit, pull request, check, and merge flow, `.agents/skills/pull-request/SKILL.md`. Read when shipping a topic-unit PR under the standing instruction, when the user asks to open, update, or merge one, or when a standing autonomous mandate authorizes end-to-end delivery; never merge on unprompted initiative.

## Maintenance

### Writing style

AGENTS.md and SKILL.md files are read by humans as well as agents.

- **Optimize for comprehension, not minimum length.** A shorter document that forces the reader to infer prerequisites, reasons, exceptions, or stop conditions is not concise. Add the context needed to execute correctly.
- **Remove repetition, not substance.** State a rule once at its owner and link to it elsewhere. Keep the rationale when it prevents a plausible mistake.
- **Give each paragraph one job.** Split purpose, rule, rationale, procedure, and consequence when combining them would make the reader unpack a dense block.
- **Use structure as compression.** Use numbered lists for ordered procedures, bullets for choices or checklists, tables for repeated mappings, and code blocks for exact commands. Do not hide a workflow inside one long sentence.
- **State the rule before its reason.** Use negative phrasing only for a named failure mode that the affirmative rule does not already exclude.
- **Skills point, not paraphrase.** Do not restate what the `.wiki/`, READMEs, or source comments already say; link to them. Skills are for cross-cutting rules and conventions, not a second copy of project docs.
- **Source lines are not paragraphs.** Keep each prose paragraph on one source line and never hard-wrap it, but insert as many blank-line paragraph boundaries as the ideas require.

### AGENTS.md

This is the single shared entry point for both Claude Code (via `CLAUDE.md -> @AGENTS.md`) and Codex CLI. Keep it to the brief product identity, global attitude, and skill index. The H2s are `## Attitude`, `## Skills`, and `## Maintenance`; `## Attitude` is the one place global agent-behavior rules live.

Update AGENTS.md only for repository-contract changes: a new skill area, a renamed or merged skill, a workflow that no longer fits an existing skill, or a coding-agent rule that applies globally before any skill loads. This file and the skills are living documents: keep them current as conventions, layout, and the mission evolve.

### Skills

- **Location.** `.agents/skills/<kebab-name>/SKILL.md`. No numeric prefix. Each file opens with YAML frontmatter whose `name` matches the directory and whose third-person `description` states what the skill covers and when to use it; Codex requires the frontmatter to load the skill. Claude Code only auto-discovers `.claude/skills/`, so it reads these via the AGENTS.md pointers rather than the frontmatter.
- **Core in SKILL.md, conditional topics as sibling documents.** Keep always-applicable procedure in SKILL.md. Move a topic needed only under a specific condition to a one-level-deep sibling document and link it with that read condition.
- **Two trigger surfaces, one scope.** The frontmatter description is the full trigger contract, including exclusions. The AGENTS.md pointer mirrors that scope more briefly. Correct the frontmatter first when the scope changes.
- **Create or merge.** Add a skill when a substantial repository concern would otherwise inflate AGENTS.md beyond an index. Merge sibling concerns when they share most of their structure.
- **Headings are plain.** No chapter numbers in skill or AGENTS.md headings. Use descriptive titles.
- **Current set.** The repository skills are `project`, `development`, `documentation`, `review`, `discussion`, `issue-campaign`, `3d-modeling`, `viewer-verification`, `mcp`, and `pull-request`.
