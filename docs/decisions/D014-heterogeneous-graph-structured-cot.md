# D014. Chain of thought is graph-structured and heterogeneous

## Decision

Each screenplay node kind carries its **own** payload shape. There are no uniform chain-of-thought slots filled in the same way at every level. This is a deliberate divergence from AutoBe's uniform CoT.

## Why

The levels are not doing the same kind of thinking. A logline decides what the film is about; a sequence decides ordering and rhythm; a beat decides who moves where, when. Forcing one slot shape across all of them either pads the shallow levels with empty ceremony or starves the deep ones of the fields they need.

Heterogeneous payloads also make the tree self-describing: the node's kind tells a reader — and the validator — exactly which fields must be present.

## Where it binds

- `packages/interface/src/harness/IAutoMovieScriptNode.ts` — "what this level of thought carries (no uniform CoT slots)"; each kind carries its own payload shape.

## Relations

Updates [D005](./D005-autobe-pattern-function-calling-harness.md). Shapes the tree defined by [D013](./D013-screenplay-is-a-refinement-graph.md).

@author Samchon
