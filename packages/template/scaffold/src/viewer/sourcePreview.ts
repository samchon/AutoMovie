import type * as THREE from "three";

/**
 * One production-owned room, object, or view offered by the common navigator.
 * Group labels and search aliases remain content rather than viewer UI.
 *
 * @author Samchon
 */
export interface IAutoMoviePreviewNavigationItem {
  /** Unique, nonempty identity passed unchanged to the production callback. */
  id: string;
  label: string;
  group?: string;
  keywords?: readonly string[];
}

/**
 * Authored destinations for the source preview's shared search and selector.
 * Items are fixed for one preview generation; a source reload replaces them.
 *
 * @author Samchon
 */
export interface IAutoMoviePreviewNavigation {
  items: readonly IAutoMoviePreviewNavigationItem[];
  /** Set the shared camera and optional target synchronously for this identity. */
  apply: (id: string) => void;
}

/**
 * A production-owned source view before builder publication. The producer
 * imports its real authored modules; no generated artifact or receipt is made.
 */
export interface IAutoMovieSourcePreview {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Authored aim point, kept in front of the eye during first-person flight. */
  target?: THREE.Vector3;
  /** Common navigation UI; the producer supplies destinations, never DOM. */
  navigation?: IAutoMoviePreviewNavigation;
  /** Apply production-owned render settings synchronously before the first frame. */
  configureRenderer?: (renderer: THREE.WebGLRenderer) => void;
  /** Update actual authored motion or camera-dependent instance resolution. */
  update?: (
    elapsed: number,
    camera: THREE.PerspectiveCamera,
    viewportHeight: number,
  ) => void;
}
