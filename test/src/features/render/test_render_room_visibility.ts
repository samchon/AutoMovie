import { autoMovieRoomVisibility } from "@automovie/engine";
import { IAutoMovieBuiltEnvironment } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { boxCell, buildingFixture } from "../internal/renderFixtures";

/**
 * Cell-and-portal culling hides a sealed room and nothing else.
 *
 * The hint is only worth having if it stays right in the cases where hiding is
 * wrong, so every conservative case is pinned beside the one aggressive case it
 * must not become. Expectations are read off the fixture's declared graph by
 * hand: `ground-vault` shares a wall with `ground-hall` that carries no
 * opening, `ground-hall` carries a door and a window onto the outside, and a
 * stair joins `ground-hall` to `upper-loft`.
 *
 * Scenarios:
 *
 * 1. A camera inside `ground-hall` hides exactly `ground-vault`, the one space no
 *    declared portal reaches, and keeps every container of a kept room.
 * 2. A camera inside `ground-vault` hides the hall, the upper storey and the loft:
 *    sealed both ways, not merely one way.
 * 3. Cutting a door through the hall/vault wall keeps the vault: same camera, one
 *    portal more, nothing hidden.
 * 4. A camera outside every cell hides nothing and states why.
 * 5. Two overlapping leaf cells containing the camera hide nothing and name the
 *    ambiguity.
 * 6. A leaf space with no cells hides nothing even though the camera is
 *    unambiguously placed: an unknown extent cannot be ruled out of a sight
 *    line.
 * 7. Two rooms whose only openings face outside still see one another, because the
 *    exterior is a portal node and not the absence of one.
 * 8. A one-way stair keeps both ends: traversal is directional, sight is not.
 */
export const test_render_room_visibility = (): void => {
  const inside = autoMovieRoomVisibility({
    environment: buildingFixture(),
    camera: { x: 5, y: 1, z: 5 },
  });
  TestValidator.equals(
    "an unambiguous interior camera hides exactly the sealed room",
    {
      placement: inside.cameraPlacement,
      camera: inside.camera,
      hidden: inside.hidden,
      visible: inside.visible,
      inconclusive: inside.inconclusive,
    },
    {
      placement: "interior",
      camera: "ground-hall",
      hidden: ["ground-vault"],
      visible: ["ground", "ground-hall", "site", "upper", "upper-loft"],
      inconclusive: null,
    },
  );

  TestValidator.equals(
    "the sealed room is sealed in both directions",
    autoMovieRoomVisibility({
      environment: buildingFixture(),
      camera: { x: 13, y: 1, z: 5 },
    }).hidden,
    ["ground-hall", "upper", "upper-loft"],
  );

  const doored = buildingFixture();
  doored.openings.push({
    id: "vault-door",
    kind: "door",
    boundary: "hall-vault-wall",
    fill: null,
  });
  TestValidator.equals(
    "one cut door keeps the previously sealed room drawn",
    autoMovieRoomVisibility({
      environment: doored,
      camera: { x: 5, y: 1, z: 5 },
    }).hidden,
    [],
  );

  const outside = autoMovieRoomVisibility({
    environment: buildingFixture(),
    camera: { x: 100, y: 1, z: 5 },
  });
  TestValidator.equals(
    "an exterior camera hides nothing and says so",
    {
      placement: outside.cameraPlacement,
      camera: outside.camera,
      hidden: outside.hidden,
      reason:
        outside.inconclusive?.includes("outside every declared leaf space") ??
        false,
    },
    { placement: "exterior", camera: null, hidden: [], reason: true },
  );

  const overlapping = buildingFixture();
  overlapping.spaces
    .find((space) => space.id === "ground-vault")!
    .cells.push(boxCell({ id: "spill", min: [0, 0, 0], max: [16, 3, 10] }));
  const ambiguous = autoMovieRoomVisibility({
    environment: overlapping,
    camera: { x: 5, y: 1, z: 5 },
  });
  TestValidator.equals(
    "overlapping cells make the camera ambiguous and hide nothing",
    {
      placement: ambiguous.cameraPlacement,
      hidden: ambiguous.hidden,
      named:
        (ambiguous.inconclusive?.includes("ground-hall") ?? false) &&
        (ambiguous.inconclusive?.includes("ground-vault") ?? false),
    },
    { placement: "ambiguous", hidden: [], named: true },
  );

  const cellless = buildingFixture();
  cellless.spaces.find((space) => space.id === "upper-loft")!.cells = [];
  const unknown = autoMovieRoomVisibility({
    environment: cellless,
    camera: { x: 5, y: 1, z: 5 },
  });
  const unplaced = autoMovieRoomVisibility({
    environment: cellless,
    camera: { x: 100, y: 1, z: 5 },
  });
  TestValidator.equals(
    "an unknown extent hides nothing, and never lets a camera be called exterior",
    {
      hidden: unknown.hidden,
      placement: unknown.cameraPlacement,
      camera: unknown.camera,
      named: unknown.inconclusive?.includes('leaf space "upper-loft"') ?? false,
      outside: unplaced.cameraPlacement,
      outsideCamera: unplaced.camera,
      outsideNamed:
        unplaced.inconclusive?.includes("no celled leaf space") ?? false,
    },
    {
      hidden: [],
      placement: "interior",
      camera: "ground-hall",
      named: true,
      outside: "ambiguous",
      outsideCamera: null,
      outsideNamed: true,
    },
  );

  TestValidator.equals(
    "two rooms open only to the outside still see one another",
    autoMovieRoomVisibility({
      environment: twoWindowedRooms(),
      camera: { x: 5, y: 1, z: 5 },
    }).hidden,
    [],
  );

  const solitary = buildingFixture();
  solitary.spaces = [
    {
      id: "cell",
      kind: "room",
      parent: null,
      cells: [boxCell({ id: "only", min: [0, 0, 0], max: [4, 3, 4] })],
    },
  ];
  solitary.boundaries = [];
  solitary.openings = [];
  solitary.connectors = [];
  TestValidator.equals(
    "a single space that is both leaf and root keeps itself and hides nothing",
    autoMovieRoomVisibility({
      environment: solitary,
      camera: { x: 2, y: 1, z: 2 },
    }),
    {
      version: 1,
      camera: "cell",
      cameraPlacement: "interior",
      hidden: [],
      visible: ["cell"],
      inconclusive: null,
    },
  );

  const oneWay = buildingFixture();
  oneWay.connectors[0]!.bidirectional = false;
  TestValidator.equals(
    "a one-way stair still lets sight travel back down it",
    autoMovieRoomVisibility({
      environment: oneWay,
      camera: { x: 5, y: 4, z: 5 },
    }).hidden,
    ["ground-vault"],
  );
};

/** Two rooms with no shared portal, each with its own exterior window. */
const twoWindowedRooms = (): IAutoMovieBuiltEnvironment => {
  const environment = buildingFixture();
  environment.boundaries.push({
    id: "vault-facade",
    kind: "wall",
    spaces: ["ground-vault"],
    elements: [],
  });
  environment.openings.push({
    id: "vault-window",
    kind: "window",
    boundary: "vault-facade",
    fill: null,
  });
  return environment;
};
