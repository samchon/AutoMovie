import {
  instanceSlot,
  selectFormationLod,
  srgbHexToLinearColor,
} from "@automovie/engine";
import {
  IAutoMovieCompiledFormationLod,
  IAutoMovieCompiledInstanceSet,
  IAutoMovieInstanceSlot,
  IAutoMovieModel,
} from "@automovie/interface";
import * as THREE from "three";

import { IAutoMovieModelObject } from "./buildModel";
import { readAutoMovieDeliveryCrop } from "./deliveryCrop";
import { flattenInstancedModel, flattenInstancedObject } from "./formation";

/**
 * Bounded viewer accounting for one general instance set.
 *
 * @evidence requirements/formations/resolution-culling-and-evidence.md#formation-resolution-policy-selection Displays this surface from the formation's selected resolution policy.
 * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-compact-representation-compatibility Implements the logical-to-display resolution boundary for instances.
 * @author Samchon
 */
export interface IAutoMovieInstanceSetViewerStats {
  /**
   * Slots currently drawn by automatic LOD tier.
   *
   * @evidence requirements/formations/resolution-culling-and-evidence.md#formation-resolution-policy-selection Displays this surface from the formation's selected resolution policy.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-compact-representation-compatibility Implements the logical-to-display resolution boundary for instances.
   */
  visible: Record<IAutoMovieCompiledFormationLod["tier"], number>;
  /**
   * Slots rejected by chunk-frustum culling.
   *
   * @evidence requirements/formations/resolution-culling-and-evidence.md#formation-resolution-policy-selection Displays this surface from the formation's selected resolution policy.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-compact-representation-compatibility Implements the logical-to-display resolution boundary for instances.
   */
  culled: number;
  /**
   * Slots intentionally hidden by authored or seeded visibility.
   *
   * @evidence requirements/formations/resolution-culling-and-evidence.md#formation-resolution-policy-selection Displays this surface from the formation's selected resolution policy.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-compact-representation-compatibility Implements the logical-to-display resolution boundary for instances.
   */
  hidden: number;
}

/**
 * Viewer-owned chunked object for a compiled general instance set.
 *
 * @evidence requirements/formations/resolution-culling-and-evidence.md#formation-resolution-policy-selection Displays this surface from the formation's selected resolution policy.
 * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-compact-representation-compatibility Implements the logical-to-display resolution boundary for instances.
 * @author Samchon
 */
export interface IAutoMovieInstanceSetViewerObject {
  /**
   * Add this group to the current scene.
   *
   * @evidence requirements/formations/resolution-culling-and-evidence.md#formation-resolution-policy-selection Displays this surface from the formation's selected resolution policy.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-compact-representation-compatibility Implements the logical-to-display resolution boundary for instances.
   */
  object: THREE.Group;
  /**
   * Current LOD and culling accounting.
   *
   * @evidence requirements/formations/resolution-culling-and-evidence.md#formation-resolution-policy-selection Displays this surface from the formation's selected resolution policy.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-compact-representation-compatibility Implements the logical-to-display resolution boundary for instances.
   */
  stats: IAutoMovieInstanceSetViewerStats;
  /**
   * Recompute chunk visibility for the current camera.
   *
   * @evidence requirements/formations/resolution-culling-and-evidence.md#formation-resolution-policy-selection Displays this surface from the formation's selected resolution policy.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-compact-representation-compatibility Implements the logical-to-display resolution boundary for instances.
   */
  update(camera: THREE.PerspectiveCamera, viewportHeight: number): void;
}

interface IInstancePrototypeChunkObject {
  /** Conservative world radius of one unscaled prototype instance. */
  projectionRadius: number;
  count: number;
  lod: IAutoMovieCompiledInstanceSet["lod"];
  tiers: Map<IAutoMovieCompiledFormationLod["tier"], THREE.InstancedMesh>;
  selected: IAutoMovieCompiledFormationLod["tier"] | null;
}

/** One flattened prototype tier ready to be cloned into a chunk batch. */
interface IInstanceRepresentation {
  geometry: THREE.BufferGeometry;
  materials: THREE.Material[];
}

interface IInstanceChunkObject {
  runtime: IAutoMovieCompiledInstanceSet["chunks"][number];
  radius: number;
  prototypes: IInstancePrototypeChunkObject[];
}

/**
 * Build one non-formation crowd, vegetation, prop, facade, or ornament set.
 *
 * Matrices, colors, scales, and numeric trait attributes are regenerated from
 * compact runtime data. No slot is promoted into a scene node: a set of a
 * hundred thousand members holds one batch per chunk, prototype and LOD tier,
 * and each member costs one instance matrix rather than one object.
 *
 * A prototype is either the builder's generated recipe or a host-loaded
 * object; passing `prototypeObjects` is what lets a registered static glTF be
 * the prototype, and it is flattened by the same rigid path a generated recipe
 * takes. Rigid is the whole condition: a skinned, morphed, or multi-material
 * source mesh is refused by name rather than instanced as something else.
 *
 * @evidence requirements/formations/resolution-culling-and-evidence.md#formation-resolution-policy-selection Displays this surface from the formation's selected resolution policy.
 * @evidence requirements/lighting/color-exposure-and-display-boundary.md#lighting-working-color-space Decodes palette swatches before their values enter the renderer's scene-linear instance attribute.
 * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-compact-representation-compatibility Implements the logical-to-display resolution boundary for instances.
 * @evidence specifications/camera-light-and-visibility/light-transport-color-and-budget.md#clv-color-effective-ownership Keeps the palette input encoding and its scene-linear output under one explicit conversion owner.
 */
export const buildInstancedInstanceSet = (input: {
  instanceSet: IAutoMovieCompiledInstanceSet;
  models: ReadonlyMap<string, IAutoMovieModel>;
  /**
   * Already-loaded prototype objects keyed by runtime model id.
   *
   * A host that has decoded a registered external asset passes it here; a model
   * absent from the map is built from its builder-owned recipe instead.
   */
  prototypeObjects?: ReadonlyMap<string, IAutoMovieModelObject>;
}): IAutoMovieInstanceSetViewerObject => {
  const root = new THREE.Group();
  // One decoded carrier per authored swatch. `setColorAt` copies its
  // components, and a block may hold a hundred thousand slots, so neither the
  // transfer function nor its temporary label belongs in the per-slot cost.
  const paletteColors = new Map<string, THREE.Color>();
  root.name = `instance-set:${input.instanceSet.id}`;
  root.position.copy(vector(input.instanceSet.anchor));
  const prototypes = input.instanceSet.prototypes ?? [
    {
      id: "default",
      modelRecipe: input.instanceSet.modelRecipe,
      weight: 1,
      lod: input.instanceSet.lod,
      projectionRadius: input.instanceSet.projectionRadius,
    },
  ];
  // Keyed by prototype and then by tier rather than by one joined string: a
  // prototype id is author-owned text, so `"panel:near"` and a `"panel"` tier
  // named `"near"` would otherwise be the same entry and one prototype would
  // silently draw the other's geometry.
  const representations = new Map<
    string,
    Map<IAutoMovieCompiledFormationLod["tier"], IInstanceRepresentation>
  >(
    prototypes.map((prototype) => [
      prototype.id,
      new Map(
        prototype.lod.map((lod) => {
          const model = input.models.get(lod.model);
          if (model === undefined)
            throw new Error(
              `Instance set "${input.instanceSet.id}" prototype "${prototype.id}" LOD "${lod.tier}" references missing runtime model "${lod.model}".`,
            );
          const owner = `Instance set "${input.instanceSet.id}" prototype "${prototype.id}" LOD "${lod.tier}"`;
          const loaded = input.prototypeObjects?.get(lod.model);
          const representation =
            loaded === undefined
              ? flattenInstancedModel(model, owner)
              : flattenInstancedObject(loaded, owner);
          return [
            lod.tier,
            {
              geometry: representation.geometry,
              materials: representation.materials.map(exactPaletteMaterial),
            },
          ] as const;
        }),
      ),
    ]),
  );
  // The largest axis scale any slot of this set can reach, measured once. It is
  // read for every chunk of every frame, and an explicit block may hold a
  // hundred thousand transforms, so measuring it per frame would both cost the
  // set's own size each frame and blow the argument limit of a spread.
  const maximumScale = maximumInstanceScale(input.instanceSet);
  const traitNames = input.instanceSet.variation.traits.map(
    (trait) => trait.name,
  );
  const chunks: IInstanceChunkObject[] = input.instanceSet.chunks.map(
    (chunk) => {
      const slots = Array.from({ length: chunk.count }, (_, index) =>
        regenerateInstanceSlot(input.instanceSet, chunk.start + index),
      );
      const visibleSlots = slots.filter((slot) => slot.visible !== false);
      const prototypeObjects = prototypes.flatMap((prototype) => {
        const selectedSlots = visibleSlots.filter(
          (slot) => (slot.prototype ?? "default") === prototype.id,
        );
        if (selectedSlots.length === 0) return [];
        const tiers = new Map<
          IAutoMovieCompiledFormationLod["tier"],
          THREE.InstancedMesh
        >();
        const tierRepresentations = representations.get(prototype.id)!;
        for (const lod of prototype.lod) {
          const representation = tierRepresentations.get(lod.tier)!;
          const geometry = representation.geometry.clone();
          for (const [traitIndex, traitName] of traitNames.entries())
            geometry.setAttribute(
              `automovieTrait${traitIndex}`,
              new THREE.InstancedBufferAttribute(
                // Every declared trait is regenerated for every slot, so a
                // declared name always names a value on the slot it came from.
                new Float32Array(
                  selectedSlots.map((slot) => slot.traits[traitName]!),
                ),
                1,
              ),
            );
          const mesh = new THREE.InstancedMesh(
            geometry,
            representation.materials,
            selectedSlots.length,
          );
          mesh.name = `${input.instanceSet.id}:${chunk.index}:${prototype.id}:${lod.tier}`;
          mesh.userData.automovieTraitNames = [...traitNames];
          mesh.userData.automoviePrototype = prototype.id;
          mesh.userData.automovieSlots = selectedSlots.map((slot) => slot.slot);
          selectedSlots.forEach((slot, index) => {
            mesh.setMatrixAt(
              index,
              instanceMatrix(slot, input.instanceSet.anchor),
            );
            // A palette entry is an sRGB swatch, so it is decoded here by the
            // engine's own transfer function rather than by handing the string
            // to `THREE.Color`. Both decodes agree to every bit this attribute
            // can hold, but three's runs only while the global
            // `ColorManagement.enabled` is true, and a host that switches it
            // off would silently brighten every instanced set while materials
            // built from an `IAutoMovieColor` triple stayed where they were.
            // Decoding explicitly is also what makes the two authoring paths
            // one conversion: the builder decodes a recipe palette with this
            // same function on its way into `baseColor`.
            let paint = paletteColors.get(slot.palette);
            if (paint === undefined) {
              const linear = srgbHexToLinearColor(slot.palette);
              paint = new THREE.Color(linear.r, linear.g, linear.b);
              paletteColors.set(slot.palette, paint);
            }
            mesh.setColorAt(index, paint);
          });
          mesh.instanceMatrix.needsUpdate = true;
          // A batch is only built for a prototype that owns at least one slot,
          // so `setColorAt` above has already allocated the color attribute.
          mesh.instanceColor!.needsUpdate = true;
          mesh.computeBoundingBox();
          mesh.computeBoundingSphere();
          mesh.frustumCulled = false;
          mesh.visible = false;
          root.add(mesh);
          tiers.set(lod.tier, mesh);
        }
        return [
          {
            projectionRadius: prototype.projectionRadius,
            count: selectedSlots.length,
            lod: prototype.lod,
            tiers,
            selected: null,
          },
        ];
      });
      return {
        runtime: chunk,
        radius: boundsRadius(chunk.bounds, chunk.centroid),
        prototypes: prototypeObjects,
      };
    },
  );
  const drawn = chunks.reduce(
    (count, chunk) =>
      count +
      chunk.prototypes.reduce(
        (prototypeCount, prototype) => prototypeCount + prototype.count,
        0,
      ),
    0,
  );
  const stats: IAutoMovieInstanceSetViewerStats = {
    visible: { hero: 0, near: 0, far: 0 },
    culled: 0,
    hidden: input.instanceSet.count - drawn,
  };
  return {
    object: root,
    stats,
    update(camera, viewportHeight): void {
      stats.visible = { hero: 0, near: 0, far: 0 };
      stats.culled = 0;
      root.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);
      camera.updateProjectionMatrix();
      const projection = new THREE.Matrix4().multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse,
      );
      const frustum = new THREE.Frustum().setFromProjectionMatrix(projection);
      const cameraPosition = new THREE.Vector3();
      camera.getWorldPosition(cameraPosition);
      const halfY = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
      const deliveryCrop = readAutoMovieDeliveryCrop(camera);
      const effectiveHalfY =
        halfY *
        (deliveryCrop === undefined
          ? 1
          : deliveryCrop.bottom - deliveryCrop.top);
      for (const chunk of chunks) {
        const center = root.localToWorld(
          new THREE.Vector3(
            chunk.runtime.centroid.x - input.instanceSet.anchor.x,
            chunk.runtime.centroid.y - input.instanceSet.anchor.y,
            chunk.runtime.centroid.z - input.instanceSet.anchor.z,
          ),
        );
        // The chunk's own bounds hold slot origins only, so the sphere is
        // widened by the largest world radius one instance of this set can
        // occupy. That radius is rotation-invariant, which is exactly why a
        // rotated, non-uniformly scaled instance whose origin sits outside the
        // frustum still keeps its chunk on screen.
        const sphere = new THREE.Sphere(
          center,
          chunk.radius + input.instanceSet.projectionRadius * maximumScale,
        );
        if (frustum.intersectsSphere(sphere) === false) {
          for (const prototype of chunk.prototypes)
            for (const mesh of prototype.tiers.values()) mesh.visible = false;
          stats.culled += chunk.prototypes.reduce(
            (count, prototype) => count + prototype.count,
            0,
          );
          continue;
        }
        const distance = Math.max(0.001, cameraPosition.distanceTo(center));
        const cameraDepth = Math.max(
          0.001,
          -center.clone().applyMatrix4(camera.matrixWorldInverse).z,
        );
        for (const prototype of chunk.prototypes) {
          const projectedPixels =
            (prototype.projectionRadius * maximumScale * viewportHeight) /
            (effectiveHalfY * cameraDepth);
          const selected = selectFormationLod({
            lod: prototype.lod,
            distance,
            projectedPixels,
            previous: prototype.selected,
          }).lod;
          prototype.selected = selected.tier;
          for (const [tier, mesh] of prototype.tiers)
            mesh.visible = tier === selected.tier;
          stats.visible[selected.tier] += prototype.count;
        }
      }
    },
  };
};

/**
 * Regenerate one exact instance from compact compiled parameters.
 *
 * The member law is the engine's {@link instanceSlot}, the one a compiled set's
 * bounds are measured with and a shot source's oracle answers through, so the
 * member drawn here is the member the compiled record holds. A viewer copy of
 * that law agreed on every valid record but refused less, and drew a
 * hand-edited record the engine refuses as members standing on non-finite
 * coordinates or painted with no swatch.
 *
 * It therefore throws what the engine throws: a slot outside the set, a route
 * snapshot that is missing, names another route, or has no finite positive
 * length, an explicit block missing the slot or naming a prototype no choice
 * declares, and a derived non-finite value or an empty palette.
 * {@link buildInstancedInstanceSet} regenerates every chunk slot through here
 * while it builds, so such a refusal leaves that call before any batch of the
 * set exists, and a host building a shot, such as a generated project's viewer
 * runtime, fails its build with the engine's message instead of drawing the
 * set.
 *
 * @evidence requirements/formations/resolution-culling-and-evidence.md#formation-resolution-policy-selection Displays this surface from the formation's selected resolution policy.
 * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-compact-representation-compatibility Implements the logical-to-display resolution boundary for instances.
 * @evidence requirements/formations/layouts-and-slots.md#formation-layout-selection-parameters Regenerates the selected grid, scatter, lattice, explicit, or route layout from its declared parameters.
 * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Implements deterministic slot generation and assignment for that layout.
 * @evidence requirements/formations/heroes-variation-and-state.md#formation-deterministic-population Regenerates prototype, palette, scale, traits, and visibility from stable seed and slot identity.
 * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hero-variation-group-state Implements deterministic population and variation state.
 * @evidence requirements/formations/scope-and-identity.md#formation-group-member-identity Preserves the compiled set and stable slot identity on each regenerated member.
 * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Implements compact member identity independently of array presentation.
 * @evidence requirements/formations/terrain-and-routes.md#formation-group-path Places along-route slots on the declared compiled path.
 */
export const regenerateInstanceSlot = (
  instanceSet: IAutoMovieCompiledInstanceSet,
  slot: number,
): IAutoMovieInstanceSlot => instanceSlot(instanceSet, slot);

const instanceMatrix = (
  slot: IAutoMovieInstanceSlot,
  anchor: IAutoMovieCompiledInstanceSet["anchor"],
): THREE.Matrix4 =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(
      slot.position.x - anchor.x,
      slot.position.y - anchor.y,
      slot.position.z - anchor.z,
    ),
    slot.rotation === undefined
      ? new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          instanceHeadingRadians(slot.facingDeg),
        )
      : new THREE.Quaternion(
          slot.rotation.x,
          slot.rotation.y,
          slot.rotation.z,
          slot.rotation.w,
        ),
    slot.scale3 === undefined
      ? new THREE.Vector3(slot.scale, slot.scale, slot.scale)
      : vector(slot.scale3),
  );

/**
 * The largest axis scale any slot of one set can reach.
 *
 * An explicit block states each slot's scale outright, so its own transforms
 * are the answer and the seeded ranges never apply. The reduction is a loop
 * rather than a spread because a set may declare a hundred thousand explicit
 * transforms, and spreading three hundred thousand arguments into `Math.max`
 * exceeds the engine's argument limit and throws instead of measuring.
 */
const maximumInstanceScale = (
  instanceSet: IAutoMovieCompiledInstanceSet,
): number => {
  if (instanceSet.layout.kind === "explicit") {
    let maximum = Number.EPSILON;
    for (const transform of instanceSet.layout.transforms)
      maximum = Math.max(
        maximum,
        transform.scale.x,
        transform.scale.y,
        transform.scale.z,
      );
    return maximum;
  }
  const range = instanceSet.variation.scale3;
  return range === undefined
    ? instanceSet.variation.scale.max
    : Math.max(range.max.x, range.max.y, range.max.z);
};

const boundsRadius = (
  bounds: IAutoMovieCompiledInstanceSet["bounds"],
  centroid: IAutoMovieCompiledInstanceSet["centroid"],
): number =>
  Math.max(
    0.01,
    ...[bounds.min.x, bounds.max.x].flatMap((x) =>
      [bounds.min.y, bounds.max.y].flatMap((y) =>
        [bounds.min.z, bounds.max.z].map((z) =>
          Math.hypot(x - centroid.x, y - centroid.y, z - centroid.z),
        ),
      ),
    ),
  );

/**
 * One instance set's base heading in radians, to the last bit.
 *
 * Not `THREE.MathUtils.degToRad`. That multiplies by a rounded `PI / 180`,
 * while the engine divides by 180 after multiplying by `Math.PI`, and the two
 * disagree in the final ulp for a great many headings. A member of a set that
 * declares no rotation carries no quaternion, so its batch matrix is turned by
 * this heading, which has to be the one the engine placed the member with
 * rather than a neighbouring double.
 */
const instanceHeadingRadians = (facingDeg: number): number =>
  (facingDeg * Math.PI) / 180;

const vector = (value: { x: number; y: number; z: number }): THREE.Vector3 =>
  new THREE.Vector3(value.x, value.y, value.z);

/**
 * Instance colors multiply the material's diffuse color in Three.js. General
 * instance palettes are exact overrides, so cloned instance-only materials use
 * white as the neutral multiplier while retaining roughness and other
 * channels.
 */
const exactPaletteMaterial = (material: THREE.Material): THREE.Material => {
  // A three.js material either carries a diffuse `color` or has none at all;
  // there is no third state to test for, so the presence of the channel is the
  // whole question.
  const clone = material.clone() as THREE.Material & { color?: THREE.Color };
  clone.color?.set(0xffffff);
  return clone;
};
