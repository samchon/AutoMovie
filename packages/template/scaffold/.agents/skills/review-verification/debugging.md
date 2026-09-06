# Debugging Handbook

Debug from the first authoritative disagreement, not from the final unattractive frame. AutoMovie has distinct owners and gates; a symptom at review can originate in prose, design, source, compiler, engine, capture host, repaint adapter, renderer, media, or stale evidence.

## Triage order

1. Read the exact diagnostic code, target, phase, path, message, and returned data.
2. Identify the owner named by the diagnostic.
3. Reproduce with the smallest current input at that boundary.
4. Compare declared identity and actual bytes or values.
5. Correct the owner, then rebuild only the documented downstream chain.
6. Capture fresh evidence; never cite a stale receipt.

Do not begin by deleting generated state, widening tolerances, adding casts, rerolling diffusion, or changing several layers at once. Those actions destroy evidence about cause.

## Ownership failures

If a generated digest, registry path, id, or fingerprint disagrees, stop consuming the output. Never edit compiler-owned files. Correct tracked design or source and run atomic compilation. If the project-state reader reports `project-state-changed`, wait only long enough to stop concurrent writers, then retry the read; do not treat either snapshot as current.

If a target is missing from the evidence registry, verify source binding, named export, design id, compile success, and production namespace. A plausible id in prose does not register an artifact.

## Derived-artifact failures

A `derived-artifact-*` refusal is not cleared by compiling. The ledger records a generator, its declared inputs, and the exact output bytes; compilation verifies that record and never runs a generator or repairs a stale result. Correct what the occurrence names, the generator, a declared input, an unsafe path, or a colliding asset registration, then rerun the explicit generation command before compiling again. Compiling first is the loop that has no exit.

Never edit the ledger or the output bytes to make a digest agree. That replaces a refusal with a false statement about what produced those bytes, and the next reader has no way to detect it. Read [Compilation](../source-authoring/compilation.md) for what each code means and whether it names the basis or the output.

## Geometry and motion failures

Reduce the question to engine facts: coordinate basis, transform chain, pose sample, reach, distance, formation slot, camera projection, contact, event time, or bounds. Inspect units and local/world conversion. Test the exact failing time and neighboring frames. Correct the earliest bad transform or contract, not the downstream pixel.

For continuity, compare outgoing and incoming state: position, facing, pose, gaze, held objects, gait phase, event completion, sound tail, and edit source offset.

Ask the compiled artifact what it is before you ask a camera to show you. [Inspection](inspection.md) describes one compiled subject exactly, its kind, prototype, placement, transform, declared and measured bounds, and members, and diffs one compiled artifact against another, with no render involved. A part that compiled to a single box, a placement off by a storey, and a brace spanning three bays while rising a fraction of a metre are all arithmetic there and guesswork in a frame. Start there whenever the question is what a thing is or what changed, because a description is cheap, exact, and stays true when the lighting does not.

When the fault is inside a building, the thing hiding it is the building. A camera moved into a room shows that room, and no exterior angle shows any of them. Cut the resolved scene instead: a section plane removes a half-space so a storey reads as a plan or a wall opens into elevation. [Inspection](inspection.md) owns both halves of that cut, the calculation that says how a subject's bound stands against the planes and the call that makes the cut visible, plus the reading rules each one needs. A section is an inspection viewpoint and never delivery evidence.

When the question is not where the fault is but whether one thing is right, open that thing by itself. The scaffold's `viewer/subject.html?shot=<id>&subject=<kind>:<id>` resolves the key against the compiled shot before it decodes anything, so a mistyped id costs a line of text rather than a scene. It then derives its own eye from the subject's content box and steps that eye around a fixed turntable plan. Left and right step the azimuth, up and down change the elevation ring, the wheel or `-` and `=` pull the distance, `F` refits, `Backspace` opens the owner, and `X` cuts away the half-space the eye is in so a room reads from inside instead of presenting its outer wall. Opened with no `subject` parameter it lists every space and population of the shot as links and decodes no model at all, which is the way in when nothing has been named yet.

Content extent rather than declared extent is the load-bearing choice there. A room is declared as a convex cell and the thing standing in it is a different box, so an eye derived from the cell frames empty air facing a wall. The page prints both boxes and says which one it used, and it falls back to the declared one only for a subject that has no content box at all. The member list the page prints is the description's bounded sample, so the count above it is the population and the links are not.

What that page returns is a subject key rather than a coordinate, which is the reason to reach for it before the free camera. An `element:` key is a name the next agent pastes into the same field to open the same thing, where a position is a place two people can disagree about having visited. The key vocabulary is the viewer's and differs from the compiled artifact's in one place: a space, an element, an instance set, and an instance are spelled the same on both sides, while a placed part is `part:<node>/<part>` here. The page prints the compiled id beside the key whenever the two differ, and a key may carry a trailing revision after an `@`, which the page reports when it is not the revision it compiled.

A prototype is refused rather than framed, and so is `model`, which is the other spelling of the same thing. Its box is measured in model space, so aiming a world camera at it stages the world origin and shows whatever happens to stand there, which looks like agreement and is a different thing; open a placement of it instead, or the prototype turntable the refusal names. Built environments, buildings, storeys, meshes, primitives, formations, and formation slots are refused the same way, each refusal naming what to open instead. The page installs no capture hook and writes nothing, and it carries the same two caveats as the free camera below: it holds the shot's opening second, and it shows the level of detail this eye's distance selects.

When the authored camera is the reason you cannot see the fault, stop reasoning about the frame and go and look.

The scaffold's `viewer/inspect.html?shot=<id>` opens the same compiled shot with the camera in your hands. Fly with the arrow keys or W A S D, rise and descend with Space and C, and click for pointer-lock mouse look. It prints the eye's position and lens on screen, so anything odd is reported by coordinate rather than by adjective.

A set heavy enough to draw slowly flies slower than the speed you asked it for, and the line says so: when the pace the eye is actually keeping differs from the pace you set, both are printed. Plan a flight from the second number and raise the speed until it reads what you wanted. The position beside it is exact whatever the frames cost, so a finding is still written from a coordinate.

That is what makes it a debugging instrument. A staging fault hidden behind the shot camera, geometry that only reads wrong from an angle nobody authored, and a placement you believed rather than measured all become one observation.

It installs no capture hook, writes nothing, holds the shot's opening second, and shows the level of detail your own distance selects, so it proves nothing on its own. Review evidence still comes from `npm run preview` and `npm run render`, and a coordinate you read there is a hypothesis to confirm against the engine query that owns it.

## Capture and render failures

Run the scaffold's configured doctor or verify path. Check current compile identity, registered target, host runtime identity, decoded PNG/media facts, raster, frame rate, frame count, duration, and atomic manifest. `captured:false` means no evidence exists.

`generated-stale` is not one of these failures and no doctor or verify command clears it. `npm run preview`, the repaint adapter, and review all read compile status through a read-only lint that is built never to repair what it reports, so the tools can only keep refusing while the generated tree lags current design and source. Run the ordinary scaffold compile command, then capture again.

If a renderer produces bytes but the receipt gate rejects them, the bytes are not deliverable. Preserve the diagnostic, correct runtime or configuration, and regenerate.

An existing unresolved chunk or proxy is not a missing render. Read the typed artifact finding from `npm run render -- status` or the four disposition sets from `npm run render -- gc` first. Apply removes only `verified-stale` exact generations and quarantines only an exact integrity-failed generation; unsafe locators, foreign generations, unavailable reads, changed observations, and invalid manifest references remain under `manualAdjudication`. Preserve that target and its evidence until an operator proves the next action, because rerunning render will refuse to erase or overwrite it.

## Repaint failures

First confirm that deterministic source and full beauty/control grid are correct. Then check reference authorization and digest, adapter identity, fixed parameters, output media facts, and input-race diagnostics. A reroll changes identity and requires review; repeated rerolls are not debugging unless one controlled variable and a falsifiable hypothesis are recorded.

## Review failures

`review-evidence-missing` means a shot is being reviewed while frames its own contract declares are absent at that shot's current fingerprint, or a staged model is being reviewed without the turntable set an asset review is judged from. It is not a capture failure and retrying the compile will not clear it: capture the exact frame-and-pass pairs the message names, then compile again. If the shot moved after those frames were drawn, the old bundles are still on disk and still do not count, which is the refusal working rather than failing. Reading a stale bundle as evidence is the one error this code exists to prevent.

Resolve every error diagnostic before writing a word of review prose. A review composed against a refused compile describes a production that does not exist.

`review-outcome-artifact-missing` and `review-outcome-artifact-malformed` are compiler-publication failures. Compile the same current inputs, having first removed only the damaged publication the occurrence names, and prepare again. `review-outcome-contract-mismatch` reads like their sibling and is not one; it belongs under Escalation record below.

A subject review is not a shot review, and their evidence does not convert. A capture that happens to contain the subject cannot discharge subject coverage, and a subject verdict cannot discharge a frame, range, sequence, film, or delivery obligation. [Inspection](inspection.md) owns what subject coverage currently reports; read it before treating a thin coverage record as something you failed to do, and write the honest incomplete state into the citation rather than retrying until it looks complete.

`review-subject-viewpoint-unsupported` is no longer the standing state of that surface, and reading it as one costs a round. It now fires only while coverage is indeterminate, which means no viewpoint plan is published for this subject at all; run `inspectProductionSubject` on the exact compiled id and the code stops applying. One permanent case shares it: a subject that inspection cannot frame is refused under the same code, and for that one the viewpoint range is not observable at all. The message distinguishes the two, so read it instead of assuming the first.

Once a plan exists, stop looking for a warning and read the coverage record, because an honest `not-run`, `partial`, `stale`, or `reviewed` is reported there rather than as a diagnostic. Three mechanics explain most surprises in it. The plan is published before the first picture is drawn, so a sweep that refuses partway leaves its denominator standing and reports `partial` instead of a clean pass over a smaller plan. Each receipt states the revision it was drawn at, so a sweep taken before a recompile reads `stale` rather than observed. And an observation counts only while its artifact still hashes to the digest its receipt recorded, so a picture edited or replaced afterwards drops back to `missing` rather than passing on its filename.

## Escalation record

When the root cause is a product boundary rather than authored content, record minimal input, exact current commit, production and target ids, expected and observed values, diagnostic, ownership trace, and why existing correction paths cannot resolve it. That evidence is suitable for a new issue; a screenshot and intuition are not.

A refusal can declare that boundary itself. `review-outcome-contract-mismatch` says the compiler that wrote an acceptance artifact and the reader that consumed it disagree inside one shipped revision, which no author-owned edit reaches. Record the artifact path and the validator paths it names, and stop. Retrying an unchanged compile is not a fix, and rewriting source that was already correct to make a product defect go quiet is worse than the defect.
