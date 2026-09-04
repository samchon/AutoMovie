# Offline measurements

Use these measurements after a current compile when a design question is exact in generated geometry or bindings and a frame would answer it only indirectly. They read compiler-owned state rather than source, and they do not become compiler output, delivery evidence, or a review verdict. Open every emitted artifact, read every finding and census, and state the resulting observation in the design review that asked the question.

Both commands refuse missing or stale generated state. Compile again before measuring rather than treating old output as evidence about changed source.

## Building reports

Run `npm run building:report` when a compiled building's spatial or system review needs drawings, schedules, quantities, services, or declared performance studies. The command collects every building this production holds: the ones compiled shots stage, and the ones a library materialized as the delivered work itself. It takes each once by id and refuses two different records under one id instead of choosing one by shot order; where a shot and a library carry the same id, the staged record wins, because that is the one a frame was drawn from.

Each building writes deterministic SVG sheets and `report.json` under `reports/<building>/`. Read the room schedule's declared volume box and measured content box as separate facts: the first says what the space claims to contain, while the second says what its staged members actually occupy. Read every declared gap with its status, reason, and remedy. A gap may name an unsupported derivation or a study that could run but lacks a production input; neither is repaired by editing the report.

The command exits successfully when no built environment is staged or materialized and says that there was nothing to draw, count, or study. That is a truthful empty population, not a clean building review. It also tallies the two provenances apart, and the difference is what a citation may rest on: a staged building has frames a delivery review can open, while a materialized one has none, so a claim about how it looks rests on these drawings and nothing else. Never stage a dummy shot to make a library building look photographed.

Reports are tracked sidecars worth comparing across revisions, but they remain derivations. Correct the design or declared study inputs and run the command again instead of hand-editing a sheet or report.

## Texture scale

Run `npm run texture:scale` when reviewed material work binds textures whose physical or normalized scale must survive the geometry that receives them. The command measures each distinct model produced by compiled shots or materialized recipes and refuses two different model records under one id.

Read the final census together with the findings. It counts models, parts, parts carrying texture coordinates, structured texture bindings, and bindings that declare a checkable `normalized` or `surface-metres` coordinate source. An empty finding list with zero checkable claims means nothing was measured and is not a texture-scale review. Declare `coordinateSource` on the bindings whose scale matters, compile, and measure again.

A contradictory normalized binding is an error and makes the command fail. A surface too small to show one whole `surface-metres` tile is a warning because fitting one image to one face can be deliberate. Resolve the authored intent rather than converting every warning into a refusal.

## Gate use

Run only the measurements the active design branches and delivery actually call for. Inspect render receipt v3's raw integer timebase and exact rational frame identity, and reject any epsilon comparison, decimal reconstruction, or runtime substitution. The commands contribute falsifying observations to a space, material, model, instance, or system review set; their existence and exit code satisfy no principle, obligation, discovery duty, or evidence citation by themselves. After a source, design, binding, study input, or compile fingerprint changes, regenerate the current state and repeat every affected measurement before renewing that review.
