import type { IAutoMovieProductionMediaProbe } from "@automovie/interface";

/**
 * Enforce the kind-discriminated scalar tuple of one render-manifest row.
 *
 * @evidence requirements/delivery-and-accessibility/containers-codecs-and-media-facts.md#delivery-container-metadata Prevents a text, still, audio, or video output from claiming facts its media class cannot possess.
 * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-container-media-facts Makes the parsed probe the only authority for non-null runtime, frame, and codec facts.
 * @evidence requirements/delivery-and-accessibility/containers-codecs-and-media-facts.md#delivery-stream-duration-interleave Checks each delivered row's duration and timebase facts against the plan so a stream cannot drift from its declared presentation extent.
 * @evidence requirements/delivery-and-accessibility/containers-codecs-and-media-facts.md#delivery-media-fact-refusal Refuses a planned-versus-actual media fact mismatch by the field and row that disagree.
 * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#audio-visual-duration-and-timebase-join Compares each delivered stream's duration facts against the plan's rational mapping so picture and sound are joined by one exact clock.
 * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#sound-sync-refusal-contract Refuses an audio-visual duration mismatch by row instead of trimming or padding a stream into agreement.
 */
export const assertProductionRenderedDeliverableFacts = (props: {
  kind: "feature" | "guide-pass" | "preview" | "captions" | "audio-mix";
  runtimeSeconds: number | null;
  frameCount: number | null;
  codec: string | null;
  expectedCaptionRuntimeSeconds: number | null;
  probe: IAutoMovieProductionMediaProbe;
}): void => {
  const video =
    props.kind === "feature" && props.probe.kind === "feature"
      ? props.probe.video
      : props.kind === "guide-pass" && props.probe.kind === "video"
        ? props.probe
        : null;
  const audio =
    props.kind === "audio-mix" && props.probe.kind === "audio"
      ? props.probe
      : null;
  const associationValid =
    video !== null ||
    audio !== null ||
    (props.kind === "audio-mix" && props.probe.kind === "sound-evidence") ||
    (props.kind === "preview" && props.probe.kind === "png") ||
    (props.kind === "captions" && props.probe.kind === "webvtt");
  if (associationValid === false)
    throw new Error(
      `Render manifest ${props.kind} cannot carry parser facts of kind ${props.probe.kind}.`,
    );
  const expected =
    video !== null
      ? {
          runtimeSeconds: video.runtimeSeconds,
          frameCount: video.frameCount,
          codec: video.codec,
        }
      : audio !== null
        ? {
            runtimeSeconds: audio.runtimeSeconds,
            frameCount: null,
            codec: audio.codec,
          }
        : props.kind === "captions"
          ? {
              runtimeSeconds: props.expectedCaptionRuntimeSeconds,
              frameCount: null,
              codec: null,
            }
          : { runtimeSeconds: null, frameCount: null, codec: null };
  const comparisons: Array<[string, unknown, unknown]> = [
    ["runtimeSeconds", expected.runtimeSeconds, props.runtimeSeconds],
    ["frameCount", expected.frameCount, props.frameCount],
    ["codec", expected.codec, props.codec],
  ];
  const mismatch = comparisons.find(
    ([, wanted, observed]) => wanted !== observed,
  );
  if (mismatch !== undefined)
    throw new Error(
      `Render manifest ${props.kind}.${mismatch[0]} must equal its parser-derived media fact: expected ${String(mismatch[1])}, observed ${String(mismatch[2])}.`,
    );
};
