import { verifyAutoMovieSemanticMask } from "@automovie/engine";
import type {
  IAutoMovieProductionDeliverable,
  IAutoMovieProductionMediaProbe,
  IAutoMovieSemanticMask,
} from "@automovie/interface";
import { probeProductionRenderedMedia } from "@automovie/render/node";

import { AUTOMOVIE_SEMANTIC_MASK_MEDIA_TYPE } from "./AUTOMOVIE_SEMANTIC_MASK_MEDIA_TYPE";
import { parseAutoMovieStructuredJson } from "./duplicateAwareJson";
import { parseProductionSoundEvidence } from "./verifyProductionNonVideoDeliverables";

/**
 * Probe one published deliverable file by its declared kind and media type.
 *
 * The two AutoMovie JSON sidecars, a guide pass's semantic-mask palette and an
 * audio mix's sound evidence, are admitted through this package's own record
 * ingress; every encoded picture, caption and MP4 byte stream is parsed by the
 * rendered-media probe that owns those formats.
 */
export const probeProductionMedia = (props: {
  kind: IAutoMovieProductionDeliverable["kind"];
  mediaType: string;
  bytes: Uint8Array;
}): IAutoMovieProductionMediaProbe => {
  if (
    props.kind === "guide-pass" &&
    props.mediaType === AUTOMOVIE_SEMANTIC_MASK_MEDIA_TYPE
  ) {
    let mask: IAutoMovieSemanticMask;
    try {
      mask = parseAutoMovieStructuredJson({
        record: "semantic-mask-sidecar",
        bytes: props.bytes,
      }) as IAutoMovieSemanticMask;
    } catch {
      throw new Error("Semantic-mask sidecar bytes are not strict UTF-8 JSON.");
    }
    verifyAutoMovieSemanticMask(mask);
    return { kind: "semantic-mask", mask };
  }
  if (props.kind === "audio-mix" && props.mediaType === "application/json") {
    return {
      kind: "sound-evidence",
      evidence: parseProductionSoundEvidence(props.bytes),
    };
  }
  return probeProductionRenderedMedia(props);
};
