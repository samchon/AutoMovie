import type { IsoFileOptions, Sample } from "mp4box";

/**
 * The sample entry of one sample as its type and its boxes.
 *
 * An absent box list reads as empty, so every writer and every comparison in
 * this entry can treat a description as one shape.
 */
export const sampleDescription = (
  sample: Sample,
): {
  type: IsoFileOptions["type"];
  boxes: NonNullable<IsoFileOptions["description_boxes"]>;
} => {
  const description = sample.description as {
    type: IsoFileOptions["type"];
    boxes?: IsoFileOptions["description_boxes"];
  };
  return { type: description.type, boxes: description.boxes ?? [] };
};
