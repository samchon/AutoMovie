import {
  autoMoviePatternTextureTransforms,
  generateAutoMovieSurfacePattern,
} from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { pattern, rectangle, zone } from "../internal/patternFixtures";
import { namedFacts, nclose, throwsError } from "../internal/predicates";

/** One slab per lattice column, flipped on the odd ones: a book match. */
const slabs = (flipOdd: boolean) =>
  zone({
    id: "slab",
    region: rectangle(0, 0, 1.2, 1),
    origin: { u: 0, v: 0 },
    period: { u: 0.6, v: 2 },
    reach: { u: 0.6, v: 1 },
    material: "stone",
    generate: ({ column, row, origin }) =>
      row !== 0
        ? []
        : [
            {
              id: `s${column}`,
              center: { u: origin.u + 0.3, v: 0.5 },
              size: { u: 0.6, v: 1 },
              rotationDeg: 0,
              grainDeg: 0,
              mirror: flipOdd && column === 1,
            },
          ],
  });

/** The sheet point a piece's own unit UV corner lands on. */
const sample = (
  transform: {
    offset: { x: number; y: number };
    scale: { x: number; y: number };
    rotationDeg: number;
  },
  u: number,
  v: number,
): { x: number; y: number } => {
  const angle = (-transform.rotationDeg * Math.PI) / 180;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return {
    x: transform.scale.x * (cosine * u - sine * v) + transform.offset.x,
    y: transform.scale.y * (sine * u + cosine * v) + transform.offset.y,
  };
};

/**
 * Laid pieces sample their material through the UV transform the PBR record
 * already carries.
 *
 * A pattern run says where every piece is and how big it is; what the piece
 * finally shows is still a texture, and the way to show it is the material's
 * own `offset` / `scale` / `rotationDeg`. This case pins that arithmetic,
 * because it is what makes a book match a real mirrored image instead of two
 * slabs a viewer cannot tell apart, and because a transform wrong here is a
 * finish wrong on every frame.
 *
 * The default field is a 2 x 1 m rectangle of eight 0.5 m squares.
 *
 * Scenarios:
 *
 * 1. A sheet pinned to the module gives every piece the same image: the identity
 *    transform, once the texture turn is the module's own size.
 * 2. A sheet pinned to the face cuts every piece out of one image, so where a
 *    piece sits decides what it shows: the first square takes a quarter by a
 *    half at the origin, the last takes the far corner, and the eight of them
 *    walk the sheet once.
 * 3. A mirrored piece reverses its own U axis: the scale goes negative and the
 *    offset moves to the far edge, so the image runs back the way it came. The
 *    unflipped twin of the same pair does not.
 * 4. The mirror is not a grain turn: a book-matched pair whose grain runs one way
 *    reports no grain break at a zero-degree tolerance.
 * 5. Grain rotates the sheet under the piece rather than the piece: a square laid
 *    square with its grain at 45 degrees samples a rotated image whose centre
 *    is still the piece's centre.
 * 6. A long piece turned off its grain by something other than a right angle needs
 *    a shear the transform has no term for and is reported by id, while a
 *    square piece at the same angle samples exactly.
 * 7. A non-positive texture turn and a non-finite sheet origin are refused.
 * 8. The same run transformed twice produces the same bytes.
 */
export const test_architecture_surface_pattern_texture = (): void => {
  const field = generateAutoMovieSurfacePattern({ pattern: pattern() });
  const perModule = autoMoviePatternTextureTransforms({
    result: field,
    tile: { u: 0.5, v: 0.5 },
    sheet: { kind: "module" },
  });

  TestValidator.equals(
    "a sheet pinned to the module shows every piece the same image",
    namedFacts([
      ["count", () => perModule.transforms.length === 8],
      ["sheared", () => perModule.sheared.length === 0],
      [
        "ids",
        () =>
          perModule.transforms.map((one) => one.id).join() ===
          field.placements.map((one) => one.id).join(),
      ],
      [
        "identity",
        () =>
          perModule.transforms.every(
            (one) =>
              nclose(one.offset.x, 0, 1e-12) &&
              nclose(one.offset.y, 0, 1e-12) &&
              nclose(one.scale.x, 1, 1e-12) &&
              nclose(one.scale.y, 1, 1e-12) &&
              nclose(one.rotationDeg, 0, 1e-12),
          ),
      ],
    ]),
    { count: true, sheared: true, ids: true, identity: true },
  );

  const perFace = autoMoviePatternTextureTransforms({
    result: field,
    tile: { u: 2, v: 1 },
    sheet: { kind: "face", origin: { u: 0, v: 0 } },
  });
  TestValidator.equals(
    "a sheet pinned to the face cuts each piece out of one image",
    namedFacts([
      [
        "scale",
        () =>
          perFace.transforms.every(
            (one) =>
              nclose(one.scale.x, 0.25, 1e-12) &&
              nclose(one.scale.y, 0.5, 1e-12) &&
              nclose(one.rotationDeg, 0, 1e-12),
          ),
      ],
      [
        "walk",
        () =>
          perFace.transforms
            .map((one) => `${one.offset.x},${one.offset.y}`)
            .join("|") ===
          "0,0|0.25,0|0.5,0|0.75,0|0,0.5|0.25,0.5|0.5,0.5|0.75,0.5",
      ],
      [
        "first",
        () => {
          const low = sample(perFace.transforms[0]!, 0, 0);
          const high = sample(perFace.transforms[0]!, 1, 1);
          return (
            nclose(low.x, 0, 1e-12) &&
            nclose(low.y, 0, 1e-12) &&
            nclose(high.x, 0.25, 1e-12) &&
            nclose(high.y, 0.5, 1e-12)
          );
        },
      ],
      [
        "last",
        () => {
          const high = sample(perFace.transforms[7]!, 1, 1);
          return nclose(high.x, 1, 1e-12) && nclose(high.y, 1, 1e-12);
        },
      ],
    ]),
    { scale: true, walk: true, first: true, last: true },
  );

  const matched = generateAutoMovieSurfacePattern({
    pattern: pattern({
      id: "book-match",
      zones: [slabs(true)],
      minimumPiece: 1,
      grainToleranceDeg: 0,
      adjacency: 0.01,
    }),
  });
  const book = autoMoviePatternTextureTransforms({
    result: matched,
    tile: { u: 0.6, v: 1 },
    sheet: { kind: "module" },
  });
  const plain = autoMoviePatternTextureTransforms({
    result: generateAutoMovieSurfacePattern({
      pattern: pattern({
        id: "unmatched",
        zones: [slabs(false)],
        minimumPiece: 1,
        grainToleranceDeg: 0,
        adjacency: 0.01,
      }),
    }),
    tile: { u: 0.6, v: 1 },
    sheet: { kind: "module" },
  });
  TestValidator.equals(
    "a book-matched slab reverses its own U axis and its twin does not",
    namedFacts([
      [
        "laid",
        () => matched.placements.map((one) => one.module).join() === "s0,s1",
      ],
      [
        "flagged",
        () =>
          matched.placements.map((one) => one.mirror).join() === "false,true",
      ],
      [
        "left",
        () =>
          nclose(book.transforms[0]!.offset.x, 0, 1e-12) &&
          nclose(book.transforms[0]!.scale.x, 1, 1e-12),
      ],
      [
        "right",
        () =>
          nclose(book.transforms[1]!.offset.x, 1, 1e-12) &&
          nclose(book.transforms[1]!.scale.x, -1, 1e-12),
      ],
      [
        "reversed",
        () => {
          const near = sample(book.transforms[1]!, 0, 0.5);
          const far = sample(book.transforms[1]!, 1, 0.5);
          return nclose(near.x, 1, 1e-12) && nclose(far.x, 0, 1e-12);
        },
      ],
      [
        "unchangedV",
        () =>
          book.transforms.every(
            (one) =>
              nclose(one.offset.y, 0, 1e-12) &&
              nclose(one.scale.y, 1, 1e-12) &&
              nclose(one.rotationDeg, 0, 1e-12),
          ),
      ],
      [
        "twin",
        () =>
          plain.transforms.every(
            (one) =>
              nclose(one.offset.x, 0, 1e-12) && nclose(one.scale.x, 1, 1e-12),
          ),
      ],
    ]),
    {
      laid: true,
      flagged: true,
      left: true,
      right: true,
      reversed: true,
      unchangedV: true,
      twin: true,
    },
  );
  TestValidator.equals(
    "a mirror is not a grain turn, so the matched pair reports nothing",
    matched.findings.length,
    0,
  );

  const diagonal = autoMoviePatternTextureTransforms({
    result: generateAutoMovieSurfacePattern({
      pattern: pattern({
        id: "diagonal-grain",
        zones: [
          zone({
            generate: ({ column, row, origin }) => [
              {
                id: `t-${column}-${row}`,
                center: { u: origin.u + 0.25, v: origin.v + 0.25 },
                size: { u: 0.5, v: 0.5 },
                rotationDeg: 0,
                grainDeg: 45,
                mirror: false,
              },
            ],
          }),
        ],
      }),
    }),
    tile: { u: 0.5, v: 0.5 },
    sheet: { kind: "module" },
  });
  TestValidator.equals(
    "grain rotates the sheet under the piece, not the piece",
    namedFacts([
      [
        "straight",
        () => nclose(perModule.transforms[0]!.rotationDeg, 0, 1e-12),
      ],
      ["rotated", () => nclose(diagonal.transforms[0]!.rotationDeg, 45, 1e-12)],
      ["sheared", () => diagonal.sheared.length === 0],
      [
        "scale",
        () =>
          diagonal.transforms.every(
            (one) =>
              nclose(one.scale.x, 1, 1e-12) && nclose(one.scale.y, 1, 1e-12),
          ),
      ],
      [
        "centred",
        () =>
          diagonal.transforms.every((one) => {
            const middle = sample(one, 0.5, 0.5);
            return nclose(middle.x, 0.5, 1e-12) && nclose(middle.y, 0.5, 1e-12);
          }),
      ],
    ]),
    {
      straight: true,
      rotated: true,
      sheared: true,
      scale: true,
      centred: true,
    },
  );

  const skewed = (size: { u: number; v: number }) =>
    autoMoviePatternTextureTransforms({
      result: generateAutoMovieSurfacePattern({
        pattern: pattern({
          id: "skewed",
          zones: [
            zone({
              region: rectangle(0, 0, 1, 1),
              period: { u: 1, v: 1 },
              reach: { u: 1, v: 1 },
              generate: ({ column, row, origin }) => [
                {
                  id: `t-${column}-${row}`,
                  center: { u: origin.u + 0.5, v: origin.v + 0.5 },
                  size,
                  rotationDeg: 45,
                  grainDeg: 0,
                  mirror: false,
                },
              ],
            }),
          ],
          minimumPiece: 0.01,
        }),
      }),
      tile: { u: 0.6, v: 0.15 },
      sheet: { kind: "module" },
    });
  const plank = skewed({ u: 0.6, v: 0.15 });
  const square = skewed({ u: 0.3, v: 0.3 });
  TestValidator.equals(
    "a long piece turned off its grain needs a shear, a square one does not",
    namedFacts([
      ["shearedIds", () => plank.sheared.join() === "field/t-0-0"],
      ["shearedEmpty", () => plank.transforms.length === 0],
      ["squareSheared", () => square.sheared.length === 0],
      ["squareCount", () => square.transforms.length === 1],
      [
        "squareRotation",
        () => nclose(square.transforms[0]!.rotationDeg, -45, 1e-12),
      ],
      [
        "squareScale",
        () =>
          nclose(square.transforms[0]!.scale.x, 0.5, 1e-12) &&
          nclose(square.transforms[0]!.scale.y, 2, 1e-12),
      ],
    ]),
    {
      shearedIds: true,
      shearedEmpty: true,
      squareSheared: true,
      squareCount: true,
      squareRotation: true,
      squareScale: true,
    },
  );

  TestValidator.equals(
    "a non-positive texture turn and a non-finite sheet origin are refused",
    namedFacts([
      [
        "tileU",
        () =>
          throwsError(
            () =>
              autoMoviePatternTextureTransforms({
                result: field,
                tile: { u: 0, v: 0.5 },
                sheet: { kind: "module" },
              }),
            "pattern texture tile u must be a finite number > 0",
          ),
      ],
      [
        "tileV",
        () =>
          throwsError(
            () =>
              autoMoviePatternTextureTransforms({
                result: field,
                tile: { u: 0.5, v: Number.NaN },
                sheet: { kind: "module" },
              }),
            "pattern texture tile v must be a finite number > 0",
          ),
      ],
      [
        "origin",
        () =>
          throwsError(
            () =>
              autoMoviePatternTextureTransforms({
                result: field,
                tile: { u: 0.5, v: 0.5 },
                sheet: {
                  kind: "face",
                  origin: { u: 0, v: Number.POSITIVE_INFINITY },
                },
              }),
            "pattern texture sheet origin must be finite",
          ),
      ],
    ]),
    { tileU: true, tileV: true, origin: true },
  );

  TestValidator.equals(
    "the same run transformed twice produces the same bytes",
    JSON.stringify(
      autoMoviePatternTextureTransforms({
        result: field,
        tile: { u: 2, v: 1 },
        sheet: { kind: "face", origin: { u: 0, v: 0 } },
      }),
    ),
    JSON.stringify(perFace),
  );
};
