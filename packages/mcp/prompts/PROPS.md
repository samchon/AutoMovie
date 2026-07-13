# Props

`forgeProp` authors an object as data — the same bet as the stick-figure cast: **crude proxy, rich meaning**. The geometry stays simple primitives (a diffusion pass will paint appearance later); the meaning — physics, contact points, articulation — is what the engine validates and simulates.

## The Model Contract

- `model.id` must equal the prop's `node` (the staged scene joins on it, exactly like a forged cast member).
- `origin: "generated"`, `skeleton: null` — a riggable actor goes through `forge`; a prop's moving parts are articulation nodes, not bones.
- The model passes full validation, including its `body` and `affordances`.

## Rich Meaning, Piece by Piece

- **Body** (`model.body`): mass, optional explicit center of mass (else derived from the primitive volumes), friction, restitution. `body: null` means no declared physics — the prop is scenery and raises no physics warnings.
- **Affordances** (`model.affordances`): named contact semantics — a `stack-top` face (convex polygon extent) other objects can rest on, a `handle` to grab, a `socket`, a `hook`. Stacking stability is then computable: seat B on A's stack-top and the support/topple check answers with physics, not vibes.
- **Articulation** (`articulation: { nodes, profile, binding }`): the prop's own joint nodes plus a profile that constrains and drives them. A door is the canonical example: a hinge node, a channel limit expressing 0..110° as quaternion component bounds, a copy driver mirroring the hinge onto a dependent part. The declared limit CLAMPS at resolve time and reports profile-tagged violations; the declared driver drives. Authored data becomes an executable constraint.

## Gates Worth Knowing

Articulation node ids must be unique and parents must resolve acyclically within the declared nodes. The binding must target the declared profile, every `boneMap` value must name a declared node, and **every semantic key the profile references must be mapped** — missing mappings are reported all at once, so one correction round sees the whole list.

## MCP Boundary

The tool's JSON contract is tuple-free: a driven driver's ranges cross as named `{from, to}` objects — omit `inRange`/`outRange` (and `clamp`) entirely when the driver instead supplies a nonlinear `curve`, which supersedes them. Prop profiles carry no gaits (props do not locomote). The success echo is your spec back, accepted.

## From Spec to Scene

A forged prop reaches the film through staging: place it with a `stage` call's `set` array (`{ node, model: <prop node id>, position, facingDeg? }`) and it becomes a static scene node the guide passes draw — the environment half of the crude-proxy bet (a room IS a few boxes). See the STAGING guide's Set section.

## Resident Write-Through

When a resident project is active, an accepted spec also writes through as `props/<node>.json` (`stored: true` in the output) — forge once, and later sessions read it from the project. Re-forging replaces exactly that file, EXCEPT when the committed scene still places the prop: that re-forge is refused (`stored: false`, a `$slate.scene` violation) because committed shots would resolve against the stale spec — re-commit the scene without the placement first, or accept re-perform. A first forge of a not-yet-stored node always stores (it creates the spec, it does not replace one). `eraseProp` removes a stored spec (refused while the committed scene still places the prop). See the PROJECT_MEMORY guide's Props section.
