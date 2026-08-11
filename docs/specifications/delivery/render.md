# Film delivery

## Prototype sequence delivery {#prototype-sequence-delivery}

<!-- @evidence requirements/00-charter.md#prototype-delivery Encodes the deterministic blocking pass and its exact frame schedule as the product artifact. -->

`@automovie/render` plans frame sequences, chunks, guide passes, captions, audio, and media assembly from compiled records. It preserves canonical timing and emits reproducible manifests instead of promising a photoreal finish.

## Repaint artifact handoff {#repaint-artifact-handoff}

<!-- @evidence requirements/12-repaint-handoff.md#stable-hint-motion-inputs Names the beauty and guide-pass inputs whose receipts keep a repaint tied to one compiled shot. -->

Guide-pass manifests retain exact frame names, chunk order, dimensions, and source identities beside beauty output. A repaint consumer can change appearance while the original structural passes and receipts remain available for review.
