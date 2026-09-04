import {
  AUTOMOVIE_SOURCE_NORMALIZATION_PROTOCOL,
  AutoMovieUtf8Error,
  normalizeAutoMovieSource,
  normalizeAutoMovieSourceIdentity,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

const throwsUtf8 = (bytes: Uint8Array): boolean => {
  try {
    normalizeAutoMovieSourceIdentity({ path: "src/shot.ts", bytes });
    return false;
  } catch (error) {
    return error instanceof AutoMovieUtf8Error;
  }
};

/** Source identity binds strict decoding and permitted equivalence to a version. */
export const test_production_source_identity_protocol = (): void => {
  const lf = normalizeAutoMovieSourceIdentity({
    path: "src/shot.ts",
    bytes: Buffer.from("a\nb\n", "utf8"),
  });
  const bomCrlf = normalizeAutoMovieSourceIdentity({
    path: "src/shot.ts",
    bytes: Buffer.from("\ufeffa\r\nb\r", "utf8"),
  });
  TestValidator.equals(
    "raw and semantic identities preserve their separate roles",
    [
      lf.protocol,
      lf.rawDigest === bomCrlf.rawDigest,
      lf.semanticDigest === bomCrlf.semanticDigest,
      Buffer.from(bomCrlf.normalized).toString("utf8"),
    ],
    [AUTOMOVIE_SOURCE_NORMALIZATION_PROTOCOL, false, true, "a\nb\n"],
  );
  TestValidator.equals(
    "empty, BOM-only, interior BOM and scalar UTF-8 remain deterministic",
    [
      Buffer.from(normalizeAutoMovieSource(new Uint8Array())).toString("hex"),
      Buffer.from(normalizeAutoMovieSource(Buffer.from("\ufeff"))).toString(
        "hex",
      ),
      Buffer.from(
        normalizeAutoMovieSource(Buffer.from("x\ufeffy¢€😀")),
      ).toString("utf8"),
    ],
    ["", "", "x\ufeffy¢€😀"],
  );
  TestValidator.equals(
    "malformed bytes never obtain semantic identity",
    [
      throwsUtf8(new Uint8Array([0x80])),
      throwsUtf8(new Uint8Array([0x81])),
      throwsUtf8(new Uint8Array([0xe2, 0x82])),
      throwsUtf8(new Uint8Array([0xed, 0xa0, 0x80])),
    ],
    [true, true, true, true],
  );
};
