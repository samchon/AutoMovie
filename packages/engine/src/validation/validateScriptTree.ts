import {
  IAutoMovieBeat,
  IAutoMovieScriptNode,
  IAutoMovieValidation,
} from "@automovie/interface";

import { ViolationCollector } from "./violation";

/**
 * Which parent kinds each node kind may refine. The refinement tree is
 * deliberately permissive where the design is silent (a tiny film may go
 * straight `intent → beat`), but never inverted: an act cannot hang under a
 * scene, a beat is always a leaf. `intent` is absent here because it is the
 * root and may have no parent at all.
 */
const ALLOWED_PARENTS: Record<
  Exclude<IAutoMovieScriptNode["kind"], "intent">,
  ReadonlyArray<IAutoMovieScriptNode["kind"]>
> = {
  act: ["intent", "group"],
  scene: ["intent", "act", "group"],
  group: ["intent", "act", "scene"],
  beat: ["intent", "act", "scene", "group"],
};

/**
 * Validate the screenplay refinement tree against its script's flat
 * beats, the structural gate a script with a `tree` must pass before commit.
 *
 * Checks, all `error` severity:
 *
 * - Node ids are non-empty and unique.
 * - Exactly one root (`parent: null`) exists and it is the `intent`: the tree
 *   refines one film-level thought; a rootless forest or a second root is two
 *   films in one script.
 * - Every `parent` resolves, the refinement axis is acyclic, and each child's
 *   kind may refine its parent's kind ({@link ALLOWED_PARENTS}); a beat is
 *   always a leaf.
 * - `temporal` and every `interactsWith` entry resolve to an existing node and
 *   never to the node itself.
 * - Beat-kind nodes join the flat `beats` 1:1: every beat node names a real beat
 *   id, no two nodes claim one beat, and every beat is claimed: a tree that
 *   forgets a beat silently drops authored structure.
 * - Dialogue anchors are finite and `>= 0` when non-null.
 *
 * The cross-edge semantics (feedback propagation up the refinement chain) are
 * consumed later; this validator only guarantees the graph is well-formed.
 *
 * @author Samchon
 */
export const validateScriptTree = (props: {
  /** The refinement tree to validate. */
  tree: IAutoMovieScriptNode[];
  /** The script's flat beats the beat-kind nodes must join. */
  beats: IAutoMovieBeat[];
}): IAutoMovieValidation => {
  const path = "$input.tree";
  const out = new ViolationCollector();
  const { tree, beats } = props;

  const byId = new Map<string, { node: IAutoMovieScriptNode; index: number }>();
  tree.forEach((node, i) => {
    const np = `${path}[${i}]`;
    if (node.id.trim().length === 0)
      out.push("type", `${np}.id`, "node id must be non-empty", node.id);
    const existing = byId.get(node.id);
    if (existing !== undefined) {
      out.push(
        "type",
        `${np}.id`,
        `node id "${node.id}" is duplicated; first declared at ${path}[${existing.index}].id`,
        node.id,
      );
      return;
    }
    byId.set(node.id, { node, index: i });
  });

  const roots = tree.filter((node) => node.parent === null);
  if (roots.length !== 1)
    out.push(
      "type",
      path,
      `the refinement tree needs exactly one root (parent: null), but found ${roots.length}`,
      roots.map((node) => node.id),
    );
  for (const root of roots)
    if (root.kind !== "intent")
      out.push(
        "type",
        `${path}[${tree.indexOf(root)}].kind`,
        `the root must be the "intent" the tree refines, but "${root.id}" is a "${root.kind}"`,
        root.kind,
      );

  tree.forEach((node, i) => {
    const np = `${path}[${i}]`;
    if (node.parent !== null) {
      const parent = byId.get(node.parent);
      if (parent === undefined) {
        out.push(
          "type",
          `${np}.parent`,
          `parent "${node.parent}" is not a node of this tree`,
          node.parent,
        );
      } else if (node.kind === "intent") {
        out.push(
          "type",
          `${np}.parent`,
          `an "intent" is the root thought and cannot refine another node`,
          node.parent,
        );
      } else if (!ALLOWED_PARENTS[node.kind].includes(parent.node.kind)) {
        out.push(
          "type",
          `${np}.parent`,
          `a "${node.kind}" cannot refine a "${parent.node.kind}" (allowed: ${ALLOWED_PARENTS[node.kind].join(", ")})`,
          node.parent,
        );
      }
    }

    if (node.temporal !== null) {
      if (node.temporal === node.id)
        out.push(
          "type",
          `${np}.temporal`,
          "a node cannot temporally follow itself",
          node.temporal,
        );
      else if (!byId.has(node.temporal))
        out.push(
          "type",
          `${np}.temporal`,
          `temporal predecessor "${node.temporal}" is not a node of this tree`,
          node.temporal,
        );
    }
    node.interactsWith.forEach((other, j) => {
      if (other === node.id)
        out.push(
          "type",
          `${np}.interactsWith[${j}]`,
          "a node cannot interact with itself",
          other,
        );
      else if (!byId.has(other))
        out.push(
          "type",
          `${np}.interactsWith[${j}]`,
          `interaction target "${other}" is not a node of this tree`,
          other,
        );
    });
  });

  for (const [id, entry] of byId) {
    const trail = new Set<string>([id]);
    let parent = entry.node.parent;
    while (parent !== null) {
      if (trail.has(parent)) {
        out.push(
          "type",
          `${path}[${entry.index}].parent`,
          `refinement chain of "${id}" is cyclic at "${parent}"`,
          parent,
        );
        break;
      }
      trail.add(parent);
      parent = byId.get(parent)?.node.parent ?? null;
    }
  }

  const beatIds = new Set(beats.map((beat) => beat.id));
  const claimed = new Map<string, number>();
  tree.forEach((node, i) => {
    if (node.kind !== "beat") return;
    const np = `${path}[${i}].payload`;
    if (!beatIds.has(node.payload.beat)) {
      out.push(
        "type",
        `${np}.beat`,
        `beat node "${node.id}" refines beat "${node.payload.beat}", which is not in the script's beats`,
        node.payload.beat,
      );
    } else {
      const first = claimed.get(node.payload.beat);
      if (first !== undefined)
        out.push(
          "type",
          `${np}.beat`,
          `beat "${node.payload.beat}" is already refined by ${path}[${first}]; each beat joins exactly one node`,
          node.payload.beat,
        );
      else claimed.set(node.payload.beat, i);
    }
    node.payload.dialogue.forEach((line, j) => {
      if (
        line.anchor !== null &&
        (!Number.isFinite(line.anchor) || line.anchor < 0)
      )
        out.push(
          "range",
          `${np}.dialogue[${j}].anchor`,
          `dialogue anchor must be a finite number >= 0 or null, but was ${line.anchor}`,
          line.anchor,
        );
    });
  });
  beats.forEach((beat, i) => {
    if (!claimed.has(beat.id))
      out.push(
        "type",
        path,
        `beat "${beat.id}" ($input.beats[${i}]) has no beat node; a tree must refine every beat`,
        beat.id,
      );
  });

  return out.toValidation();
};
