# D011. Crude proxy, rich meaning

## Decision

Objects and spaces are modelled the way the actor is: a crude geometric proxy carrying rich, engine-validatable semantics. A chair is a box plus a seat affordance with a height, a facing, and an occupancy rule. A room is a few boxes plus surfaces that feet obey. The parameterization stays deliberately minimal — "the proxy *means* the thing."

## Why

This is the stick-figure bet applied past the character. Appearance is diffusion's job ([D009](./D009-motion-first-infinite-duration.md)), so spending modelling effort on how a chair *looks* buys nothing the generative pass will not overwrite. Spending it on what the chair *affords* buys everything: the engine can then check that an actor can sit there, that the prop supports the weight put on it, that the guide pass draws a world the feet are actually standing on.

A bare imported mesh has no constraints and no dependencies. Adding that semantic layer is what makes automovie an engine rather than a model holder.

## Where it binds

- `packages/interface/src/harness/IAutoMoviePropSpec.ts` — a crude primitive proxy with rich meaning; body, affordances, self-declared articulation.
- `packages/interface/src/model/IAutoMovieAffordance.ts` — the meaning an object declares.
- `packages/interface/src/scene/IAutoMovieSurface.ts` — deliberately minimal parameterization.
- `packages/engine/src/film/forgeProp.ts` — gates the model contract and the articulation contract together.
- `packages/mcp/prompts/props.md` — "a room IS a few boxes".

## Relations

Follows from [D009](./D009-motion-first-infinite-duration.md).

@author Samchon
