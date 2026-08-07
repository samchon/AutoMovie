import {
  FRAMING_AIM_FRACTION,
  FRAMING_HEIGHT_FRACTION,
  computeModelRestExtentY,
  computeRestHeight,
} from "@automovie/engine";
import {
  IAutoMovieModel,
  IAutoMovieModelPart,
  IAutoMovieSkeleton,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose } from "../internal/predicates";

const HEIGHT = 1.72;

const transform = (y: number) => ({
  translation: { x: 0, y, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

/**
 * A rig whose extreme joints sit well inside the figure, exactly as the
 * generated `stickman` does: the highest joint at 0.92 of the height and the
 * lowest at 0.24, with no foot bone and no head-top bone.
 */
const skeleton = (): IAutoMovieSkeleton => ({
  id: "probe-rig",
  bones: [
    {
      bone: "hips",
      parent: null,
      rest: transform(HEIGHT * 0.5),
      constraint: null,
    },
    {
      bone: "spine",
      parent: "hips",
      rest: transform(HEIGHT * 0.18),
      constraint: null,
    },
    {
      bone: "head",
      parent: "spine",
      rest: transform(HEIGHT * 0.24),
      constraint: null,
    },
    {
      bone: "leftUpperLeg",
      parent: "hips",
      rest: transform(-HEIGHT * 0.04),
      constraint: null,
    },
    {
      bone: "leftLowerLeg",
      parent: "leftUpperLeg",
      rest: transform(-HEIGHT * 0.22),
      constraint: null,
    },
  ],
});

const part = (
  id: string,
  attachedBone: IAutoMovieModelPart["attachedBone"],
  shape: Extract<
    IAutoMovieModelPart["geometry"],
    { type: "primitive" }
  >["shape"],
  y: number,
): IAutoMovieModelPart => ({
  id,
  name: null,
  geometry: { type: "primitive", shape },
  material: "body",
  attachedBone,
  transform: transform(y),
});

/**
 * A figure that reaches the ground under its lowest joint and past its highest:
 * legs hanging below `leftLowerLeg` and a head sphere above the head joint, so
 * the drawn extent runs 0 to `HEIGHT` while the joints span far less.
 */
const model = (): IAutoMovieModel => ({
  id: "probe-model",
  name: null,
  origin: "generated",
  parts: [
    // Legs: a box centred so its bottom lands on the ground under the knee.
    part(
      "legs",
      "leftLowerLeg",
      { type: "box", width: 0.2, height: HEIGHT * 0.24, depth: 0.2 },
      -HEIGHT * 0.12,
    ),
    // Head: a sphere sitting above the head joint, crown at exactly HEIGHT.
    part(
      "head",
      "head",
      { type: "sphere", radius: HEIGHT * 0.04 },
      HEIGHT * 0.04,
    ),
  ],
  skeleton: skeleton(),
  body: null,
  materials: [],
  asset: null,
});

/**
 * What the camera frames is the figure, not the rig that animates it.
 *
 * The framing grammar solves distance and aim height from one number, so if
 * that number is the span between a rig's extreme joints the whole shot is
 * mis-sized. Rigs stop where animation needs them to: the generated `stickman`
 * has no foot bone and no head-top bone, and the geometry continues past both
 * ends. Measuring the drawn extent instead is what keeps `full` meaning "the
 * whole body with modest headroom" rather than "from the shins up".
 *
 * The oracle is the construction, not the engine: this model's parts are placed
 * so the drawn figure runs exactly 0 to 1.72 while the joints span 0.413 to
 * 1.582, and the framing bands below follow from `FRAMING_HEIGHT_FRACTION` and
 * `FRAMING_AIM_FRACTION` by arithmetic.
 *
 * Scenarios:
 *
 * 1. The rig measurement returns the joint span, 0.680 of the figure, and is
 *    documented as such rather than quietly corrected.
 * 2. The drawn extent returns the real figure: floor at 0, crown at 1.72.
 * 3. Framing solved from the joint span loses the top 27% of the actor, while the
 *    same `full` framing solved from the extent contains the whole figure. This
 *    is the defect and its repair stated as one comparison.
 * 4. A model with no skeleton still measures, since a prop is framed too.
 * 5. A model with no parts measures nothing and returns null, leaving the caller's
 *    own fallback in charge instead of inventing a height.
 */
export const test_film_camera_subject_extent = (): void => {
  const jointSpan = computeRestHeight(skeleton());
  const extent = computeModelRestExtentY(model());

  TestValidator.predicate(
    "the rig measurement is the joint span, not the figure",
    nclose(jointSpan, HEIGHT * 0.68, 1e-9),
  );
  TestValidator.predicate(
    "the drawn extent is the figure, floor to crown",
    extent !== null &&
      nclose(extent.min, 0, 1e-9) &&
      nclose(extent.max, HEIGHT, 1e-9),
  );

  // The band a `full` shot shows, in world Y, given a base at the ground.
  const band = (height: number): { low: number; high: number } => {
    const visible = height * FRAMING_HEIGHT_FRACTION.full;
    const aim = height * FRAMING_AIM_FRACTION.full;
    return { low: aim - visible / 2, high: aim + visible / 2 };
  };
  const fromJoints = band(jointSpan);
  const fromExtent = band(extent?.max ?? 0);
  TestValidator.equals(
    "framing from the joint span crops the actor's head, framing from the extent does not",
    namedFacts([
      ["jointsCropTheCrown", () => fromJoints.high < HEIGHT],
      ["extentHoldsTheCrown", () => fromExtent.high >= HEIGHT],
      ["extentHoldsTheFloor", () => fromExtent.low <= 0],
      ["cropIsAboutAQuarter", () => (HEIGHT - fromJoints.high) / HEIGHT > 0.25],
    ]),
    {
      jointsCropTheCrown: true,
      extentHoldsTheCrown: true,
      extentHoldsTheFloor: true,
      cropIsAboutAQuarter: true,
    },
  );

  const prop: IAutoMovieModel = {
    ...model(),
    parts: [
      part("crate", null, { type: "box", width: 1, height: 2, depth: 1 }, 1),
    ],
    skeleton: null,
  };
  const propExtent = computeModelRestExtentY(prop);
  TestValidator.predicate(
    "a rigless prop measures from its own geometry",
    propExtent !== null &&
      nclose(propExtent.min, 0, 1e-9) &&
      nclose(propExtent.max, 2, 1e-9),
  );
  TestValidator.equals(
    "a model with nothing drawn measures nothing",
    computeModelRestExtentY({ ...model(), parts: [] }),
    null,
  );
};
