import { resolveShotLighting } from "@automovie/engine";
import { IAutoMovieClip, IAutoMovieLight } from "@automovie/interface";
import * as THREE from "three";

import { applyTransform } from "./buildModel";

/**
 * Write one {@link IAutoMovieLight}'s value onto the `three.js` light that plays
 * it: its PLACEMENT for every kind, colour and intensity for every kind,
 * falloff distance for the two that have one, the cone half-angle (degrees on
 * the artifact, radians in `three.js`) for a spot, and the panel extent for an
 * area source.
 *
 * The one place the mapping lives. {@link buildLight} calls it to place a staged
 * light and {@link applyLightMotion} calls it to move that same light over time,
 * so an animated light and a static one can never disagree about what `range`
 * or `coneAngle` means.
 *
 * The transform is written HERE rather than once at build time, which is what
 * makes a light's direction animatable at all. `buildLight` used to place the
 * light itself and this helper wrote everything except its placement, so a
 * `/lights/<id>/rotation` track could resolve to a new orientation every frame
 * and the `three.js` light would keep the one it was staged with forever. Both
 * callers now go through one writer, so the rendered placement is the resolved
 * placement by construction; {@link aimLight} keeps the light's target as a
 * CHILD for exactly the same reason, so a turning light turns what it aims at
 * with it.
 *
 * Writing an absolute TRS every frame is also what lets `applyLightMotion` keep
 * its promise that the viewer's lighting is a pure function of scene, clips and
 * time: a light nothing addresses is written back to where the scene staged it
 * rather than holding wherever the previous frame left it.
 *
 * @author Samchon
 * @evidence requirements/lighting/sources-and-photometry.md#lighting-source-time-sampling Writes this light surface from the exact sampled source state.
 * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-source-sampling-refusal Implements the fixed-time source sampling and refusal boundary.
 */
export const applyLightState = (
  target: THREE.Light,
  light: IAutoMovieLight,
): void => {
  applyTransform(target, light.transform);
  target.color.setRGB(light.color.r, light.color.g, light.color.b);
  target.intensity = light.intensity;
  if (light.type === "point" && target instanceof THREE.PointLight)
    target.distance = light.range;
  else if (light.type === "spot" && target instanceof THREE.SpotLight) {
    target.distance = light.range;
    target.angle = (light.coneAngle * Math.PI) / 180;
  } else if (light.type === "area" && target instanceof THREE.RectAreaLight) {
    // Extent carries no channel, so it never changes between frames; it is
    // written here anyway because this is the one place a light's values are
    // mapped, and a second writer at build time is the duplicate that survives
    // until the two copies disagree.
    target.width = light.width;
    target.height = light.height;
  }
};

/**
 * Drive scene lights from a shot's `lightMotions`: evaluate the clips at
 * `seconds` through the engine's {@link resolveShotLighting} and write each
 * resolved light onto the `THREE.Light` that `resolve` returns for its **id**.
 *
 * The render side of #1348, and the reason the axis is not a false green: the
 * engine decides what the light IS at an instant and this writes it, so a
 * candle blown out at 1.6s dims in the viewer at 1.6s instead of holding its
 * staged glow for the whole film.
 *
 * Lights are resolved by id and never by position. `buildScene` adds them as
 * top-level children and the segmentation mask palette is keyed by top-level
 * child index, so an index-addressed light would silently re-target whenever
 * staging inserts one; {@link IAutoMovieSceneObject.lights} is the id index
 * built for exactly this call.
 *
 * Every staged light is written, not only the ones a clip addresses, which is
 * the deliberate difference from {@link applyObjectMotion}. That helper owns no
 * rest poses, so it must leave an unaddressed channel alone; a light carries
 * its rest on the scene, so writing all of them makes the viewer's lighting a
 * pure function of scene, clips and time. A host swapping clips mid-scene gets
 * the staged light back instead of whatever the previous frame left behind.
 *
 * A light the host cannot resolve is skipped: the engine has already refused a
 * clip addressing a light the scene does not stage, so the only way to arrive
 * here unresolved is a host that built a subset of the scene.
 *
 * @author Samchon
 * @evidence requirements/lighting/sources-and-photometry.md#lighting-source-time-sampling Writes this light surface from the exact sampled source state.
 * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-source-sampling-refusal Implements the fixed-time source sampling and refusal boundary.
 */
export const applyLightMotion = (
  lights: readonly IAutoMovieLight[],
  clips: readonly IAutoMovieClip[],
  seconds: number,
  resolve: (light: string) => THREE.Light | undefined,
): void => {
  for (const light of resolveShotLighting({ lights, clips, seconds })) {
    const target = resolve(light.id);
    if (target === undefined) continue;
    applyLightState(target, light);
  }
};
