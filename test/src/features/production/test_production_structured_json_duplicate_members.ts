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

const duplicate = (text: string): unknown => {
  try {
    return parse(text);
  } catch (error) {
    return error instanceof AutoMovieStructuredJsonError
      ? [error.stage, error.offset, error.pointer, error.member]
      : error;
  }
};

/** Decoded member names are unique in every independent JSON object scope. */
export const test_production_structured_json_duplicate_members = (): void => {
  TestValidator.equals(
    "root and nested duplicates fail before a last-wins value can escape",
    [
      duplicate('{"a":1,"a":2}'),
      duplicate('{"a":1,"\\u0061":2}'),
      duplicate('{"outer":{"x":1,"x":2}}'),
    ],
    [
      ["duplicate", 7, "", "a"],
      ["duplicate", 7, "", "a"],
      ["duplicate", 16, "/outer", "x"],
    ],
  );
  TestValidator.equals(
    "sibling scope, case and normalization distinctions remain admitted",
    [
      parse('{"left":{"a":1},"right":{"a":2}}'),
      parse('{"a":1,"A":2,"é":3,"é":4}'),
      parse('{"a/b":{"~x":1}}'),
    ],
    [
      { left: { a: 1 }, right: { a: 2 } },
      { a: 1, A: 2, é: 3, é: 4 },
      { "a/b": { "~x": 1 } },
    ],
  );
  TestValidator.predicate(
    "pathological nesting is refused by the declared parser bound",
    (duplicate(`${"[".repeat(258)}0${"]".repeat(258)}`) as unknown[])[0] ===
      "syntax",
  );
};
