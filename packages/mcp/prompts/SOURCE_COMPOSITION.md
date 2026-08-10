# Source Composition Handbook

A film is a program that emits shots. This handbook is about the shape that program takes once a production has more shots than you would willingly type, which is the point where authoring each one by hand stops being craft and becomes transcription.

`TYPESCRIPT` governs how any one module must behave: pure builds, typed payloads, explicit units, no I/O in the compile sandbox. Those rules hold everywhere here. This document is about arrangement across modules, and it applies to any production with repeated subjects: a crowd, a parade, a fleet, a corps of dancers.

## Know when to compose

Hand-author while a production has a handful of shots. The starter's two shots are cheaper written out than generated, and a factory built for one caller is a worse module than the caller.

Compose at the moment you copy a shot module and change its names. That copy is the signal, not the fortieth one. The cost of hand-authoring is linear in runtime and invisible until the runtime is large, so the decision has to be made from the repetition you can see rather than from the pain you have felt.

## Each module has one second

The sandbox runs every transpiled module, the registration probe, and the `build` call under a one-second timeout, and a script that exceeds it is refused with `source-execution-timeout` having published nothing. The budget is per invocation rather than per production, so a hundred shot modules each get a second of their own — and the single film module that assembles every placement in the edit gets one second for the whole thing.

That is an arrangement constraint, not a micro-optimization. Keep the work inside a build proportionate to what the shot itself stages: let the engine regenerate a formation from its runtime instead of walking its members, and let a table computed once at module scope stay at module scope rather than being rebuilt inside a factory that is called per shot. Expensive derivation belongs in the ordinary scripts that emit design records and generated modules, which run outside the sandbox and under no such clock.

## Every subject is a class

A figure, an animal, a tree, a wall, a hill, a river, a field, the map: each is a subject, and a subject is a class extending `AutoMovieSubject`. Nothing is special about performers here. A thing that stands still and is never touched is still the owner of its own measurements and its own place in a frame.

A class owns four things, and the reason it is a class rather than a factory returning a record is that these four belong together:

- **Constraints** are fields, validated where the subject is built. A measured fact (a reference height, a rated capacity, an interval that must not close) is a field so that another subject can be checked against it and so that the field itself can cite the document that measured it. A number restated in two places is two numbers.
- **Motions** are methods. A `capabilities: ["advance"]` array names an action without owning it; a method is the action. If a caller cannot invoke it, the source never did the work the array claims.
- **Utilities** are methods that answer questions about the subject: its extent, its footprint, whether a point is inside it, the ground height at a place, where member _n_ stands. Delegate to the engine function that already computes the answer. Recomputing it in the class produces a second answer that can disagree with the first, and disagreement is worse than either answer alone.
- **`render(context)`** returns what this subject puts into a shot: its actors, its clips, its cues, its world geometry. Never a whole shot program: a shot is assembled from many subjects, and each one returns only the part it owns.

```ts
import {
  AutoMovieSubject,
  type IAutoMovieSubjectContribution,
} from "@automovie/engine";
import type {
  IAutoMovieModelRecipe,
  IAutoMovieShotBuildContext,
} from "@automovie/interface";

export class Figure extends AutoMovieSubject<IAutoMovieModelRecipe> {
  public readonly id = "figure";

  /** A fact other subjects measure themselves against. */
  public readonly height = 1.8;

  /** Derived, so a change to the scale cannot leave this behind. */
  public eyeHeight(): number {
    return this.height * 0.9;
  }

  public design(): IAutoMovieModelRecipe {
    return {
      id: this.id,
      role: "performer",
      archetype: "stickman",
      parameters: { height: this.height, headRadius: 0.16, limbRadius: 0.06 },
      palette: { body: "#d7b56d" },
      lod: [{ tier: "hero", maxDistance: null, recipe: this.id }],
      capabilities: ["signal"],
      attachments: [],
    };
  }

  public render(
    context: IAutoMovieShotBuildContext,
  ): IAutoMovieSubjectContribution {
    return {
      actors: [
        {
          node: this.id,
          model: this.id,
          speed: 1.2,
          eyeHeight: this.eyeHeight(),
        },
      ],
    };
  }
}
```

`design()` is the wire. A class is an authoring surface and never reaches the compile sandbox as itself; everything the compiler stores and validates leaves through that one method as the plain record it already understands. Two constructions with the same inputs must emit byte-identical records, which is what keeps one design compiling to one film.

## A group of subjects is a subject

A cluster holds figures, a group holds clusters, a building holds wings and storeys, a forest holds trees, and a world holds terrain plus placed buildings. The shape is identical at every level, which is what makes a mass scene authorable: a group advancing or a repeated floor stack being raised is one call, not two thousand copied records.

Extend `AutoMovieSubjectGroup`, state `members()`, and `render` composes them for you. Override it only to add something the group owns that no member does (a banner, a shared route, a dust cue), and merge with `super.render(context)` rather than replacing what the members said.

Keep populations compact. A formation materializes its members from count, layout, anchor, facing, and seed, and the compiler stores bounded chunks rather than scene nodes, so a member's own `render` usually contributes nothing and the group's cue is what a shot stages. A member that rendered itself individually is the first step toward ten thousand nodes.

Buildings use the same rule without pretending they are formations. A building class emits `IAutoMovieBuiltEnvironment`; its element hierarchy carries local full TRS and reusable model ids, while its independent logical-space hierarchy carries rooms, floors, voids, boundaries, openings, and stair/lift/bridge connectivity. One such record may hold several independent building units through its `buildings` root table plus the sky-bridges that couple them, so a keep, its yawed annex, and the bridge between them are one `design()` and one `render()` rather than three subjects that have to agree. Write a repeated storey as a loop over its index: the slab, its logical space, its room, its door, and the stair up to it all derive from the same number, and the looped record must be the same artifact as the hand-expanded one. `render(context)` delegates to `lowerBuiltEnvironment(design())`, and the shot consumes that derived contribution:

```ts
import {
  AutoMovieSubject,
  IAutoMovieSubjectContribution,
  mergeAutoMovieSpaces,
} from "@automovie/engine";
import { IAutoMovieShotBuildContext } from "@automovie/interface";

export const stageTower = (
  tower: AutoMovieSubject<unknown>,
  context: IAutoMovieShotBuildContext,
): IAutoMovieSubjectContribution => {
  const architecture = tower.render(context);
  return {
    models: [...(architecture.models ?? [])],
    builtEnvironments: [...(architecture.builtEnvironments ?? [])],
    stage: {
      // actor/camera/light fields omitted here
      set: [...(architecture.set ?? [])],
      space: mergeAutoMovieSpaces("shot-space", architecture.spaces ?? []),
    },
    // script, blocking, performance, and eventSamples remain shot-owned
  } as IAutoMovieSubjectContribution;
};
```

The building owns its interior, exterior envelope, roof, facade attachments, exterior stairs, ladders, rails, and helipad. Surrounding ground, parks, sky, and natural water stay in the world subject. Water simulation is its own subject/domain; an interior water feature composes it with a building space instead of making fluid an architecture-only feature.

## A shot names subjects and asks them to render

A shot module imports the subjects it stages and merges what they return. When a shot restates a member's dimensions, re-derives a layout, or rebuilds a motion, the vocabulary is missing and the shot has absorbed work that belongs a layer down.

Project source is linked, so a shot may import other modules under your source roots. Every linked module is held to the same rules as the shot itself: no clock, no network, no filesystem, no unseeded randomness, and a diagnostic names the file that broke one. Import cycles are refused, because a subject reading its own half-built exports is a defect better heard at compile time than met as a missing method mid-render.

## Let the engine carry the repetition

A formation design materializes its members from count, layout, anchor, facing, and seed, and the compiler stores bounded chunks rather than scene nodes. A thousand-member unit costs one record. Large non-formation populations use compact instance sets the same way.

Do not expand either into per-member scene nodes or per-member curves. Author the unit's cues and let the runtime regenerate members from index and seed. Promoting a member to a named actor is for a persistent named performer with a close camera or unique prop, not for reaching individual behavior.

At compile time, inspect `context.formationRuntime[id]` for chunks, bounds, hero inventory, LOD, and phase, and regenerate a single representative through `context.engine` when you need one. Recreating layout arithmetic in source produces a second answer that will disagree with the first.

## Derive variation from declared seeds

A group of identical members placed on exact geometry reads as one object repeated. Deterministic variation is what makes it read as many individuals, and the seed is what keeps that reproducible: the same design must always compile to the same frames.

Take every varying value from the design's own seed and the member's index. Never from a clock, a counter, a call order, or unseeded randomness, all of which the compile sandbox refuses. A value derived from seed and index needs no storage, survives regeneration, and reproduces on every machine.

State the seed in the design record rather than in source, so the variation is a declared property of the thing rather than an accident of the code that read it.

## One factory per recurring kind of shot

A factory takes the parameters that actually differ and returns the shot definition. What repeats lives in the factory; what varies lives in the table that calls it.

Name factories for what the shot _is_, not for what it looks like: a factory named for an action reads at the call site, and one named for a camera move hides the beat behind the lens. Keep them honest about what they cannot know. A factory that supplies a default predicate, a default event time, or a default acceptance criterion produces shots that satisfy their contract and prove nothing, which is worse than a shot that fails to compile.

Keep the module quotable while you are at it. `prepareReview` returns source selectors for only the first 512 non-blank lines of a module and warns `review-selector-truncated` past that, so everything below the cut exists but cannot be cited as review evidence. A factory module that grows beyond it has a tail no review can reach; split it along its own seams before that happens.

## Derive the tracked design record from the same table

`IAutoMovieDefinedShotContract` is exactly the tracked shot contract minus `id` and `source`. The module and the design record are therefore two representations of one fact, and transcribing the second by hand is how they drift apart.

The design record is yours to author, the same as source. Only generated output, renders, production state, and capture state have other owners. Emit the record from an ordinary script outside the compile sandbox, from the same table the modules read.

Store it through the project's own design setters, never by writing a path the script worked out for itself. Which tree an artifact lives in is the project's decision: a model, a world, and a formation are shared across productions while a shot contract and an acceptance scenario are not. A script that computes the path restates that layout in a second place, and a record written beside the one the compiler reads is a derivation that proves nothing. Read the stored record back first and skip an identical one, because a design mutation deliberately stales every dependent shot and review, and re-storing an unchanged record would invalidate the production for saying nothing new.

```ts
import type {
  IAutoMovieDefinedShotContract,
  IAutoMovieShotContract,
} from "@automovie/interface";

/** One row of the table a production derives every shot from. */
export interface IPlannedShot {
  id: string;
  module: string;
  export: string;
  contract: IAutoMovieDefinedShotContract;
}

/** The tracked design record, derived rather than transcribed. */
export const plannedShotRecord = (
  planned: IPlannedShot,
): IAutoMovieShotContract => ({
  ...planned.contract,
  id: planned.id,
  source: { module: planned.module, export: planned.export },
});
```

A shot's source binding names a module path and a static export, so the exports themselves stay statically written. Generating those modules from the table is ordinary code generation over source you own; keep the emitted files out of the compiler's generated root, which has a different owner.

## Assemble the edit from the same table

The film's shot order is data the table already holds. Build the edit by walking it rather than by listing placements by hand, and a reordered sequence stays one edit instead of a renumbering.

Placement timing, transitions, and edge states still belong to the edit's own rules. Deriving the order does not license deriving a continuity claim: an edge state asserts a measured fact about two specific shots, and a factory cannot know it.

## Read the shipped examples

The starter's own vocabulary is the worked example of the subject layer. Under `src/units/` a leaf subject's measured facts are fields and its one capability is a method, and a second unit derives its scale from the first rather than restating it; under `src/formations/` a group states arrangement and answers questions about its own extent; under `src/world/` a group of places emits a record that is the merge of what its pieces put down.
