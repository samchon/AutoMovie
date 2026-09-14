import type { sampleDescription } from "./sampleDescription";
import { serializeDescriptionBox } from "./serializeDescriptionBox";

/**
 * Whether two sample entries are identical once written out.
 *
 * Parser object identity says nothing about the decoder configuration, so the
 * boxes are serialized and compared as bytes; a splice that joined clips with
 * different configurations would not decode to the frames the clips decode to.
 */
export const sameSampleDescription = (
  left: ReturnType<typeof sampleDescription>,
  right: ReturnType<typeof sampleDescription>,
): boolean =>
  left.type === right.type &&
  left.boxes.length === right.boxes.length &&
  left.boxes.every((box, index) => {
    const leftBytes = serializeDescriptionBox(box);
    const rightBytes = serializeDescriptionBox(right.boxes[index]!);
    return Buffer.from(leftBytes).equals(Buffer.from(rightBytes));
  });
