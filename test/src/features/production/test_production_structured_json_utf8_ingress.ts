import {
  AutoMovieStructuredJsonError,
  parseAutoMovieStructuredJson,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

const parse = (text: string): unknown =>
  parseAutoMovieStructuredJson({
    record: "automovie/registry.json",
    bytes: Buffer.from(text, "utf8"),
  });

const refusal = (bytes: Uint8Array): unknown => {
  try {
    return parseAutoMovieStructuredJson({
      record: "automovie/registry.json",
      bytes,
    });
  } catch (error) {
    return error instanceof AutoMovieStructuredJsonError
      ? [error.stage, error.offset, error.pointer]
      : error;
  }
};

/** Persistent JSON has one strict UTF-8 parse owner before schema admission. */
export const test_production_structured_json_utf8_ingress = (): void => {
  TestValidator.equals(
    "materialization preserves JSON values and a literal __proto__ member",
    parse('{"text":"¢€😀","__proto__":{"safe":true},"array":[1,false,null]}'),
    JSON.parse(
      '{"text":"¢€😀","__proto__":{"safe":true},"array":[1,false,null]}',
    ),
  );
  TestValidator.equals(
    "encoding, BOM and JSON syntax stages remain distinct",
    [
      refusal(new Uint8Array([0x7b, 0x22, 0x61, 0x22, 0x3a, 0x80, 0x7d])),
      refusal(Buffer.from("\ufeff{}", "utf8")),
      refusal(Buffer.from('{"a":1,}')),
    ],
    [
      ["encoding", 5, ""],
      ["syntax", 0, ""],
      ["syntax", 7, ""],
    ],
  );
};
