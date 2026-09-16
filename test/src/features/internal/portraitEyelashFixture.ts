import type {
  IPortraitComponent,
  IPortraitComponentHost,
  IPortraitEyelashProfile,
} from "@automovie/human";
import type { IAutoMovieMesh, IAutoMovieVector3 } from "@automovie/interface";

/** A straight eight-millimetre lash for independent circle and arc arithmetic. */
export const portraitEyelashFixture = (): IPortraitEyelashProfile => ({
  length: 8,
  elevation: 0,
  curl: 0,
  fan: 0,
  radius: 0.06,
  taper: 0.9,
  variation: 0,
});

/** Average the eight distinct ring directions; the repeated closing vertex is excluded. */
export const portraitEyelashRingCenter = (
  mesh: IAutoMovieMesh,
  row: number,
): IAutoMovieVector3 => {
  const values = [0, 1, 2].map(
    (axis) =>
      Array.from(
        { length: 8 },
        (_, i) => mesh.positions[(row * 9 + i) * 3 + axis],
      ).reduce((sum, value) => sum + value, 0) / 8,
  );
  return { x: values[0], y: values[1], z: values[2] };
};

/** Exercise the fitted eye's attachment and finisher without assembling unrelated cranial skin. */
export const portraitEyelashEyeFixture = (
  component: IPortraitComponent,
  host: IPortraitComponentHost,
) => {
  const plan = component.fit(host);
  const targets = new Map(plan.constraints.map((c) => [c.vertex, c.target]));
  const positions = host.positions.map((point, id) => [
    ...(targets.get(id) ?? point),
  ]);
  const cage = { positions, indices: [] as number[], groups: [] as number[] };
  const attached = plan.attach(cage, positions, () => 1);
  return { parts: attached.finish(cage), cage };
};
