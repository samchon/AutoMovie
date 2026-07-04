## Attitude

Follow the literal request; it is the contract, not a hint at what the user "really" wants.

- **Scope is the user's to widen.** Reinterpret the goal, weigh alternatives, or expand the task only on an explicit hand-off ("figure it out", "you decide"). Take a confident, specific ask as given.
- **Fidelity binds the goal, not the effort.** Within that goal, act with full initiative: do the substeps it needs, verify your work, surface what you notice. Literal scope is no excuse for passive execution.
- **Default over ask.** On an ambiguous detail, pick the sensible default and say what you chose; reserve questions for forks only the user can settle.
- **Ship each topic as a PR: open, pass CI, merge.** Standing instruction (user, 2026-07-03): every topic-unit of work is submitted as its own PR and merged once CI is green — no separate per-PR merge approval. Never commit to `master` directly. Flow details in `.codex/skills/pull-request/SKILL.md`.

## Skills

All conventions and workflows live as skills under `.codex/skills/`. Read the linked file when its topic applies.

### Project Outline

What `autofilm` is, the long-haul mission, the workspace layout, and the canonical commands, `.codex/skills/project/SKILL.md`.

### Development

Work rules, testing, the always-100% coverage mandate, validation, change integrity, `.codex/skills/development/SKILL.md`. Read before writing or modifying code.

### Documentation

The `.wiki/` working knowledge base, package READMEs, code JSDoc, `.codex/skills/documentation/SKILL.md`. Read before writing or modifying docs, and revise the wiki as the work proceeds.

### Multi-Agent Workflows

Review Cycle, Discussion, Research Review Round, `.codex/skills/multi-agent/SKILL.md`. Read the Briefing subagents rule before delegating to any subagent; read in full only when the user asks for a named mode. The reference study that precedes each major interface/engine push runs as a Research Review Round or Discussion.

### 3D Modeling

Working rules for parametric head/face modeling — verification discipline, anthropometric fitting, derived-data cascades, texture/morph craft, `.codex/skills/3d-modeling/SKILL.md`. Read before any 3D model, likeness, or pipeline work.

### Viewer Verification

Driving the viewer/playground through Playwright MCP to inspect renders, poses, and motion against expectation, `.codex/skills/viewer-verification/SKILL.md`. Read before claiming a viewer or render change works.

### MCP Server Design

Designing `packages/mcp` — server/tool arrangement as an ongoing experiment, and the hard JSDoc-length constraints MCP clients impose (the 512-character server-instruction lead, the 1023-character tool-description cap), `.codex/skills/mcp/SKILL.md`. Read before adding or reshaping an MCP tool.

### Pull Request Submission

PR submission flow, `.codex/skills/pull-request/SKILL.md`. Read only when the user explicitly asks for a pull request; never open, push, propose, or merge a PR on your own initiative.

## Maintenance

### Writing style

AGENTS.md and SKILL.md files are read by humans as well as agents.

- **Concise means no redundancy, no padding**: not the same as cramming long sentences into one dense paragraph.
- **Concise does not mean gutted.** Drop repetition; keep the rule and the rationale that makes it usable.
- **Match structure to content.** Bullets for parallel items, a short paragraph for a single idea, a code block for a command.
- **State the rule first, then the reason.** Use negative phrasing only for named failure modes the affirmative does not already cover.
- **Skills point, not paraphrase.** Don't restate what the `.wiki/`, READMEs, or source comments already say, link to them. Skills are for cross-cutting rules and conventions, not a second copy of project docs.

### AGENTS.md

The single shared entry point for both Claude Code (via `CLAUDE.md → @AGENTS.md`) and Codex CLI, table of contents, not content. The H2s are `## Attitude`, `## Skills`, and `## Maintenance`. `## Attitude` is the one place global agent-behavior rules live; everything else points to a skill.

Update only for repository-contract changes: a new skill area, a renamed or merged skill, a workflow that no longer fits an existing skill, or a coding-agent rule that applies globally before any skill loads. This file and the skills are living documents: keep them current as conventions, layout, and the mission evolve.

### Skills

- **Location.** `.codex/skills/<kebab-name>/SKILL.md`. No numeric prefix. Each file opens with YAML frontmatter (`---` delimited) carrying `name` and `description`, which Codex requires to load the skill; the body is plain markdown committed to the repo. Claude Code only auto-discovers `.claude/skills/`, so it reads these via the AGENTS.md pointers rather than the frontmatter.
- **AGENTS.md pointer.** Each skill gets a `### Title` entry under `## Skills` in AGENTS.md with a one-paragraph pointer to the SKILL.md path.
- **Create or merge.** Add a new skill when a substantial repository concern would otherwise inflate AGENTS.md beyond an index. Merge sibling concerns into one multi-section skill when they share most of their structure.
- **Headings are plain.** No chapter numbers in skill or AGENTS.md headings. Use descriptive titles.
