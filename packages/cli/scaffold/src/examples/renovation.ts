import {
  designLineageCompare,
  designLineageImpact,
  designLineagePhaseOrder,
  designLineagePhaseSnapshot,
  designLineageProject,
  designLineageViewDigest,
  validateDesignLineage,
  validateDesignLineageBinding,
} from "@automovie/engine";
import type {
  AutoMovieContentDigest,
  IAutoMovieDesignComparison,
  IAutoMovieDesignImpact,
  IAutoMovieDesignLineage,
  IAutoMovieDesignPhaseSnapshot,
} from "@automovie/interface";

import { ExampleBuilding } from "./buildings";

/**
 * Renovating a building without modelling a second building.
 *
 * ## The one rule this example exists to teach
 *
 * Lineage annotates identities; it never holds geometry. Nothing below is a
 * wall, a room, or a door. Every entry is a string that `examples/buildings.ts`
 * already published, plus a statement about when it arrives, when it leaves,
 * which alternative changes it, and what was derived from it. That is why the
 * same record can phase an element, a logical space, an opening, a material
 * layer, a service port, or a fold this project has not written yet: it
 * attaches over any stable id and imports none of them.
 *
 * The two mistakes it exists to prevent are the same mistake twice. Copying the
 * building to describe the "before" state throws away the identity that makes
 * the two states comparable; copying it again to describe an alternative throws
 * away the identity that makes the two schemes comparable. So the design stays
 * one design, and this file is the only thing that changes.
 *
 * ## Role and presence are two different questions
 *
 * A partition marked for demolition is `demolished` for the entire job and is
 * still `present` while the temporary access is up. Collapsing those into one
 * field is how a demolition drawing and a demolition render begin to disagree,
 * so a snapshot answers both and every consumer reads that one snapshot.
 *
 * ## What the digests are for
 *
 * `revision.digest` pins the authored source, a subject's own `digest` pins
 * imported bytes such as a texture, and `stamp.configuration` pins the lowering
 * settings. A derived artifact that does not cite all three cannot be checked
 * against anything, and one still stamping a superseded revision is refused as
 * stale rather than quietly served.
 *
 * Imported bytes need one extra step, because a revision cannot pin them.
 * Replacing a texture moves no line of the design, so an output that opened the
 * file quotes the digest it read in its own `assets` list; when the two copies
 * stop agreeing, the record says the output is stale. An output that opened
 * nothing imported quotes nothing, which is why the rule cannot be satisfied by
 * listing every asset everywhere.
 */
export const EXAMPLE_RENOVATION: IAutoMovieDesignLineage = {
  version: 1,
  id: "example-building-renovation",
  // Every derived artifact below must stamp this revision. Bump it when the
  // authored source changes, and the outputs baked from the old source stop
  // validating instead of silently passing as current.
  head: "r2",
  revisions: [
    {
      id: "r1",
      parent: null,
      digest:
        "sha256:1111111111111111111111111111111111111111111111111111111111111111",
    },
    {
      id: "r2",
      parent: "r1",
      digest:
        "sha256:2222222222222222222222222222222222222222222222222222222222222222",
    },
  ],
  // A construction plan is a graph of prerequisites, not a numbered list. Two
  // wings can be stripped independently and still both precede one structural
  // phase; ordering them by hand would invent a sequence nobody required.
  phases: [
    { id: "strip", label: "demolition", requires: [] },
    { id: "structure", label: "structural repair", requires: ["strip"] },
    { id: "fitout", label: "fit-out", requires: ["structure"] },
    { id: "handover", label: "handover", requires: ["fitout"] },
  ],
  // Ids owned by `examples/buildings.ts`, plus one owned by the asset manifest.
  // The `graph` label says where each one came from and is an open string, so a
  // fold that lands later registers its own ids under its own name without this
  // schema moving, and one lineage spans as many graphs as the work touches.
  subjects: [
    { id: "tower-partition-1", graph: "element", digest: null },
    { id: "tower-partition-2", graph: "element", digest: null },
    { id: "tower-door-leaf-2", graph: "element", digest: null },
    { id: "tower-facade-ladder", graph: "element", digest: null },
    { id: "tower-door-2", graph: "opening", digest: null },
    { id: "tower-room-2", graph: "space", digest: null },
    // The one subject whose content is bytes rather than authored source. Its
    // digest is the file as it was read; every output that opens the file has
    // to quote that value back, because replacing a texture moves no line of
    // the design and would otherwise leave those outputs reading as current.
    {
      id: "oak-floor-texture",
      graph: "asset",
      digest:
        "sha256:eeee1111eeee1111eeee1111eeee1111eeee1111eeee1111eeee1111eeee1111",
    },
  ],
  // Exactly one entry per subject. There is no default: every default would
  // assert something the author did not, either that a thing predates the work
  // or that it survives it.
  lifecycles: [
    // Existing and taken down: `demolished`.
    { subject: "tower-partition-1", introducedIn: null, removedIn: "strip" },
    // Existing and kept: `retained`.
    { subject: "tower-partition-2", introducedIn: null, removedIn: null },
    // Installed by the work and kept: `new`.
    { subject: "tower-door-leaf-2", introducedIn: "fitout", removedIn: null },
    // Installed by the work and taken out again: `temporary`. Access put up
    // for the works is not the building, and this is what keeps it out of the
    // as-built scene, drawing, schedule, and render without deleting it from
    // the phases it really stood through.
    {
      subject: "tower-facade-ladder",
      introducedIn: "strip",
      removedIn: "handover",
    },
    { subject: "tower-door-2", introducedIn: "fitout", removedIn: null },
    { subject: "tower-room-2", introducedIn: null, removedIn: null },
    // An imported file is not installed by the work and not taken out by it.
    { subject: "oak-floor-texture", introducedIn: null, removedIn: null },
  ],
  // Two schemes over one revision. Neither copies the building; each names only
  // what it changes, and every subject it does not name keeps the id, the
  // geometry, and the citations the revision gave it.
  variants: [
    {
      id: "warm-oak",
      label: "warm oak",
      base: "r2",
      changes: [
        {
          id: "warm-room-material",
          subject: "tower-room-2",
          aspect: "material",
          value: "oak-rift-sawn",
          rationale: "continues the retained partition's timber",
        },
        {
          id: "warm-room-lighting",
          subject: "tower-room-2",
          aspect: "lighting",
          value: "2700K",
          rationale: "warm source to match the oak",
        },
      ],
    },
    {
      id: "cool-stone",
      label: "cool stone",
      base: "r2",
      changes: [
        {
          id: "cool-room-material",
          subject: "tower-room-2",
          aspect: "material",
          value: "limestone-honed",
          rationale: "cooler ground against the north light",
        },
        {
          id: "cool-room-lighting",
          subject: "tower-room-2",
          aspect: "lighting",
          value: "4000K",
          rationale: "neutral source over stone",
        },
      ],
    },
  ],
  // A choice does not consume the alternatives it rejected. `selected` stays
  // null until somebody decides, and the losing scheme stays on the record with
  // its changes and its reasons afterwards.
  decisions: [
    {
      id: "d-room-2",
      question: "which finish scheme does the second-storey room take",
      options: ["cool-stone", "warm-oak"],
      selected: null,
    },
  ],
  // Outputs, each citing the identities it was computed from. These edges are
  // what let one change name exactly what it invalidated instead of everything.
  derived: [
    {
      id: "mesh-tower-partition-2",
      kind: "mesh",
      inputs: ["tower-partition-2", "tower-door-2"],
      assets: [],
      stamp: {
        revision: "r2",
        variant: null,
        phase: null,
        configuration:
          "sha256:3333333333333333333333333333333333333333333333333333333333333333",
      },
      digest:
        "sha256:4444444444444444444444444444444444444444444444444444444444444444",
    },
    {
      id: "mesh-tower-partition-1",
      kind: "mesh",
      inputs: ["tower-partition-1"],
      // Nothing imported goes into this mesh, so it quotes nothing. The rule is
      // bounded by what an output actually opened.
      assets: [],
      stamp: {
        revision: "r2",
        variant: null,
        phase: null,
        configuration:
          "sha256:3333333333333333333333333333333333333333333333333333333333333333",
      },
      digest:
        "sha256:5555555555555555555555555555555555555555555555555555555555555555",
    },
    {
      id: "mesh-tower-door-leaf-2",
      kind: "mesh",
      inputs: ["tower-door-leaf-2", "tower-door-2"],
      assets: [],
      stamp: {
        revision: "r2",
        variant: null,
        phase: null,
        configuration:
          "sha256:3333333333333333333333333333333333333333333333333333333333333333",
      },
      digest:
        "sha256:6666666666666666666666666666666666666666666666666666666666666666",
    },
    {
      id: "cut-room-2-finish",
      kind: "cut",
      inputs: ["tower-room-2", "mesh-tower-partition-2", "oak-floor-texture"],
      // This one reads the imported file, so it quotes the bytes it read. Swap
      // the texture without moving this value and the record refuses the cut as
      // stale instead of serving a finish nobody can check.
      assets: [
        {
          subject: "oak-floor-texture",
          digest:
            "sha256:eeee1111eeee1111eeee1111eeee1111eeee1111eeee1111eeee1111eeee1111",
        },
      ],
      stamp: {
        revision: "r2",
        variant: null,
        phase: null,
        configuration:
          "sha256:3333333333333333333333333333333333333333333333333333333333333333",
      },
      digest:
        "sha256:7777777777777777777777777777777777777777777777777777777777777777",
    },
    {
      id: "quantity-room-2",
      kind: "quantity",
      inputs: ["cut-room-2-finish"],
      // The texture reaches this schedule line only through the cut above, and
      // a quote here would claim bytes this take-off never opened.
      assets: [],
      stamp: {
        revision: "r2",
        variant: null,
        phase: null,
        configuration:
          "sha256:3333333333333333333333333333333333333333333333333333333333333333",
      },
      digest:
        "sha256:8888888888888888888888888888888888888888888888888888888888888888",
    },
    {
      id: "render-room-2",
      kind: "render",
      inputs: [
        "mesh-tower-partition-2",
        "mesh-tower-door-leaf-2",
        "cut-room-2-finish",
      ],
      assets: [],
      stamp: {
        revision: "r2",
        variant: null,
        phase: null,
        configuration:
          "sha256:3333333333333333333333333333333333333333333333333333333333333333",
      },
      digest:
        "sha256:9999999999999999999999999999999999999999999999999999999999999999",
    },
    // The two comparison renders share one configuration and one phase on
    // purpose. Two alternatives shot under two cameras compare the cameras, so
    // validation refuses the pair rather than trusting the reviewer to notice.
    {
      id: "render-room-2-warm",
      kind: "comparison-render",
      inputs: ["tower-room-2"],
      assets: [],
      stamp: {
        revision: "r2",
        variant: "warm-oak",
        phase: "handover",
        configuration:
          "sha256:aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111",
      },
      digest:
        "sha256:bbbb1111bbbb1111bbbb1111bbbb1111bbbb1111bbbb1111bbbb1111bbbb1111",
    },
    {
      id: "render-room-2-cool",
      kind: "comparison-render",
      inputs: ["tower-room-2"],
      assets: [],
      stamp: {
        revision: "r2",
        variant: "cool-stone",
        phase: "handover",
        configuration:
          "sha256:aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111",
      },
      digest:
        "sha256:cccc1111cccc1111cccc1111cccc1111cccc1111cccc1111cccc1111cccc1111",
    },
  ],
};

/**
 * Every stable id the example building publishes, as one flat roll-call.
 *
 * Lineage cannot see the graphs it annotates, so a renamed partition leaves a
 * phase plan quietly talking about nothing. Handing the published ids to
 * {@link validateDesignLineageBinding} is what turns that into an error, and
 * writing the harvest here rather than inside the engine is deliberate: a
 * production adds its own folds to this list without waiting for the engine to
 * learn about them.
 */
export const exampleBuildingIdentities = (): string[] => {
  const design = new ExampleBuilding().design();
  return [
    ...design.buildings.map((unit) => unit.id),
    ...design.elements.map((element) => element.id),
    ...design.spaces.map((space) => space.id),
    ...design.boundaries.map((boundary) => boundary.id),
    ...design.openings.map((opening) => opening.id),
    ...design.connectors.map((connector) => connector.id),
  ];
};

/**
 * The asset ids `.automovie/assets.json` registers for this example.
 *
 * Lineage spans every graph a production publishes ids from, not only the
 * building, so the roll-call it is checked against has to span them too. The
 * asset manifest is one of those graphs: a texture is an identity with bytes,
 * and phasing or impact-tracing it is the same act as phasing a wall.
 */
export const exampleRegisteredAssets = (): string[] => ["oak-floor-texture"];

/**
 * Check the lineage against itself and against the building it annotates.
 *
 * Both halves are needed and neither implies the other. The first refuses a
 * cyclic plan, an alternative on a revision nobody recorded, two edits of one
 * aspect, and a stale output; the second refuses a subject that resolves to no
 * published identity.
 */
export const checkExampleRenovation = (): void => {
  const coherent = validateDesignLineage({ lineage: EXAMPLE_RENOVATION });
  if (coherent.success === false)
    throw new Error(
      `the renovation lineage is not coherent: ${coherent.violations[0]!.path}`,
    );
  const bound = validateDesignLineageBinding({
    lineage: EXAMPLE_RENOVATION,
    known: [...exampleBuildingIdentities(), ...exampleRegisteredAssets()],
  });
  if (bound.success === false)
    throw new Error(
      `the renovation lineage cites an identity the building does not publish: ${bound.violations[0]!.path}`,
    );
};

/** The construction plan in a deterministic order, prerequisites first. */
export const exampleRenovationPhases = (): string[] =>
  designLineagePhaseOrder(EXAMPLE_RENOVATION);

/**
 * What every annotated identity is doing once one phase completes.
 *
 * Pass null for the completed work. A scene, a drawing, a schedule, and a
 * render all read this one answer rather than each deciding for itself.
 */
export const exampleRenovationAt = (
  phase: string | null,
): IAutoMovieDesignPhaseSnapshot =>
  designLineagePhaseSnapshot(EXAMPLE_RENOVATION, phase);

/**
 * The building's own elements, filtered to the ones standing at one phase.
 *
 * The filter is generic over anything carrying an id, which is the point: the
 * same call phases set pieces, drawing rows, schedule lines, and draw calls. An
 * id the lineage never declared passes through, so annotating one wing does not
 * empty the rest of the work.
 */
export const exampleRenovationElementsAt = (phase: string | null): string[] =>
  designLineageProject(
    EXAMPLE_RENOVATION,
    phase,
    new ExampleBuilding().design().elements,
  ).map((element) => element.id);

/** How the two finish schemes differ, over the identities they both keep. */
export const exampleRenovationAlternatives = (): IAutoMovieDesignComparison =>
  designLineageCompare(EXAMPLE_RENOVATION, "warm-oak", "cool-stone");

/**
 * What moving one door opening invalidates, and what it provably does not.
 *
 * The second half is the interesting one. "Everything is stale" is always
 * correct and never useful, so the answer names the untouched outputs too.
 */
export const exampleRenovationDoorImpact = (): IAutoMovieDesignImpact =>
  designLineageImpact(EXAMPLE_RENOVATION, ["tower-door-2"]);

/**
 * The replay handle a derived artifact should have been produced against.
 *
 * The same alternative at the same phase digests identically on every run and
 * every platform; a different alternative, a different phase, or an imported
 * asset whose bytes moved all produce a different value.
 */
export const exampleRenovationViewDigest = (
  variant: string | null,
  phase: string | null,
): AutoMovieContentDigest =>
  designLineageViewDigest(EXAMPLE_RENOVATION, { variant, phase });
