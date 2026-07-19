# D009. Motion first, infinite duration; appearance and audio go to diffusion

## Decision

The division of labour, and the root of the mission:

- **automovie owns** motion, physical plausibility, rigs and ROM, the meaning of objects and space, screenplay **text**, cameras and timeline, and deterministic guide-pass output.
- **Diffusion owns** final appearance, faces, and audio rendering.

Dialogue is authored by automovie as *text*; it leaves as text and comes back as audio from the generative pass. Duration is unbounded by construction: nothing in the pipeline scales with film length in a way that caps it.

## Why

Diffusion is good at appearance and bad at consistency across time. A deterministic engine is the reverse. Splitting on that seam takes each side's strength: automovie emits the depth, silhouette, keypoint, and camera structure a generative pass can be conditioned on, and lets the generative pass decide what the pixels look like.

The infinite-duration half is what makes it a *film* tool rather than a clip tool, and it is why state is persisted per beat rather than held in one growing in-memory artifact.

## Where it binds

- `packages/render/src/screenplay.ts` — dialogue text is authoring data; audio is delegated.
- `packages/render/src/guidePasses.ts` — the structural conditioning output.
- `README.md` — "The Bet".

## Relations

The retreat that produced it is [D001](./D001-face-editor-dormant-motion-first.md). The geometry policy that follows from it is [D011](./D011-crude-proxy-rich-meaning.md).

@author Samchon
