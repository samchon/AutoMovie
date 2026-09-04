import { autoMovieSemanticMaskNodeIndex } from "@automovie/engine";
import {
  IAutoMovieSemanticMaskCoverage as AutoMovieSemanticMaskCoverage,
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

export type { IAutoMovieSemanticMaskCoverage } from "@automovie/interface";

/**
 * A reversible semantic-mask override, restored exactly like a render mode.
 *
 * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Makes this public surface part of the stable identity-mask channel.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Implements that channel as a structural render product.
 * @author Samchon
 */
export interface IAutoMovieSemanticMaskHandle {
  /**
   * How many meshes were painted a semantic colour.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Makes this public surface part of the stable identity-mask channel.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Implements that channel as a structural render product.
   */
  painted: number;

  /**
   * Meshes left at the reserved background colour because no entry claimed
   * them. Never silently zero: unaddressed geometry in a segmentation pass is a
   * hole in the evidence, and it is counted so a consumer can refuse it.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Makes this public surface part of the stable identity-mask channel.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Implements that channel as a structural render product.
   */
  unaddressed: number;

  /**
   * Semantic ids that name a drawable this scene does not hold, ascending.
   *
   * The mirror image of {@link unaddressed}: that one counts pixels no id
   * claimed, this one names ids no pixels answered. See
   * {@link auditAutoMovieSemanticMaskScene}, which reports both without
   * painting, for why an empty list is the only proof that what a production
   * declared is what it drew.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Makes this public surface part of the stable identity-mask channel.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Implements that channel as a structural render product.
   */
  unresolved: string[];

  /**
   * Undo the override completely, disposing everything it created.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Makes this public surface part of the stable identity-mask channel.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Implements that channel as a structural render product.
   */
  restore: () => void;
}

/**
 * A built scene and the palette its structural mask pass must paint it with.
 *
 * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Makes this public surface part of the stable identity-mask channel.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Implements that channel as a structural render product.
 * @author Samchon
 */
export interface IAutoMovieSemanticMaskBinding {
  /**
   * The design the scene was built from, in its own declaration order.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Makes this public surface part of the stable identity-mask channel.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Implements that channel as a structural render product.
   */
  design: IAutoMovieScene;

  /**
   * Palette derived from the same production.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Makes this public surface part of the stable identity-mask channel.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Implements that channel as a structural render product.
   */
  mask: IAutoMovieSemanticMask;
}

/** Where a built scene keeps the palette its mask pass paints with. */
const SCENE_MASK_KEY = "automovieSemanticMask";

/**
 * Hand a built scene the palette its `mask` pass must paint it with.
 *
 * The scene carries it, rather than every caller passing it down, for the same
 * reason a formation's baked cycle rides on its own mesh: the pass boundary
 * that needs it is several calls below whoever knows it. A compiled shot's
 * runtime hands `applyRenderMode` a pass name and nothing else, so a mask that
 * had to arrive as an argument could only arrive by widening every signature
 * between the page and the pass. A scene given no palette keeps the legacy
 * index ramp, which is what an asset turntable and any host without a compiled
 * design draw.
 *
 * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Makes this public surface part of the stable identity-mask channel.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Implements that channel as a structural render product.
 * @author Samchon
 */
export const attachAutoMovieSemanticMask = (
  scene: THREE.Scene,
  binding: IAutoMovieSemanticMaskBinding,
): void => {
  scene.userData[SCENE_MASK_KEY] = binding;
};

/**
 * The palette a scene was given, or `null` when it was given none.
 *
 * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Makes this public surface part of the stable identity-mask channel.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Implements that channel as a structural render product.
 */
export const autoMovieSemanticMaskOf = (
  scene: THREE.Scene,
): IAutoMovieSemanticMaskBinding | null =>
  (scene.userData[SCENE_MASK_KEY] as
    | IAutoMovieSemanticMaskBinding
    | undefined) ?? null;

/**
 * How completely one palette and one built scene account for each other.
 *
 * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Makes this public surface part of the stable identity-mask channel.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Implements that channel as a structural render product.
 * @author Samchon
 */
/**
 * Hold one palette against one built scene, in both directions.
 *
 * This is the join the pipeline was missing. The mask is derived from the
 * compiled artifact and states which drawables one frame commits to; the scene
 * is what a viewer actually assembled. A production can declare a pond, a
 * curtain and a fern bed, compile clean, and render a room with none of them in
 * it, and nothing anywhere goes red, because each half was only ever checked
 * against itself. Holding the two against each other is what turns "declared"
 * into "drawn": an id in `unresolved` exists in the design and in no pixel, and
 * `unaddressed` counts the pixels the palette has no name for.
 *
 * Only entries that claim a drawable are checked for the first. A building
 * unit, a storey, a room, a wall opening and an instanced slot deliberately
 * paint nothing of their own and are reached through `owner`, so listing them
 * would report the whole ownership chain as missing on every well-drawn frame.
 *
 * Nothing here paints, hides, or suspends anything, so a host reads its
 * coverage once at build time and reports it beside every frame, instead of
 * opening a pass boundary it would then have to close.
 *
 * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Makes this public surface part of the stable identity-mask channel.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Implements that channel as a structural render product.
 * @author Samchon
 */
export const auditAutoMovieSemanticMaskScene = (props: {
  /** The built scene. */
  scene: THREE.Scene;
  /** The design the scene was built from, in its own declaration order. */
  design: IAutoMovieScene;
  /** Palette derived from the same production. */
  mask: IAutoMovieSemanticMask;
}): AutoMovieSemanticMaskCoverage => {
  const roots = maskRoots(props);
  let unaddressed = 0;
  props.scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh !== true) return;
    if (nearest(mesh, roots) === undefined) ++unaddressed;
  });
  return { unresolved: unresolvedOf(props.mask, roots), unaddressed };
};

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
 * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Makes this public surface part of the stable identity-mask channel.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Implements that channel as a structural render product.
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
  const { scene, mask } = props;
  const roots = maskRoots(props);
  const bySlot = new Map<string, IAutoMovieSemanticMaskEntry>();
  for (const entry of mask.entries)
    if (entry.slot !== null)
      bySlot.set(`${entry.slot.instanceSet}#${entry.slot.index}`, entry);

  // A segmentation pass states an identity, and three things in a scene will
  // quietly overwrite one. Fog mixes every `MeshBasicMaterial` toward the fog
  // colour with distance, so the same wall far away would read as a different
  // wall near. Image lighting draws its own background over the reserved black.
  // A grid, a helper line, a sprite or a point cloud draws its live beauty
  // material straight into the mask. All three are suspended for the duration
  // and put back exactly as they were, so calling this directly is as correct
  // as calling it from inside a pass boundary that already suspends them.
  const fog = scene.fog;
  scene.fog = null;
  const environment = scene.environment;
  scene.environment = null;
  const hidden: THREE.Object3D[] = [];
  scene.traverse((object) => {
    if (!object.visible) return;
    if (
      (object as THREE.Line).isLine === true ||
      (object as THREE.Points).isPoints === true ||
      (object as THREE.Sprite).isSprite === true
    ) {
      object.visible = false;
      hidden.push(object);
    }
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
    unresolved: unresolvedOf(mask, roots),
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
      for (const object of hidden) object.visible = true;
      scene.background = background;
      scene.environment = environment;
      scene.fog = fog;
    },
  };
};

/**
 * Objects whose whole subtree belongs to one entry.
 *
 * Staged nodes are matched positionally because {@link buildScene} adds one
 * group per designed node, in order; everything else is matched by its own
 * name. Both readings are kept because a host is free to leave those groups
 * anonymous, and the mask must resolve the scene the viewer builds rather than
 * the scene a test found convenient to assemble.
 */
const maskRoots = (props: {
  scene: THREE.Scene;
  design: IAutoMovieScene;
  mask: IAutoMovieSemanticMask;
}): Map<THREE.Object3D, IAutoMovieSemanticMaskEntry> => {
  const { scene, design, mask } = props;
  if (scene.children.length < design.nodes.length)
    throw new Error(
      `semantic mask cannot resolve staged nodes: the scene holds ${scene.children.length} top-level children for ${design.nodes.length} designed nodes`,
    );
  const byNode = autoMovieSemanticMaskNodeIndex(mask);
  const roots = new Map<THREE.Object3D, IAutoMovieSemanticMaskEntry>();
  design.nodes.forEach((node, index) => {
    const entry = byNode.get(node.id);
    if (entry !== undefined) roots.set(scene.children[index]!, entry);
  });
  scene.traverse((object) => {
    const entry = byNode.get(object.name);
    if (entry !== undefined) roots.set(object, entry);
  });
  return roots;
};

/**
 * Ids that claim a drawable and resolved to no object, in the mask's own
 * ascending order.
 */
const unresolvedOf = (
  mask: IAutoMovieSemanticMask,
  roots: ReadonlyMap<THREE.Object3D, IAutoMovieSemanticMaskEntry>,
): string[] => {
  const resolved = new Set<string>();
  for (const entry of roots.values()) resolved.add(entry.id);
  return mask.entries
    .filter(
      (entry) =>
        (entry.nodes.length !== 0 || entry.kind === "instance-set") &&
        !resolved.has(entry.id),
    )
    .map((entry) => entry.id);
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
