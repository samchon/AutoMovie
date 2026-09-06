import {
  AutoMovieStructuredJsonError,
  parseAutoMovieStructuredJson,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

const outcome = (text: string): unknown => {
  try {
    return parseAutoMovieStructuredJson({
      record: "automovie/record.json",
      bytes: Buffer.from(text, "utf8"),
    });
  } catch (error) {
    return error instanceof AutoMovieStructuredJsonError
      ? `${error.stage}@${error.offset}${error.pointer}: ${error.message.slice(error.message.indexOf(":") + 2)}`
      : error;
  }
};

/**
 * The duplicate-aware parser names every JSON syntax refusal at its offset and
 * pointer instead of falling back to the host parser.
 *
 * Scenarios:
 *
 * 1. Every scalar and container form the grammar admits parses to the same
 *    value the host would produce, including every string escape.
 * 2. Trailing content, a missing member separator, a missing comma in an
 *    object or an array, an invalid or truncated escape, an unescaped control
 *    character, an unterminated string, an invalid number, a leading octal
 *    digit, a bare word, a non-string member name, and a truncated keyword are
 *    each refused at their exact position with the enclosing pointer.
 */
export const test_production_structured_json_syntax = (): void => {
  TestValidator.equals(
    "admitted syntax parses to the host value",
    [
      outcome(
        '{"a":[1,-2.5e3,true,false,null,"x\\u0041\\n\\"\\\\\\/\\b\\f\\r\\t"]}',
      ),
      outcome(" [ ] "),
      outcome("0"),
    ],
    [{ a: [1, -2500, true, false, null, 'xA\n"\\/\b\f\r\t'] }, [], 0],
  );
  TestValidator.equals(
    "syntax refusals name the offset and enclosing pointer",
    [
      outcome("{} x"),
      outcome('{"a" 1}'),
      outcome('{"a":1 "b":2}'),
      outcome("[1 2]"),
      outcome('["\\q"]'),
      outcome('["\\u12"]'),
      outcome('[""]'),
      outcome('{"a":"open'),
      outcome("[-]"),
      outcome("[01]"),
      outcome("x"),
      outcome("{1:2}"),
      outcome("[tru]"),
    ],
    [
      "syntax@3: unexpected content after the root value",
      "syntax@5: expected ':' after member name",
      "syntax@7: expected ',' or '}'",
      "syntax@3: expected ',' or ']'",
      "syntax@3/0: invalid string escape",
      "syntax@3/0: invalid Unicode escape",
      "syntax@2/0: unescaped control character in string",
      "syntax@5/a: unterminated string",
      "syntax@1/0: invalid number",
      "syntax@2: expected ',' or ']'",
      "syntax@0: expected a JSON value",
      "syntax@1: expected an object member name",
      "syntax@1/0: expected true",
    ],
  );
};
