# Forge (Cast Stand-Ins)

`forge` builds the stand-in rigs for every cast member the script left with `modelRef: null`, the same bet as props: **crude proxy, rich meaning**. The geometry is simple primitive parts a diffusion pass will paint over later; what matters is the skeleton, because everything downstream (staging measurements, perform's ROM gate, the pose guide pass) is computed against it.

## Think Silhouette First

The `thinking` field is where the design happens: for each stand-in, what silhouette reads as this character from the shot distances the script implies? A knight reads by bulk and helmet mass, a cat by spine length and leg ratio. Get the proportions from the silhouette; the engine gets the anatomy from the skeleton.

## The Casting Contract

- **Exactly one entry per stand-in cast member.** A missing rig is an actor with no body; an entry for a cast member that already has a `modelRef`, or for a node the script never cast, contradicts the script and is refused.
- **`model.id` must equal the entry's `node`.** That id is the join the staged scene resolves through its `modelRef ?? node` fallback. Break it and staging cannot find the body.

## The Rig Contract

- `origin: "generated"`, and the model **must carry a skeleton**, a boneless model is a prop, not a castable actor (author it through `forgeProp` instead).
- The whole model passes `validateModel`: parts and materials, strictly positive extents, and the skeleton graph (bones parent acyclically to a root). Violations come back remapped onto the offending entry's path, all at once, so one correction round sees the whole list.
- Attach each visible part to its bone (`attachedBone`) so the primitive rides the joint it embodies; sizes are meters, and ROM constraints beyond the humanoid defaults go on the bones that need them.

## What the Forge Feeds

The success result is the forged cast keyed by node, each entry a validated model + skeleton. Downstream:

- `stage` measures placements against these rigs (heights are measured from the rest pose, measure, don't hope).
- `perform` actor contexts carry each actor's rig, so IK verbs solve and every compiled motion ROM-validates against the very skeleton you forged.
- The `pose` guide pass draws these bones; a bad rig is visible in every conditioning frame.

Unlike props, a forged cast is **not** written through to the resident project, the models travel with the calls that need them (staging validation, perform contexts). Export a baked `.glb` through the render tooling and `registerAsset` it when a binary should live in the project's `models/`.
