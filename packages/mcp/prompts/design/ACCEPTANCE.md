# Acceptance Scenarios

A tracked acceptance record makes an observable contract addressable.

Frame criteria name a review-frame id and pass. Event criteria name a semantic event. A frame or event criterion targeting the whole film must also name its owning `shot`; shot-local ids are not assumed globally unique. The current deterministic metric is `runtime-seconds`; physics and occlusion remain explicit geometry or frame-review questions until their operands and measurement protocols are defined.

A criterion may only address what its shot already declares. Design validation refuses a frame criterion whose review frame the shot does not own, and refuses one whose pass that review frame does not request, naming the missing reference either way. An event criterion is held to the same rule against the shot's declared events. So asking for the mask is two edits in one topic: add `mask` to the review frame in the shot contract, then name it here. Skipping the first turns the criterion into a dangling reference; skipping the second leaves a pass captured that nothing judges. `SHOT_CONTRACT` owns what a declared pass then obliges review to capture.

`evidence` cites the screenplay scenes this scenario observes, and it is what a required scenario contributes beyond its own verdict. At `review` and `final`, an active scene the index has not exempted and no required scenario cites is refused as unobserved: a compiled realization proves the film covers the scene, and only a required scenario proves somebody was asked to look at it. A cited scene the screenplay index does not declare is refused at every scope, and a required scenario citing a scene the ledger has tombstoned or exempted is refused as a contradiction: the index asserts the scene is absent while the scenario asserts somebody signed for it.

A `story-sync` criterion states that events in different shots happened at one moment. Cutting between them asserts nothing on its own: the edit is presentation order, so two shots covering the same instant are merely adjacent in it. The claim becomes measurable when the production declares `storyClock` and each addressed shot declares `storyTime`, pinning its local zero to a story-clock second. The criterion names two or more `{ shot, event }` pairs and a `toleranceSeconds`; it holds when the widest gap between the realized story times is within that tolerance. It targets the film, because no single shot owns a claim about several. Design validation refuses one whose declared event windows could never fall inside the tolerance, and compilation refuses one whose realized times do not, naming the measured gap. A shot with no `storyTime` asserts nothing about story time and behaves exactly as before.

Required scenarios enter the review and final gates. A required scenario also adds a design review of its own record to the queue that same compile asks to be complete, so authoring one is authoring two obligations.

An event or metric review must cite its exact passing compiler-derived outcome, not merely quote the acceptance contract. A frame review must cite the exact current frame and pass. Write expectations so another agent can falsify them from current evidence. "Looks good" is not an expectation; "the front rank remains legible against smoke in the mask pass" is.

That derived outcome is not recomputed for the review. It is read back from the compiler's own publication under `generated`, digest-matched against the current manifest, and when the reader cannot obtain it review refuses by name rather than deriving a substitute. An absent publication and damaged bytes each carry their own code and are recovered by compiling the same current inputs again; a publication that is valid JSON yet disagrees with the reader's schema carries a third, and it is a product defect rather than anything your source did, so recompiling unchanged is not a fix for it. Read `REVIEW_SHOT` before treating one as an authoring error.

Keep historical assertions in cited research documents and translate only observable consequences into acceptance. The engine cannot prove that a disputed quotation happened; it can prove timing, distance, continuity, visibility, grounding, and deliverable identity.

## A criterion is proved from evidence, not from a compile

A scenario states what must be observable. Nothing about it is settled until the observation exists.

1. `captureFrame` on the shot target at the exact time and pass the criterion names. A criterion whose frame nobody captured is refused as `review-evidence-missing`, and that refusal is the scenario working.
2. `captureTurntable({ asset })` when the criterion is about an authored thing rather than a staged moment.
3. `prepareReview` and `submitReview` cite the criterion ids on the `acceptance-scenarios` check, which is where a scenario becomes a recorded verdict rather than a sentence in a file.
