import { Matrix4 } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

const close = (a: number[], b: number[], eps = 1e-6): boolean =>
  a.length === b.length && a.every((v, i) => nclose(v, b[i]!, eps));

/**
 * The column-major 4횞4 matrix algebra the compose pass rests on: identity, TRS
 * composition (matching `three.js` `Matrix4.compose`), and the matrix product.
 *
 * Scenarios:
 *
 * 1. `identity()` is the 16-element identity, ones on the diagonal.
 * 2. Composing translation (1,2,3) + identity rotation + scale (2,2,2) places the
 *    scale on the diagonal and the translation in the last column ??the
 *    glTF/`three.js` column-major layout.
 * 3. Composing a 90째 rotation about +Y (with unit scale) turns the basis so the
 *    matrix maps +X to ?뭒 (right-handed, Y-up): the third row of column 0 is
 *    ??.
 * 4. `multiply(identity, M) === M` ??identity is the product's unit.
 * 5. A non-trivial product `T 쨌 S` (translate ??scale) scales the basis and keeps
 *    the translation, confirming row/column indexing is consistent.
 */
export const test_resolve_matrix4 = (): void => {
  // 1. identity
  TestValidator.predicate(
    "identity matrix",
    close(Matrix4.identity(), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
  );

  // 2. compose translation + scale, identity rotation
  const ts = Matrix4.compose(
    { x: 1, y: 2, z: 3 },
    { x: 0, y: 0, z: 0, w: 1 },
    { x: 2, y: 2, z: 2 },
  );
  TestValidator.predicate(
    "compose places scale on diagonal, translation in last column",
    close(ts, [2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 1, 2, 3, 1]),
  );

  // 3. compose a 90째 rotation about +Y
  const s = Math.SQRT1_2;
  const rotY = Matrix4.compose(
    { x: 0, y: 0, z: 0 },
    { x: 0, y: s, z: 0, w: s },
    { x: 1, y: 1, z: 1 },
  );
  TestValidator.predicate(
    "compose 90째 about Y maps +X to ?뭒",
    close(rotY, [0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1]),
  );

  // 4. identity is the multiplicative unit
  TestValidator.predicate(
    "identity 쨌 M = M",
    close(Matrix4.multiply(Matrix4.identity(), ts), ts),
  );

  // 5. T 쨌 S product ??translate after scale
  const t = Matrix4.compose(
    { x: 5, y: 0, z: 0 },
    { x: 0, y: 0, z: 0, w: 1 },
    { x: 1, y: 1, z: 1 },
  );
  const scale = Matrix4.compose(
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0, w: 1 },
    { x: 3, y: 3, z: 3 },
  );
  TestValidator.predicate(
    "T 쨌 S scales the basis and keeps the translation",
    close(
      Matrix4.multiply(t, scale),
      [3, 0, 0, 0, 0, 3, 0, 0, 0, 0, 3, 0, 5, 0, 0, 1],
    ),
  );
};
