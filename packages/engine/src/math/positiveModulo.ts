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
  const normalized = remainder + period * Number(remainder < 0);
  return normalized === period ? 0 : normalized;
};

/**
 * Add an offset on a positive cyclic domain without perturbing the phase when
 * the offset is zero or a whole period.
 *
 * Normalizing both operands before their sum prevents a neutral elapsed/start
 * offset from first enlarging an already normalized phase and then rounding it
 * differently while wrapping the combined value.
 *
 * @internal
 */
export const addPositiveModulo = (
  value: number,
  offset: number,
  period: number,
): number =>
  positiveModulo(
    positiveModulo(value, period) + positiveModulo(offset, period),
    period,
  );
