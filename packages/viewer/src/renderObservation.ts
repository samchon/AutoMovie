import {
  AutoMovieRenderMetric,
  IAutoMovieRenderReport,
} from "@automovie/interface";
import * as THREE from "three";

/** What a built scene actually draws, read from the scene graph itself. */
export interface IAutoMovieRenderObservation {
  /** Visible mesh objects. */
  meshes: number;

  /** Draw submissions: one per visible mesh, per material group it uses. */
  drawCalls: number;

  /** Triangles submitted, counting every live instance of a batch. */
  triangles: number;

  /** Distinct material objects bound by visible meshes. */
  materials: number;

  /** Distinct texture objects bound by those materials. */
  textures: number;

  /** Visible lights. */
  lights: number;

  /** Visible lights whose `castShadow` is set. */
  shadowMaps: number;

  /** Live instances across every visible instanced batch. */
  instanceSlots: number;
}

/**
 * Read what a built scene draws right now.
 *
 * This is the live half of the evidence pair. The compiled report states an
 * upper bound before a renderer exists; this states what the scene graph in
 * front of you actually submits, and {@link auditAutoMovieRenderObservation}
 * compares the two rather than trusting either alone.
 *
 * The scaffold viewer's shot and film pages call it and publish the count on
 * their capture handle, so a live viewer and the headless capture driving that
 * same page do read one function's answer rather than two. The comparison is
 * what nobody runs: {@link auditAutoMovieRenderObservation} is called by the
 * test suite alone, so a scene that outdraws its report is detectable rather
 * than detected.
 *
 * Only DRAWN geometry counts. An object hidden by its own flag or by any
 * ancestor's submits nothing, and counting it would make a culled crowd look
 * like a budget breach; a chunked instance set starts every chunk hidden and
 * turns on what the frustum keeps, which is precisely the case that must not be
 * miscounted.
 *
 * @author Samchon
 */
export const observeAutoMovieSceneRender = (
  scene: THREE.Scene,
): IAutoMovieRenderObservation => {
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const observation: IAutoMovieRenderObservation = {
    meshes: 0,
    drawCalls: 0,
    triangles: 0,
    materials: 0,
    textures: 0,
    lights: 0,
    shadowMaps: 0,
    instanceSlots: 0,
  };
  scene.traverse((object) => {
    if (!drawn(object)) return;
    const light = object as THREE.Light;
    if (light.isLight === true) {
      ++observation.lights;
      if (light.castShadow === true) ++observation.shadowMaps;
      return;
    }
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh !== true) return;
    ++observation.meshes;
    const bound = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    for (const material of bound) {
      materials.add(material);
      for (const texture of texturesOf(material)) textures.add(texture);
    }
    const instanced = mesh as THREE.InstancedMesh;
    const copies = instanced.isInstancedMesh === true ? instanced.count : 1;
    if (instanced.isInstancedMesh === true)
      observation.instanceSlots += instanced.count;
    observation.drawCalls += bound.length;
    observation.triangles += triangleCount(mesh.geometry) * copies;
  });
  observation.materials = materials.size;
  observation.textures = textures.size;
  return observation;
};

/** One breach of a report's upper bound by what the scene actually draws. */
export interface IAutoMovieRenderObservationBreach {
  /** Metric whose bound was exceeded. */
  metric: AutoMovieRenderMetric;

  /** The report's measured upper bound. */
  bound: number;

  /** What the scene actually submits. */
  observed: number;
}

/**
 * Check a live scene against the report that cleared it.
 *
 * The report's numbers are upper bounds, so the only defect this can find is an
 * observation ABOVE one: a scene drawing more than the compiled artifact
 * committed to means the report is not describing the frame, and a budget
 * verdict about a different frame is worthless. Drawing less is normal and
 * expected, because culling and level-of-detail selection exist.
 *
 * Metrics the report never measured are returned as `unchecked` rather than
 * silently passed. A consumer that treats an empty breach list as agreement
 * would be reading "we did not look" as "we agree", which is the exact
 * confusion the report's `unsupported` and `not-run` states exist to prevent.
 */
export const auditAutoMovieRenderObservation = (props: {
  /** The report that cleared the artifact. */
  report: IAutoMovieRenderReport;
  /** What the scene in front of the consumer draws. */
  observed: IAutoMovieRenderObservation;
}): {
  /** Whether every checkable bound holds. */
  agrees: boolean;
  /** Every exceeded bound, in report order. */
  breaches: IAutoMovieRenderObservationBreach[];
  /** Metrics the report carried no number for, in report order. */
  unchecked: AutoMovieRenderMetric[];
} => {
  const observable: ReadonlyArray<
    [AutoMovieRenderMetric, keyof IAutoMovieRenderObservation]
  > = [
    ["triangles", "triangles"],
    ["drawCalls", "drawCalls"],
    ["materials", "materials"],
    ["textures", "textures"],
    ["lights", "lights"],
    ["shadowMaps", "shadowMaps"],
    ["instanceSlots", "instanceSlots"],
  ];
  const measured = new Map(
    props.report.findings.map((finding) => [finding.metric, finding.measured]),
  );
  const breaches: IAutoMovieRenderObservationBreach[] = [];
  const unchecked: AutoMovieRenderMetric[] = [];
  for (const [metric, field] of observable) {
    const bound = measured.get(metric) ?? null;
    if (bound === null) {
      unchecked.push(metric);
      continue;
    }
    const observed = props.observed[field];
    if (observed > bound) breaches.push({ metric, bound, observed });
  }
  return { agrees: breaches.length === 0, breaches, unchecked };
};

/** Whether an object and every ancestor above it is visible. */
const drawn = (object: THREE.Object3D): boolean => {
  let current: THREE.Object3D | null = object;
  while (current !== null) {
    if (!current.visible) return false;
    current = current.parent;
  }
  return true;
};

const triangleCount = (geometry: THREE.BufferGeometry): number => {
  const index = geometry.getIndex();
  if (index !== null) return index.count / 3;
  const position = geometry.getAttribute("position");
  return position === undefined ? 0 : position.count / 3;
};

/** Every texture object one material binds. */
const texturesOf = (material: THREE.Material): THREE.Texture[] => {
  const found: THREE.Texture[] = [];
  for (const value of Object.values(
    material as unknown as Record<string, unknown>,
  )) {
    const texture = value as THREE.Texture | null;
    if (
      texture !== null &&
      (texture as THREE.Texture | undefined)?.isTexture === true
    )
      found.push(texture);
  }
  return found;
};
