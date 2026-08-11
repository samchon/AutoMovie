/**
 * Fold one full safe-integer seed into a domain-separated 32-bit state.
 *
 * Both 32-bit words participate, so values separated by 2^32 remain distinct.
 * The function is pure and stable across effect, combat, formation, and
 * instance-set runtimes.
 *
 * @evidence requirements/product/prototype-quality.md#product-authored-variation-determinism Mixes the complete authored integer seed and a domain salt so distinct variation decisions remain reproducible.
 * @evidence specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-deterministic-input-identity Mixes the complete authored integer seed and a domain salt so distinct variation decisions remain reproducible.
 */
export const mixSeed = (seed: number, salt: number): number => {
  const integer = Math.trunc(seed);
  const low = integer >>> 0;
  const high = Math.floor(integer / 4_294_967_296) >>> 0;
  let value = (salt ^ low) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15) ^ high, 0x846ca68b);
  return (value ^ (value >>> 16)) >>> 0;
};

/**
 * Return one deterministic half-open [0, 1) sample from ordered seed parts.
 *
 * Callers must include a stable domain constant when the same identities feed
 * independent decisions such as misfire, hit, scale, or palette.
 *
 * @evidence requirements/product/prototype-quality.md#product-authored-variation-determinism Maps stable authored identities to the same bounded variation value on every replay.
 * @evidence specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-deterministic-input-identity Maps stable authored identities to the same bounded variation value on every replay.
 */
export const seededValue = (...values: number[]): number => {
  let state = 0x9e3779b9;
  for (const value of values) state = mixSeed(value, state);
  state = (state + 0x6d2b79f5) >>> 0;
  let output = state;
  output = Math.imul(output ^ (output >>> 15), output | 1);
  output ^= output + Math.imul(output ^ (output >>> 7), output | 61);
  return ((output ^ (output >>> 14)) >>> 0) / 4_294_967_296;
};
