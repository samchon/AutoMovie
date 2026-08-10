import { autoMovieSemanticMaskNodeIndex } from "@automovie/engine";
import {
  IAutoMovieScene,
  IAutoMovieSemanticMask,
  IAutoMovieSemanticMaskEntry,
} from "@automovie/interface";
import * as THREE from "three";

import {
  IAutoMovieFormationCycle,
  applyFormationCycleMaterial,
  formationCycleOf,
} from "./formationCycle";

/** A reversible semantic-mask override, restored exactly like a render mode. */
export interface IAutoMovieSemanticMaskHandle {
  /** How many meshes were painted a semantic colour. */
  painted: number;

  /**
   * Meshes left at the reserved background colour because no entry claimed
   * them. Never silently zero: unaddressed geometry in a segmentation pass is a
   * hole in the evidence, and it is counted so a consumer can refuse it.
   */
  unaddressed: number;

  /** Undo the override completely, disposing everything it created. */
  restore: () => void;
}

/** Prefix of the viewer group name a compiled instance set is built under. */
const INSTANCE_SET_PREFIX = "instance-set:";

/**
 * Paint a built scene with its stable semantic palette.
 *
 * The mask pass that shipped before this coloured the Nth top-level child with
 * the Nth colour of a ramp, which meant an entire building read as one colour
 * and inserting an unrelated node repainted everything after it. Here every
 * mesh is painted the colour its own semantic id earned, so a wall, the opening
 * cut through it, the door leaf filling that opening and one repeated window
 * slot are four different colours, and they are the SAME four colours after the
 * scene is rebuilt in a different order.
 *
 * Resolution walks each mesh up to the nearest ancestor the mask names:
 *
 * - A staged node, matched to `design.nodes` by construction order, which is the
 *   order {@link buildScene} adds its top-level children in;
 * - Any named object the mask lists, which is how the standable ground and a
 *   compiled instance set's viewer group are found;
 * - A compiled instance set's per-slot colours, written into `instanceColor` so
 *   one window out of ten thousand is addressable without ever promoting it to
 *   a scene node.
 *
 * A mesh no entry claims is painted the reserved background colour rather than
 * left showing its beauty material: a segmentation consumer must never read a
 * lit surface as a class, and an unpainted mesh would be exactly that.
 *
 * Deformation follows the beauty pass. A formation's baked cycle is carried
 * onto every replacement material, so a marching crowd marches in the mask
 * exactly as it marches in the film, and the mask describes the frame that will
 * be delivered rather than a rest pose nobody sees.
 *
 * @author Samchon
 */
export const applyAutoMovieSemanticMask = (props: {
  /** The built scene. */
  scene: THREE.Scene;
  /** The design the scene was built from, in its own declaration order. */
  design: IAutoMovieScene;
  /** Palette derived from the same production. */
  mask: IAutoMovieSemanticMask;
}): IAutoMovieSemanticMaskHandle => {
  const { scene, design, mask } = props;
  if (scene.children.length < design.nodes.length)
    throw new Error(
      `semantic mask cannot resolve staged nodes: the scene holds ${scene.children.length} top-level children for ${design.nodes.length} designed nodes`,
    );
  const byNode = autoMovieSemanticMaskNodeIndex(mask);
  const bySlot = new Map<string, IAutoMovieSemanticMaskEntry>();
  for (const entry of mask.entries)
    if (entry.slot !== null)
      bySlot.set(`${entry.slot.instanceSet}#${entry.slot.index}`, entry);

  // Objects whose whole subtree belongs to one entry. Staged nodes are matched
  // positionally because `buildScene` adds one anonymous group per designed
  // node, in order; everything else is matched by its own name.
  const roots = new Map<THREE.Object3D, IAutoMovieSemanticMaskEntry>();
  design.nodes.forEach((node, index) => {
    const entry = byNode.get(node.id);
    if (entry !== undefined) roots.set(scene.children[index]!, entry);
  });
  scene.traverse((object) => {
    const entry = byNode.get(object.name);
    if (entry !== undefined) roots.set(object, entry);
  });

  const background = scene.background;
  scene.background = new THREE.Color(0x000000);
  const swaps: Array<{
    mesh: THREE.Mesh;
    material: THREE.Material | THREE.Material[];
  }> = [];
  const colors: Array<{
    mesh: THREE.InstancedMesh;
    values: Float32Array | null;
  }> = [];
  const created: THREE.Material[] = [];
  // One material per colour per formation cycle: a hundred chunks of one wall
  // compile one program, and a tier that deforms by its own baked table keeps
  // its own.
  const materials = new Map<
    string,
    Map<IAutoMovieFormationCycle | null, THREE.Material>
  >();
  const materialOf = (
    color: string,
    cycle: IAutoMovieFormationCycle | null,
  ): THREE.Material => {
    let byCycle = materials.get(color);
    if (byCycle === undefined) {
      byCycle = new Map();
      materials.set(color, byCycle);
    }
    const cached = byCycle.get(cycle);
    if (cached !== undefined) return cached;
    const material = new THREE.MeshBasicMaterial({ color });
    if (cycle !== null) applyFormationCycleMaterial(material, cycle);
    byCycle.set(cycle, material);
    created.push(material);
    return material;
  };

  let painted = 0;
  let unaddressed = 0;
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh !== true) return;
    const entry = nearest(mesh, roots);
    swaps.push({ mesh, material: mesh.material });
    if (entry === undefined) {
      ++unaddressed;
      mesh.material = materialOf(mask.background, formationCycleOf(mesh));
      return;
    }
    ++painted;
    mesh.material = materialOf(entry.color, formationCycleOf(mesh));
    if (entry.kind !== "instance-set") return;
    const instanced = mesh as THREE.InstancedMesh;
    if (instanced.isInstancedMesh !== true) return;
    const slots = instanced.userData.automovieSlots as number[] | undefined;
    if (slots === undefined || slots.length === 0) return;
    // Per-slot identity: the batch material stays white and three multiplies it
    // by the instance colour, so each slot renders its own exact palette value.
    const previous = instanced.instanceColor;
    colors.push({
      mesh: instanced,
      values:
        previous === null ? null : (previous.array as Float32Array).slice(),
    });
    const set = entry.id.slice(INSTANCE_SET_PREFIX.length);
    const paint = new THREE.Color();
    slots.forEach((slot, index) => {
      const owned = bySlot.get(`${set}#${slot}`);
      paint.set(owned === undefined ? entry.color : owned.color);
      instanced.setColorAt(index, paint);
    });
    instanced.instanceColor!.needsUpdate = true;
  });

  let done = false;
  return {
    painted,
    unaddressed,
    restore: (): void => {
      if (done) return;
      done = true;
      for (const swap of swaps) swap.mesh.material = swap.material;
      for (const entry of colors)
        if (entry.values === null) entry.mesh.instanceColor = null;
        else {
          (entry.mesh.instanceColor!.array as Float32Array).set(entry.values);
          entry.mesh.instanceColor!.needsUpdate = true;
        }
      for (const material of created) material.dispose();
      scene.background = background;
    },
  };
};

/** The nearest ancestor (or the object itself) that an entry claims. */
const nearest = (
  object: THREE.Object3D,
  roots: ReadonlyMap<THREE.Object3D, IAutoMovieSemanticMaskEntry>,
): IAutoMovieSemanticMaskEntry | undefined => {
  let current: THREE.Object3D | null = object;
  while (current !== null) {
    const entry = roots.get(current);
    if (entry !== undefined) return entry;
    current = current.parent;
  }
  return undefined;
};
