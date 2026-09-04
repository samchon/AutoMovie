import { AutoMovieUtf8Error, decodeAutoMovieUtf8 } from "./strictUtf8";

/** Explicit recursive grammar bound; valid records do not need unbounded depth. */
const MAX_JSON_NESTING_DEPTH = 256;

/** Ordered admission stages for a persistent JSON record. */
export type AutoMovieStructuredJsonStage = "encoding" | "syntax" | "duplicate";

/** A stable structured-record refusal before schema validation. */
export class AutoMovieStructuredJsonError extends Error {
  /** Stable machine-readable diagnostic code. */
  public readonly code = "automovie-structured-json-invalid" as const;

  public constructor(
    /** Logical record being admitted. */
    public readonly record: string,
    /** Earliest failed ingress stage. */
    public readonly stage: AutoMovieStructuredJsonStage,
    /** UTF-8 byte offset that proves the failure. */
    public readonly offset: number,
    /** JSON Pointer of the containing value. */
    public readonly pointer: string,
    detail: string,
    /** Decoded duplicate name, only at the duplicate stage. */
    public readonly member?: string,
  ) {
    super(
      `AutoMovie JSON record "${record}" failed ${stage} admission at byte ${offset} (${pointer || "/"}): ${detail}`,
    );
    this.name = "AutoMovieStructuredJsonError";
  }
}

/**
 * Decode and materialize a persistent JSON record exactly once.
 *
 * Member names are compared after JSON escape decoding and within their own
 * object scope. A duplicate is refused before any last-wins object can escape
 * to schema validation.
 *
 * @evidence requirements/evidence-and-provenance/canonical-digests-and-content-identity.md#integrity-structured-canonicalization Rejects malformed encoding and duplicate decoded names before schema interpretation.
 * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-canonical-receipt-result Gives persistent records a single duplicate-safe materialization owner.
 */
export const parseAutoMovieStructuredJson = (props: {
  /** Logical record named by refusals. */
  record: string;
  /** Exact persistent bytes. */
  bytes: Uint8Array;
}): unknown => {
  let text: string;
  try {
    text = decodeAutoMovieUtf8({
      record: props.record,
      bytes: props.bytes,
      leadingBom: "preserve",
    });
  } catch (error) {
    if (error instanceof AutoMovieUtf8Error)
      throw new AutoMovieStructuredJsonError(
        props.record,
        "encoding",
        error.offset,
        "",
        error.category,
      );
    throw error;
  }
  return new JsonParser(props.record, text).parse();
};

/** Recursive-descent JSON grammar that owns both validation and materialization. */
class JsonParser {
  private cursor = 0;

  public constructor(
    private readonly record: string,
    private readonly text: string,
  ) {}

  public parse(): unknown {
    this.whitespace();
    const value = this.value("", 0);
    this.whitespace();
    if (this.cursor !== this.text.length)
      this.syntax("unexpected content after the root value", "");
    return value;
  }

  private value(pointer: string, depth: number): unknown {
    if (depth > MAX_JSON_NESTING_DEPTH)
      this.syntax(
        `nesting exceeds ${MAX_JSON_NESTING_DEPTH} containers`,
        pointer,
      );
    const token = this.text[this.cursor];
    if (token === '"') return this.string(pointer);
    if (token === "{") return this.object(pointer, depth);
    if (token === "[") return this.array(pointer, depth);
    if (token === "t") return this.keyword("true", true, pointer);
    if (token === "f") return this.keyword("false", false, pointer);
    if (token === "n") return this.keyword("null", null, pointer);
    if (token === "-" || (token !== undefined && /[0-9]/.test(token)))
      return this.number(pointer);
    this.syntax("expected a JSON value", pointer);
  }

  private object(pointer: string, depth: number): Record<string, unknown> {
    this.cursor += 1;
    this.whitespace();
    const output: Record<string, unknown> = {};
    const names = new Set<string>();
    if (this.take("}")) return output;
    while (true) {
      if (this.text[this.cursor] !== '"')
        this.syntax("expected an object member name", pointer);
      const nameOffset = this.cursor;
      const name = this.string(pointer);
      if (names.has(name))
        this.fail(
          "duplicate",
          nameOffset,
          pointer,
          `duplicate member ${JSON.stringify(name)}`,
          name,
        );
      names.add(name);
      this.whitespace();
      if (!this.take(":"))
        this.syntax("expected ':' after member name", pointer);
      this.whitespace();
      const childPointer = `${pointer}/${escapePointer(name)}`;
      const value = this.value(childPointer, depth + 1);
      Object.defineProperty(output, name, {
        configurable: true,
        enumerable: true,
        writable: true,
        value,
      });
      this.whitespace();
      if (this.take("}")) return output;
      if (!this.take(",")) this.syntax("expected ',' or '}'", pointer);
      this.whitespace();
    }
  }

  private array(pointer: string, depth: number): unknown[] {
    this.cursor += 1;
    this.whitespace();
    const output: unknown[] = [];
    if (this.take("]")) return output;
    while (true) {
      output.push(this.value(`${pointer}/${output.length}`, depth + 1));
      this.whitespace();
      if (this.take("]")) return output;
      if (!this.take(",")) this.syntax("expected ',' or ']'", pointer);
      this.whitespace();
    }
  }

  private string(pointer: string): string {
    const start = this.cursor;
    this.cursor += 1;
    while (this.cursor < this.text.length) {
      const character = this.text[this.cursor]!;
      if (character === '"') {
        this.cursor += 1;
        return JSON.parse(this.text.slice(start, this.cursor)) as string;
      }
      if (character === "\\") {
        this.cursor += 1;
        const escape = this.text[this.cursor];
        if (escape === undefined || !'"\\/bfnrtu'.includes(escape))
          this.syntax("invalid string escape", pointer);
        if (escape === "u") {
          const digits = this.text.slice(this.cursor + 1, this.cursor + 5);
          if (!/^[0-9a-fA-F]{4}$/.test(digits))
            this.syntax("invalid Unicode escape", pointer);
          this.cursor += 4;
        }
      } else if (character.charCodeAt(0) <= 0x1f)
        this.syntax("unescaped control character in string", pointer);
      this.cursor += 1;
    }
    this.fail("syntax", start, pointer, "unterminated string");
  }

  private number(pointer: string): number {
    const rest = this.text.slice(this.cursor);
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(rest);
    if (match === null) this.syntax("invalid number", pointer);
    this.cursor += match[0].length;
    return Number(match[0]);
  }

  private keyword<T>(spelling: string, value: T, pointer: string): T {
    if (!this.text.startsWith(spelling, this.cursor))
      this.syntax(`expected ${spelling}`, pointer);
    this.cursor += spelling.length;
    return value;
  }

  private whitespace(): void {
    while (
      this.text[this.cursor] === " " ||
      this.text[this.cursor] === "\t" ||
      this.text[this.cursor] === "\n" ||
      this.text[this.cursor] === "\r"
    )
      this.cursor += 1;
  }

  private take(character: string): boolean {
    if (this.text[this.cursor] !== character) return false;
    this.cursor += 1;
    return true;
  }

  private syntax(detail: string, pointer: string): never {
    this.fail("syntax", this.cursor, pointer, detail);
  }

  private fail(
    stage: AutoMovieStructuredJsonStage,
    characterOffset: number,
    pointer: string,
    detail: string,
    member?: string,
  ): never {
    throw new AutoMovieStructuredJsonError(
      this.record,
      stage,
      Buffer.byteLength(this.text.slice(0, characterOffset), "utf8"),
      pointer,
      detail,
      member,
    );
  }
}

/** RFC 6901 escaping for diagnostic object locations. */
const escapePointer = (value: string): string =>
  value.replace(/~/g, "~0").replace(/\//g, "~1");
