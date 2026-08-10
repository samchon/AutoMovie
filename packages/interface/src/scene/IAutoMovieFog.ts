import { IAutoMovieColor } from "../color/IAutoMovieColor";

/**
 * The scene's atmosphere: exponential distance fog, the one cue that makes
 * depth readable on open ground.
 *
 * Without it a scene has no distance at all. Every surface is shaded the same
 * way at one meter and at four hundred, so a far ridge and a near wall read as
 * the same object at the same remove, and the only way to suggest depth is to
 * spend the particle budget on alpha billboards standing in for haze. Fog is
 * the cheap, exact, camera-independent alternative: it costs no particles, it
 * applies to every drawn surface, and it is one declaration for the whole scene
 * rather than a volume per region.
 *
 * ## The law
 *
 * A viewing ray crossing a uniformly scattering medium keeps a fraction of the
 * subject's own color, its **transmittance**, and takes the rest from the
 * medium:
 *
 *     T(d)     = exp(-(density * d)^2)
 *     rendered = subject * T(d) + color * (1 - T(d))
 *
 * Where `d` is the camera-space **depth** of the shaded point (its distance
 * along the camera's forward axis, not its radial distance).
 *
 * The squared exponent is not a choice. It is exactly what the renderer's fog
 * shader computes, `fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth
 *
 * - VFogDepth)`in`three.js`'s `fog_fragment.glsl`under`FOG_EXP2`, with `vFogDepth
 *   = -mvPosition.z`from`fog_vertex.glsl`. A physically pure Beer-Lambert
 *   medium would extinguish as `exp(-density * d)`; adopting the shader's own
 *   law instead means the number an offline consumer derives on the CPU is the
 *   number the GPU actually painted, rather than an approximation of it that
 *   drifts with distance. {@link sceneFogTransmittance} is that single shared
 *   derivation.
 *
 * Because the law is even in `d`, a point behind the camera attenuates like one
 * the same distance in front. That too is the shader's behavior; a caller that
 * cares reads the sign of the depth itself.
 *
 * ## Choosing a density
 *
 * `density` is per meter and its readable anchor is the **half-visibility
 * distance**, where a subject keeps half its own color:
 *
 *     d(T = 1/2) = sqrt(ln 2) / density ~= 0.8326 / density
 *
 * So `0.01 /m` is a clear day with a soft horizon (half at ~83 m, 2% left at
 * 200 m); `0.05 /m` is heavy weather (half at ~17 m); `0.002 /m` is the barely
 * perceptible aerial perspective of a wide vista (half at ~416 m). Zero is a
 * vacuum and renders exactly as no fog at all.
 *
 * @author Samchon
 */
export interface IAutoMovieFog {
  /**
   * Extinction coefficient per meter, `>= 0`. Half-visibility sits at `0.8326 /
   * density` meters; `0` is a vacuum.
   */
  density: number;

  /**
   * The color the atmosphere tends to at full extinction: what an infinitely
   * distant subject becomes. Linear components, like every other
   * {@link IAutoMovieColor}; the alpha slot is opacity-irrelevant here, so
   * `null` is its ordinary value.
   *
   * A scene usually wants this to match its background, otherwise the horizon
   * cuts a visible seam where fogged geometry meets unfogged sky.
   */
  color: IAutoMovieColor;
}
