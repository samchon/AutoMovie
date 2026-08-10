import { validateDesignLineage } from "@automovie/engine";
import type {
  AutoMovieContentDigest,
  AutoMovieViolationKind,
  IAutoMovieDesignLineage,
} from "@automovie/interface";

import { hasViolation } from "./predicates";

/** Build a well-formed lowercase SHA-256 digest from a hexadecimal seed. */
export const lineageDigest = (seed: string): AutoMovieContentDigest =>
  `sha256:${seed.repeat(64).slice(0, 64)}`;

/** The lowering configuration the phase-independent artifacts were baked with. */
export const RENOVATION_CONFIGURATION = lineageDigest("c0");

/** The configuration both alternative comparison renders must share. */
export const RENOVATION_COMPARISON_CONFIGURATION = lineageDigest("c1");

/** The configuration the demolition-phase render was baked with. */
export const RENOVATION_PHASE_CONFIGURATION = lineageDigest("c2");

/** The bytes of the imported oak texture the finish alternative cites. */
export const RENOVATION_TEXTURE_DIGEST = lineageDigest("7e");

/**
 * One renovation of one hall, expressed only as lineage over ids other graphs
 * own.
 *
 * Nothing in this record is a wall. `wall-north` is a string, and this fixture
 * never learns what it is: that is the property under test, because the folds
 * that publish these ids are still being reshaped and lineage must not have to
 * move with them.
 *
 * The plan is a graph, not a line. `shore` and `strip` are siblings under
 * `survey`, which is what makes "the shoring is not up yet during demolition"
 * an answer about incomparable branches rather than about elapsed time, and
 * `structure` closes the diamond over both.
 *
 * `oak-texture` is the one subject whose content is bytes rather than authored
 * source, so it is the one the derived artifacts have to quote back. Two of
 * them read it and one of the two alternatives does not, which is what keeps
 * the citation rule from being satisfied by quoting every asset everywhere.
 *
 * Every call returns a fresh object so a refusal case can edit one field
 * without leaking the edit into the next case.
 */
export const renovationLineage = (): IAutoMovieDesignLineage => ({
  version: 1,
  id: "hall-renovation",
  head: "r2",
  subjects: [
    { id: "wall-north", graph: "element", digest: null },
    { id: "wall-south", graph: "element", digest: null },
    { id: "wall-west", graph: "element", digest: null },
    { id: "shoring-frame", graph: "element", digest: null },
    { id: "door-leaf", graph: "element", digest: null },
    { id: "opening-door", graph: "opening", digest: null },
    { id: "window-north", graph: "opening", digest: null },
    { id: "room-main", graph: "space", digest: null },
    { id: "floor-oak", graph: "material-layer", digest: null },
    { id: "pendant-lamp", graph: "fixture", digest: null },
    { id: "oak-texture", graph: "asset", digest: RENOVATION_TEXTURE_DIGEST },
  ],
  revisions: [
    { id: "r1", parent: null, digest: lineageDigest("1a") },
    { id: "r2", parent: "r1", digest: lineageDigest("2b") },
  ],
  phases: [
    { id: "survey", label: "survey", requires: [] },
    { id: "strip", label: "demolition", requires: ["survey"] },
    { id: "shore", label: "temporary shoring", requires: ["survey"] },
    { id: "structure", label: "structure", requires: ["strip", "shore"] },
    { id: "services", label: "services", requires: ["structure"] },
    { id: "finishes", label: "finishes", requires: ["services"] },
  ],
  lifecycles: [
    { subject: "wall-north", introducedIn: null, removedIn: null },
    { subject: "wall-south", introducedIn: null, removedIn: "strip" },
    { subject: "wall-west", introducedIn: null, removedIn: null },
    { subject: "shoring-frame", introducedIn: "shore", removedIn: "structure" },
    { subject: "door-leaf", introducedIn: "structure", removedIn: null },
    { subject: "opening-door", introducedIn: "structure", removedIn: null },
    { subject: "window-north", introducedIn: "structure", removedIn: null },
    { subject: "room-main", introducedIn: null, removedIn: null },
    { subject: "floor-oak", introducedIn: "finishes", removedIn: null },
    { subject: "pendant-lamp", introducedIn: "finishes", removedIn: null },
    { subject: "oak-texture", introducedIn: null, removedIn: null },
  ],
  variants: [
    {
      id: "warm-oak",
      label: "warm oak",
      base: "r2",
      changes: [
        {
          id: "warm-floor",
          subject: "floor-oak",
          aspect: "material",
          value: "oak-rift-sawn",
          rationale: "continues the retained north wall's timber",
        },
        {
          id: "warm-floor-pattern",
          subject: "floor-oak",
          aspect: "pattern",
          value: "herringbone",
          rationale: "a second aspect of the one floor, not a second floor",
        },
        {
          id: "warm-light",
          subject: "pendant-lamp",
          aspect: "lighting",
          value: "2700K",
          rationale: "warm source to match the oak",
        },
        {
          id: "warm-layout",
          subject: "room-main",
          aspect: "layout",
          value: "open",
          rationale: "one room reading end to end",
        },
        {
          id: "warm-plaster",
          subject: "wall-north",
          aspect: "material",
          value: "lime-plaster",
          rationale: "both schemes keep the retained wall breathable",
        },
      ],
    },
    {
      id: "cool-stone",
      label: "cool stone",
      base: "r2",
      changes: [
        {
          id: "cool-floor",
          subject: "floor-oak",
          aspect: "material",
          value: "limestone-honed",
          rationale: "cooler ground against the north light",
        },
        {
          id: "cool-floor-pattern",
          subject: "floor-oak",
          aspect: "pattern",
          value: "stack-bond",
          rationale: "a second aspect of the one floor, not a second floor",
        },
        {
          id: "cool-light",
          subject: "pendant-lamp",
          aspect: "lighting",
          value: "4000K",
          rationale: "neutral source over stone",
        },
        {
          id: "cool-window",
          subject: "window-north",
          aspect: "material",
          value: "bronze-frame",
          rationale: "warm frame to offset the stone",
        },
        {
          id: "cool-plaster",
          subject: "wall-north",
          aspect: "material",
          value: "lime-plaster",
          rationale: "both schemes keep the retained wall breathable",
        },
      ],
    },
    {
      id: "legacy-scheme",
      label: "superseded scheme",
      base: "r1",
      changes: [
        {
          id: "legacy-floor",
          subject: "floor-oak",
          aspect: "material",
          value: "vinyl-sheet",
          rationale: "the scheme the first revision was drawn around",
        },
      ],
    },
  ],
  decisions: [
    {
      id: "d-interior",
      question: "which interior scheme does the hall take",
      options: ["cool-stone", "warm-oak"],
      selected: null,
    },
  ],
  derived: [
    {
      id: "mesh-wall-north",
      kind: "mesh",
      inputs: ["wall-north", "opening-door"],
      assets: [],
      stamp: {
        revision: "r2",
        variant: null,
        phase: null,
        configuration: RENOVATION_CONFIGURATION,
      },
      digest: lineageDigest("11"),
    },
    {
      id: "mesh-wall-west",
      kind: "mesh",
      inputs: ["wall-west"],
      assets: [],
      stamp: {
        revision: "r2",
        variant: null,
        phase: null,
        configuration: RENOVATION_CONFIGURATION,
      },
      digest: lineageDigest("22"),
    },
    {
      id: "mesh-door-leaf",
      kind: "mesh",
      inputs: ["door-leaf", "opening-door"],
      assets: [],
      stamp: {
        revision: "r2",
        variant: null,
        phase: null,
        configuration: RENOVATION_CONFIGURATION,
      },
      digest: lineageDigest("33"),
    },
    {
      id: "cut-floor-oak",
      kind: "cut",
      inputs: ["floor-oak", "oak-texture", "mesh-wall-north"],
      // The one output that reads bytes nobody authored, so it is the one that
      // has to say which bytes it read.
      assets: [{ subject: "oak-texture", digest: RENOVATION_TEXTURE_DIGEST }],
      stamp: {
        revision: "r2",
        variant: null,
        phase: null,
        configuration: RENOVATION_CONFIGURATION,
      },
      digest: lineageDigest("44"),
    },
    {
      id: "cut-floor-west",
      kind: "cut",
      inputs: ["floor-oak", "mesh-wall-west"],
      assets: [],
      stamp: {
        revision: "r2",
        variant: null,
        phase: null,
        configuration: RENOVATION_CONFIGURATION,
      },
      digest: lineageDigest("55"),
    },
    {
      id: "quantity-finishes",
      kind: "quantity",
      inputs: ["cut-floor-oak", "cut-floor-west"],
      // Reached by the texture only through the cut above, which is why a
      // citation here would be a claim about bytes this output never opened.
      assets: [],
      stamp: {
        revision: "r2",
        variant: null,
        phase: null,
        configuration: RENOVATION_CONFIGURATION,
      },
      digest: lineageDigest("66"),
    },
    {
      id: "render-lobby",
      kind: "render",
      inputs: ["mesh-wall-north", "mesh-door-leaf", "cut-floor-oak"],
      assets: [],
      stamp: {
        revision: "r2",
        variant: null,
        phase: null,
        configuration: RENOVATION_CONFIGURATION,
      },
      digest: lineageDigest("77"),
    },
    {
      id: "render-west",
      kind: "render",
      inputs: ["mesh-wall-west", "cut-floor-west"],
      assets: [],
      stamp: {
        revision: "r2",
        variant: null,
        phase: null,
        configuration: RENOVATION_CONFIGURATION,
      },
      digest: lineageDigest("88"),
    },
    {
      id: "render-strip-phase",
      kind: "phase-render",
      inputs: ["wall-south", "wall-north"],
      assets: [],
      stamp: {
        revision: "r2",
        variant: null,
        phase: "strip",
        configuration: RENOVATION_PHASE_CONFIGURATION,
      },
      digest: lineageDigest("99"),
    },
    {
      // The warm scheme lays the imported oak, so its comparison render opens
      // the same bytes the finish cut did; the stone scheme below never does.
      // Two outputs citing one asset and a third that must not is what keeps
      // the rule from reading as "every render cites every texture".
      id: "render-warm",
      kind: "comparison-render",
      inputs: ["floor-oak", "pendant-lamp", "oak-texture"],
      assets: [{ subject: "oak-texture", digest: RENOVATION_TEXTURE_DIGEST }],
      stamp: {
        revision: "r2",
        variant: "warm-oak",
        phase: null,
        configuration: RENOVATION_COMPARISON_CONFIGURATION,
      },
      digest: lineageDigest("aa"),
    },
    {
      id: "render-cool",
      kind: "comparison-render",
      inputs: ["floor-oak", "pendant-lamp"],
      assets: [],
      stamp: {
        revision: "r2",
        variant: "cool-stone",
        phase: null,
        configuration: RENOVATION_COMPARISON_CONFIGURATION,
      },
      digest: lineageDigest("bb"),
    },
  ],
});

/**
 * The smallest lineage that is still a lineage: one revision and nothing else.
 *
 * A production that records a revision without a construction sequence or an
 * alternative is the normal starting state, and it has to validate and answer
 * queries rather than be a degenerate case nobody tested.
 */
export const emptyLineage = (): IAutoMovieDesignLineage => ({
  version: 1,
  id: "bare",
  head: "r1",
  subjects: [],
  revisions: [{ id: "r1", parent: null, digest: lineageDigest("0f") }],
  phases: [],
  lifecycles: [],
  variants: [],
  decisions: [],
  derived: [],
});

/**
 * Apply one edit to a fresh renovation lineage.
 *
 * Every refusal case needs the same shape with one field wrong, and building
 * that by hand is how a case ends up asserting something other than the defect
 * it named. The mutation runs against a copy nobody else holds.
 */
export const brokenLineage = (
  edit: (draft: IAutoMovieDesignLineage) => void,
): IAutoMovieDesignLineage => {
  const lineage = renovationLineage();
  edit(lineage);
  return lineage;
};

/**
 * True when one edit away from the coherent fixture is refused at one path.
 *
 * Each refusal case is a single property change against a record that is known
 * to validate, so a failing case names the rule that stopped firing rather than
 * a fixture that was never coherent to begin with.
 */
export const refusesLineage = (
  edit: (draft: IAutoMovieDesignLineage) => void,
  path: string,
  kind: AutoMovieViolationKind = "type",
): boolean =>
  hasViolation(
    validateDesignLineage({ lineage: brokenLineage(edit) }),
    kind,
    path,
  );
