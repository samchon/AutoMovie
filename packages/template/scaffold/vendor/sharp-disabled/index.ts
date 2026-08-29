/** Refuse image processing outside AutoMovie's TTS-only Transformers.js lane. */
const sharp = (): never => {
  throw new Error(
    "AutoMovie's Kokoro adapter supports the Transformers.js text/audio path only; the Sharp image pipeline is not installed.",
  );
};

export default sharp;
