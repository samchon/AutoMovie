/**
 * `value` with the indefinite article that belongs in front of it.
 *
 * A diagnostic written as `` `a ${subject}` `` reads as `a opening` the moment
 * the union it interpolates carries a vowel-initial member, and the unions this
 * package names in its diagnostics keep growing: light types, action verbs,
 * analysis domains, schedule subjects. Deriving the article from the value
 * rather than typing it beside the value is what makes that growth safe — the
 * article cannot drift from the word it introduces, because there is only one
 * place it comes from.
 *
 * The choice is made from spelling, which is exactly right for the values this
 * package interpolates and wrong for English at large. Every one of them is a
 * lowercase ASCII name of this project's own coining, so the letter is the
 * sound. The three classes that read against the rule — a `u` that says "you"
 * (`a unit`), a silent `h` (`an hour`), and an `o` that says "wun" (`a one-way
 * route`) — cannot arrive from those unions, and a value that could belongs in
 * a sentence written for it rather than in this helper.
 *
 * A number is not accepted. `an 8-byte chunk` is correct English and the rule
 * that produces it is a different one, read off the spoken numeral rather than
 * the leading character; the diagnostics that would need it say `a chunk of
 * ${n} bytes` instead, which needs no article agreement at all.
 *
 * @internal
 */
export const withArticle = (value: string): string =>
  `${VOWEL_LETTERS.has((value[0] ?? "").toLowerCase()) ? "an" : "a"} ${value}`;

/**
 * The letters that take `an` in front of a name of this project's coining.
 */
const VOWEL_LETTERS = new Set(["a", "e", "i", "o", "u"]);
