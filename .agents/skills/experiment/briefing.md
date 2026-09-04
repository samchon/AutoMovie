# Briefing A Benchmark

Read this document when the experiment is a benchmark: an external agent authors a whole production over many rounds while you observe what the product affords it. [steering.md](steering.md) owns the session once it is running, meaning turn boundaries, delivery, process isolation, and proving what the agent reports. This one owns what you tell the agent: what the brief says, what it deliberately leaves out, and what may go into a message afterwards.

A single-prompt experiment needs none of this. There the brief is the question.

Everything below comes from one campaign that ran about a day. Almost none of its lost time was the authoring agent producing bad work. It was the brief being wrong, or the observer's own hypotheses arriving as instructions.

## What The Brief Names

Six things, all settled before the first turn, because a brief edited mid-run can no longer be rerun. One section below owns each.

1. The subject and the references it will be judged against, without the method for building it, and which of the two governs where they disagree.
2. The stages, coarsest first, and what closes each one.
3. The decomposition the production owes by the end of the first stage.
4. The fixed camera set and the artifact queries you will read every round.
5. The condition that ends the run.
6. What you will do and what you will not, so the agent knows which side of the boundary a task is on.

## Say Which Source Governs When Two Disagree

A brief names the subject **and** the references it is judged against, and those two disagree. Not occasionally : twice in one run, on one production, in the same shape.

The fixed massing said "one main body, one garage, nothing else"; the reference plainly showed a chimney. Earlier, the fixed circulation named a straight flight; the reference showed a dog-leg stair. Both times the agent stopped and asked, which is the behaviour to want : it refused to resolve a contradiction in its own instructions by picking the half it preferred. Both times the driver had to adjudicate in flight, which is a decision the brief should already have made.

So the brief states the rule, once, in the section that fixes the massing: **which source governs, and for what.** The ruling that worked was that the fixed graph governs volumes and circulation, the reference governs everything the envelope carries, and a detail that cannot be expressed without changing the graph is a stop rather than a judgement call.

Whatever the rule is, name it before the first turn. A contradiction adjudicated mid-run cannot be rerun, and an agent that meets one with no rule either stops : costing a turn : or picks, which silently makes the brief mean whatever it picked.

## Withhold The Method

A benchmark measures what the agent derives from the product's surface and its guides. Give it the target and the evidence: what the thing is, what it has to end up looking like, and how it will be judged. Withhold how to build it.

That campaign's brief handed over ten reference images and a layout sheet, and the result worth having was the difference between what the agent derived and what it expanded by hand. A brief that had specified the grid would have measured nothing but its own grid.

Withholding costs something you accept knowingly. The agent may take a route you would not have, and that route is the observation.

Withholding fails at the filesystem before it fails at the prompt. One campaign kept its method out of every brief and put it in a `HANDOFF.md` inside `experimental/<name>/`, which is the authoring agent's own working directory; the session read it in its first turn, and the transcript carries the read and the contents. Four axes of that run were then declared unmeasurable, because an agent that has been handed the instrument's traps, the campaign's list of missing scripts, and the fact that `git status` is being watched cannot discover any of them afterwards. Keep every operational document outside the work root. The brief is what the agent may read.

A sandbox under `experimental/` also sits inside this repository's git root, and Codex discovers `.agents/skills/` from that root and injects the whole skill index into the session. The same run measured five repository `SKILL.md` files read, none of them this skill's own documents or `.wiki/`, so what leaks is the repository's engineering practice rather than the experiment's method. No brief can withhold it. Record it as a condition of the run rather than reporting the agent's behaviour as if it had arrived unprimed.

## Naming A Tool Spends The Measurement It Would Have Made

Decide before turn one whether the run measures what an agent does with the tools or whether it finds them, because the brief can only buy one.

One run's session called `getGuideDocument` nine times in the single turn whose message named that tool and told it which guide to read first, and zero times in every turn afterwards. It read product source under `node_modules/@automovie/**` in all of them, twelve times in the same turn it used the tool nine times and twenty times out of twenty-three calls in the turn it used it never, and what it read there (`realizeShotContract.ts`, `stageScene.ts`, the compiler and its interface) is what three of the guides answer. So that run has evidence the tool works and none that an agent reaches for it.

Two consequences for a brief. A tool named once is named for the whole session, so a later turn is not a control for an earlier one. And the observation is not that the agent avoided a costly channel: under Codex both the guide call and the shell call are functions in the same executed cell, so they cost the same, and the difference was the naming.

Measuring discoverability needs a run in which the name appears in no message at all, including the ones that only list what the agent may read.

**And including anything you quote back from the product.** Its own diagnostics name its tools : one refusal used to read *"Run prepareReview, correct the target, and submitReview before this compile scope"* : so relaying a diagnostic verbatim spends the measurement in the act of describing it. A driver caught that with the message already drafted: it had been analysing a contradiction between two commands' remedies, and quoting either one to the agent would have handed over two of the three names the run existed to see whether the agent could find.

The consequence is not "paraphrase the diagnostic". It is that **a finding about the product's text is the driver's to file and not the author's to be told**, and a run measuring discoverability cannot use the product's own error messages as steering material at all. Scan every outgoing message against the tool names, not only against the ones you wrote yourself.

## Send Observations, Not Causes

The withholding rule outlives the brief, and this is the form it takes afterwards. Report what you measured and where you measured it. Name a cause only when you have read the code path that produces it, which as the observer you usually have not.

Whatever you send inherits your authority over the guides the agent works under, so a diagnosis sent as an instruction overrides them without either of you noticing. Three did in that campaign, and each cost a retraction.

| Sent | What it actually was |
| --- | --- |
| Make the coursed ashlar, slate, flags, and boards from texture images | `BUILT_ENVIRONMENT.md` forbids exactly that: those are physical modules, not texture repeats. The masonry had to be retracted and rebuilt |
| The west facade renders as a different material from the south | The light rig. A fill 2.3 times more blue than red at a third of the key's intensity, so one material read as two colours |
| Check whether the leaf-count cap is clamping the foliage | The cap throws rather than clamps, so a clamp would have surfaced as a refusal. The recipe was asking for 288 leaves against a cap of 512 |

Each was reportable without its cause: the two facades differ, the foliage is thin, the masonry does not read as courses. Stated that way the agent diagnoses it against code you cannot see, which is the division of labour the benchmark exists to exercise.

Two of the three were caught only because the message sat in the [delivery queue](steering.md#there-is-no-steering-window-inside-a-turn) long enough to be re-read before it landed. That was luck, not procedure.

Say how you obtained each claim as well, which [steering.md](steering.md#the-agent-will-rebut-you-and-may-be-right) requires for the same reason: an agent told that a claim came from a frame can challenge the frame.

## Stage The Work Coarse To Fine

State the stages in the brief and state what closes each one. Massing and the space graph first, then the shell, then the modules that clad it, then the fit-out, then the finish. A stage closes when it is correct at its own grain, and a closed stage reopens only for a stated reason.

The coarse decisions are the expensive ones to change and the cheap ones to get right early. That campaign's layout was correct on the first day and never moved again, and every defect for the rest of the run was surface: masonry, half-timbering, slates, fit-out.

The ordering also decides what you can read. A stage's defects become legible only once the stage above it has closed, so reviewing the finish while the shell is still moving reads noise as signal and spends rounds on it.

Getting the massing right cheaply and then leaving it alone was the most valuable structural decision of that campaign, and it happened by accident. It is written here so the next one does not have to be lucky.

## Require The Surface Decomposition Early

Ask for the decomposition as a deliverable of the massing stage, before there is anything to clad. One complete visual surface has one owner and no surface is ever split, which the [design-branches document](../../../packages/template/scaffold/.agents/skills/source-authoring/design-branches.md) owns and the sandbox's own `src/examples/surfaceOwnership.ts` teaches as an authoring technique; the [review skill's law](../review/SKILL.md#non-negotiable-review-law) is the same rule for reviewers. What the brief adds is the timing.

That campaign's production restructured itself into one file per elevation, per room, and per courtyard level, with a single owner for each cross-cutting concern, but only halfway through. Before that it was a few large files and the authoring agent could not fan out at all.

The decomposition is also what your findings are addressed to. A finding that names a surface names an owner, and one that names a pixel does not.

## Build The Instrument And Its Baseline Before The First Turn

Build the instrument, prove it, and take round zero with it before the agent starts. [Read The Result](SKILL.md#read-the-result) requires the instrument to be verified before the subject, and a benchmark's instrument then runs unattended for hours against work that changes under it.

Prove it against a known count rather than against a picture. That campaign's fixed-camera sweep called `renderer.render` directly, so every instanced population stayed invisible for four rounds: 2,392 slate modules, 927 ashlar, 1,045 stone flags, 419 oak boards. What it showed was not an empty screen but a plausible one, because the trimmed pieces, quoins, and window surrounds were all present and the frames read as "the edges are laid and the fields are empty". Two rounds of priorities went to the agent on that evidence before it [pushed back](steering.md#the-agent-will-rebut-you-and-may-be-right).

An instrument that draws with a camera of its own must resolve the instanced tiers for that camera first. The compiled shot runtime's `resolveForCamera` exists for exactly that, and its `render` already calls it for the shot's own camera, so this failure appears only in the surveys a benchmark depends on.

State in the brief which fixed camera set and which artifact queries you will read each round. The agent then knows what its work is judged by and can tell you when the set misses something it built. [steering.md](steering.md#prove-the-pixels-are-new) owns the round-to-round comparison itself; what the brief owns is that a comparison needs a baseline that exists before turn one.

## Say What Ends The Run

Name the closing condition in the brief. Your own list going empty is not one.

That campaign closed when both lists were empty against all ten references, the observer's and the agent's. Asking for the agent's list is [steering.md's move](steering.md#ask-for-its-list-when-yours-is-empty); the brief's job is to name the reference set both lists are checked against, so that closure is a comparison rather than an opinion.

## Run The Same Brief Twice

Run the same brief a second time in a fresh sandbox, byte for byte identical, before concluding anything about the product.

A conclusion drawn from one run cannot be separated from that run's character. The second run is what tells a habit of this agent apart from something the brief induced or the product forced.

In that campaign the second run disproved the observer's hypothesis. It was about to conclude that the authoring agent hand-expands grids instead of programming them, and the reproduction derived room boundaries from dimensions without being told to and parameterised the spiral stair from the start. The narrow conclusion that survived, that derivation stops one level up, was a far more accurate description of the product.

Byte for byte identical is why the brief is a file. An agent that received half of its brief in conversation cannot be rerun, and neither can one whose brief was edited mid-run. [Read The Result](SKILL.md#read-the-result) requires reproduction before belief for a single result, and a benchmark's conclusion is a result of the same kind.

## Keep The Roles Apart

| Role | Owns | Does not |
| --- | --- | --- |
| Observer | Measurement and judgment: the instrument, the counts, the frames, the findings, and the turns that carry them | Write production source |
| Authoring agent | The production, including its own fan-out | Change repository code |
| Repository issue owner | One issue the benchmark produced, under the [issue-campaign skill](../issue-campaign/SKILL.md) | Steer the benchmark |

State the first two rows in the brief, because the agent cannot respect a boundary it was never told. Both crossings in that campaign were the observer's: it wired production source the authoring agent was already wiring, and it ran a parallel fan-out that was the authoring agent's to run.

The observer's product is measurement, not code. That is what keeps an observation an observation.

## Carry The Numbers Forward As Evidence

A finished benchmark's numbers describe one subject, one authoring agent, and one duration. They are evidence for the next brief, not constants in it.

That campaign's 192 authored prototypes against 3,474 placings is one building's ratio. Whether the prototype is still the right unit for a subject that moves, or for a crowd, or for terrain, is unmeasured, and a brief that assumes it is has borrowed a conclusion the run never made.

Record what the run did not cover beside what it found, and write the next brief from both halves.
