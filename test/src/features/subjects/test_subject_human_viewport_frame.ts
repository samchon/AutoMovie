import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { createHumanViewportFixture } from "../internal/createHumanViewportFixture";
import { nclose } from "../internal/predicates";

/**
 * Manual captures and animation frames project the same current clay and orbit
 * state; browser diagnostics do not assume the debug renderer extension exists.
 *
 * Scenarios:
 * 1. Finishing immediately after either clay toggle applies it before drawing.
 * 2. Animation frames use the same order, and only the key light casts shadows.
 * 3. Resize updates the camera; renderer reporting uses debug and basic enums.
 * 4. Pixel ratios above the sampling cap clamp, while a smaller ratio survives.
 */
export const test_subject_human_viewport_frame = (): void => {
  const f = createHumanViewportFixture();
  f.viewport.fitView();
  f.viewport.setClay(true);
  f.viewport.finish();
  TestValidator.predicate(
    "manual capture immediately uses clay",
    (f.frames[0].clay as THREE.MeshStandardMaterial | null)
      ?.isMeshStandardMaterial === true,
  );
  TestValidator.equals(
    "manual capture updates then draws then waits",
    f.events.slice(-3),
    ["orbit", "render", "finish"],
  );
  f.viewport.setClay(false);
  f.viewport.finish();
  TestValidator.equals(
    "manual capture immediately removes clay",
    f.frames[1].clay,
    null,
  );
  f.viewport.setClay(true);
  f.frame();
  TestValidator.predicate(
    "loop uses the same clay material",
    f.frames[2].clay === f.frames[0].clay,
  );
  f.viewport.setClay(false);
  f.frame();
  TestValidator.equals("loop removes clay", f.frames[3].clay, null);
  TestValidator.equals("loop updates then draws", f.events.slice(-2), [
    "orbit",
    "render",
  ]);
  // The test runner and application can resolve separate Three.js instances.
  const lights = f.frames[0].scene.children.filter(
    (object) => (object as THREE.Light).isLight === true,
  ) as THREE.Light[];
  TestValidator.predicate(
    "fill and rim do not cast key shadows",
    lights.filter((light) => light.castShadow).length === 1 &&
      lights.some((light) => !light.castShadow),
  );
  const key = lights.find(
    (light) => light.castShadow,
  )! as THREE.DirectionalLight;
  TestValidator.predicate(
    "shadow camera brackets a finite facial volume",
    key.shadow.camera.near > 0 &&
      key.shadow.camera.far > key.shadow.camera.near &&
      key.shadow.camera.left < 0 &&
      key.shadow.camera.right > 0 &&
      key.shadow.camera.projectionMatrix.elements.every(Number.isFinite),
  );
  TestValidator.predicate(
    "display configuration is active",
    f.renderer.shadowMap.enabled &&
      f.renderer.outputColorSpace === THREE.SRGBColorSpace &&
      f.orbit.enableDamping &&
      f.orbit.minDistance > 0,
  );
  f.dimensions.width = 900;
  f.dimensions.height = 300;
  f.resize();
  TestValidator.predicate(
    "resize reaches perspective",
    nclose(f.camera().aspect, 3),
  );
  TestValidator.equals("resize preserves CSS ownership", f.sizes, [
    [640, 480, 0],
    [900, 300, 0],
  ]);
  f.viewport.cameraView(90);
  TestValidator.predicate(
    "left camera is positive X",
    f.camera().position.x > f.orbit.target.x &&
      nclose(f.camera().position.z, f.orbit.target.z),
  );
  TestValidator.equals(
    "debug renderer",
    f.viewport.renderer(),
    "renderer-37446",
  );
  f.state.extension = null;
  TestValidator.equals(
    "basic renderer fallback",
    f.viewport.renderer(),
    "renderer-7937",
  );
  TestValidator.equals("renderer queries", f.parameters, [37446, 7937]);
  TestValidator.equals("extension queries", f.extensions, [
    "WEBGL_debug_renderer_info",
    "WEBGL_debug_renderer_info",
  ]);
  TestValidator.predicate("supersampling is capped", nclose(f.ratios[0], 2));
  const low = createHumanViewportFixture({ pixelRatio: 1.25 });
  TestValidator.predicate(
    "ordinary pixel ratio retained",
    nclose(low.ratios[0], 1.25),
  );
  f.frames[0].clay!.dispose();
};
