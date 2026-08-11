import type {
  IAutoMovieRenderObservation,
  IAutoMovieRenderReport,
} from "@automovie/interface";
import { auditAutoMovieRenderObservation } from "@automovie/render";
import { observeAutoMovieSceneRender } from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

/**
 * The viewer owns scene traversal while the render package owns the pure
 * comparison with a preflight report.
 *
 * Scenarios:
 *
 * 1. A visible unindexed triangle is counted as one mesh, draw call, material, and
 *    triangle without inventing textures, lights, shadows, or instances.
 * 2. The render-owned audit accepts that interface observation, checks the one
 *    measured bound, and reports every absent report metric as unchecked.
 */
export const test_viewer_render_observation_boundary = (): void => {
  const scene = new THREE.Scene();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
  );
  const material = new THREE.MeshBasicMaterial();
  scene.add(new THREE.Mesh(geometry, material));

  const observed: IAutoMovieRenderObservation =
    observeAutoMovieSceneRender(scene);
  TestValidator.equals("viewer observes one drawn triangle", observed, {
    meshes: 1,
    drawCalls: 1,
    triangles: 1,
    materials: 1,
    textures: 0,
    lights: 0,
    shadowMaps: 0,
    instanceSlots: 0,
  });

  const report: IAutoMovieRenderReport = {
    version: 1,
    protocol: "automovie.render-report.v1",
    tier: "boundary-test",
    status: "within",
    findings: [
      {
        metric: "triangles",
        status: "within",
        measured: 1,
        limit: 1,
        excess: 0,
        contributors: [],
        omittedContributors: 0,
        omittedCost: 0,
        recovery: null,
      },
    ],
    mask: "sha256:mask",
    target: {
      protocol: "automovie.render-target.v1",
      renderer: { api: "test", vendor: "test", device: "test" },
      settings: {
        width: 1,
        height: 1,
        pixelRatio: 1,
        shadows: false,
        shadowType: "none",
        toneMapping: "none",
        exposure: 1,
      },
      assets: [],
      digest: "sha256:target",
    },
    digest: "sha256:report",
  };
  TestValidator.equals(
    "render audit consumes the interface observation without claiming unchecked agreement",
    auditAutoMovieRenderObservation({ report, observed }),
    {
      agrees: false,
      breaches: [],
      unchecked: [
        "drawCalls",
        "materials",
        "textures",
        "lights",
        "shadowMaps",
        "instanceSlots",
      ],
    },
  );

  geometry.dispose();
  material.dispose();
};
