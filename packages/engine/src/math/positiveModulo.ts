/**
 * Return `value mod period` in `[0, period)` without perturbing an already
 * normalized value.
 *
 * Callers validate the finite positive period appropriate to their domain.
 * Computing the remainder once matters for serialized continuity state: the
 * common double-modulo formula adds and removes a period even from an in-range
 * value, introducing a fresh floating-point rounding error.
 *
 * @internal
 */
export const positiveModulo = (value: number, period: number): number => {
  const remainder = value % period;
  return remainder + period * Number(remainder < 0);
};
