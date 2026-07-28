# Shot Contract

`setShotContract` says what a shot must accomplish and which source export implements it. It never stores dense keyframes or an action list.

Bind one project-relative TypeScript module and named export. Declare duration, participants, opening and closing named states, camera readability, semantic events, and review frames. Duration must equal an integer production frame count divided by fps; event windows and review times must lie inside it. Formation participants must reference current formation designs.

Every named opening state, closing state, and event needs at least one machine-checkable predicate. Use joint-angle, world-position, or distance predicates with explicit operands, comparison, value, and tolerance. Descriptive prose gives creative meaning but never proves realization.

The coding agent writes the build function in `src`. It may use loops, helpers in the supported source boundary, explicit design seeds, compiler-provided `runtimeModels` and `formationSlots`, and deterministic engine oracles. It returns `eventSamples`, its authored scene, sparse motions, and shot. For every contract event, choose exactly one sample inside its declared window. Do not return models, formation nodes, or a contract-compliance witness: the compiler owns and measures those facts.

IDs, duration, camera, motion references, model wiring, ROM, predicate outcomes, and temporal rules are engine-validated. The compiler samples opening predicates at zero, closing predicates at shot duration, event predicates at declared samples, and required camera subjects at review times. A failed measurement blocks compilation even when source prose claims success.

Camera validation projects each required subject's animated root through the current camera, FOV, clip planes, and production aspect ratio. It does not measure `maxOcclusionRatio`, full-body framing, or pixel visibility. Treat that value as the maximum allowed pixel-occlusion threshold, inspect current beauty, mask, depth, outline, or pose PNGs, and cite the exact required frames through `submitReview`.

Every shot declares at least one review frame so visual review has a reachable exact evidence target. Review frames are deliberate evidence points: contact, reveal, formation transition, or a continuity boundary. Request the guide passes needed to judge the criterion; beauty alone cannot prove depth, masking, pose, or outline facts.
