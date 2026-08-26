"use strict";

const sharp = () => {
  throw new Error(
    "AutoMovie's Kokoro adapter supports the Transformers.js text/audio path only; the Sharp image pipeline is not installed.",
  );
};

module.exports = sharp;
