import type { IAutoMovieFilmSource } from "@automovie/interface";

/** Finished-film edit compiled into the canonical global timeline. */
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
            id: "signal-caption",
            text: "The sentinel raises the signal.",
            language: "en",
            speaker: "sentinel",
            start: { seconds: 1.5 },
            end: { seconds: 3 },
          },
        ],
        effects: [],
      },
    };
  },
} satisfies IAutoMovieFilmSource;
