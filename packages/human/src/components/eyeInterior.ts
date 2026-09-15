import {
  createAutoMovieMeshDepthSampler,
  mergeAutoMovieMeshes,
  transformAutoMovieMesh,
} from "@automovie/engine";
import type {
  IAutoMovieModelPart,
  IAutoMovieVector3 as Point,
} from "@automovie/interface";

import {
  portraitSpline as interpolate,
  portraitMix as mix,
  portraitPoint as p,
  portraitPatch as patch,
  portraitNormals,
  portraitPart,
  portraitRegion,
  portraitTube as tube,
} from "../geometry/geometry";
import { portraitDirectionalSurfaceTargets } from "../geometry/portraitDirectionalContact";
import {
  type IPortraitEyeSphere,
  portraitEyeSphereHeight,
  portraitEyeSphereIntersection,
} from "../geometry/portraitEyeSphere";
import { createPortraitOpticalFrame } from "../geometry/portraitOpticalFrame";
import type { IControlMesh } from "../geometry/subdivideControlMesh";
import { buildPortraitEyeCornea } from "./eyeOpticalSurface";
import {
  type IPortraitEyePerformance,
  buildPortraitPerformanceGlobe,
  posePortraitOpticalMesh,
} from "./eyePerformance";
import type { IPortraitEyeShape, IPortraitEyeSocket } from "./eyeShape";
import { buildPortraitEyebrow } from "./eyebrows";
import { buildPortraitEyelash } from "./eyelashes";
import type { createPortraitOcularTissues } from "./ocularTissues";

const pi = Math.PI,
  tau = pi * 2;

/**
 * Build the sclera, gaze, iris, lashes and brow against this eye's refined rim.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Constructs resident sclera, iris, pupil, cornea, wet tissues, lashes and brows against a refined eyelid.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Uses the shared globe and view-ray intersection for optics, fixed-sphere performance, deterministic pigment bands and final-surface brow attachment.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-expression Attaches profiled lashes at the final margin and carries their supplied observed-relative orientation.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-expression Keeps strand transport separate from fixed optical identity and gaze.
 */
export function buildPortraitEye(
  source: number[][],
  refined: IControlMesh,
  eyeMargins: ReadonlyMap<number, number>,
  viewRay: number[],
  socket: IPortraitEyeSocket,
  shape: IPortraitEyeShape,
  sphere: IPortraitEyeSphere,
  tissues?: ReturnType<typeof createPortraitOcularTissues>,
  performance?: IPortraitEyePerformance,
  lashMotion?: (at: number) => Parameters<typeof buildPortraitEyelash>[5],
): IAutoMovieModelPart[] {
  const parts: IAutoMovieModelPart[] = [];
  const add = (
    id: string,
    mesh: Parameters<typeof portraitPart>[1],
    finish: string,
  ): void => {
    parts.push(portraitPart(id, mesh, finish));
  };
  const landmark = (id: number): Point =>
    p(source[id][0], source[id][1], source[id][2]);
  const white = "sclera",
    pupil = "pupil",
    brow = "brows";
  const eye = socket;
  {
    const margin = (id: number): Point => {
      const point = refined.positions[eyeMargins.get(id)!];
      return p(point[0], point[1], point[2]);
    };
    const upper = eye.top.map(margin),
      lower = eye.bottom.map(margin);
    const lidSamples = [lower, upper].map((points) =>
      Array.from({ length: 257 }, (_, i) => {
        const x = mix(points[0].x, points[points.length - 1].x, i / 256);
        let low = 0,
          high = 1;
        for (let iteration = 0; iteration < 18; iteration++) {
          const t = (low + high) / 2;
          if (interpolate(points, t).x < x) low = t;
          else high = t;
        }
        return interpolate(points, (low + high) / 2);
      }),
    );
    const lidAt = (x: number, points: Point[]): Point => {
      const samples = lidSamples[points === lower ? 0 : 1];
      const t = Math.max(
        0,
        Math.min(
          256,
          (256 * (x - points[0].x)) /
            (points[points.length - 1].x - points[0].x),
        ),
      );
      const i = Math.min(255, Math.floor(t));
      return p(
        x,
        mix(samples[i].y, samples[i + 1].y, t - i),
        mix(samples[i].z, samples[i + 1].z, t - i),
      );
    };
    // Spherical curvature is independent of aperture height and gaze. The
    // fitted lid alone determines how much of that surface remains visible.
    const eyeZ = (x: number, y: number): number =>
      portraitEyeSphereHeight(sphere, x, y);
    const sclera =
      performance === undefined && shape.opticalFrame !== "radial"
        ? patch(
            (u, v) => {
              const top = interpolate(upper, u),
                bottom = interpolate(lower, u);
              const x = mix(bottom.x, top.x, v),
                y = mix(bottom.y, top.y, v);
              return p(x, y, eyeZ(x, y));
            },
            shape.sampling.eyeColumns,
            shape.sampling.eyeRows,
          )
        : buildPortraitPerformanceGlobe(
            sphere,
            Math.max(3, shape.sampling.eyeColumns),
            Math.max(2, shape.sampling.eyeRows),
          );
    // The sclera owns an exact spherical surface: grad(|p-c|^2-r^2)
    // points along p-c, and |p-c|=r. Divide construction millimetres by
    // radius millimetres to obtain dimensionless outward unit normals. This
    // remains defined at a collapsed canthal row where triangle-area averaging
    // has no direction, and avoids a sampling-dependent optical normal field.
    const sphereCenter = [sphere.center.x, sphere.center.y, sphere.center.z];
    sclera.normals = sclera.positions.map(
      (value, index) => (value - sphereCenter[index % 3]) / sphere.radius,
    );
    add(`${eye.name}-sclera`, sclera, white);
    // One gaze centre feeds drawing and tissue support. Full-limbus contact
    // includes the actual optical shell, whose anterior surface is above the
    // basic globe; following the latter buried the wet margin in the cornea.
    const center = portraitEyeSphereIntersection(
      sphere,
      landmark(eye.iris),
      p(viewRay[0], viewRay[1], viewRay[2]),
    );
    const radial =
      shape.opticalFrame === "radial"
        ? createPortraitOpticalFrame(sphere, center)
        : undefined;
    const opticalCenter = radial === undefined ? center : radial.sphere.center;
    const support = portraitPart(
      "ocular-tissue-support",
      mergeAutoMovieMeshes([
        sclera,
        ...(shape.lidContact === "cornea"
          ? [buildPortraitEyeCornea(center, sphere, shape, [], performance)]
          : []),
      ]),
      white,
    ).geometry.mesh;
    const surface = createAutoMovieMeshDepthSampler(support, "z");
    if (tissues !== undefined && performance?.blink !== 1) {
      const surfaces = tissues({
        side: eye.name,
        minimumX: lower[0].x,
        maximumX: lower[lower.length - 1].x,
        lower: (x) => lidAt(x, lower),
        upper: (x) => lidAt(x, upper),
        globe: (x, y) =>
          Math.max(
            eyeZ(x, y),
            (surface(x / 1000, y / 1000)?.maximum ?? -Infinity) * 1000,
          ),
      });
      // A strip's vertices may clear a curved support while its straight
      // triangles cut it. Resolve the emitted faces in metres, then return to
      // construction mm before add() crosses the common model-unit boundary.
      for (const mesh of [surfaces.corner, surfaces.lowerMargin]) {
        if (mesh === null) continue;
        const metric = portraitPart("ocular-tissue-contact", mesh, white)
          .geometry.mesh;
        const targets = portraitDirectionalSurfaceTargets(
          metric,
          support,
          p(0, 0, 1),
          0.00002,
        );
        for (const { vertex, target } of targets)
          mesh.positions.splice(
            vertex * 3,
            3,
            target.x * 1000,
            target.y * 1000,
            target.z * 1000,
          );
        mesh.normals = portraitNormals(mesh.positions, mesh.indices!);
      }
      if (surfaces.corner !== null)
        add(`${eye.name}-medial-conjunctiva`, surfaces.corner, "ocular-corner");
      if (surfaces.lowerMargin !== null)
        add(
          `${eye.name}-lower-lid-margin`,
          surfaces.lowerMargin,
          "ocular-margin",
        );
    }
    // The detector's iris depth differs from the eye surface depth. Simply
    // replacing Z moves the apparent gaze in the reference camera. Intersect
    // its measured ray instead, retaining the photographed iris centre in XY.
    for (const [name, radius] of [
      ["iris", shape.irisRadius],
      ["pupil", shape.pupilRadius],
    ] as const) {
      // All radial samples on one ray share the same clipped endpoint. Solve
      // it once per angular column, retaining the exact same ray and bisection.
      const extents = Array.from(
        { length: shape.sampling.irisColumns + 1 },
        (_, column) => {
          if (performance !== undefined || radial !== undefined) return radius;
          const angle = tau * (column / shape.sampling.irisColumns);
          const inside = (r: number): boolean => {
            const x = center.x + r * Math.cos(angle),
              y = center.y - r * Math.sin(angle);
            return (
              y >= lidAt(x, lower).y + 0.15 && y <= lidAt(x, upper).y - 0.15
            );
          };
          let extent: number = radius;
          if (!inside(radius)) {
            let low = 0,
              high: number = radius;
            for (let i = 0; i < 24; i++) {
              const r = (low + high) / 2;
              if (inside(r)) low = r;
              else high = r;
            }
            extent = (low + high) / 2;
          }
          return extent;
        },
      );
      let mesh = patch(
        (u, v) => {
          const angle = tau * u;
          const extent = extents[Math.round(u * shape.sampling.irisColumns)];
          const x =
              opticalCenter.x +
              extent * (0.0001 + 0.9999 * v) * Math.cos(angle),
            y =
              opticalCenter.y -
              extent * (0.0001 + 0.9999 * v) * Math.sin(angle);
          const z =
            radial === undefined
              ? eyeZ(x, y)
              : portraitEyeSphereHeight(radial.sphere, x, y);
          return p(x, y, z + (name === "pupil" ? 0.09 : 0.055));
        },
        shape.sampling.irisColumns,
        shape.sampling.irisRows,
      );
      if (radial !== undefined)
        mesh = transformAutoMovieMesh(mesh, radial.transform);
      if (performance !== undefined)
        mesh = posePortraitOpticalMesh(mesh, sphere.center, performance);
      if (name === "pupil") add(`${eye.name}-pupil`, mesh, pupil);
      else {
        add(
          `${eye.name}-cornea`,
          buildPortraitEyeCornea(
            center,
            sphere,
            shape,
            extents.slice(0, -1),
            performance,
          ),
          eye.name + "-cornea",
        );
        // Pigment follows radial fibres. The outer 13 percent forms a dark
        // limbal ring; the inner bands vary in brown. All regions retain the
        // exact same positions and normals, so this edit cannot enlarge an eye.
        const regions = Array.from({ length: 8 }, () => [] as number[]);
        for (let i = 0; i < mesh.indices!.length; i += 6) {
          const cell = i / 6;
          const angle =
            (tau * ((cell % shape.sampling.irisColumns) + 0.5)) /
            shape.sampling.irisColumns;
          const radius =
            (Math.floor(cell / shape.sampling.irisColumns) + 0.5) /
            shape.sampling.irisRows;
          const fiber =
            0.48 +
            0.23 * Math.sin(angle * 37 + radius * 7) +
            0.17 * Math.sin(angle * 71 - radius * 11) +
            0.12 * Math.cos(angle * 13);
          const group =
            radius > 0.87 ? 0 : Math.max(0, Math.min(7, Math.floor(fiber * 8)));
          regions[group].push(...mesh.indices!.slice(i, i + 6));
        }
        regions.forEach((indices, group) => {
          if (indices.length === 0) return;
          add(
            `${eye.name}-iris-${group}`,
            portraitRegion(mesh.positions, mesh.normals!, indices),
            `${shape.irisPigment === undefined ? "iris" : eye.name + "-iris"}-${group}`,
          );
        });
      }
    }
    add(
      `${eye.name}-lash-line`,
      tube(
        (t) => {
          const point = interpolate(upper, t);
          return p(point.x, point.y, point.z + 0.04);
        },
        (t) => 0.06 + 0.16 * Math.sin(pi * t),
        70,
      ),
      brow,
    );
    // Short curled upper lashes belong to the eyelid, not the deferred scalp
    // hairstyle. They project in front of the measured rim, so their shadows
    // affect the eye without changing the opening's geometric silhouette.
    const outward = eye.name === "left" ? 1 : -1;
    for (let i = 0; i < shape.upperLashes; i++) {
      const u = 0.04 + (0.92 * (i + 0.5)) / shape.upperLashes;
      const origin = interpolate(upper, u);
      const length = 0.5 + (eye.name === "left" ? u : 1 - u);
      add(
        `${eye.name}-upper-lash-${i}`,
        shape.upperLashProfile === undefined
          ? tube(
              (t) =>
                p(
                  origin.x + outward * 0.25 * length * t,
                  origin.y + 0.45 * length * t * t,
                  origin.z + 0.05 + length * t,
                ),
              (t) => 0.055 * (1 - 0.9 * t),
              6,
            )
          : buildPortraitEyelash(
              p(origin.x, origin.y, origin.z + 0.05),
              shape.upperLashProfile,
              eye.name,
              eye.name === "left" ? u : 1 - u,
              i,
              lashMotion?.(u),
            ),
        brow,
      );
    }
    parts.push(
      ...buildPortraitEyebrow(
        refined,
        { side: eye.name, upper: eye.browTop, lower: eye.browBottom },
        shape.browFibres,
        shape.browProfile,
      ),
    );
  }
  return parts;
}
