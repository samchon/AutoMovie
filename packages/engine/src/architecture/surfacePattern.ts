import {
  IAutoMovieExplicitInstanceTransform,
  IAutoMovieVector3,
} from "@automovie/interface";

import { Matrix4 } from "../math/Matrix4";
import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
import { convexHull2D } from "../math/hull";
import { positiveModulo } from "../math/positiveModulo";
import { seededValue } from "../math/random";

/** Greatest number of lattice cells one zone may be enumerated over. */
export const AUTOMOVIE_MAX_PATTERN_CELLS = 1_000_000;

/** Domain constant separating variant draws from every other seeded decision. */
const VARIANT_DOMAIN = 0x7061_7474;

/** Smallest square metre area counted as real coverage. */
const AREA_EPSILON = 1e-12;

/** Smallest metre length counted as a real gap or overlap. */
const LENGTH_EPSILON = 1e-9;

/** Smallest surviving-fraction shortfall counted as a real sliver. */
const COVERAGE_EPSILON = 1e-12;

/** Greatest relative skew a UV transform is still counted as free of. */
const SHEAR_EPSILON = 1e-9;

/** One point on the host face, in face-local metres. */
export interface IAutoMoviePatternPoint {
  /** Distance along the face's local U axis, in metres. */
  u: number;
  /** Distance along the face's local V axis, in metres. */
  v: number;
}

/** One convex face-local area a pattern must leave uncovered. */
export interface IAutoMoviePatternExclusion {
  /** Stable exclusion id, unique inside one pattern. */
  id: string;
  /** Convex face-local polygon of at least three points. */
  polygon: IAutoMoviePatternPoint[];
}

/** One module a zone's own program proposes, before any clipping. */
export interface IAutoMoviePatternCandidate {
  /** Stable module identity, unique inside its zone. */
  id: string;
  /** Module centre in face-local metres. */
  center: IAutoMoviePatternPoint;
  /** Module footprint in metres; the joint is the gap the author leaves. */
  size: {
    /** Module extent along its own long axis before rotation, in metres. */
    u: number;
    /** Module extent across that axis before rotation, in metres. */
    v: number;
  };
  /** In-plane module rotation in degrees, counter-clockwise about the normal. */
  rotationDeg: number;
  /** Material grain direction in degrees; read modulo 180. */
  grainDeg: number;
  /**
   * Whether the piece is laid face-flipped, its own U axis reversed.
   *
   * This is what book-matching is: two slabs cut from one block and opened like
   * a page, so the second shows the first's image reversed. A rectangle is
   * unchanged by that flip, so the piece keeps the same footprint and the same
   * instance slot; what reverses is the material across it, which is why the
   * flip only becomes visible through
   * {@link autoMoviePatternTextureTransforms}.
   *
   * It is not the grain turned. {@link grainDeg} states the direction the grain
   * runs on the surface either way, so a mirrored pair whose grain runs one way
   * is continuous grain and is not reported as a break.
   */
  mirror: boolean;
}

/**
 * The author's own module program, run once per lattice cell.
 *
 * This is the whole of what the engine does not decide. Square, running bond,
 * herringbone, chevron, radial, and anything a production invents are all this
 * one function written differently: the engine hands over a cell and takes back
 * whatever modules the author puts in it. Nothing here is a preset, because a
 * catalogue of bonds is content, and content is the customer's.
 *
 * The function must be pure: the same cell must always produce the same
 * modules, or the determinism the rest of the pipeline is built on stops at
 * this boundary.
 */
export type AutoMovieSurfacePatternGenerator = (cell: {
  /** Integer lattice column along the face's U axis. */
  column: number;
  /** Integer lattice row along the face's V axis. */
  row: number;
  /** The cell's own origin in face-local metres. */
  origin: IAutoMoviePatternPoint;
  /** The zone's lattice period in metres. */
  period: {
    /** Cell pitch along U, in metres. */
    u: number;
    /** Cell pitch along V, in metres. */
    v: number;
  };
}) => readonly IAutoMoviePatternCandidate[];

/** One area of the host face filled by one module program. */
export interface IAutoMovieSurfacePatternZone {
  /** Stable zone id, unique inside one pattern. */
  id: string;
  /** Convex face-local polygon of at least three points. */
  region: IAutoMoviePatternPoint[];
  /** Face-local metre position of lattice cell `(0, 0)`. */
  origin: IAutoMoviePatternPoint;
  /** Lattice pitch in metres; the generator runs once per cell. */
  period: {
    /** Cell pitch along U, strictly above zero. */
    u: number;
    /** Cell pitch along V, strictly above zero. */
    v: number;
  };
  /**
   * How far in metres a generated module may reach from its cell origin.
   *
   * The lattice is enumerated wide enough that every cell whose modules could
   * touch the region is visited, which is only knowable if the author states
   * the reach. A module that exceeds it is refused rather than silently dropped
   * at the region's edge.
   */
  reach: {
    /** Greatest reach along U, strictly above zero. */
    u: number;
    /** Greatest reach along V, strictly above zero. */
    v: number;
  };
  /** {@link IAutoMovieMaterial} id this zone's modules carry, or `null`. */
  material: string | null;
  /** The author's module program for this zone. */
  generate: AutoMovieSurfacePatternGenerator;
}

/**
 * A deterministic module-laying program over one host face.
 *
 * Tiles, bricks, stone slabs, boards, panels, and repeated ornament are not a
 * texture repeat. A texture repeat knows nothing about the real module size,
 * the joint between modules, the piece cut at a boundary, the opening the
 * pattern has to step around, or how many modules were consumed and how much of
 * them was thrown away. This record is the program that does: the author writes
 * the module law per zone, and the engine owns the parts that must be identical
 * every run — clipping, exclusion, cut classification, neighbour measurement,
 * seeded variation, and the take-off.
 *
 * Several zones in one pattern is how a transition is expressed: each zone lays
 * its own modules inside its own region, and the neighbour scan then measures
 * across the border between them exactly as it does inside one zone, so a grain
 * that turns or a joint that fails to line up at the transition is reported
 * with both occurrence ids rather than being invisible.
 */
export interface IAutoMovieSurfacePattern {
  /** Stable pattern id. */
  id: string;
  /** Areas of the face, each with its own module program. Never empty. */
  zones: IAutoMovieSurfacePatternZone[];
  /** Areas no module may cover, such as an opening or a drain. */
  exclusions: IAutoMoviePatternExclusion[];
  /** Nominal gap between neighbouring laid pieces in metres, at least zero. */
  joint: number;
  /** Metre slack a measured gap may differ from the nominal joint by. */
  jointTolerance: number;
  /** Greatest metre gap at which two laid pieces still count as neighbours. */
  adjacency: number;
  /** Smallest acceptable surviving fraction of a module, within `(0, 1]`. */
  minimumPiece: number;
  /**
   * Greatest tolerated grain deviation between neighbours in degrees, or
   * `null`.
   */
  grainToleranceDeg: number | null;
  /** Non-negative safe-integer seed driving every variant draw. */
  seed: number;
  /** Positive integer count of variants the seed may choose between. */
  variants: number;
}

/**
 * One laid module occurrence: the identity geometry, finish, and take-off
 * share.
 */
export interface IAutoMoviePatternPlacement {
  /** Occurrence identity, `"<zone>/<module>"`. */
  id: string;
  /** The zone that laid it. */
  zone: string;
  /** The generator's own module id inside that zone. */
  module: string;
  /** Surface material id inherited from the zone, or `null`. */
  material: string | null;
  /** Module centre in face-local metres, as generated. */
  center: IAutoMoviePatternPoint;
  /** Module footprint in metres, as generated. */
  size: {
    /** Extent along the module's own U axis. */
    u: number;
    /** Extent along the module's own V axis. */
    v: number;
  };
  /** In-plane module rotation in degrees. */
  rotationDeg: number;
  /** Grain direction in degrees, read modulo 180. */
  grainDeg: number;
  /** Whether the piece is laid face-flipped, its own U axis reversed. */
  mirror: boolean;
  /** Surviving area in square metres. */
  area: number;
  /** Surviving fraction of the module's own area, within `(0, 1]`. */
  coverage: number;
  /** What reduced the module, if anything. */
  cut: "none" | "boundary" | "exclusion" | "both";
  /** Seeded variant index within `[0, variants)`. */
  variant: number;
  /**
   * The module clipped to its zone region, counter-clockwise.
   *
   * This, and not the module rectangle, is what a joint is measured between,
   * because a joint is read on the surface rather than on the drawing.
   */
  outline: IAutoMoviePatternPoint[];
  /**
   * Square metres an exclusion took out of the area {@link outline} draws.
   *
   * The outline is a convex polygon, because a convex module clipped to a
   * convex region stays convex. Subtracting an exclusion generally does not, so
   * a punched piece's true shape is not this outline and no convex kernel path
   * can build it; the run reports that as its own finding rather than handing
   * back an outline that quietly covers the opening. Zero means no exclusion
   * reached the piece and the outline is the piece.
   */
  punchedArea: number;
}

/** The take-off one pattern run produces. */
export interface IAutoMoviePatternQuantities {
  /** Placed occurrences. */
  modules: number;
  /** Occurrences laid whole. */
  whole: number;
  /** Occurrences reduced by a boundary or an exclusion. */
  cut: number;
  /** Surviving area laid, in square metres. */
  coveredArea: number;
  /** Full modules consumed, in square metres; a cut piece still costs one. */
  consumedArea: number;
  /** Offcut area, in square metres. */
  wasteArea: number;
  /** Offcut share of what was consumed, within `[0, 1)`. */
  wasteRatio: number;
  /** Zone area net of exclusions, in square metres. */
  netRegionArea: number;
  /**
   * Net region area left uncovered by modules, in square metres.
   *
   * Negative states that the pieces cover more than the region has, which only
   * happens when they overlap each other; the overlap findings name the pairs.
   */
  jointArea: number;
  /**
   * Joint area divided by the nominal joint width, in metres; zero when the
   * joint is zero.
   */
  jointLength: number;
  /** The same figures per zone, in declaration order. */
  zones: IAutoMoviePatternZoneQuantities[];
}

/** One zone's share of the take-off. */
export interface IAutoMoviePatternZoneQuantities {
  /** The zone id. */
  zone: string;
  /** Placed occurrences in this zone. */
  modules: number;
  /** Occurrences laid whole in this zone. */
  whole: number;
  /** Occurrences reduced in this zone. */
  cut: number;
  /** Surviving area laid in this zone, in square metres. */
  coveredArea: number;
  /** Full modules consumed in this zone, in square metres. */
  consumedArea: number;
  /** Offcut area in this zone, in square metres. */
  wasteArea: number;
  /** This zone's region area net of exclusions, in square metres. */
  netRegionArea: number;
}

/** One structured defect or unsupported case a pattern run reports. */
export interface IAutoMoviePatternFinding {
  /** What the run measured and found wanting. */
  kind:
    | "sliver"
    | "unsupported-piece"
    | "module-overlap"
    | "joint-deviation"
    | "grain-break";
  /** Occurrence ids involved, in ascending placement order. */
  occurrences: string[];
  /** The measured quantity, in the finding's own unit. */
  measured: number;
  /** The limit the measurement failed against. */
  limit: number;
  /** A statement an author or an agent can act on. */
  detail: string;
}

/** Everything one deterministic pattern run produces. */
export interface IAutoMovieSurfacePatternResult {
  /** The pattern that produced this run. */
  id: string;
  /** Occurrences in zone, row, column, then generator order. */
  placements: IAutoMoviePatternPlacement[];
  /** The take-off. */
  quantities: IAutoMoviePatternQuantities;
  /** Structured defects, per-occurrence ones first, then per-pair ones. */
  findings: IAutoMoviePatternFinding[];
}

/** The world placement of the face a pattern was laid on. */
export interface IAutoMoviePatternFaceFrame {
  /** World point the face-local origin sits at. */
  origin: IAutoMovieVector3;
  /** Unit world direction of the face-local U axis. */
  u: IAutoMovieVector3;
  /** Unit world direction of the face-local V axis, perpendicular to U. */
  v: IAutoMovieVector3;
}

/**
 * One flat panel of a host that folds or curves, and the strip of the face it
 * carries.
 *
 * A pattern is laid on one plane because a joint, a cut piece, and a take-off
 * are all measured on the surface rather than in the air above it. A wall that
 * turns a corner and a facade that curves are still one surface, and unrolling
 * them is what keeps them one: the face-local plane is the developed surface,
 * distance along U is distance along the building past the corner, and each
 * zone then says which flat panel of the real host its own strip went back
 * onto.
 *
 * {@link anchor} is the developed point {@link frame}'s origin sits at, so a zone
 * starting three metres along the developed face returns to the return wall's
 * own origin rather than three metres past it. Without it a fold would turn the
 * panel and still leave the pieces where the flat face had put them.
 *
 * A module is a rigid piece, so it belongs to exactly one panel. A piece
 * crossing a fold is authored as two zones meeting at that fold, which is what
 * the two pieces really are: the border cut already butts them on the surface,
 * and the neighbour scan already measures across it.
 */
export interface IAutoMoviePatternFacet {
  /** Zone whose pieces sit on this panel. */
  zone: string;
  /** Face-local metre point this panel's frame origin sits at. */
  anchor: IAutoMoviePatternPoint;
  /** World placement of that point. */
  frame: IAutoMoviePatternFaceFrame;
}

/** Explicit instance slots and the occurrences that cannot become one. */
export interface IAutoMoviePatternInstancing {
  /** One exact full-TRS slot per whole occurrence, in placement order. */
  transforms: IAutoMovieExplicitInstanceTransform[];
  /** Occurrence ids that were cut and therefore need their own geometry. */
  cut: string[];
}

/**
 * Where one material's texture sheet is pinned on the face.
 *
 * The two answers are the two things a repeated finish can mean. A tile carries
 * its own image, so every piece shows the same one and the sheet travels with
 * the piece. A slab, a board, and a panel are cut out of one sheet, so where a
 * piece sits decides what it shows, and the sheet stays where the face put it.
 */
export type AutoMoviePatternTextureSheet =
  | {
      /** Every piece shows the same image, centred on the piece itself. */
      kind: "module";
    }
  | {
      /** One sheet runs across the whole face and pieces are cut out of it. */
      kind: "face";
      /** Face-local metre point the sheet's own origin sits at. */
      origin: IAutoMoviePatternPoint;
    };

/**
 * One occurrence's sampling of its material, in the PBR record's own UV
 * transform.
 */
export interface IAutoMoviePatternTextureTransform {
  /** The occurrence this samples for. */
  id: string;
  /** Normalized UV offset. */
  offset: {
    /** Offset along the texture's own U axis. */
    x: number;
    /** Offset along the texture's own V axis. */
    y: number;
  };
  /** Normalized UV scale; a negative `x` is the mirrored piece. */
  scale: {
    /** Scale along the texture's own U axis. */
    x: number;
    /** Scale along the texture's own V axis. */
    y: number;
  };
  /** UV rotation in degrees, within `[-180, 180]`. */
  rotationDeg: number;
}

/** UV transforms and the occurrences that transform cannot express. */
export interface IAutoMoviePatternTexturing {
  /** One transform per expressible occurrence, in placement order. */
  transforms: IAutoMoviePatternTextureTransform[];
  /** Occurrence ids whose sampling needs a shear the transform has no term for. */
  sheared: string[];
}

/**
 * Lay one pattern and measure exactly what was laid.
 *
 * The run is a fixed sequence so two runs of the same declaration produce
 * byte-identical output on every platform: zones in declaration order, lattice
 * rows outermost and columns innermost, and each cell's modules in the order
 * the author's generator returned them. Nothing samples a clock, a hash
 * iteration order, or `Math.random`; the only randomness is {@link seededValue},
 * drawn from the pattern seed and the occurrence id.
 *
 * Every module is clipped to its own zone region, then measured against every
 * exclusion. A module the region rejects entirely is not a zero-area
 * occurrence, it is absent. What survives carries the coverage it kept, why it
 * was cut, and the identity that the mesh, the instance slot, the finish, and
 * the take-off all cite, so a quantity can be traced back to the exact piece it
 * counted.
 */
export const generateAutoMovieSurfacePattern = (props: {
  pattern: IAutoMovieSurfacePattern;
}): IAutoMovieSurfacePatternResult => {
  const { pattern } = props;
  const exclusions = validatePattern(pattern);
  const placements: IAutoMoviePatternPlacement[] = [];
  const zoneQuantities: IAutoMoviePatternZoneQuantities[] = [];

  pattern.zones.forEach((zone, zoneIndex) => {
    const region = convexPolygon(
      zone.region,
      `pattern zone[${zoneIndex}] region`,
    );
    for (let other = 0; other < zoneIndex; ++other)
      if (
        polygonArea(
          clipConvex(
            region,
            convexPolygon(
              pattern.zones[other]!.region,
              `pattern zone[${other}] region`,
            ),
          ),
        ) > AREA_EPSILON
      )
        throw new Error(
          `pattern zones "${pattern.zones[other]!.id}" and "${zone.id}" overlap`,
        );
    const bounds = boundsOf(region);
    const columns = latticeRange(
      bounds.minU,
      bounds.maxU,
      zone.origin.u,
      zone.period.u,
      zone.reach.u,
    );
    const rows = latticeRange(
      bounds.minV,
      bounds.maxV,
      zone.origin.v,
      zone.period.v,
      zone.reach.v,
    );
    const cells = (columns.max - columns.min + 1) * (rows.max - rows.min + 1);
    if (cells > AUTOMOVIE_MAX_PATTERN_CELLS)
      throw new Error(
        `pattern zone "${zone.id}" spans ${cells} lattice cells, above the ${AUTOMOVIE_MAX_PATTERN_CELLS} cell limit`,
      );
    const netRegionArea =
      polygonArea(region) -
      exclusions.reduce(
        (sum, exclusion) => sum + polygonArea(clipConvex(region, exclusion)),
        0,
      );
    const seen = new Set<string>();
    const start = placements.length;
    for (let row = rows.min; row <= rows.max; ++row)
      for (let column = columns.min; column <= columns.max; ++column) {
        const origin = {
          u: zone.origin.u + column * zone.period.u,
          v: zone.origin.v + row * zone.period.v,
        };
        for (const candidate of zone.generate({
          column,
          row,
          origin,
          period: { u: zone.period.u, v: zone.period.v },
        })) {
          const outline = clipConvex(
            validateCandidate(zone, candidate, origin, seen),
            region,
          );
          const clipped = polygonArea(outline);
          if (clipped <= AREA_EPSILON) continue;
          const removed = exclusions.reduce(
            (sum, exclusion) =>
              sum + polygonArea(clipConvex(outline, exclusion)),
            0,
          );
          const area = clipped - removed;
          if (area <= AREA_EPSILON) continue;
          const moduleArea = candidate.size.u * candidate.size.v;
          const id = `${zone.id}/${candidate.id}`;
          const boundaryCut = clipped < moduleArea - AREA_EPSILON;
          const punched = removed > AREA_EPSILON;
          placements.push({
            id,
            zone: zone.id,
            module: candidate.id,
            material: zone.material,
            center: { u: candidate.center.u, v: candidate.center.v },
            size: { u: candidate.size.u, v: candidate.size.v },
            rotationDeg: candidate.rotationDeg,
            grainDeg: candidate.grainDeg,
            mirror: candidate.mirror,
            area,
            coverage: area / moduleArea,
            cut:
              boundaryCut && punched
                ? "both"
                : boundaryCut
                  ? "boundary"
                  : punched
                    ? "exclusion"
                    : "none",
            variant: variantOf(pattern, id),
            outline,
            punchedArea: punched ? removed : 0,
          });
        }
      }
    zoneQuantities.push(
      summarize(zone.id, placements.slice(start), netRegionArea),
    );
  });

  return {
    id: pattern.id,
    placements,
    quantities: totalQuantities(pattern, placements, zoneQuantities),
    findings: findingsOf(pattern, placements),
  };
};

/**
 * Turn whole occurrences into exact instance slots and name the ones that
 * cannot be.
 *
 * A repeated module is a GPU instance, never duplicated vertex data, so the
 * whole modules leave here as explicit full-TRS slots: the occurrence id
 * becomes the slot id, the in-plane rotation becomes a real unit quaternion
 * rather than a yaw, and the module's two face dimensions plus its thickness
 * become a per-axis scale rather than a uniform one. A prototype table, when
 * given, is indexed by the occurrence's own seeded variant, so the variation
 * the run drew is the variation the instancer draws.
 *
 * A cut piece is not an instance and is not pretended to be one. Scaling a
 * whole module down to a cut piece's bounding box would render a tile that is
 * the wrong shape and the wrong size, so cut occurrences are returned by id for
 * the caller to build as geometry.
 *
 * The prototype's local `+X` maps to the module's U extent, local `+Y` to its V
 * extent, and local `+Z` to the face normal, which is `u × v`.
 *
 * A host that folds at a corner or curves is one developed face standing on
 * several flat panels, so a zone may name its own {@link IAutoMoviePatternFacet}
 * and every zone that does not stays on {@link frame}.
 */
export const autoMoviePatternInstanceTransforms = (props: {
  result: IAutoMovieSurfacePatternResult;
  frame: IAutoMoviePatternFaceFrame;
  /** Panels the folded or curved zones return onto; the rest use `frame`. */
  facets?: readonly IAutoMoviePatternFacet[];
  /** Module thickness along the face normal in metres, strictly above zero. */
  thickness: number;
  /** Prototype ids indexed by variant; omitted leaves the set default. */
  prototypes?: readonly string[];
}): IAutoMoviePatternInstancing => {
  positive(props.thickness, "pattern module thickness");
  const flat = resolveFacet({ u: 0, v: 0 }, props.frame, "pattern face frame");
  const panels = resolveFacets(props.result, props.facets ?? []);
  const transforms: IAutoMovieExplicitInstanceTransform[] = [];
  const cut: string[] = [];
  for (const placement of props.result.placements) {
    if (placement.cut !== "none") {
      cut.push(placement.id);
      continue;
    }
    const panel = panels.get(placement.zone) ?? flat;
    const { u, v, normal } = panel;
    const angle = placement.rotationDeg * Quaternion.DEG2RAD;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const axisU = Vector3.add(Vector3.scale(u, cosine), Vector3.scale(v, sine));
    const axisV = Vector3.cross(normal, axisU);
    const translation = Vector3.add(
      panel.origin,
      Vector3.add(
        Vector3.scale(u, placement.center.u - panel.anchor.u),
        Vector3.scale(v, placement.center.v - panel.anchor.v),
      ),
    );
    const rotation = Quaternion.normalize(
      Matrix4.decompose([
        axisU.x,
        axisU.y,
        axisU.z,
        0,
        axisV.x,
        axisV.y,
        axisV.z,
        0,
        normal.x,
        normal.y,
        normal.z,
        0,
        translation.x,
        translation.y,
        translation.z,
        1,
      ]).rotation,
    );
    const slot: IAutoMovieExplicitInstanceTransform = {
      id: placement.id,
      translation,
      rotation,
      scale: {
        x: placement.size.u,
        y: placement.size.v,
        z: props.thickness,
      },
    };
    if (props.prototypes !== undefined) {
      const prototype = props.prototypes[placement.variant];
      if (prototype === undefined)
        throw new Error(
          `pattern occurrence "${placement.id}" draws variant ${placement.variant}, which the ${props.prototypes.length} declared prototypes do not cover`,
        );
      slot.prototype = prototype;
    }
    transforms.push(slot);
  }
  return { transforms, cut };
};

/**
 * Say how each laid piece samples its material, in the UV transform the PBR
 * record already carries.
 *
 * A pattern is not a texture repeat, but what a laid piece finally shows is
 * still a texture, and the way to show it is the one the material record
 * already has: an `offset`, a `scale`, and a `rotationDeg` on its texture
 * reference. Nothing new is invented here and no second texturing path is
 * opened; what this adds is the arithmetic that turns a piece's own place,
 * size, rotation, grain, and flip into that transform, so a book-matched pair
 * is a real mirrored image rather than two slabs a viewer cannot tell apart.
 *
 * The mesh UV this is applied to is a point's place inside the module rectangle
 * the occurrence was generated at, normalized. A whole piece therefore spans
 * `[0, 1]` on both axes, which is what a unit-square prototype gives, and a cut
 * piece spans the sub-rectangle the cut left it rather than being renormalized
 * over its own outline, because a renormalized cut piece would show the whole
 * image squeezed into the surviving sliver. The sheet is turned by the piece's
 * own {@link IAutoMoviePatternPlacement.grainDeg}, so a board whose grain runs
 * along it samples straight while a slab set across the grain samples across
 * it.
 *
 * One call states one material's sheet. A run whose zones carry different
 * materials calls it once per material and keeps the occurrences belonging to
 * that material's zones, exactly as the prototype table is stated per call.
 *
 * The renderer's texture matrix scales and then rotates, so a piece samples
 * exactly when its own two axes stay perpendicular under the map, which they do
 * when the piece is square or when it is laid square to its grain. A long piece
 * turned off its grain by anything else needs a shear the transform has no term
 * for, and is reported by id rather than handed back as a transform that
 * quietly skews the image.
 */
export const autoMoviePatternTextureTransforms = (props: {
  result: IAutoMovieSurfacePatternResult;
  /** Metres one turn of the texture covers along its own two axes. */
  tile: {
    /** Metres one turn covers along the sheet's own U axis. */
    u: number;
    /** Metres one turn covers along the sheet's own V axis. */
    v: number;
  };
  /** Where the sheet is pinned. */
  sheet: AutoMoviePatternTextureSheet;
}): IAutoMoviePatternTexturing => {
  positive(props.tile.u, "pattern texture tile u");
  positive(props.tile.v, "pattern texture tile v");
  const sheet = props.sheet;
  if (sheet.kind === "face")
    finitePoint(sheet.origin, "pattern texture sheet origin");
  const transforms: IAutoMoviePatternTextureTransform[] = [];
  const sheared: string[] = [];
  for (const placement of props.result.placements) {
    const grain = placement.grainDeg * Quaternion.DEG2RAD;
    const turn = placement.rotationDeg * Quaternion.DEG2RAD - grain;
    const cosine = Math.cos(turn);
    const sine = Math.sin(turn);
    const width = placement.mirror ? -placement.size.u : placement.size.u;
    const height = placement.size.v;
    // The two rows of `diag(1/tile) · R(turn) · diag(width, height)`: the map
    // from the piece's own unit UV onto the sheet's.
    const first = {
      x: (cosine * width) / props.tile.u,
      y: (-sine * height) / props.tile.u,
    };
    const second = {
      x: (sine * width) / props.tile.v,
      y: (cosine * height) / props.tile.v,
    };
    const across = Math.hypot(first.x, first.y);
    const down = Math.hypot(second.x, second.y);
    if (
      Math.abs(first.x * second.x + first.y * second.y) >
      SHEAR_EPSILON * across * down
    ) {
      sheared.push(placement.id);
      continue;
    }
    // Scaling and then rotating carries the second row to `ry · (sin, cos)`, so
    // the angle is read off that row and `ry` is its length. That leaves the
    // first row as `rx · (cos, -sin)`, whose signed length along the same
    // direction is the pair's determinant over `ry`, which is where a flipped
    // piece shows up as a negative scale.
    const angle = Math.atan2(second.x, second.y);
    const base =
      sheet.kind === "module"
        ? { x: 0.5, y: 0.5 }
        : sheetPoint(placement.center, sheet.origin, grain, props.tile);
    transforms.push({
      id: placement.id,
      offset: {
        x: base.x - (first.x + first.y) / 2,
        y: base.y - (second.x + second.y) / 2,
      },
      scale: {
        x: (first.x * second.y - first.y * second.x) / down,
        y: down,
      },
      rotationDeg: -angle / Quaternion.DEG2RAD,
    });
  }
  return { transforms, sheared };
};

/** Where a face point falls on a sheet turned by the grain, in turns. */
const sheetPoint = (
  point: IAutoMoviePatternPoint,
  origin: IAutoMoviePatternPoint,
  grain: number,
  tile: { u: number; v: number },
): { x: number; y: number } => {
  const cosine = Math.cos(grain);
  const sine = Math.sin(grain);
  const alongU = point.u - origin.u;
  const alongV = point.v - origin.v;
  return {
    x: (cosine * alongU + sine * alongV) / tile.u,
    y: (-sine * alongU + cosine * alongV) / tile.v,
  };
};

/** The panel each zone returns onto, refusing a facet nothing was laid in. */
const resolveFacets = (
  result: IAutoMovieSurfacePatternResult,
  facets: readonly IAutoMoviePatternFacet[],
): Map<string, IAutoMovieResolvedFacet> => {
  const zones = new Set(result.quantities.zones.map((one) => one.zone));
  const panels = new Map<string, IAutoMovieResolvedFacet>();
  for (const facet of facets) {
    if (!zones.has(facet.zone))
      throw new Error(
        `pattern facet names zone "${facet.zone}", which pattern "${result.id}" did not lay`,
      );
    if (panels.has(facet.zone))
      throw new Error(`pattern facet zone "${facet.zone}" must be unique`);
    panels.set(
      facet.zone,
      resolveFacet(
        facet.anchor,
        facet.frame,
        `pattern facet "${facet.zone}" frame`,
      ),
    );
  }
  return panels;
};

/** One panel's orthonormal world basis and the developed point it stands at. */
interface IAutoMovieResolvedFacet {
  /** Face-local metre point {@link origin} sits at. */
  anchor: IAutoMoviePatternPoint;
  /** World point the panel is measured from. */
  origin: IAutoMovieVector3;
  /** Unit world direction of the panel's U axis. */
  u: IAutoMovieVector3;
  /** Unit world direction of the panel's V axis. */
  v: IAutoMovieVector3;
  /** Unit world face normal, `u × v`. */
  normal: IAutoMovieVector3;
}

const resolveFacet = (
  anchor: IAutoMoviePatternPoint,
  frame: IAutoMoviePatternFaceFrame,
  label: string,
): IAutoMovieResolvedFacet => {
  const u = unitAxis(frame.u, `${label} u`);
  const v = unitAxis(frame.v, `${label} v`);
  finiteVector(frame.origin, `${label} origin`);
  finitePoint(anchor, `${label} anchor`);
  if (Math.abs(Vector3.dot(u, v)) > 1e-6)
    throw new Error(`${label} axes must be perpendicular`);
  return { anchor, origin: frame.origin, u, v, normal: Vector3.cross(u, v) };
};

const validatePattern = (
  pattern: IAutoMovieSurfacePattern,
): IAutoMoviePatternPoint[][] => {
  nonBlank(pattern.id, "pattern id");
  if (pattern.zones.length === 0)
    throw new Error("a surface pattern needs at least one zone");
  atLeast(pattern.joint, 0, "pattern joint");
  atLeast(pattern.jointTolerance, 0, "pattern joint tolerance");
  atLeast(pattern.adjacency, 0, "pattern adjacency");
  if (
    !Number.isFinite(pattern.minimumPiece) ||
    pattern.minimumPiece <= 0 ||
    pattern.minimumPiece > 1
  )
    throw new Error("pattern minimum piece must be a finite number in (0, 1]");
  if (pattern.grainToleranceDeg !== null)
    atLeast(pattern.grainToleranceDeg, 0, "pattern grain tolerance");
  if (!Number.isSafeInteger(pattern.seed) || pattern.seed < 0)
    throw new Error("pattern seed must be a safe integer >= 0");
  if (!Number.isSafeInteger(pattern.variants) || pattern.variants < 1)
    throw new Error("pattern variants must be a safe integer >= 1");

  const zoneIds = new Set<string>();
  pattern.zones.forEach((zone, index) => {
    nonBlank(zone.id, `pattern zone[${index}] id`);
    if (zoneIds.has(zone.id))
      throw new Error(`pattern zone id "${zone.id}" must be unique`);
    zoneIds.add(zone.id);
    finitePoint(zone.origin, `pattern zone "${zone.id}" origin`);
    positive(zone.period.u, `pattern zone "${zone.id}" period u`);
    positive(zone.period.v, `pattern zone "${zone.id}" period v`);
    positive(zone.reach.u, `pattern zone "${zone.id}" reach u`);
    positive(zone.reach.v, `pattern zone "${zone.id}" reach v`);
  });

  const exclusionIds = new Set<string>();
  const exclusions = pattern.exclusions.map((exclusion, index) => {
    nonBlank(exclusion.id, `pattern exclusion[${index}] id`);
    if (exclusionIds.has(exclusion.id))
      throw new Error(`pattern exclusion id "${exclusion.id}" must be unique`);
    exclusionIds.add(exclusion.id);
    return convexPolygon(
      exclusion.polygon,
      `pattern exclusion "${exclusion.id}" polygon`,
    );
  });
  for (let left = 0; left < exclusions.length; ++left)
    for (let right = left + 1; right < exclusions.length; ++right)
      if (
        polygonArea(clipConvex(exclusions[left]!, exclusions[right]!)) >
        AREA_EPSILON
      )
        throw new Error(
          `pattern exclusions "${pattern.exclusions[left]!.id}" and "${pattern.exclusions[right]!.id}" overlap`,
        );
  return exclusions;
};

/**
 * Judge one generated module and hand back the corners the judgment used.
 *
 * The reach check has to build the module's corners anyway, and the clipper
 * needs exactly those corners next, so they are returned rather than built a
 * second time in the innermost loop of the whole run.
 */
const validateCandidate = (
  zone: IAutoMovieSurfacePatternZone,
  candidate: IAutoMoviePatternCandidate,
  origin: IAutoMoviePatternPoint,
  seen: Set<string>,
): IAutoMoviePatternPoint[] => {
  nonBlank(candidate.id, `pattern zone "${zone.id}" module id`);
  if (seen.has(candidate.id))
    throw new Error(
      `pattern zone "${zone.id}" module id "${candidate.id}" must be unique`,
    );
  seen.add(candidate.id);
  const label = `pattern module "${zone.id}/${candidate.id}"`;
  finitePoint(candidate.center, `${label} center`);
  positive(candidate.size.u, `${label} size u`);
  positive(candidate.size.v, `${label} size v`);
  if (
    !Number.isFinite(candidate.rotationDeg) ||
    !Number.isFinite(candidate.grainDeg)
  )
    throw new Error(`${label} rotation and grain must be finite`);
  const corners = moduleCorners(candidate);
  for (const corner of corners)
    if (
      Math.abs(corner.u - origin.u) > zone.reach.u ||
      Math.abs(corner.v - origin.v) > zone.reach.v
    )
      throw new Error(
        `${label} reaches beyond the declared reach of its cell origin`,
      );
  return corners;
};

/**
 * The inclusive lattice range whose cells can still touch the region.
 *
 * A cell contributes when a module reaching {@link reach} from its origin can
 * still meet the region's own span, so the range is the region widened by the
 * reach and then divided by the pitch. Widening before dividing is what keeps a
 * module laid across a cell border from being lost at the region's edge.
 */
const latticeRange = (
  min: number,
  max: number,
  origin: number,
  period: number,
  reach: number,
): { min: number; max: number } => ({
  min: Math.floor((min - reach - origin) / period),
  max: Math.ceil((max + reach - origin) / period),
});

const moduleCorners = (
  candidate: IAutoMoviePatternCandidate,
): IAutoMoviePatternPoint[] => {
  const angle = candidate.rotationDeg * Quaternion.DEG2RAD;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const halfU = candidate.size.u / 2;
  const halfV = candidate.size.v / 2;
  return [
    { u: -halfU, v: -halfV },
    { u: halfU, v: -halfV },
    { u: halfU, v: halfV },
    { u: -halfU, v: halfV },
  ].map((corner) => ({
    u: candidate.center.u + corner.u * cosine - corner.v * sine,
    v: candidate.center.v + corner.u * sine + corner.v * cosine,
  }));
};

const variantOf = (pattern: IAutoMovieSurfacePattern, id: string): number =>
  Math.min(
    pattern.variants - 1,
    Math.floor(
      seededValue(pattern.seed, hashOf(id), VARIANT_DOMAIN) * pattern.variants,
    ),
  );

/** Fold an occurrence id into a 32-bit integer with FNV-1a. */
const hashOf = (id: string): number => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < id.length; ++index) {
    hash = (hash ^ id.charCodeAt(index)) >>> 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
};

const summarize = (
  zone: string,
  placements: readonly IAutoMoviePatternPlacement[],
  netRegionArea: number,
): IAutoMoviePatternZoneQuantities => {
  const coveredArea = placements.reduce((sum, one) => sum + one.area, 0);
  const consumedArea = placements.reduce(
    (sum, one) => sum + one.size.u * one.size.v,
    0,
  );
  return {
    zone,
    modules: placements.length,
    whole: placements.filter((one) => one.cut === "none").length,
    cut: placements.filter((one) => one.cut !== "none").length,
    coveredArea,
    consumedArea,
    wasteArea: consumedArea - coveredArea,
    netRegionArea,
  };
};

const totalQuantities = (
  pattern: IAutoMovieSurfacePattern,
  placements: readonly IAutoMoviePatternPlacement[],
  zones: readonly IAutoMoviePatternZoneQuantities[],
): IAutoMoviePatternQuantities => {
  const coveredArea = zones.reduce((sum, one) => sum + one.coveredArea, 0);
  const consumedArea = zones.reduce((sum, one) => sum + one.consumedArea, 0);
  const netRegionArea = zones.reduce((sum, one) => sum + one.netRegionArea, 0);
  const wasteArea = consumedArea - coveredArea;
  const jointArea = netRegionArea - coveredArea;
  return {
    modules: placements.length,
    whole: zones.reduce((sum, one) => sum + one.whole, 0),
    cut: zones.reduce((sum, one) => sum + one.cut, 0),
    coveredArea,
    consumedArea,
    wasteArea,
    wasteRatio: consumedArea === 0 ? 0 : wasteArea / consumedArea,
    netRegionArea,
    jointArea,
    jointLength: pattern.joint === 0 ? 0 : jointArea / pattern.joint,
    zones: [...zones],
  };
};

/**
 * Measure every occurrence and every neighbouring pair against the declaration.
 *
 * Per-occurrence findings come first so a defect that belongs to one piece is
 * never buried under the pair findings its neighbours produced. The partner
 * list is then sorted, so a bucket map's insertion order can never reach the
 * output.
 *
 * Pairs are gathered through a uniform bucket grid rather than an all-pairs
 * sweep, and the grid is sized so the screen provably loses nothing. A piece
 * lies inside its own module rectangle, so it is never further than half that
 * rectangle's diagonal from the centre the grid buckets by. Two pieces whose
 * true separation is within the adjacency gap therefore have centres no further
 * apart than the largest module diagonal plus that gap, which is exactly the
 * cell size, so they always share a bucket or an adjacent one.
 *
 * What is then reported is the edge-normal joint, which is how a joint is read
 * and which never exceeds the true separation. A pair whose projections read
 * close while the pieces themselves sit diagonally further apart than the
 * adjacency gap is not scanned, and should not be: those two are not neighbours
 * on the surface.
 *
 * Neighbours are measured between the pieces as laid, not between the modules
 * as designed. Two zones that each cut their modules at the border they share
 * would otherwise be judged on rectangles that overlap across it and reported
 * as colliding when nothing on the surface does.
 */
const findingsOf = (
  pattern: IAutoMovieSurfacePattern,
  placements: readonly IAutoMoviePatternPlacement[],
): IAutoMoviePatternFinding[] => {
  const findings: IAutoMoviePatternFinding[] = [];
  for (const placement of placements) {
    if (placement.coverage < pattern.minimumPiece - COVERAGE_EPSILON)
      findings.push({
        kind: "sliver",
        occurrences: [placement.id],
        measured: placement.coverage,
        limit: pattern.minimumPiece,
        detail: `occurrence "${placement.id}" survives at ${placement.coverage} of a module, below the ${pattern.minimumPiece} minimum piece`,
      });
    if (placement.punchedArea > 0)
      findings.push({
        kind: "unsupported-piece",
        occurrences: [placement.id],
        measured: placement.punchedArea,
        limit: 0,
        detail: `occurrence "${placement.id}" is cut by an exclusion, so its true piece is the outline minus that area; the convex procedural kernel has no boolean difference and cannot build it`,
      });
  }
  if (placements.length === 0) return findings;

  const cellSize =
    placements.reduce(
      (largest, one) =>
        Math.max(
          largest,
          Math.sqrt(one.size.u * one.size.u + one.size.v * one.size.v),
        ),
      0,
    ) + pattern.adjacency;
  const buckets = new Map<string, number[]>();
  placements.forEach((placement, index) => {
    const key = bucketKey(placement, cellSize, 0, 0);
    const bucket = buckets.get(key);
    if (bucket === undefined) buckets.set(key, [index]);
    else bucket.push(index);
  });
  placements.forEach((placement, index) => {
    const partners = new Set<number>();
    for (let du = -1; du <= 1; ++du)
      for (let dv = -1; dv <= 1; ++dv)
        for (const candidate of buckets.get(
          bucketKey(placement, cellSize, du, dv),
        ) ?? [])
          if (candidate > index) partners.add(candidate);
    for (const partner of [...partners].sort((left, right) => left - right)) {
      const other = placements[partner]!;
      const gap = separation(placement.outline, other.outline);
      if (gap < -LENGTH_EPSILON) {
        findings.push({
          kind: "module-overlap",
          occurrences: [placement.id, other.id],
          measured: gap,
          limit: 0,
          detail: `occurrences "${placement.id}" and "${other.id}" overlap by ${-gap} m instead of leaving a joint`,
        });
        continue;
      }
      if (gap > pattern.adjacency + LENGTH_EPSILON) continue;
      if (
        Math.abs(gap - pattern.joint) >
        pattern.jointTolerance + LENGTH_EPSILON
      )
        findings.push({
          kind: "joint-deviation",
          occurrences: [placement.id, other.id],
          measured: gap,
          limit: pattern.joint,
          detail: `occurrences "${placement.id}" and "${other.id}" are ${gap} m apart, off the ${pattern.joint} m joint by more than the ${pattern.jointTolerance} m tolerance`,
        });
      if (pattern.grainToleranceDeg === null) continue;
      const deviation = grainDeviation(placement.grainDeg, other.grainDeg);
      if (deviation > pattern.grainToleranceDeg + LENGTH_EPSILON)
        findings.push({
          kind: "grain-break",
          occurrences: [placement.id, other.id],
          measured: deviation,
          limit: pattern.grainToleranceDeg,
          detail: `neighbouring occurrences "${placement.id}" and "${other.id}" run their grain ${deviation}° apart, above the ${pattern.grainToleranceDeg}° tolerance`,
        });
    }
  });
  return findings;
};

const bucketKey = (
  placement: IAutoMoviePatternPlacement,
  cellSize: number,
  du: number,
  dv: number,
): string =>
  `${Math.floor(placement.center.u / cellSize) + du},${Math.floor(placement.center.v / cellSize) + dv}`;

/** Smallest in-plane angle between two 180-periodic grain directions. */
const grainDeviation = (left: number, right: number): number => {
  const delta = positiveModulo(left - right, 180);
  return Math.min(delta, 180 - delta);
};

/**
 * The gap between two convex pieces, measured along their own edge normals.
 *
 * A joint is read perpendicular to the edges it separates, which is exactly the
 * separating-axis measurement: the largest projection gap over both pieces'
 * edge normals. A negative result is a real overlap, because no axis separated
 * them.
 */
const separation = (
  left: readonly IAutoMoviePatternPoint[],
  right: readonly IAutoMoviePatternPoint[],
): number => {
  let best = Number.NEGATIVE_INFINITY;
  for (const polygon of [left, right])
    for (let index = 0; index < polygon.length; ++index) {
      const from = polygon[index]!;
      const to = polygon[(index + 1) % polygon.length]!;
      const axis = { u: -(to.v - from.v), v: to.u - from.u };
      const length = Math.sqrt(axis.u * axis.u + axis.v * axis.v);
      const normal = { u: axis.u / length, v: axis.v / length };
      const a = project(left, normal);
      const b = project(right, normal);
      best = Math.max(best, Math.max(b.min - a.max, a.min - b.max));
    }
  return best;
};

const project = (
  polygon: readonly IAutoMoviePatternPoint[],
  axis: IAutoMoviePatternPoint,
): { min: number; max: number } => {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const point of polygon) {
    const value = point.u * axis.u + point.v * axis.v;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  return { min, max };
};

/**
 * Canonicalize an authored polygon to a counter-clockwise convex outline.
 *
 * The hull is taken and then compared with the input, so a reflex corner, an
 * interior point, a repeated point, and a point sitting on an edge are all
 * refused instead of being silently absorbed. That is the same refusal the
 * procedural profile kernel makes, for the same reason: a clipper fed a
 * non-convex outline reports areas the surface does not have.
 */
const convexPolygon = (
  polygon: readonly IAutoMoviePatternPoint[],
  label: string,
): IAutoMoviePatternPoint[] => {
  polygon.forEach((point, index) => finitePoint(point, `${label}[${index}]`));
  const hull = convexHull2D(
    polygon.map((point) => ({ x: point.u, y: 0, z: point.v })),
  ).map((point) => ({ u: point.x, v: point.z }));
  if (hull.length < 3)
    throw new Error(`${label} needs at least three non-collinear points`);
  if (hull.length !== polygon.length)
    throw new Error(`${label} must be convex and contain no interior points`);
  return hull;
};

/**
 * Clip one convex polygon by another with the Sutherland–Hodgman half-planes.
 *
 * A crossing is only cut where the corner it crosses to actually leaves the
 * line. A corner sitting exactly on a clip edge already _is_ the intersection,
 * so emitting one for it would put the same point in the outline twice, and a
 * repeated point makes a zero-length edge whose normal is undefined. That
 * outline still measures the right area, which is what makes the fault quiet:
 * the joint measurement between two pieces would divide by that zero, and every
 * comparison against the resulting `NaN` reads false, so the pair passes the
 * joint and overlap tests by never being judged at all.
 */
const clipConvex = (
  subject: readonly IAutoMoviePatternPoint[],
  clipper: readonly IAutoMoviePatternPoint[],
): IAutoMoviePatternPoint[] => {
  let output: IAutoMoviePatternPoint[] = [...subject];
  for (let index = 0; index < clipper.length && output.length > 0; ++index) {
    const from = clipper[index]!;
    const to = clipper[(index + 1) % clipper.length]!;
    const input = output;
    output = [];
    for (let corner = 0; corner < input.length; ++corner) {
      const current = input[corner]!;
      const previous = input[(corner + input.length - 1) % input.length]!;
      const currentSide = side(from, to, current);
      const previousSide = side(from, to, previous);
      if (currentSide >= 0) {
        if (previousSide < 0 && currentSide > 0)
          output.push(intersect(previous, current, from, to));
        output.push(current);
      } else if (previousSide > 0)
        output.push(intersect(previous, current, from, to));
    }
  }
  return output;
};

const side = (
  from: IAutoMoviePatternPoint,
  to: IAutoMoviePatternPoint,
  point: IAutoMoviePatternPoint,
): number =>
  (to.u - from.u) * (point.v - from.v) - (to.v - from.v) * (point.u - from.u);

const intersect = (
  from: IAutoMoviePatternPoint,
  to: IAutoMoviePatternPoint,
  edgeFrom: IAutoMoviePatternPoint,
  edgeTo: IAutoMoviePatternPoint,
): IAutoMoviePatternPoint => {
  const a = side(edgeFrom, edgeTo, from);
  const b = side(edgeFrom, edgeTo, to);
  const ratio = a / (a - b);
  return {
    u: from.u + (to.u - from.u) * ratio,
    v: from.v + (to.v - from.v) * ratio,
  };
};

const polygonArea = (polygon: readonly IAutoMoviePatternPoint[]): number => {
  let twice = 0;
  for (let index = 0; index < polygon.length; ++index) {
    const from = polygon[index]!;
    const to = polygon[(index + 1) % polygon.length]!;
    twice += from.u * to.v - to.u * from.v;
  }
  return Math.abs(twice) / 2;
};

const boundsOf = (
  polygon: readonly IAutoMoviePatternPoint[],
): { minU: number; maxU: number; minV: number; maxV: number } => ({
  minU: Math.min(...polygon.map((point) => point.u)),
  maxU: Math.max(...polygon.map((point) => point.u)),
  minV: Math.min(...polygon.map((point) => point.v)),
  maxV: Math.max(...polygon.map((point) => point.v)),
});

const unitAxis = (
  axis: IAutoMovieVector3,
  label: string,
): IAutoMovieVector3 => {
  finiteVector(axis, label);
  if (Math.abs(Vector3.length(axis) - 1) > 1e-6)
    throw new Error(`${label} must be a unit vector`);
  return axis;
};

const finiteVector = (value: IAutoMovieVector3, label: string): void => {
  if (![value.x, value.y, value.z].every(Number.isFinite))
    throw new Error(`${label} must be finite`);
};

const finitePoint = (point: IAutoMoviePatternPoint, label: string): void => {
  if (!Number.isFinite(point.u) || !Number.isFinite(point.v))
    throw new Error(`${label} must be finite`);
};

const nonBlank = (value: string, label: string): void => {
  if (value.trim().length === 0) throw new Error(`${label} must be non-empty`);
};

const positive = (value: number, label: string): void => {
  if (!Number.isFinite(value) || value <= 0)
    throw new Error(`${label} must be a finite number > 0`);
};

const atLeast = (value: number, limit: number, label: string): void => {
  if (!Number.isFinite(value) || value < limit)
    throw new Error(`${label} must be a finite number >= ${limit}`);
};
