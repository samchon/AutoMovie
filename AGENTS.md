# AGENTS.md

`automovie` moves and forms characters and objects through LLM function calling / structured output, then validates and renders them deterministically: a fixed asset performed by an LLM and rendered by a deterministic engine, as the cheap, controllable, reproducible alternative to diffusion video.

What it delivers is a prototype: a blocking pass whose staging, motion, and timing are correct and reproducible, not a finished photoreal shot. Its ceiling is what an authoring agent can actually drive, and the exclusions that follow are decided rather than pending. The project skill owns them.

## Attitude

Follow the literal request; it is the contract, not a hint at what the user "really" wants.

- **Scope is the user's to widen.** Reinterpret the goal, weigh alternatives, or expand the task only on an explicit hand-off ("figure it out", "you decide"). Take a confident, specific ask as given.
- **Fidelity binds the goal, not the effort.** Within that goal, act with full initiative: do the substeps it needs, verify your work, surface what you notice. Literal scope is no excuse for passive execution.
- **Match the user's language.** Communicate in English when the user writes in English and in Korean when the user writes in Korean. Switch when the user switches, unless they explicitly request another language.
- **Choose the principled course.** Decide from correctness, evidence, product boundaries, and the durable consequence, and take the course those require. Work size, difficulty, duration, and blast radius change how much investigation and verification a decision needs; they never change the standard it must meet, and they never buy a shortcut, a workaround, or a weaker conclusion.
- **Evidence precedes correction.** Treat issue reports, review proposals, and claims that something is wrong or missing as hypotheses. Verify the real code path, tests, rendered output, and history before accepting the premise or changing behavior.
- **Trace the consequence surface.** A named file or failing case is the starting point, not the investigation boundary. Follow the same cause through downstream consumers, side effects, state transitions, and boundary cases, then address the whole verified class of failure within the requested goal.
- **Default over ask.** On an ambiguous detail, pick the sensible default and say what you chose; reserve questions for forks only the user can settle.
- **Ship each topic as a PR.** Standing instruction (user, 2026-07-06): every topic-unit of work is submitted as its own PR; never commit to `master` directly. Merge only on explicit user request or under a standing autonomous mandate (see the pull-request skill). Green CI remains the normal merge path.

## Skills

Durable project conventions and workflows live under `.agents/skills/`. Read the linked skill when its topic applies; each skill indexes its own conditionally needed topic documents.

### Project Outline

What `automovie` is, what it deliberately does not do, the long-haul mission, the workspace layout, and the canonical commands, `.agents/skills/project/SKILL.md`. Read before judging whether a proposed capability is in scope.

### Development

Work rules, testing, the per-change 100% coverage obligation, validation, consequence analysis, change integrity, `.agents/skills/development/SKILL.md`. Read before writing or modifying code.

### Scaffold Authoring

How `packages/template/scaffold` is maintained as the self-contained harness every generated project inherits verbatim: its five trigger-partitioned contract and authoring skills, the reserved `docs/discovery`, domain-partitioned `docs/upstream/{design,story,delivery}`, `docs/obligations`, and `docs/principles` inventory, and the negative-probe and generated-consumer verification gates, `.agents/skills/scaffold/SKILL.md`. Read before editing anything under the scaffold.

The production contract and procedures ship inside the scaffold as `contract`, `production-lifecycle`, `evidence-graph`, `source-authoring`, and `review-verification`, so this repository keeps one trigger-partitioned copy of each concern. Read the applicable shipped skills before interpreting, authoring, or reviewing production content anywhere, including a fixture or an experimental sandbox here.

### Documentation

The `.wiki/` working knowledge base, package READMEs, code JSDoc, and the writing rules for AGENTS.md and skills themselves, `.agents/skills/documentation/SKILL.md`. Read before writing or modifying docs or agent instructions, and revise the wiki as the work proceeds.

### Evidence Graph

The committed contract trace from product requirements through package-independent system specifications to public source JSDoc, including stable anchors, citations, exclusions, README participation, lint populations, and triangular reachability, `.agents/skills/evidence-graph/SKILL.md`. Read before adding, moving, or reviewing requirements or specifications, changing public-export evidence JSDoc, or reshaping repository `@ttsc/evidence` configuration and guards.

### Review

Self-Review, unqualified review, and exhaustive solo issue-discovery rounds, `.agents/skills/review/SKILL.md`. One reviewer inspects one whole declared surface and repeats fresh rounds until a complete pass finds no sound improvement or meaningful candidate. Inside a campaign that means each issue owner reviews its own issue and the main agent then reviews the integrated diff; a surface is never split across agents. Read the multi-agent skill only for an explicitly requested team, parallel, or multi-agent review.

### Multi-Agent Workflows

Isolated-topology variants live under one overview skill, `.agents/skills/multi-agent/SKILL.md`, with separate detailed topic documents. Read it only when the user explicitly asks to split discovery or review across agents, or to isolate implementation into per-batch worktrees, branches, and pull requests. Parallel implementation by itself is not a reason to read it: the ordinary issue campaign already implements in parallel inside one checkout and one branch.

### Discussion

Structured multi-agent topic discussion with persistent research notes and transcripts, `.agents/skills/discussion/SKILL.md`. Read only when the user explicitly asks for a discussion; review and issue discovery do not imply discussion.

### Issue Campaign

Solo repository-wide issue discovery, main-agent-vetted issue publication, DAG-ordered parallel implementation by one owner per issue in one checkout and one branch, one unified pull request per cycle, and campaign closure (the conquest loop), `.agents/skills/issue-campaign/SKILL.md`. Each owner Self-Reviews and pushes its own work; the main agent owns every shared integration file and closes the cycle with one integration Self-Review. Read when the user asks for a broad audit, many issue candidates, or an issue-to-implementation campaign; do not use it for one already-defined issue.

### Experiment

Ad-hoc experimentation: a disposable source-linked sandbox under `experimental/`, briefed and steered through a live Claude Code or Codex session against the working tree, `.agents/skills/experiment/SKILL.md`. Read when the user wants to try something out, run a benchmark against an authoring agent, or drive a generated project's scripts by hand.

### 3D Modeling

What automovie models and what it refuses to model, plus the verification discipline every geometry, parameter, and derived-data change is held to, `.agents/skills/3d-modeling/SKILL.md`. Read before any model, geometry, rig, morph, or asset-pipeline work, and before proposing anything that would raise a figure's fidelity.

### Viewer Verification

Driving the viewer/playground through the Playwright library to inspect renders, poses, and motion against expectation, `.agents/skills/viewer-verification/SKILL.md`. Read before claiming a viewer or render change works, and to reach a real GPU context rather than a software fallback that reads like one.

### Pull Request Submission

Branch, commit, pull request, check, and merge flow, `.agents/skills/pull-request/SKILL.md`. Read when shipping a topic-unit PR under the standing instruction, when the user asks to open, update, or merge one, or when a standing autonomous mandate authorizes end-to-end delivery; never merge on unprompted initiative.

## Maintenance

### Writing style

AGENTS.md and SKILL.md files are read by humans as well as agents. Read the documentation skill's [Instruction authority](.agents/skills/documentation/SKILL.md#instruction-authority) section before editing either; it owns instruction classification, semantic ownership, writing form, link integrity, and the two-clean-round review gate.

### AGENTS.md

This is the single shared entry point for both Claude Code (via `CLAUDE.md -> @AGENTS.md`) and Codex CLI. Keep it to the brief product identity, global attitude, and skill index. The H2s are `## Attitude`, `## Skills`, and `## Maintenance`; `## Attitude` is the one place global agent-behavior rules live.

Update AGENTS.md only for repository-contract changes: a new skill area, a renamed or merged skill, a workflow that no longer fits an existing skill, or a coding-agent rule that applies globally before any skill loads. This file and the skills are living documents: keep them current as conventions, layout, and the mission evolve.

### Skills

- **Location.** `.agents/skills/<kebab-name>/SKILL.md`. No numeric prefix. Each file opens with YAML frontmatter whose `name` matches the directory and whose third-person `description` states what the skill covers and when to use it; Codex requires the frontmatter to load the skill. Claude Code only auto-discovers `.claude/skills/`, so it reads these via the AGENTS.md pointers rather than the frontmatter.
- **Core in SKILL.md, conditional topics as sibling documents.** Keep always-applicable procedure in SKILL.md. Move a topic needed only under a specific condition to a one-level-deep sibling document and link it with that read condition.
- **Two trigger surfaces, one scope.** The frontmatter description is the full trigger contract, including exclusions. The AGENTS.md pointer mirrors that scope more briefly. Correct the frontmatter first when the scope changes.
- **Create or merge.** Add a skill when a substantial repository concern would otherwise inflate AGENTS.md beyond an index. Merge sibling concerns when they share most of their structure.
- **Repository skill files only.** Keep repository skills to `SKILL.md` and conditionally loaded sibling documents. Do not create separate `multi-agent-*` skills or `agents/openai.yaml`; parallel variants belong under `multi-agent/`.
- **Headings are plain.** No chapter numbers in skill or AGENTS.md headings. Use descriptive titles.
- **Current set.** The repository skills are `project`, `development`, `scaffold`, `documentation`, `evidence-graph`, `review`, `multi-agent`, `discussion`, `issue-campaign`, `experiment`, `3d-modeling`, `viewer-verification`, and `pull-request`.
