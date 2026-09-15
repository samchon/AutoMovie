# Offline measurements

Use these measurements after a current compile when a design question is exact in generated geometry or bindings and a frame would answer it only indirectly. They consume the same typed result as the source viewer and delivery consumer, and do not become a review verdict. Open every emitted artifact, read every finding and census, and state the resulting observation in the design review that asked the question.

Execute the current producer before measuring. A result from an earlier source revision is not evidence about changed source.

## Placement and storage

Use the engine's placement, support, overlap, and storage queries on each current built environment. Declare reference ground height and contact tolerance in metres in the relevant source input. Without that declaration preserve `not-run` for support; overlap candidates and storage counts may still be measured.

Read the support report's measured, grounded, borne, floating and unresolved populations together. The overlap report lists bounds candidates and comparisons, not proven triangle collisions. Population bounds cover each compressed set as a whole; they do not certify every member. Contact is not a load-bearing, stability or gravity simulation result. Resolve the candidate families against the actual geometry and intended connections before claiming the spatial requirement is satisfied.

The census separates owned models, external references, parts, population sets and represented members. Storage measures compact UTF-8 JSON and byte-identical serialized geometry repeats. Use those observations to share prototypes and retain instancing where the authored content permits it. A repeated geometry count alone does not prove whole models, materials or placements interchangeable. Reports retain the compile fingerprint and never assign a review verdict.

## Building reports

Run `npm run building:report` when a compiled building's spatial or system review needs drawings, schedules, quantities, services, or declared performance studies. The command collects every building this production holds: the ones compiled shots stage, and the ones a library materialized as the delivered work itself. It takes each once by id and refuses two different records under one id instead of choosing one by shot order; where a shot and a library carry the same id, the staged record wins, because that is the one a frame was drawn from.

Keep derived drawings as SVG and record measurements in the authored review. Read the room schedule's declared volume box and measured content box as separate facts: the first says what the space claims to contain, while the second says what its staged members actually occupy. Read every declared gap with its status, reason, and remedy. A gap may name an unsupported derivation or a study that could run but lacks a production input; neither is repaired by editing the report.

The command exits successfully when no built environment is staged or materialized and says that there was nothing to draw, count, or study. That is a truthful empty population, not a clean building review. It also tallies the two provenances apart, and the difference is what a citation may rest on: a staged building has frames a delivery review can open, while a materialized one has none, so a claim about how it looks rests on these drawings and nothing else. Never stage a dummy shot to make a library building look photographed.

Reports are tracked sidecars worth comparing across revisions, but they remain derivations. Correct the design or declared study inputs and run the command again instead of hand-editing a sheet or report.

## Texture scale

Run `npm run texture:scale` when reviewed material work binds textures whose physical or normalized scale must survive the geometry that receives them. The command measures each distinct model produced by compiled shots or materialized recipes and refuses two different model records under one id.

Read the final census together with the findings. It counts models, parts, parts carrying texture coordinates, structured texture bindings, and bindings that declare a checkable `normalized` or `surface-metres` coordinate source. An empty finding list with zero checkable claims means nothing was measured and is not a texture-scale review. Declare `coordinateSource` on the bindings whose scale matters, compile, and measure again.

A contradictory normalized binding is an error and makes the command fail. A surface too small to show one whole `surface-metres` tile is a warning because fitting one image to one face can be deliberate. Resolve the authored intent rather than converting every warning into a refusal.

## Geometry questions

Use a source module when a review needs distance, reach, ground, formation, effect, film-time, pose, or camera measurements. Pass the producer's actual design, compiled shots, and film values directly to `measureAutoMovieGeometry` from `@automovie/engine`. The query reads only those explicit inputs; preserve its refusal when they cannot answer the question.

Read each answer as the measurement it is. A formation's ground violations count only its representative members, the first, middle and last slot of each chunk, placed from the compiled record on its terrain snapshot. A camera answer projects subject roots and does not measure occlusion. An effect's visibility risk is its density along the camera's central ray, not a rendered frame. None of these is a review verdict; state what was measured in the review that asked.

## Gate use

Run only the measurements the active design branches and delivery actually call for. The commands contribute falsifying observations to a space, material, model, instance, or system review set; their existence and exit code satisfy no principle, obligation, discovery duty, or evidence citation by themselves. After a source, design, binding, study input, or compile fingerprint changes, regenerate the current state and repeat every affected measurement before renewing that review. [Capture](capture.md) owns rendered artifact and frame identity checks.
