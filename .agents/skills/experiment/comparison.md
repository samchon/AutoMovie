# Comparing Several Productions Under One Harness

Read this document when one run puts several productions under one harness at the same time and the point of the run is to compare them. [briefing.md](briefing.md) owns what a brief says and what it withholds, and [steering.md](steering.md) owns how one live session is driven. This document owns only what changes when there are several sessions, and what has to be separated before a comparison means anything.

Two failures make a comparison worthless, and both are cheap to prevent and impossible to repair afterwards: a harness that moved between two productions, and a verdict issued by the agent that commissioned the work.

A comparison run is still an experiment, so [Read The Result](SKILL.md#read-the-result), [Run The Same Brief Twice](briefing.md#run-the-same-brief-twice), and the [campaign record](records.md) apply unchanged. Several productions do not add up to a control.

## Fix The Harness Before The First Writer Starts

Freeze the common harness, the shipped skills, the contract family behavior, the stage semantics, the compiler gates, the review completion rule, and the observation plan before any writer launches.

A comparison is only a comparison where the productions differ in their subject and in nothing else. A harness edited between two productions makes every later difference unattributable, and unlike a brief the harness cannot be restored by rerunning it, because the earlier production already paid its cost against the earlier harness.

One production is one experimental unit. Do not merge two units, do not silently drop one, and never let a unit discharge an obligation with another unit's evidence.

The packed product tree is part of the harness, so refreshing one unit's packages moves that unit off the harness the others are on. A sandbox pins its tarballs by content digest, which is what makes the drift checkable: compare the pinned digests across units before reading any difference between them as a difference in the work. When a repack is genuinely needed, refresh every unit and record the boundary, because [A Repack Is A Change To The Production](steering.md#a-repack-is-a-change-to-the-production) already invalidates each unit's own comparands.

## Keep Judgment Away From Commissioning

These four roles replace [briefing.md's Observer](briefing.md#keep-the-roles-apart) for the length of a comparison run. That role holds measurement and judgment together, which one benchmark can afford and a comparison cannot, so it is split here into the reviewer, the liveness observer, and the coordinator. The authoring agent and the repository issue owner rows carry over unchanged, the first as the writer below.

| Role | Owns | Never |
| --- | --- | --- |
| Writer | One production: its research, design, source, fan-out, and repairs | Another unit's paths, the harness, or the verdict on its own work |
| Paired reviewer | The PASS or FAIL at each gate of that one production, read over the complete corpus | Editing content, moving stage state, staging, committing, or pushing anything |
| Liveness observer | Whether each unit is alive and moving, for the whole run | Any judgment about content |
| Coordinator | The harness, the launches, recovery, the records, and the final cross-work review | Writing production source, or sending content feedback to a working writer |

Each active production gets one persistent writer and one separate persistent read-only reviewer on the same interpreting model, and that pair holds across every layer. Enforce read-only through the tools or permissions the reviewer is given, because a role stated in prose is not a role the harness can refuse to break.

The whole run gets exactly one liveness observer. A per-production observer means several agents supervising overlapping scope, and the writer then receives contradictory instructions from two of them.

The combination this separation exists to break is one agent holding commissioner, experimenter, and reviewer at once. That agent's work drifts toward its own taste, and its content feedback arrives on layers that are still drafts, where incompleteness is the expected state rather than a finding.

## A Gate Is One Invocation And One Complete Pass

A gate review is not a loop-until-dry round. `PASS` ends that gate, resumes the same writer immediately, and requires no second clean audit. `FAIL` leaves the stage where it is and returns every finding in one batch, and the same writer resumes on the repair.

Clean-round requirements belong to the procedures that declare them, and no gate is one of those procedures. The [review skill](../review/SKILL.md#self-review) closes a Self-Review on one complete round that finds nothing, and the [documentation skill](../documentation/SKILL.md#agent-instructions) separately requires two consecutive clean rounds over an agent-instruction diff. Demanding a duplicate clean pass at a gate uses the reviewer for nothing and pays a full corpus read for it.

## Judge Each Gate By Its Own Purpose

Two ladders run at once and neither substitutes for the other. The graph stage ladder is what a reviewer judges, and the compiler scope ladder is what the compiler judges. The stage ladder runs `disabled -> draft -> evidence -> review`, and the three transitions below are the ones a reviewer is asked to decide. The [review skill's rule that a claim the compiler can decide is not a review criterion](../review/SKILL.md#a-claim-the-compiler-can-decide-is-not-a-review-criterion) owns that division.

| Gate | Judged on | Not yet judged on |
| --- | --- | --- |
| `draft -> evidence` | Completeness, hierarchy, continuity, specificity, and consequence of the content itself | The evidence population, which has not been paid yet |
| `evidence -> review` | The content again, plus whether every evidence relationship states something true | Review citations and fingerprints, which are not written yet |
| `review` completion | Everything, including the citations, the observations, and the fingerprints | Nothing |

Applying a later gate's standard to an earlier artifact is the most common way a comparison run stops. A first draft is not an incomplete evidence payment, it is a first draft.

A shape without a narrative ladder still has gates. A library has no treatment or script, so its writer moves along `settings -> applicable design -> matching source -> compiled artifact -> observation and review`, and the reviewer judges each stage transition on that ladder rather than looking for a narrative one.

## Leave A Working Writer Alone

Send no content feedback while a writer is working. Outside a submitted gate, the coordinator's preference is a preference and not a finding.

[Send Observations, Not Causes](briefing.md#send-observations-not-causes) governs what a message may contain when one is warranted. This rule governs when a message is warranted at all, and under a comparison run the answer is at a gate or at a liveness failure.

## Read Liveness From Artifacts, Not From Self-Report

Read the signals this harness actually leaves, and say which one you are reading before you read it. A process that exists is not a unit that is working, and a report that work happened is a claim about the work rather than a reading of it.

[steering.md](steering.md#your-own-instruments-fail-plausibly-too) owns those signals and their failure modes, including the three that must agree before a turn is called over, and the finding that process and transcript answer whether the session is alive while only the disk answers whether work is happening.

Do not carry over a signal the harness does not leave. A sandbox under `experimental/` is gitignored and holds no repository of its own, so commit movement is not readable here. What moves instead is the sandbox tree, the compiled revision and input fingerprint, and the receipts a recompile invalidates.

What a comparison run adds is that the observer reads those signals for every unit on one cadence, so a stalled unit is visible against its moving siblings instead of only against itself.

## Counts Are Alarms, Not Scores

Element counts, prototype counts, and elapsed time tell you where to look. They do not rank productions, and they never carry a causal claim.

Without a control, report the run as exploratory and say so. [Carry The Numbers Forward As Evidence](briefing.md#carry-the-numbers-forward-as-evidence) states the same limit for a single run, and several runs sharing one harness do not manufacture the control that none of them had.

Different subjects are separate experimental units, not replicates of one condition. Same-subject repeated runs can establish only `consistency-only` or `variability-found`. A `controlled-comparison` requires independent repetition on both sides of a predeclared comparator, exactly one `changedAxis`, and an otherwise frozen basis. [records.md](records.md#declare-the-causal-ceiling) owns the complete matrix and the rule against a fixed global sample size or metric.

## The Cross-Work Review Is Its Own Surface

A per-production review never substitutes for the comparison. Each writer's reviewer read one unit, so anything that appears only between units is invisible to all of them: a harness defect every writer worked around differently, a contract every writer read the same wrong way, an instruction that was clear to three and ambiguous to the fourth.

The coordinator closes the run by reading all productions as one surface in one round, and separates what is a common harness defect from what is specific to one unit. This is the same structure the [issue campaign](../issue-campaign/SKILL.md) uses when owners' rounds never add up to the integration round.

## Known Failures

| Area | Symptom | Rule |
| --- | --- | --- |
| Supervision | Work drifts toward the coordinator's taste, and feedback arrives on layers still in draft | One agent never holds commissioner, experimenter, and reviewer together |
| Supervision | A writer receives contradictory direction from two supervisors | One liveness observer for the whole run, never one per production |
| Ownership | A reviewer or observer edits, stages, or commits an artifact | Read-only is enforced by tools or permissions, not stated in prose |
| Ownership | Two units contend over one file, one config key, or one scratch name | Every shared resource on the machine is prefixed by its owner, and [One Machine, Several Campaigns](steering.md#one-machine-several-campaigns) applies in full |
| Gate | The reviewer is asked for a second clean pass and finds nothing twice | One invocation, one complete pass, then `PASS` or a single batched `FAIL` |
| Gate | A run stops because an early artifact was judged against a late gate | Each gate judges only what its own transition is for |
| Record | The result dies with the sandbox | Operational status goes to the ignored `.wiki`, durable conclusions to the issue, and a baseline to the tracked [baseline directory](../../../experiments/baselines/README.md) in its fixed format before the sandbox is deleted |
| Record | A number in prose disagrees with the artifact it came from | Re-count when you move a number into prose, and cite what you re-counted from |

## What Is Not Imported

A shared commit lock serialized through one file is not adopted here. AutoNovel's round-three checkpoint records one left present at zero bytes after the compound command that was supposed to acquire and release it was refused by policy, and all four writers were then unable to commit.

The lesson is the transferable part: a lock whose acquisition and release depend on one command surviving is a lock that leaks. AutoMovie needs no such lock in a comparison run, because each unit gets its own sandbox and the [issue campaign's path ownership](../issue-campaign/development.md) already handles a shared checkout without touching the staged index.
