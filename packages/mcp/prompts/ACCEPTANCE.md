# Acceptance Scenarios

A tracked acceptance record makes an observable contract addressable.

Frame criteria name a review-frame id and pass. Event criteria name a semantic event. A frame or event criterion targeting the whole film must also name its owning `shot`; shot-local ids are not assumed globally unique. The current deterministic metric is `runtime-seconds`; physics and occlusion remain explicit geometry or frame-review questions until their operands and measurement protocols are defined.

A `story-sync` criterion states that events in different shots happened at one moment. Cutting between them asserts nothing on its own: the edit is presentation order, so two shots covering the same instant are merely adjacent in it. The claim becomes measurable when the production declares `storyClock` and each addressed shot declares `storyTime`, pinning its local zero to a story-clock second. The criterion names two or more `{ shot, event }` pairs and a `toleranceSeconds`; it holds when the widest gap between the realized story times is within that tolerance. It targets the film, because no single shot owns a claim about several. Design validation refuses one whose declared event windows could never fall inside the tolerance, and compilation refuses one whose realized times do not, naming the measured gap. A shot with no `storyTime` asserts nothing about story time and behaves exactly as before.

Required scenarios enter the review and final gates. An event or metric review must cite its exact passing compiler-derived outcome, not merely quote the acceptance contract. A frame review must cite the exact current frame and pass. Write expectations so another agent can falsify them from current evidence. “Looks good” is not an expectation; “the front rank remains legible against smoke in the mask pass” is.

Keep historical assertions in cited research documents and translate only observable consequences into acceptance. The engine cannot prove that a disputed quotation happened; it can prove timing, distance, continuity, visibility, grounding, and deliverable identity.
