import {
  AutoMovieSubject,
  AutoMovieSubjectGroup,
  type IAutoMovieSubjectContribution,
  mergeAutoMovieSubjectContributions,
} from "@automovie/engine";
import type { IAutoMovieShotBuildContext } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";

/** A leaf subject that contributes exactly what it was built with. */
class Leaf extends AutoMovieSubject<{ id: string }> {
  public constructor(
    public readonly id: string,
    private readonly contribution: IAutoMovieSubjectContribution,
  ) {
    super();
  }

  public design(): { id: string } {
    return { id: this.id };
  }

  public render(
    _context: IAutoMovieShotBuildContext,
  ): IAutoMovieSubjectContribution {
    return this.contribution;
  }
}

/** A group that composes its members and adds nothing of its own. */
class Plain extends AutoMovieSubjectGroup<{ id: string }, Leaf> {
  public constructor(
    public readonly id: string,
    private readonly held: readonly Leaf[],
  ) {
    super();
  }

  public members(): readonly Leaf[] {
    return this.held;
  }

  public design(): { id: string } {
    return { id: this.id };
  }
}

/** A group that adds a cue no member owns, without discarding theirs. */
class Bannered extends Plain {
  public override render(
    context: IAutoMovieShotBuildContext,
  ): IAutoMovieSubjectContribution {
    return mergeAutoMovieSubjectContributions([
      super.render(context),
      { landmarks: [landmark("banner")] },
    ]);
  }
}

const actor = (node: string) => ({
  node,
  model: node,
  speed: 1,
  eyeHeight: 1.6,
});

const landmark = (id: string) => ({
  id,
  position: { x: 0, y: 0, z: 0 },
  radius: 1,
  meaning: `the ${id}`,
});

const context = {} as IAutoMovieShotBuildContext;

/**
 * A subject contributes its own part of a shot, and a group is its members.
 *
 * No subject returns a shot program. A shot is assembled from many of them, so
 * each returns only what it owns and the shot merges the pieces. That is the
 * whole reason a regiment can be its squadrons and a world can be its terrain
 * without either knowing it was composed.
 *
 * Merging deliberately does not deduplicate. Two subjects claiming one id is a
 * defect the compiler's own uniqueness checks report, and collapsing it here
 * would hide the collision from the gate that owns it, the same "one
 * obligation, one owner" rule the rest of the pipeline is built on.
 *
 * Scenarios:
 *
 * 1. Merging carries every contribution key, concatenating in the order given, so
 *    a group listing its members in a stable order merges to stable bytes.
 * 2. An absent key stays absent and an empty array contributes nothing, so a
 *    subject that fills one field does not litter the merge with empties.
 * 3. Two subjects claiming one identity both survive the merge, because silently
 *    collapsing them would answer a question this layer does not own.
 * 4. A group renders exactly the merge of its members, and an empty group renders
 *    nothing.
 * 5. Nesting holds: a group of groups equals the merge of its leaves, which is
 *    what makes a regiment of squadrons the same shape as a squadron.
 * 6. A group that adds something of its own keeps what its members said, because
 *    overriding `render` to replace them would make composition a lie.
 */
export const test_world_subject_contribution = (): void => {
  TestValidator.equals(
    "merging concatenates every key in the order given",
    mergeAutoMovieSubjectContributions([
      { actors: [actor("a")], landmarks: [landmark("one")] },
      { actors: [actor("b")], surfaces: [] },
      { landmarks: [landmark("two")] },
    ]),
    {
      actors: [actor("a"), actor("b")],
      landmarks: [landmark("one"), landmark("two")],
    },
  );

  TestValidator.equals(
    "an empty merge is an empty contribution",
    mergeAutoMovieSubjectContributions([]),
    {},
  );

  TestValidator.equals(
    "two subjects claiming one identity both survive",
    mergeAutoMovieSubjectContributions([
      { landmarks: [landmark("same")] },
      { landmarks: [landmark("same")] },
    ]),
    { landmarks: [landmark("same"), landmark("same")] },
  );

  const left = new Leaf("left", { actors: [actor("left")] });
  const right = new Leaf("right", {
    clips: [{ id: "right-clip" }] as never,
  });
  const squadron = new Plain("squadron", [left, right]);
  TestValidator.equals(
    "a group renders the merge of its members",
    squadron.render(context),
    {
      actors: [actor("left")],
      clips: [{ id: "right-clip" }] as never,
    },
  );

  TestValidator.equals(
    "an empty group renders nothing",
    new Plain("empty", []).render(context),
    {},
  );

  const regiment = new (class extends AutoMovieSubjectGroup<
    { id: string },
    Plain
  > {
    public readonly id = "regiment";
    public members(): readonly Plain[] {
      return [squadron, new Plain("second", [new Leaf("far", {})])];
    }
    public design(): { id: string } {
      return { id: this.id };
    }
  })();
  TestValidator.equals(
    "a group of groups equals the merge of its leaves",
    regiment.render(context),
    squadron.render(context),
  );

  const bannered = new Bannered("bannered", [left]);
  TestValidator.equals(
    "a group that adds its own keeps what its members said",
    bannered.render(context),
    { actors: [actor("left")], landmarks: [landmark("banner")] },
  );

  TestValidator.equals(
    "a subject and a group each answer with their own record",
    namedFacts([
      ["leaf", () => left.design().id === "left"],
      ["group", () => squadron.design().id === "squadron"],
      ["nested", () => regiment.design().id === "regiment"],
    ]),
    { leaf: true, group: true, nested: true },
  );
};
