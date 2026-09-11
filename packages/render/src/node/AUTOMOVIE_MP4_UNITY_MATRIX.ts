/**
 * The ISO base media unity display matrix, in the file's own 16.16 and 2.30
 * fixed-point terms.
 *
 * A track that carries this matrix is displayed untransformed. The delivery
 * profile requires it and the splice admission checks it, and a transform that
 * differed between those two readings would let a rotated or scaled track pass
 * one gate and fail the other, so both read this.
 */
export const AUTOMOVIE_MP4_UNITY_MATRIX: readonly number[] = [
  65_536, 0, 0, 0, 65_536, 0, 0, 0, 1_073_741_824,
];
