import { AutoMovieUtf8Error, decodeAutoMovieUtf8 } from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

const failure = (bytes: readonly number[]): unknown => {
  try {
    return decodeAutoMovieUtf8({
      record: "src/shot.ts",
      bytes: new Uint8Array(bytes),
      leadingBom: "strip",
    });
  } catch (error) {
    return error instanceof AutoMovieUtf8Error
      ? [error.code, error.record, error.offset, error.category]
      : error;
  }
};

/** Strict UTF-8 admits scalar text and classifies every malformed sequence. */
export const test_production_strict_utf8 = (): void => {
  TestValidator.equals(
    "valid scalar text, one leading BOM and an interior BOM are distinct",
    [
      decodeAutoMovieUtf8({
        record: "source",
        bytes: Buffer.from("¢€😀", "utf8"),
        leadingBom: "preserve",
      }),
      decodeAutoMovieUtf8({
        record: "source",
        bytes: Buffer.from("\ufeffx", "utf8"),
        leadingBom: "strip",
      }),
      decodeAutoMovieUtf8({
        record: "source",
        bytes: Buffer.from("x\ufeffy", "utf8"),
        leadingBom: "strip",
      }),
    ],
    ["¢€😀", "x", "x\ufeffy"],
  );
  TestValidator.equals(
    "malformed categories report the deterministic first proving byte",
    [
      failure([0x80]),
      failure([0x81]),
      failure([0xc2]),
      failure([0xc2, 0x41]),
      failure([0xe2, 0x41]),
      failure([0xe2, 0x82]),
      failure([0xc0, 0x80]),
      failure([0xe0, 0x80]),
      failure([0xed, 0xa0, 0x80]),
      failure([0xed, 0xa0]),
      failure([0xf4, 0x90, 0x80, 0x80]),
      failure([0xf4, 0x90]),
      failure([0xf5, 0x80, 0x80, 0x80]),
    ],
    [
      ["automovie-invalid-utf8", "src/shot.ts", 0, "isolated-continuation"],
      ["automovie-invalid-utf8", "src/shot.ts", 0, "isolated-continuation"],
      ["automovie-invalid-utf8", "src/shot.ts", 0, "truncated-sequence"],
      ["automovie-invalid-utf8", "src/shot.ts", 1, "invalid-continuation"],
      ["automovie-invalid-utf8", "src/shot.ts", 1, "invalid-continuation"],
      ["automovie-invalid-utf8", "src/shot.ts", 0, "truncated-sequence"],
      ["automovie-invalid-utf8", "src/shot.ts", 0, "overlong-sequence"],
      ["automovie-invalid-utf8", "src/shot.ts", 0, "overlong-sequence"],
      ["automovie-invalid-utf8", "src/shot.ts", 0, "surrogate-scalar"],
      ["automovie-invalid-utf8", "src/shot.ts", 0, "surrogate-scalar"],
      ["automovie-invalid-utf8", "src/shot.ts", 0, "out-of-range-scalar"],
      ["automovie-invalid-utf8", "src/shot.ts", 0, "out-of-range-scalar"],
      ["automovie-invalid-utf8", "src/shot.ts", 0, "invalid-leader"],
    ],
  );
  TestValidator.predicate(
    "a JSON-domain BOM refusal remains typed",
    failureWithBom() instanceof AutoMovieUtf8Error,
  );
};

const failureWithBom = (): unknown => {
  try {
    decodeAutoMovieUtf8({
      record: "record.json",
      bytes: Buffer.from("\ufeff{}", "utf8"),
      leadingBom: "reject",
    });
  } catch (error) {
    return error;
  }
};
