import { IAutoMovieFog } from "@automovie/interface";

/**
 * The fraction of a subject's own color that survives the scene's atmosphere at
 * `depthMeters`: its **transmittance**, one at the lens and falling to zero
 * with distance. The rendered color is `subject * T + fog.color * (1 - T)`.
 *
 *     T(d) = exp(-(density * d)^2)
 *
 * This is the whole of automovie's fog law and the ONLY place it is written.
 * The viewer hands the same `density` to the GPU ({@link applySceneFog} builds a
 * `FogExp2`), whose shader computes `1.0 - exp(-fogDensity * fogDensity *
 * vFogDepth * vFogDepth)` (`three.js` `fog_fragment.glsl`, `FOG_EXP2` branch)
 * over `vFogDepth = -mvPosition.z` (`fog_vertex.glsl`). Reproducing that exact
 * expression here, rather than the physically purer Beer-Lambert `exp(-density
 * * d)`, is what makes this function a PREDICTION of the painted pixel instead
 * of an estimate of it: an offline artifact and a review frame state the same
 * atmosphere, or the artifact is lying about the film.
 *
 * `depthMeters` is camera-space depth (distance along the camera's forward
 * axis, `projectToNdc`'s `depth`), not radial distance, again because that is
 * what the shader interpolates. The law is even in depth, so a point behind the
 * camera attenuates like one the same distance in front; that is the shader's
 * behavior too, and a caller that cares reads the depth's sign.
 *
 * An absent or `null` fog is a scene with no declared atmosphere, and returns
 * exactly `1`: nothing is taken from the subject, which is what makes the whole
 * feature invisible to every production that never mentions it.
 *
 * @author Samchon
 */
export const sceneFogTransmittance = (
  fog: IAutoMovieFog | null | undefined,
  depthMeters: number,
): number => {
  if (fog === null || fog === undefined) return 1;
  const opticalDepth = fog.density * depthMeters;
  return Math.exp(-(opticalDepth * opticalDepth));
};
