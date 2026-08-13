/**
 * Build a compact byte-offset index for lines in one declared UTF-8 input.
 *
 * This is a technique example for deterministic precomputation, not production
 * content. The caller supplies the bytes and chooses whether an index is useful
 * to its own source. Newline offsets are measured from the exact UTF-8 bytes so
 * a consumer can seek without repeating the scan inside a one-second build.
 */
export const deriveUtf8LineIndex = (input: Uint8Array): Uint8Array => {
  new TextDecoder("utf-8", { fatal: true }).decode(input);
  const starts = [0];
  for (let index = 0; index < input.length; ++index)
    if (input[index] === 0x0a && index + 1 < input.length)
      starts.push(index + 1);
  return new TextEncoder().encode(
    `${JSON.stringify({ byteLength: input.length, lineStarts: starts })}\n`,
  );
};
