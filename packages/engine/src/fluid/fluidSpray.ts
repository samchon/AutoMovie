import {
  IAutoMovieFluidDomain,
  IAutoMovieFluidSpray,
  IAutoMovieFluidSprayParticle,
  IAutoMovieFluidSpraySample,
  IAutoMovieFluidState,
} from "@automovie/interface";

import { seededValue } from "../math/random";

const JITTER_X = 0x73707278;
const JITTER_Y = 0x73707279;
const JITTER_Z = 0x7370727a;

/**
 * Sample the decorative spray of a fluid domain at one solved state.
 *
 * Spray is the garnish, not the water: a jet's mist and the curtain at the foot
 * of a water wall read as motion without ever entering or leaving the conserved
 * depth field, which is why the mass balance stays a statement about the solver
 * alone.
 *
 * A particle's whole life is a function of the emitter seed and its spawn
 * index, so seeking to a time reproduces exactly the set that playing straight
 * through would have shown. Particle `i` is launched at `i / rate` seconds from
 * the free surface above the emitter's cell, then follows the ballistic arc `p
 * = p₀ + d·speed·age − ½·g·age²·ŷ` for `lifetime` seconds.
 *
 * The live set is bounded twice. Distance thins it deterministically by keeping
 * every `1 + floor(cameraDistance / lodDistance)`-th index, so a fountain seen
 * from across a courtyard costs a fraction of the same fountain seen from its
 * rim, and the hard `maxParticles` cap then keeps the newest survivors. Both
 * are enforced here rather than trusted to the renderer, so the CPU reference
 * and any GPU projection agree on how many particles exist.
 *
 * @author Samchon
 */
export const sampleFluidSpray = (props: {
  domain: IAutoMovieFluidDomain;
  state: IAutoMovieFluidState;
  /** Camera distance in metres driving LOD thinning; defaults to `0`. */
  cameraDistance?: number;
}): IAutoMovieFluidSpraySample => {
  const { domain, state } = props;
  const cameraDistance = props.cameraDistance ?? 0;
  const time = state.time;
  const particles: IAutoMovieFluidSprayParticle[] = [];
  for (const spray of domain.sprays)
    emit({ domain, state, spray, time, cameraDistance, particles });
  return { step: state.step, time, particles };
};

const emit = (props: {
  domain: IAutoMovieFluidDomain;
  state: IAutoMovieFluidState;
  spray: IAutoMovieFluidSpray;
  time: number;
  cameraDistance: number;
  particles: IAutoMovieFluidSprayParticle[];
}): void => {
  const { domain, spray } = props;
  const cell = spray.row * domain.grid.columns + spray.column;
  const nozzle = {
    x: domain.grid.origin.x + (spray.column + 0.5) * domain.grid.cellX,
    y: domain.grid.origin.y + domain.bed[cell] + props.state.depth[cell],
    z: domain.grid.origin.z + (spray.row + 0.5) * domain.grid.cellZ,
  };
  const stride = 1 + Math.floor(props.cameraDistance / spray.lodDistance);
  const newest = Math.floor(props.time * spray.rate);
  const oldest = Math.floor((props.time - spray.lifetime) * spray.rate);
  const gravity = domain.solver.gravity;

  // Walk newest-first so the hard cap keeps the freshest particles, then put
  // the survivors back in spawn order: a bounded walk, never the whole history.
  const collected: IAutoMovieFluidSprayParticle[] = [];
  for (let index = newest; index >= 0 && index > oldest; --index) {
    if (collected.length === spray.maxParticles) break;
    if (index % stride !== 0) continue;
    // `oldest < index <= time·rate` is the exact integer statement of "alive
    // for less than `lifetime`", so aliveness needs no second test; the clamp
    // only absorbs a rounding ulp in `floor(time·rate)`.
    const age = Math.max(0, props.time - index / spray.rate);
    const direction = jitter(spray, index);
    collected.push({
      spray: spray.id,
      index,
      position: {
        x: nozzle.x + direction.x * spray.speed * age,
        y:
          nozzle.y +
          direction.y * spray.speed * age -
          0.5 * gravity * age * age,
        z: nozzle.z + direction.z * spray.speed * age,
      },
      size: spray.size,
      ageRatio: age / spray.lifetime,
    });
  }
  for (let at = collected.length - 1; at >= 0; --at)
    props.particles.push(collected[at]);
};

/** The unit launch direction of one particle: the jet axis plus seeded jitter. */
const jitter = (
  spray: IAutoMovieFluidSpray,
  index: number,
): { x: number; y: number; z: number } => {
  const axis = spray.direction;
  const axisLength = Math.sqrt(
    axis.x * axis.x + axis.y * axis.y + axis.z * axis.z,
  );
  const x =
    axis.x / axisLength +
    spray.spread * (2 * seededValue(spray.seed, index, JITTER_X) - 1);
  const y =
    axis.y / axisLength +
    spray.spread * (2 * seededValue(spray.seed, index, JITTER_Y) - 1);
  const z =
    axis.z / axisLength +
    spray.spread * (2 * seededValue(spray.seed, index, JITTER_Z) - 1);
  const length = Math.sqrt(x * x + y * y + z * z);
  return { x: x / length, y: y / length, z: z / length };
};
