import type { IAutoMovieFilmSource } from "@automovie/interface";

/**
 * Finished-film edit compiled into the canonical global timeline.
 *
 * @evidence screenplays/001-cue/001-cue.md#seq-cue Places the complete cue source first,
 *   carries its authored English caption, and preserves its silent meaning.
 * @evidenceReview screenplays/001-cue/001-cue.md#seq-cue #b6982dc Read screenplays/001-cue/001-cue.md#seq-cue and film; confirmed the six-second opening fades up over its first local half-second, dissolves over its last local half-second, and carries the exact English caption from 1.5 through 3.0.
 * @evidence screenplays/002-answer/001-answer.md#seq-answer Dissolves into the complete answer
 *   source and holds it through the final global sample.
 * @evidenceReview screenplays/002-answer/001-answer.md#seq-answer #d29078c Read screenplays/002-answer/001-answer.md#seq-answer and film; confirmed the six-second answer enters through the authored half-second dissolve, holds its wide insert, and fades to black over its final local half-second.
 * @evidence obligations/delivery/film-sources.md#editorial-only-assembly Selects only the
 *   two reviewed shots and declares their half-second overlap and fades.
 * @evidenceReview obligations/delivery/film-sources.md#editorial-only-assembly #86e74ab Read obligations/delivery/film-sources.md#editorial-only-assembly and film; confirmed both video entries select reviewed shots, map explicit local/global intervals, and assemble exactly 11.5 seconds without local creative decisions.
 * @evidence obligations/delivery/film-sources.md#authored-auxiliary-tracks Maps the
 *   screenplay caption exactly and keeps the named structural guide at zero
 *   gain while creating no empty success track for intentionally absent products.
 * @evidenceReview obligations/delivery/film-sources.md#authored-auxiliary-tracks #eb8a354 Read obligations/delivery/film-sources.md#authored-auxiliary-tracks and film; confirmed it maps the required English caption exactly from screenplay into the global 1.5-3.0 second English track, keeps the zero-gain fixture explicitly inert, and creates no empty success track for intentionally absent description, transcript, signed, subtitle, or clean-audio products.
 * @evidence obligations/delivery/film-sources.md#deterministic-timeline Returns fixed,
 *   ordered tracks from production context without mutable or discovered state.
 * @evidenceReview obligations/delivery/film-sources.md#deterministic-timeline #7324edc Read obligations/delivery/film-sources.md#deterministic-timeline and film; confirmed build reads only production identity and returns fixed literal track order and values with no mutable state or fallback.
 */
export const film = {
  build(context) {
    return {
      id: context.production.id,
      omissions: [],
      tracks: {
        video: [
          {
            shot: "opening",
            sourceIn: { frame: 0 },
            sourceOut: { seconds: 6 },
            start: { frame: 0 },
            handles: {
              head: { frame: 0 },
              tail: { seconds: 0.5 },
            },
            transitionIn: { kind: "fade", duration: { seconds: 0.5 } },
            transitionOut: {
              kind: "dissolve",
              duration: { seconds: 0.5 },
            },
          },
          {
            shot: "answer",
            sourceIn: { frame: 0 },
            sourceOut: { seconds: 6 },
            start: { seconds: 5.5 },
            handles: {
              head: { seconds: 0.5 },
              tail: { seconds: 0.5 },
            },
            transitionIn: {
              kind: "dissolve",
              duration: { seconds: 0.5 },
            },
            transitionOut: { kind: "fade", duration: { seconds: 0.5 } },
          },
        ],
        audio: [
          {
            id: "starter-silent-guide",
            asset: "public/audio/starter-tone.json",
            sourceDuration: { seconds: 11.5 },
            sourceOffset: { frame: 0 },
            start: { frame: 0 },
            duration: { seconds: 11.5 },
            gain: 0,
            fadeIn: { frame: 0 },
            fadeOut: { frame: 0 },
            bus: "ambience",
          },
        ],
        captions: [
          {
            id: "cue-caption",
            text: "The soloist raises the cue.",
            language: "en",
            start: { seconds: 1.5 },
            end: { seconds: 3 },
          },
        ],
        effects: [],
      },
    };
  },
} satisfies IAutoMovieFilmSource;
