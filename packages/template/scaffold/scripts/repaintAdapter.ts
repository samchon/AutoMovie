import type { AutoMovieProductionShotRepaint } from "@automovie/interface";

/**
 * The diffusion adapter a repainted delivery runs on, which this project owns.
 *
 * AutoMovie ships no model. `visualDelivery: "repainted"` makes the
 * deterministic shot technical truth and a derived rendition what the audience
 * sees, so something has to draw that rendition: a local checkpoint, an API
 * client, a render farm. Which one is a production decision carrying cost,
 * licence, and provenance, and choosing it here would make the product a
 * catalogue instead of a capability.
 *
 * Replace this export, but do not select a generator here. The reviewed exact
 * provider, model, version, execution boundary, source, rights, terms, cost,
 * consumer, and per-shot request live in `automovie.config.ts`. The runtime
 * resolves that request, verifies the deterministic source the rendition
 * derives from, refuses an adapter identity that differs from the selection,
 * parses the returned MP4, and commits a receipt binding compiler,
 * source-render, control, reference, generator adoption, parameter, authority,
 * and output identities. This adapter owns nothing but "take these reviewed
 * controls and references, return those bytes".
 *
 * Leaving it as it stands is a legitimate state. A deterministic delivery never
 * reaches it, and a repainted one refuses by name rather than publishing output
 * nobody drew.
 */
export const repaintProductionShot: AutoMovieProductionShotRepaint = () => {
  throw new Error(
    'This project supplies no repaint adapter. Implement repaintProductionShot in scripts/repaintAdapter.ts with a local model or an API client, or set visualDelivery to "deterministic". AutoMovie will not fabricate diffusion output.',
  );
};
