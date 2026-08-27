# Object and Rigging Handbook

Design the object as a readable form first, then as a hierarchy of controlled degrees of freedom. A technically valid skeleton cannot rescue an unrecognizable silhouette, and a beautiful static mesh cannot serve a shot if its required action has no representable articulation.

## Silhouette-first recipe

Collect front, side, three-quarter, and action references. Identify the few masses and negative spaces that survive at thumbnail size: torso-to-limb ratio, head shape, wheelbase, wing planform, handle opening, blade profile. Encode those before surface detail.

Establish real-world scale and a semantic local frame. Mark front, up, ground contact, center of mass, grip points, emission points, and interaction anchors. Test profiles from all required turntable angles. Thin parts need enough visual thickness and value contrast to survive target raster and outline treatment.

Use primitive recipes as bounded constructive geometry, not as an excuse for arbitrary piles of shapes. Each part should contribute identity, structure, articulation, collision, attachment, or material grouping.

## Hierarchy and pivots

Parent according to mechanical or anatomical motion. Put a pivot at the true hinge, axle, ball joint, or sliding axis. Freeze unintended transforms before binding. A door pivot belongs on the hinge line; a wheel axis passes through its hub; a human limb chain rotates about joint centers.

Where that pivot is written down depends on what the moving thing belongs to, and the two answers are not interchangeable. A building's own door, shutter, gate, or sash states its axis and pivot inside its opening record, in the coordinates the next section names. A prop states them as the local transform of its own articulation node. Authoring the first as if it were the second produces a leaf that no opening drives and no clearance check measures.

The classic arm-axis failure is a mesh modeled along one axis while the skeleton and rest-frame contract assume another. Never fix that with unexplained corrective rotations scattered through animation. Record the asset's basis, retarget once, and verify named left/right chains in rest and extreme poses.

For humanoids, preserve a conventional hips-rooted hierarchy with stable left/right names and a documented T- or A-pose conversion. VRM 1.0 assets use meters, a right-handed Y-up coordinate system, and a normalized humanoid T-pose facing +Z; normalize external assets at ingest instead of leaking foreign conventions downstream.

## Operable openings

A door, shutter, gate, sash, portcullis, or hatch that belongs to a building is not a prop you rig from scratch. The built environment already owns it: an opening names the boundary it is cut through and the element that fills it, and that opening's operation declares the travelling leaves, the named states they stand in, the state the design currently stands in, and the fixed hardware the opening carries. Read `IAutoMovieOpeningOperation` and the records beneath it before inventing a second vocabulary for the same hinge, because the engine measures and refuses that record and not your parallel one.

Each travelling leaf declares exactly one degree of freedom, and this is where a building pivot gets its coordinates. A leaf's motion is revolute or prismatic; the axis, and for a hinge the pivot point on it, are written in the moving element's own local frame, never in world space and never in the host boundary's frame. The leaf occupies the element-local rectangle from that frame's origin to its stated width and height in the XY plane, so a hinge at the local origin with the leaf running along local `+X` is the natural authoring, and it is the rectangle a swept envelope is measured from. Travel is measured from the element's rest pose, so its lowest value is at most zero and its highest at least zero, and the element's authored local transform stays the rest placement instead of being consumed by the hinge.

Swing, slide, and fold are not three contracts. A swing leaf is one revolute panel, a slide leaf is one prismatic panel, and a folding leaf is a revolute panel whose element is parented to another leaf's element, so the element hierarchy already carries the chaining and there is no second parent notion to learn.

The state vocabulary is yours and the arithmetic is the engine's. `closed`, `open`, `vent`, `barred`, and a production's own term are the same kind of record: a named state gives every panel of the operation a value, in radians for a revolute panel and metres for a prismatic one. That is what lets a temple's pivoting bronze leaf, a hall's barred gate, a casement, and a curtain-wall vent be one record under different numbers, so nothing here assumes any period's ironmongery.

`validateBuiltEnvironment` refuses this family by name, and reading the refusals before authoring is cheaper than reading them afterwards:

- an opening declaring panels while naming no filling element, because a leaf that fills nothing is a leaf nobody can point at;
- a panel element that does not resolve, or that is neither the filling element nor a descendant of it;
- a panel element already driven by another panel anywhere in the work, because one element carries one displacement and a second claim would silently lose the first;
- a non-positive leaf width or height;
- a zero travel axis, a non-finite pivot, a lowest travel above zero, a highest travel below zero, a range with no travel in it, or a turning leaf given more than a full turn;
- an operation declaring no panel, or declaring no named state;
- a state that drives an unknown panel, drives one panel twice, leaves a declared panel with no value, or drives a panel outside its own travel;
- a current state naming no declared state;
- an empty or duplicated panel, state, or hardware id, an empty hardware kind, or a hardware element that does not resolve.

Rigging a leaf buys you no visibility change, and this is the connection authors get wrong. The room culler treats a boundary carrying an opening as a portal whether or not a leaf fills it and whatever state that leaf stands in, because a shut leaf is movable state and the cull stays conservative. [Design branches](../design-branches.md) owns that rule and the rest of the space graph; what follows for your rig is that the state a leaf stands in never moves a space between the drawn set and the hidden one, so a shot that needs the room beyond a door out of the picture is solved by framing, lighting, or the design, never by the hinge. What the travel does feed is clearance and, separately, the swing an audience sees: `builtOpeningSweepEnvelope` returns the world volume each panel sweeps across its whole travel, which is the number a swing clearance is argued from, and the next section owns what it takes to put that swing in a frame.

A hinge pin, a knob, a boss, a ring pull, and a finial are surfaces of revolution. [Models and motions](../models-and-motions.md) and this document own the recipe vocabulary that turns a profile into one; go there rather than spelling it a second way here, and judge the result at the distance the shot actually uses, because a turned part that reads in the hand is a smear at room scale and the reverse is just as common.

## Making a leaf move on screen

A named state is a configuration, not a movement. It says where a leaf stands, and a design that only ever states one is a door an author can write open or shut and nobody ever sees swing. What carries the swing is an object-motion clip on the shot, and one channel serves the building's panel and the prop's leaf alike, because they are the same thing: a node in the staged graph turned over the shot's own clock.

Address a building's panel by its staged set-piece node, the environment id and the panel's element id joined as `<environment>/<element>`, which is the node id `builtOpeningPanelPlacements` answers with. Address a prop's leaf by its lowered joint, `<placement>/<joint>`, which the prop gate section below defines. The clips go on the shot's own `objectMotions`, and they are measured rather than trusted: they resolve through the engine's frame solver with every staged prop's profile bound at its own placement prefix, so a track driving a hinge past the travel its profile declares is refused with the channel and the owning profile both named.

An object-motion track interpolates `step` or `linear`. `cubicspline` is refused by name, because a spline's tangents can leave a declared travel between two bounded keys while nothing downstream clamps an object clip; the viewer writes it onto the object verbatim. The rest of what the gate refuses:

- a node no shot staged, and a joint no staged prop declares, because a clip addressing nothing is written, validated, stored, and rendered as silence;
- a node this shot's performance already drives, because a performer moves off its rig rather than off a transform clip that would fight the pose every frame;
- a channel a baked clip already drives, or a clip id a baked clip already carries, since one channel carries one authority;
- a clip id duplicated among the authored clips;
- a key outside the shot's own clock, because a time past the end is data no frame reads.

Getting the numbers for those keys is where an author stalls. `builtOpeningPanelPlacements` returns each panel's world placement at one named state and refuses a state the opening does not declare, so a key at a half-open angle is bought by declaring that half-open state and reading its placement, never by passing an angle to the query. Declare on the opening every state the shot has to pass through, then read them. The query is not reachable from shot source, so a project script asks and the shot carries the keys that come back.

## Profiles, traits, and controls

A skeleton names topology. A profile names semantic capability over that topology. A binding maps profile controls to actual nodes, and it may be applied more than once on one model under its own instance name, which is how a pair of leaves share one hinge profile without sharing an identity. A trait is a typed claim rather than a description: an engine verb looks for its matching trait on the profile, and a model name or a free-form capability label never grants the permission a trait grants.

Expose controls an author can reason about: `doorOpen`, `wheelSteer`, `jawOpen`, not anonymous channel numbers. A control names itself, names the channel it writes, and carries its neutral as a default value with one entry per channel component; the range that bounds it is a profile limit stated beside it rather than a field on the control, and the coupling that makes one control follow another is a driver. Use springs only where secondary motion is intended and bounded.

For handled objects, verify grip anchors, support-hand reach, sight line, and moving parts. For repeated objects, keep one asset identity and instance transforms; do not clone nearly identical geometry into separate semantic objects.

## What the prop gate refuses

An object that is not part of a building is a prop, and `forgeProp` is the gate it passes. Its model contract: the model id must equal the prop's own scene node, since staging joins on it; the origin must be generated unless the spec names the compiler registration its imported bytes came from; and the skeleton must be null. A riggable performer goes through the cast gate instead, and a prop's moving parts are articulation nodes rather than bones, so an imported appearance carrying humanoid bones is refused here as a performer standing where furniture should be.

The articulation contract is reported all at once rather than one failure at a time, so a single correction round sees the whole list. Joint ids must be non-empty and unique. Every parent must resolve inside the declared nodes without a cycle, where `null` means the prop's own root and a joint may declare its parent after itself. Each joint's optional mesh must name one part of this prop's own model, and no part may be claimed by two joints, because a part rides one frame. The binding must target the declared profile, every mapped value must name a declared node, and every semantic key the profile references must be mapped.

The mesh reference is the one authors forget, and forgetting it is silent. A joint that names no part still builds its frame and still turns, so a hinge declared without its leaf turns nothing while the shot validates clean and shows a door standing still. Name the part on the joint that carries it. A joint that only positions other joints legitimately names none, and a prop drawing an imported appearance has no addressable parts in the model the viewer builds, so a joint of one may name none and its frame still turns whatever it holds.

A lowered joint is addressed by `placementChildNode(`, the placement id and the joint id joined under the engine's own lowering law, which is the string an object-motion clip names. Only the channels a clip carries actually move on screen. A profile's limits and drivers are resolved by the engine's frame solver, so a handle declared to mirror its hinge is honored where the shot is gated and stands still where the shot is drawn; author the channel you want to see move rather than expecting a driver to animate it for you.

## Retargeting

Map semantic bone chains rather than assuming equal bone counts, names, orientations, or proportions. Establish the retarget pose explicitly. IK can preserve hand and foot contacts after proportional changes, but contact correction is a verification step, not an automatic guarantee.

Check:

- rest pose and local axes;
- parent-child continuity and nonzero bone lengths;
- left/right and front/back identity;
- joint limits across the required range of motion;
- hand, foot, wheel, and hinge contacts;
- skin collapse, twist distribution, and volume preservation;
- deterministic output under repeated sampling.

## Review recipe

`captureTurntable({ asset })` is the whole first step. One call commits the set an asset review is judged from: four horizontal quarters, the overhead outline pass, and the extreme-range pose of a rigged model. Assembling that set by hand is where the one angle a defect was on gets dropped.

Then frame what a whole-model view cannot resolve. `npm run preview` accepts a `part` on an asset target and narrows the camera onto one compiled part with the model still around it, which is how a hinge, a pintle, a stile, or a pivot cover is actually looked at.

Judge silhouette before detail, then hierarchy, pivots, limits, material separation, and every shot-required capability. A capability absent from the profile is not available just because a mesh visually suggests it.

Close by opening every captured view of the object and saying what each one showed in the evidence citation on its design owner. An object read from one flattering angle is not an object anybody looked at.
