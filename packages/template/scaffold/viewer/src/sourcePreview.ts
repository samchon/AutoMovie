import type * as THREE from "three";

/**
 * A production-owned source view before compiler publication. The producer
 * imports its real authored modules; no generated artifact or receipt is made.
 */
export interface IAutoMovieSourcePreview {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Authored aim point, kept in front of the eye during first-person flight. */
  target?: THREE.Vector3;
  /** Apply production-owned render settings synchronously before the first frame. */
  configureRenderer?: (renderer: THREE.WebGLRenderer) => void;
  /** Update actual authored motion or camera-dependent instance resolution. */
  update?: (
    elapsed: number,
    camera: THREE.PerspectiveCamera,
    viewportHeight: number,
  ) => void;
}
