import { builtEnvironmentElementPartBounds } from "@automovie/engine";
import type {
  IAutoMovieBuiltEnvironment,
  IAutoMovieModel,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { originTransform } from "../internal/envelopeFixtures";
import { makeProp, primitivePart } from "../internal/fixtures";
import { namedFacts, vclose } from "../internal/predicates";

/**
 * Two different absences answer `null` here, and only one of them was pinned.
 *
 * Per-part boxes exist so a caller can ask how much of a body's box is body,
 * which is the question a union cannot answer for a multi-part thing. The two
 * ways there is no answer are not the same fact: an id the record never
 * declared is a caller mistake, while a transform-only group is a real element
 * that draws nothing. Both return `null`, so a caller cannot tell them apart,
 * and a test that exercises only one leaves the other free to start returning
 * something.
 *
 * Scenarios:
 *
 * 1. An element the record does not hold answers `null`.
 * 2. A group element that stages no model answers `null` for the other reason.
 * 3. A placed unit box answers with the half-metre reach its own placement puts
 *    it at, so the refusals are read against a working positive rather than
 *    against a record nothing works on.
 */
export const test_architecture_element_part_bounds_refusals = (): void => {
  const record = pair();
  const drawn = builtEnvironmentElementPartBounds(record, "crate");

  TestValidator.equals(
    "a placed unit box reports the one box its own part fills",
    namedFacts([
      ["it reports one part", () => drawn !== null && drawn.length === 1],
      [
        "reaching half a metre either side of its placement",
        () =>
          drawn !== null &&
          vclose(drawn[0]!.min, { x: 1.5, y: -0.5, z: 2.5 }) &&
          vclose(drawn[0]!.max, { x: 2.5, y: 0.5, z: 3.5 }),
      ],
    ]),
    {
      "it reports one part": true,
      "reaching half a metre either side of its placement": true,
    },
  );

  TestValidator.equals(
    "an undeclared element and a group that draws nothing both answer null",
    {
      undeclared: builtEnvironmentElementPartBounds(record, "nowhere"),
      group: builtEnvironmentElementPartBounds(record, "yard-root"),
    },
    { undeclared: null, group: null },
  );
};

/** One unit box model, placed once under a group that draws nothing itself. */
const pair = (): IAutoMovieBuiltEnvironment => ({
  version: 1,
  id: "yard",
  units: "meter",
  buildings: [{ id: "yard", element: "yard-root", space: "yard-space" }],
  models: [box("crate-model")],
  modelReferences: [],
  elements: [
    {
      id: "yard-root",
      kind: "building",
      parent: null,
      transform: originTransform(),
      model: null,
      space: "yard-space",
    },
    {
      id: "crate",
      kind: "prop",
      parent: "yard-root",
      transform: {
        translation: { x: 2, y: 0, z: 3 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
      model: "crate-model",
      space: null,
    },
  ],
  spaces: [{ id: "yard-space", kind: "zone", parent: null, cells: [] }],
  boundaries: [],
  openings: [],
  connectors: [],
  surfaces: [],
  walkable: [],
});

/** A one-metre cube whose single part is named for readable expectations. */
const box = (id: string): IAutoMovieModel => ({
  ...makeProp([
    primitivePart("block", { type: "box", width: 1, height: 1, depth: 1 }),
  ]),
  id,
});
