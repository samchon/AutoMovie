# Source Composition Handbook

A timed AutoMovie delivery is a program that emits shots. This handbook is about the shape that program takes once a production has more shots than you would willingly type, which is the point where authoring each one by hand stops being craft and becomes transcription.

[TypeScript](typescript.md) governs how any one module must behave: pure builds, typed payloads, explicit units, explicit inputs for reproducible output. Those rules hold everywhere here. This document is about arrangement across modules, and it applies to any production with repeated subjects: a crowd, a parade, a fleet, a corps of dancers.

## Know when to compose

Hand-author while a production has a handful of shots. A few explicit shots are cheaper than a generator, and a factory built for one caller is a worse module than the caller.

Compose at the moment you copy a shot module and change its names. That copy is the signal, not the fortieth one. The cost of hand-authoring is linear in runtime and invisible until the runtime is large, so the decision has to be made from the repetition you can see rather than from the pain you have felt.

## Each module has one second

Keep the work inside a build proportionate to what the shot itself stages: let the engine regenerate a formation from its runtime instead of walking its members. Compute shared deterministic inputs once per execution and pass the resulting typed values to each consumer rather than repeating the same derivation inside every shot factory.

Keep the derivation executable from its declared inputs. A copied result literal can become stale when those inputs change; a source function retains that relationship without an intermediate project store. [Compilation](compilation.md) owns execution and the producer-consumer boundary.

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

`design()` returns the subject's typed design value for its consumers to validate and use. Equal declared inputs produce equal values; calling the method does not require publishing or reopening a design file.

## A group of subjects is a subject

A cluster holds figures, a group holds clusters, a building holds wings and storeys, a forest holds trees, and a world holds terrain plus placed buildings. The shape is identical at every level, which is what makes a mass scene authorable: a group advancing or a repeated floor stack being raised is one call, not two thousand copied records.

Extend `AutoMovieSubjectGroup`, state `members()`, and `render` composes them for you. Override it only to add something the group owns that no member does (a banner, a shared route, a dust cue), and merge with `super.render(context)` rather than replacing what the members said.

Keep populations compact. A formation materializes its members from count, layout, anchor, facing, and seed, and the runtime represents them as bounded chunks rather than scene nodes, so a member's own `render` usually contributes nothing and the group's cue is what a shot stages. A member that rendered itself individually is the first step toward ten thousand nodes.

Buildings use the same rule without pretending they are formations. A building class emits `IAutoMovieBuiltEnvironment`; its element hierarchy carries local full TRS and reusable model ids, while its independent logical-space hierarchy carries rooms, floors, voids, boundaries, openings, and stair/lift/bridge connectivity. One such record may hold several independent building units through its `buildings` root table plus the sky-bridges that couple them, so a keep, its yawed annex, and the bridge between them are one `design()` and one `render()` rather than three subjects that have to agree. Write a repeated storey as a loop over its index: the slab, its logical space, its room, its door, and the stair up to it all derive from the same number, and the looped record must be the same artifact as the hand-expanded one. `render(context)` delegates to `lowerBuiltEnvironment(design())`, and the shot consumes that derived contribution:

```ts
import {
  AutoMovieSubject,
  type IAutoMovieSubjectContribution,
  mergeAutoMovieSubjectContributions,
} from "@automovie/engine";
import type { IAutoMovieShotBuildContext } from "@automovie/interface";

export const stageSubjects = (
  subjects: readonly AutoMovieSubject<unknown>[],
  context: IAutoMovieShotBuildContext,
): IAutoMovieSubjectContribution =>
  mergeAutoMovieSubjectContributions(
    subjects.map((subject) => subject.render(context)),
  );
```

The contribution keeps `set` and `spaces` alongside `models` and `builtEnvironments`. The shot places the merged `set` in its stage and calls `mergeAutoMovieSpaces` on the merged `spaces` when assembling that stage. Actors, cameras, lights, script, blocking, performance, and event samples remain the shot's assembly responsibility; a subject contribution is not a partial shot program.

The building owns its interior, exterior envelope, roof, facade attachments, exterior stairs, ladders, rails, and helipad. Surrounding ground, parks, sky, and natural water stay in the world subject. Water simulation is its own subject/domain; an interior water feature composes it with a building space instead of making fluid an architecture-only feature.

## A shot names subjects and asks them to render

A shot module imports the subjects it stages and merges what they return. When a shot restates a member's dimensions, re-derives a layout, or rebuilds a motion, the vocabulary is missing and the shot has absorbed work that belongs a layer down.

Project source is linked, so a shot may import other modules under your source roots. Every linked module is held to the same rules as the shot itself: no clock, no network, no filesystem, no unseeded randomness, and a diagnostic names the file that broke one. Import cycles are refused, because a subject reading its own half-built exports is a defect better heard at compile time than met as a missing method mid-render.

## Let the engine carry the repetition

A formation design materializes its members from count, layout, anchor, facing, and seed. Keep its runtime representation in bounded chunks rather than scene nodes. Large non-formation populations use compact instance sets the same way.

Do not expand either into per-member scene nodes or per-member curves. Author the unit's cues and let the runtime regenerate members from index and seed. Promoting a member to a named actor is for a persistent named performer with a close camera or unique prop, not for reaching individual behavior.

At compile time, inspect `context.formationRuntime[id]` for chunks, bounds, hero inventory, LOD, and phase, and regenerate a single representative through `context.engine` when you need one. Recreating layout arithmetic in source produces a second answer that will disagree with the first.

## Derive variation from declared seeds

A group of identical members placed on exact geometry reads as one object repeated. Deterministic variation is what makes it read as many individuals, and the seed is what keeps that reproducible: the same design must always compile to the same frames.

Take every varying value from the design's own seed and the member's index. Never from a clock, a counter, a call order, or unseeded randomness. A value derived from seed and index needs no storage, survives regeneration, and reproduces on every machine.

Declare the seed in the typed design input, so variation is a property of the subject rather than hidden state in the implementation that consumes it.

## One factory per recurring kind of shot

A factory takes the parameters that actually differ and returns the shot definition. What repeats lives in the factory; what varies lives in the table that calls it.

Name factories for what the shot _is_, not for what it looks like: a factory named for an action reads at the call site, and one named for a camera move hides the beat behind the lens. Keep them honest about what they cannot know. A factory that supplies a default predicate, a default event time, or a default acceptance criterion produces shots that satisfy their contract and prove nothing, which is worse than a shot that fails to compile.

Keep the module readable while you are at it. A citation names a symbol, and a reviewer has to hold that symbol's whole scope in mind to say anything true about it; a factory module that grows past what one reading can carry has a tail nobody reviews honestly. Split it along its own seams before that happens.

## Derive the design value from the same table

`IAutoMovieDefinedShotContract` is the shot contract minus `id` and `source`. When a consumer needs the complete `IAutoMovieShotContract`, derive that typed value from the same planning input instead of transcribing its fields into a second authority.

Keep the plan and derivation in their source owner. Pass the returned value directly to the selected public consumer, and use that same producer for execution and measurements. [Ownership](ownership.md) governs the authored input and output boundary; a record-shaped value is not an instruction to serialize it into a file.

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

/** The typed design value, derived rather than transcribed. */
export const plannedShotRecord = (
  planned: IPlannedShot,
): IAutoMovieShotContract => ({
  ...planned.contract,
  id: planned.id,
  source: { module: planned.module, export: planned.export },
});
```

A shot's source binding names a module path and a static export. Keep those export identities explicit while sharing the pure factory and typed planning table; repeated shots do not require a code-generation script or generated source tree.

## Assemble the edit from the same table

The film's shot order is data the table already holds. Build the edit by walking it rather than by listing placements by hand, and a reordered sequence stays one edit instead of a renumbering.

Placement timing, transitions, and edge states still belong to the edit's own rules. Deriving the order does not license deriving a continuity claim: an edge state asserts a measured fact about two specific shots, and a factory cannot know it.

## Reuse techniques, not content

Read the public package APIs and the design branch that owns the current problem. Derive repetition, surface allocation, quantities, placement, and phase changes from the production's reviewed inputs. A shared concern has one source owner; a complete visual surface is not split merely to distribute files.

Create production modules only when their active branch needs real implementation. A familiar example may suggest a technique, but its dimensions, layout, assets, identities, and content are not production authority.
