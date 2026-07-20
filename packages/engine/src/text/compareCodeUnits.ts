/**
 * A locale-independent total order over strings by UTF-16 code unit.
 *
 * `String.prototype.localeCompare()` is ICU-collation based: its result depends
 * on the host's default locale AND on the ICU data compiled into the runtime
 * (full-icu vs small-icu), and it returns `0` for distinct-but-Unicode-
 * equivalent strings. Neither is acceptable where an order feeds the render
 * event stream, tool-visible arrays, or persisted slate reads: the same inputs
 * must always yield the same order (and therefore the same frames) on every
 * host. This comparator is a pure function of the code units, so it is
 * reproducible everywhere and returns `0` only for genuinely equal strings.
 *
 * @author Samchon
 */
export const compareCodeUnits = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;
