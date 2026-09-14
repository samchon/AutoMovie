/**
 * The manor production authors its scene in JavaScript. This declaration is the
 * website's typed boundary onto that module: only the fields the showcase host
 * reads are named, and its shape follows `createManorScene` in
 * `experimental/medieval-baron-manor/src/models/manor.js`.
 */
declare module "medieval-baron-manor/src/instances/manor-textured.js" {
  import type * as THREE from "three";

  /** One authored room of the manor as the scene manifest lists it. */
  export interface IManorRoom {
    id: string;
    label: string;
    level: number;
  }

  /** One authored observation point; `room` or `object` says what it frames. */
  export interface IManorView {
    id: string;
    room?: string;
    object?: string;
    plan?: boolean;
    cut?: string;
  }

  /** The visual manor scene with its authored views and camera. */
  export interface IManorScene {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    views: readonly IManorView[];
    manifest: { rooms: readonly IManorRoom[] };
    /** The scene object of every authored entry, keyed by entry id. */
    objects: ReadonlyMap<string, THREE.Object3D>;
    /** Authored aim point, kept in front of the eye during flight. */
    target: THREE.Vector3;
    /** The inspection light; its target marks the selected view's aim. */
    inspection: THREE.DirectionalLight;
    applyView(index: number): IManorView;
    /** Follow the eye with the inspection light and resolve the instance sets. */
    update(): void;
    /** The lighting half of `update`, for a host that draws the sets itself. */
    followLighting(): void;
    configureRenderer(renderer: THREE.WebGLRenderer): void;
    instanceState: {
      prototypes: number;
      instanceSets: number;
      drawnInstances: number;
      gpuInstancedMeshes: number;
    };
    disposeTextures(): Promise<void>;
  }

  /** Decode the textures, derive the shared prototypes, and build the scene. */
  export function createTexturedManorScene(options?: {
    /** Named before each phase starts; may return a promise to let a host paint. */
    report?: (phase: string) => Promise<void> | undefined;
    shadows?: boolean;
  }): Promise<IManorScene>;
}
