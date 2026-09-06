/**
 * A sanitized failure whose message is written by the reader, never by I/O.
 *
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-bounds Separates known refusals from sensitive external error messages.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-bounds Carries a classified code with a source-free recovery message.
 */
export class ReferenceError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Stop one reference operation with its intentional sanitized refusal.
 *
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-bounds Prevents an invalid or partial read from becoming a success result.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-bounds Raises the provider's classified refusal rather than reflecting external diagnostics.
 */
export const fail = (code: string, message: string): never => {
  throw new ReferenceError(code, message);
};

/**
 * Maximum bytes admitted from one Markdown source.
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-bounds Makes single-file resource consumption finite before parsing.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-bounds Supplies the 8 MiB source ceiling to byte and physical admission.
 */
export const MAX_SOURCE_BYTES = 8_388_608;
/**
 * Maximum aggregate source bytes observed for one layer revision.
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-bounds Bounds the work needed for stateless revision-bound pagination.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-bounds Supplies the 32 MiB aggregate source ceiling.
 */
export const MAX_LAYER_BYTES = 33_554_432;
/**
 * Maximum number of files admitted into one authored-layer inventory.
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-bounds Refuses an unbounded navigation population.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-bounds Supplies the 10,000-file ceiling to physical and provider enumeration.
 */
export const MAX_FILES = 10_000;
/**
 * Default UTF-8 byte allowance for one serialized success envelope.
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-bounds Makes ordinary navigation compact without an explicit caller budget.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-bounds Supplies the 65,536-byte default to shared request admission.
 */
export const DEFAULT_BUDGET = 65_536;
/**
 * Largest explicit serialized-result allowance accepted by either transport.
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-bounds Keeps an explicit caller budget within a finite response limit.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-bounds Caps common schema admission at 1,048,576 bytes.
 */
export const MAX_BUDGET = 1_048_576;
