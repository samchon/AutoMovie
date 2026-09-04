import {
  AutoMovieSubject,
  AutoMovieSubjectGroup,
  type IAutoMovieSubjectContribution,
  mergeAutoMovieSubjectContributions,
  worldSurfaceHeight,
} from "@automovie/engine";
import type {
  IAutoMovieShotBuildContext,
  IAutoMovieSpace,
  IAutoMovieSurface,
  IAutoMovieWorldDesign,
} from "@automovie/interface";

import { chorus } from "../formations/chorus";

/**
 * A piece of the world: a surface, a landmark, a region where something
 * happens.
 *
 * A place is made of things the same way a group is made of members, and each
 * of those things is a subject. Its geometry does not depend on the shot it
 * appears in, so a piece states it through {@link place} and its `render` simply
 * hands the same answer to whichever shot asks. That split is the point:
 * geometry is context-free and performance is not, and a class that pretended
 * otherwise would need a shot before it could say where it is.
 *
 * @evidence models/040-plaza.md Defines the context-free contribution boundary
 *   shared by the reviewed ground, centre landmark, and haze pieces of PLAZA.
 * @evidenceReview models/040-plaza.md #b061784 Read models/040-plaza.md and WorldPiece in src/world/plaza.ts; confirmed that the abstraction defines the context-free contribution boundary shared by the reviewed ground, centre landmark, and haze pieces, while its H2 citation delimits that common world-piece boundary.
 * @evidence models/040-plaza.md#plaza-world-composition Defines the common
 *   context-free contribution boundary for every reviewed world piece.
 * @evidenceReview models/040-plaza.md#plaza-world-composition #96ea0f6 Read models/040-plaza.md#plaza-world-composition and WorldPiece in src/world/plaza.ts; confirmed this citation after checking the claim that defines the common context-free contribution boundary for every reviewed world piece.
 * @evidence obligations/design/model-sources.md#design-owned-construction Keeps world
 *   pieces as implementations of the cited model design.
 * @evidenceReview obligations/design/model-sources.md#design-owned-construction #ffa6690 Read obligations/design/model-sources.md#design-owned-construction and WorldPiece in src/world/plaza.ts; confirmed this citation after checking the claim that keeps world pieces as implementations of the cited model design.
 * @evidence obligations/design/model-sources.md#deterministic-build Returns the same
 *   placed contribution from the same piece state in every shot.
 * @evidenceReview obligations/design/model-sources.md#deterministic-build #27790fe Read obligations/design/model-sources.md#deterministic-build and WorldPiece in src/world/plaza.ts; confirmed this citation after checking the claim that returns the same placed contribution from the same piece state in every shot.
 * @evidence obligations/design/model-sources.md#unsupported-fidelity-is-explicit Makes
 *   unsupported enclosure and final atmosphere fidelity absent from the API.
 * @evidenceReview obligations/design/model-sources.md#unsupported-fidelity-is-explicit #15c03fa Read obligations/design/model-sources.md#unsupported-fidelity-is-explicit and WorldPiece in src/world/plaza.ts; confirmed this citation after checking the claim that makes unsupported enclosure and final atmosphere fidelity absent from the API.
 * @evidence principles/core/source-units.md#source-scope-preservation WorldPiece keeps responsibility for A piece of the world: a surface, a landmark, a region where something happens in this declaration; the implementation fragment place, patches, design, render introduces no second creative owner.
 * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete WorldPiece declaration and implementation with the reviewed PLAZA composition, extent, atmosphere, and review decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
 * @evidence principles/core/source-units.md#source-substantive-completion WorldPiece is a usable source artifact for A piece of the world: a surface, a landmark, a region where something happens; it is implemented directly as place, patches, design, render rather than as a placeholder or future-work wrapper.
 * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable WorldPiece signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
 * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing WorldPiece tested the reviewed PLAZA composition, extent, atmosphere, and review decisions through A piece of the world: a surface, a landmark, a region where something happens; the implementation fragment place, patches, design, render shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
 * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete WorldPiece implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
 */
export abstract class WorldPiece extends AutoMovieSubject<IAutoMovieSubjectContribution> {
  /**
   * What this piece puts into the world, independent of any shot.
   * @evidence principles/core/source-units.md#source-scope-preservation WorldPiece.place keeps responsibility for What this piece puts into the world, independent of any shot in this declaration; the implementation fragment IAutoMovieSubjectContribution introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete WorldPiece.place declaration and implementation with the reviewed PLAZA composition, extent, atmosphere, and review decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion WorldPiece.place is a usable source artifact for What this piece puts into the world, independent of any shot; it is implemented directly as IAutoMovieSubjectContribution rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable WorldPiece.place signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing WorldPiece.place tested the reviewed PLAZA composition, extent, atmosphere, and review decisions through What this piece puts into the world, independent of any shot; the implementation fragment IAutoMovieSubjectContribution shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete WorldPiece.place implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public abstract place(): IAutoMovieSubjectContribution;

  /**
   * The standable patches this piece contributes to a staged scene, if any.
   *
   * A world surface and a scene surface are two readings of one piece of
   * ground: the first answers where the terrain is, the second is what the
   * engine stands feet on and what the viewer draws. A piece that is ground
   * answers both from the same measurement; a landmark or an effect region is
   * neither and answers with nothing.
   * @evidence principles/core/source-units.md#source-scope-preservation WorldPiece.patches keeps responsibility for The standable patches this piece contributes to a staged scene, if any in this declaration; the implementation fragment { return []; } introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete WorldPiece.patches declaration and implementation with the reviewed PLAZA composition, extent, atmosphere, and review decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion WorldPiece.patches is a usable source artifact for The standable patches this piece contributes to a staged scene, if any; it is implemented directly as { return []; } rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable WorldPiece.patches signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing WorldPiece.patches tested the reviewed PLAZA composition, extent, atmosphere, and review decisions through The standable patches this piece contributes to a staged scene, if any; the implementation fragment { return []; } shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete WorldPiece.patches implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public patches(): readonly IAutoMovieSurface[] {
    return [];
  }

  /**
   * @evidence principles/core/source-units.md#source-scope-preservation WorldPiece.design keeps responsibility for the named design operation and its declared result in this declaration; the implementation fragment { return this.place(); } introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete WorldPiece.design declaration and implementation with the reviewed PLAZA composition, extent, atmosphere, and review decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion WorldPiece.design is a usable source artifact for the named design operation and its declared result; it is implemented directly as { return this.place(); } rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable WorldPiece.design signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing WorldPiece.design tested the reviewed PLAZA composition, extent, atmosphere, and review decisions through the named design operation and its declared result; the implementation fragment { return this.place(); } shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete WorldPiece.design implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public design(): IAutoMovieSubjectContribution {
    return this.place();
  }

  /**
   * @evidence principles/core/source-units.md#source-scope-preservation WorldPiece.render keeps responsibility for the named render operation and its declared result in this declaration; the implementation fragment { return this.place(); } introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete WorldPiece.render declaration and implementation with the reviewed PLAZA composition, extent, atmosphere, and review decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion WorldPiece.render is a usable source artifact for the named render operation and its declared result; it is implemented directly as { return this.place(); } rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable WorldPiece.render signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing WorldPiece.render tested the reviewed PLAZA composition, extent, atmosphere, and review decisions through the named render operation and its declared result; the implementation fragment { return this.place(); } shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete WorldPiece.render implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public render(
    _context: IAutoMovieShotBuildContext,
  ): IAutoMovieSubjectContribution {
    return this.place();
  }
}

/**
 * The level ground everything stands on.
 *
 * Its extent is one number rather than four corners, because the shape the
 * specification asks for is a square of open ground and a polygon spelled out
 * corner by corner is four chances to disagree with itself.
 *
 * @evidence models/040-plaza.md Owns the one reviewed level square whose
 *   derived extent contains the formation and supplies both ground records.
 * @evidenceReview models/040-plaza.md #b061784 Read models/040-plaza.md and PlazaGround in src/world/plaza.ts; confirmed that the class owns the one reviewed level square whose derived extent contains the formation and supplies both ground records, while its H2 citation delimits the ground subset it realizes.
 * @evidence models/040-plaza.md#plaza-world-composition Implements the one
 *   derived level square used by both world and rendered surface records.
 * @evidenceReview models/040-plaza.md#plaza-world-composition #96ea0f6 Read models/040-plaza.md#plaza-world-composition and PlazaGround in src/world/plaza.ts; confirmed this citation after checking the claim that implements the one derived level square used by both world and rendered surface records.
 * @evidence principles/core/source-units.md#source-scope-preservation PlazaGround keeps responsibility for The level ground everything stands on in this declaration; the implementation fragment id, margin, halfExtent, place, heightAt, patches introduces no second creative owner.
 * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete PlazaGround declaration and implementation with the reviewed PLAZA composition, extent, atmosphere, and review decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
 * @evidence principles/core/source-units.md#source-substantive-completion PlazaGround is a usable source artifact for The level ground everything stands on; it is implemented directly as id, margin, halfExtent, place, heightAt, patches rather than as a placeholder or future-work wrapper.
 * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable PlazaGround signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
 * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing PlazaGround tested the reviewed PLAZA composition, extent, atmosphere, and review decisions through The level ground everything stands on; the implementation fragment id, margin, halfExtent, place, heightAt, patches shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
 * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete PlazaGround implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
 */
export class PlazaGround extends WorldPiece {
  /**
   * @evidence principles/core/source-units.md#source-scope-preservation PlazaGround.id keeps responsibility for the readonly id value materialized by its initializer in this declaration; the implementation fragment "ground" introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete PlazaGround.id declaration and implementation with the reviewed PLAZA composition, extent, atmosphere, and review decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion PlazaGround.id is a usable source artifact for the readonly id value materialized by its initializer; it is implemented directly as "ground" rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable PlazaGround.id signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing PlazaGround.id tested the reviewed PLAZA composition, extent, atmosphere, and review decisions through the readonly id value materialized by its initializer; the implementation fragment "ground" shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete PlazaGround.id implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public readonly id = "ground";

  /**
   * Clear ground kept beyond the farthest member, in metres.
   * @evidence principles/core/source-units.md#source-scope-preservation PlazaGround.margin keeps responsibility for Clear ground kept beyond the farthest member, in metres in this declaration; the implementation fragment 1 introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete PlazaGround.margin declaration and implementation with the reviewed PLAZA composition, extent, atmosphere, and review decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion PlazaGround.margin is a usable source artifact for Clear ground kept beyond the farthest member, in metres; it is implemented directly as 1 rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable PlazaGround.margin signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing PlazaGround.margin tested the reviewed PLAZA composition, extent, atmosphere, and review decisions through Clear ground kept beyond the farthest member, in metres; the implementation fragment 1 shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete PlazaGround.margin implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public readonly margin: number = 1;

  /**
   * Half-extent of the square plaza, in metres.
   *
   * Derived from the group that stands on it rather than authored beside it.
   * The specification states its requirement as a relation, that the rows must
   * end inside the place, and two independently authored numbers is how this
   * plaza came to be a third the size of its own chorus. Deriving makes the
   * relation true by construction, so a change to the group carries the ground
   * with it.
   * @evidence principles/core/source-units.md#source-scope-preservation PlazaGround.halfExtent keeps responsibility for Half-extent of the square plaza, in metres in this declaration; the implementation fragment { return chorus.reach() + this.margin; } introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete PlazaGround.halfExtent declaration and implementation with the reviewed PLAZA composition, extent, atmosphere, and review decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion PlazaGround.halfExtent is a usable source artifact for Half-extent of the square plaza, in metres; it is implemented directly as { return chorus.reach() + this.margin; } rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable PlazaGround.halfExtent signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing PlazaGround.halfExtent tested the reviewed PLAZA composition, extent, atmosphere, and review decisions through Half-extent of the square plaza, in metres; the implementation fragment { return chorus.reach() + this.margin; } shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete PlazaGround.halfExtent implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public halfExtent(): number {
    return chorus.reach() + this.margin;
  }

  /**
   * @evidence principles/core/source-units.md#source-scope-preservation PlazaGround.place keeps responsibility for the named place operation and its declared result in this declaration; the implementation fragment { const half = this.halfExtent(); return { surfaces: [ { id: this.id, polygon: [ { x: -half, z: -half }, { x: half, z: -half }, { x: half, z: half }, { x: -half, z: half }, ] introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete PlazaGround.place declaration and implementation with the reviewed PLAZA composition, extent, atmosphere, and review decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion PlazaGround.place is a usable source artifact for the named place operation and its declared result; it is implemented directly as { const half = this.halfExtent(); return { surfaces: [ { id: this.id, polygon: [ { x: -half, z: -half }, { x: half, z: -half }, { x: half, z: half }, { x: -half, z: half }, ] rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable PlazaGround.place signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing PlazaGround.place tested the reviewed PLAZA composition, extent, atmosphere, and review decisions through the named place operation and its declared result; the implementation fragment { const half = this.halfExtent(); return { surfaces: [ { id: this.id, polygon: [ { x: -half, z: -half }, { x: half, z: -half }, { x: half, z: half }, { x: -half, z: half }, ] shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete PlazaGround.place implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public place(): IAutoMovieSubjectContribution {
    const half = this.halfExtent();
    return {
      surfaces: [
        {
          id: this.id,
          polygon: [
            { x: -half, z: -half },
            { x: half, z: -half },
            { x: half, z: half },
            { x: -half, z: half },
          ],
          height: { kind: "constant", value: 0 },
          walkable: true,
        },
      ],
    };
  }

  /**
   * How high this ground is where something stands on it, in metres.
   *
   * The question is asked of the record this piece emits, through the engine
   * function that owns the answer. A class that read `height.value` itself
   * would be right for a level plaza and wrong the day the piece slopes, and a
   * second answer that agrees until it does not is the failure the whole
   * one-owner rule exists to prevent.
   *
   * @evidence models/040-plaza.md#plaza-world-composition Reads the reviewed
   *   level-surface height through the engine's owning query.
   * @evidenceReview models/040-plaza.md#plaza-world-composition #96ea0f6 Read models/040-plaza.md#plaza-world-composition and heightAt in src/world/plaza.ts; confirmed this citation after checking the claim that reads the reviewed level-surface height through the engine's owning query.
   * @evidence principles/core/source-units.md#source-scope-preservation PlazaGround.heightAt keeps responsibility for How high this ground is where something stands on it, in metres in this declaration; the implementation fragment { return worldSurfaceHeight(this.place().surfaces![0]!, point); } introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete PlazaGround.heightAt declaration and implementation with the reviewed PLAZA composition, extent, atmosphere, and review decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion PlazaGround.heightAt is a usable source artifact for How high this ground is where something stands on it, in metres; it is implemented directly as { return worldSurfaceHeight(this.place().surfaces![0]!, point); } rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable PlazaGround.heightAt signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing PlazaGround.heightAt tested the reviewed PLAZA composition, extent, atmosphere, and review decisions through How high this ground is where something stands on it, in metres; the implementation fragment { return worldSurfaceHeight(this.place().surfaces![0]!, point); } shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete PlazaGround.heightAt implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public heightAt(point: { x: number; z: number }): number {
    return worldSurfaceHeight(this.place().surfaces![0]!, point);
  }

  /**
   * The same square, as the patch a scene stands on and the viewer draws.
   *
   * Measured once. A shot that spelled these corners out again would be a
   * second ground beside this one, and the second is the one that decides
   * pixels: the scene keeps the space a shot staged, and the viewer builds its
   * meshes from it. That is how a plaza corrected in the design record went on
   * drawing a floor a third the size of the group standing on it.
   *
   * @evidence models/040-plaza.md#plaza-world-composition Emits the same
   *   reviewed polygon for the floor a delivered scene draws.
   * @evidenceReview models/040-plaza.md#plaza-world-composition #96ea0f6 Read models/040-plaza.md#plaza-world-composition and patches in src/world/plaza.ts; confirmed this citation after checking the claim that emits the same reviewed polygon for the floor a delivered scene draws.
   * @evidence principles/core/source-units.md#source-scope-preservation PlazaGround.patches keeps responsibility for The same square, as the patch a scene stands on and the viewer draws in this declaration; the implementation fragment { const half = this.halfExtent(); return [ { id: this.id, kind: "floor", // Only 'x' and 'z' are read; the height comes from the anchor. polygon: [ { x: -half, y: 0, z: -half introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete PlazaGround.patches declaration and implementation with the reviewed PLAZA composition, extent, atmosphere, and review decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion PlazaGround.patches is a usable source artifact for The same square, as the patch a scene stands on and the viewer draws; it is implemented directly as { const half = this.halfExtent(); return [ { id: this.id, kind: "floor", // Only 'x' and 'z' are read; the height comes from the anchor. polygon: [ { x: -half, y: 0, z: -half rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable PlazaGround.patches signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing PlazaGround.patches tested the reviewed PLAZA composition, extent, atmosphere, and review decisions through The same square, as the patch a scene stands on and the viewer draws; the implementation fragment { const half = this.halfExtent(); return [ { id: this.id, kind: "floor", // Only 'x' and 'z' are read; the height comes from the anchor. polygon: [ { x: -half, y: 0, z: -half shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete PlazaGround.patches implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public patches(): readonly IAutoMovieSurface[] {
    const half = this.halfExtent();
    return [
      {
        id: this.id,
        kind: "floor",
        // Only `x` and `z` are read; the height comes from the anchor.
        polygon: [
          { x: -half, y: 0, z: -half },
          { x: half, y: 0, z: -half },
          { x: half, y: 0, z: half },
          { x: -half, y: 0, z: half },
        ],
        anchor: { x: 0, y: 0, z: 0 },
        rampTo: null,
      },
    ];
  }
}

/**
 * The named point the soloist steps to.
 *
 * A landmark exists so a shot contract can say where the gesture happened
 * without restating a coordinate, which is exactly why it is a subject with an
 * id rather than three numbers inside a shot.
 *
 * @evidence models/040-plaza.md Owns the reviewed ground-level origin marker
 *   that lets shots address `plaza-center` without copying its coordinates.
 * @evidenceReview models/040-plaza.md #b061784 Read models/040-plaza.md and PlazaCenterMark in src/world/plaza.ts; confirmed that the class owns the reviewed ground-level origin marker used by shots as `plaza-center`, while its H2 citation delimits the landmark subset it realizes.
 * @evidence models/040-plaza.md#plaza-world-composition Implements the reviewed
 *   named origin and its deterministic landmark record.
 * @evidenceReview models/040-plaza.md#plaza-world-composition #96ea0f6 Read models/040-plaza.md#plaza-world-composition and PlazaCenterMark in src/world/plaza.ts; confirmed this citation after checking the claim that implements the reviewed named origin and its deterministic landmark record.
 * @evidence principles/core/source-units.md#source-scope-preservation PlazaCenterMark keeps responsibility for The named point the soloist steps to in this declaration; the implementation fragment id, radius, place introduces no second creative owner.
 * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete PlazaCenterMark declaration and implementation with the reviewed PLAZA composition, extent, atmosphere, and review decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
 * @evidence principles/core/source-units.md#source-substantive-completion PlazaCenterMark is a usable source artifact for The named point the soloist steps to; it is implemented directly as id, radius, place rather than as a placeholder or future-work wrapper.
 * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable PlazaCenterMark signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
 * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing PlazaCenterMark tested the reviewed PLAZA composition, extent, atmosphere, and review decisions through The named point the soloist steps to; the implementation fragment id, radius, place shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
 * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete PlazaCenterMark implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
 */
export class PlazaCenterMark extends WorldPiece {
  /**
   * @evidence principles/core/source-units.md#source-scope-preservation PlazaCenterMark.id keeps responsibility for the readonly id value materialized by its initializer in this declaration; the implementation fragment "plaza-center" introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete PlazaCenterMark.id declaration and implementation with the reviewed PLAZA composition, extent, atmosphere, and review decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion PlazaCenterMark.id is a usable source artifact for the readonly id value materialized by its initializer; it is implemented directly as "plaza-center" rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable PlazaCenterMark.id signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing PlazaCenterMark.id tested the reviewed PLAZA composition, extent, atmosphere, and review decisions through the readonly id value materialized by its initializer; the implementation fragment "plaza-center" shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete PlazaCenterMark.id implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public readonly id = "plaza-center";

  /**
   * Readable radius around the marked point, in metres.
   * @evidence principles/core/source-units.md#source-scope-preservation PlazaCenterMark.radius keeps responsibility for Readable radius around the marked point, in metres in this declaration; the implementation fragment 3 introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete PlazaCenterMark.radius declaration and implementation with the reviewed PLAZA composition, extent, atmosphere, and review decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion PlazaCenterMark.radius is a usable source artifact for Readable radius around the marked point, in metres; it is implemented directly as 3 rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable PlazaCenterMark.radius signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing PlazaCenterMark.radius tested the reviewed PLAZA composition, extent, atmosphere, and review decisions through Readable radius around the marked point, in metres; the implementation fragment 3 shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete PlazaCenterMark.radius implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public readonly radius: number = 3;

  /**
   * @evidence principles/core/source-units.md#source-scope-preservation PlazaCenterMark.place keeps responsibility for the named place operation and its declared result in this declaration; the implementation fragment { return { landmarks: [ { id: this.id, position: { x: 0, y: 0, z: 0 }, radius: this.radius, meaning: "The readable center of the starter frame.", }, ], }; } introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete PlazaCenterMark.place declaration and implementation with the reviewed PLAZA composition, extent, atmosphere, and review decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion PlazaCenterMark.place is a usable source artifact for the named place operation and its declared result; it is implemented directly as { return { landmarks: [ { id: this.id, position: { x: 0, y: 0, z: 0 }, radius: this.radius, meaning: "The readable center of the starter frame.", }, ], }; } rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable PlazaCenterMark.place signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing PlazaCenterMark.place tested the reviewed PLAZA composition, extent, atmosphere, and review decisions through the named place operation and its declared result; the implementation fragment { return { landmarks: [ { id: this.id, position: { x: 0, y: 0, z: 0 }, radius: this.radius, meaning: "The readable center of the starter frame.", }, ], }; } shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete PlazaCenterMark.place implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public place(): IAutoMovieSubjectContribution {
    return {
      landmarks: [
        {
          id: this.id,
          position: { x: 0, y: 0, z: 0 },
          radius: this.radius,
          meaning: "The readable center of the starter frame.",
        },
      ],
    };
  }
}

/**
 * Drifting haze, and the region it drifts in.
 *
 * The recipe and the zone travel together because neither means anything alone:
 * a recipe nothing activates is dead configuration, and a zone with no recipe
 * has nothing to emit.
 *
 * @evidence models/040-plaza.md Owns the reviewed seeded smoke recipe and the
 *   bounded low-contrast PLAZA region that activates it.
 * @evidenceReview models/040-plaza.md #b061784 Read models/040-plaza.md and PlazaHaze in src/world/plaza.ts; confirmed that the class owns the reviewed seeded smoke recipe together with its bounded low-contrast PLAZA region, while its H2 citation delimits the atmosphere subset it realizes.
 * @evidence models/040-plaza.md#plaza-atmosphere-proxy Implements the one
 *   reviewed seeded smoke recipe and bounded low-contrast effect zone.
 * @evidenceReview models/040-plaza.md#plaza-atmosphere-proxy #30a801c Read models/040-plaza.md#plaza-atmosphere-proxy and PlazaHaze in src/world/plaza.ts; confirmed this citation after checking the claim that implements the one reviewed seeded smoke recipe and bounded low-contrast effect zone.
 * @evidence principles/core/source-units.md#source-scope-preservation PlazaHaze keeps responsibility for Drifting haze, and the region it drifts in in this declaration; the implementation fragment id, recipe, seed, place introduces no second creative owner.
 * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete PlazaHaze declaration and implementation with the reviewed PLAZA composition, extent, atmosphere, and review decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
 * @evidence principles/core/source-units.md#source-substantive-completion PlazaHaze is a usable source artifact for Drifting haze, and the region it drifts in; it is implemented directly as id, recipe, seed, place rather than as a placeholder or future-work wrapper.
 * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable PlazaHaze signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
 * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing PlazaHaze tested the reviewed PLAZA composition, extent, atmosphere, and review decisions through Drifting haze, and the region it drifts in; the implementation fragment id, recipe, seed, place shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
 * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete PlazaHaze implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
 */
export class PlazaHaze extends WorldPiece {
  /**
   * @evidence principles/core/source-units.md#source-scope-preservation PlazaHaze.id keeps responsibility for the readonly id value materialized by its initializer in this declaration; the implementation fragment "plaza-haze" introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete PlazaHaze.id declaration and implementation with the reviewed PLAZA composition, extent, atmosphere, and review decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion PlazaHaze.id is a usable source artifact for the readonly id value materialized by its initializer; it is implemented directly as "plaza-haze" rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable PlazaHaze.id signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing PlazaHaze.id tested the reviewed PLAZA composition, extent, atmosphere, and review decisions through the readonly id value materialized by its initializer; the implementation fragment "plaza-haze" shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete PlazaHaze.id implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public readonly id = "plaza-haze";

  /**
   * Recipe identity the zone activates.
   * @evidence principles/core/source-units.md#source-scope-preservation PlazaHaze.recipe keeps responsibility for Recipe identity the zone activates in this declaration; the implementation fragment "plaza-haze-smoke" introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete PlazaHaze.recipe declaration and implementation with the reviewed PLAZA composition, extent, atmosphere, and review decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion PlazaHaze.recipe is a usable source artifact for Recipe identity the zone activates; it is implemented directly as "plaza-haze-smoke" rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable PlazaHaze.recipe signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing PlazaHaze.recipe tested the reviewed PLAZA composition, extent, atmosphere, and review decisions through Recipe identity the zone activates; the implementation fragment "plaza-haze-smoke" shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete PlazaHaze.recipe implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public readonly recipe = "plaza-haze-smoke";

  /**
   * Deterministic seed for the emission, declared rather than drawn.
   * @evidence principles/core/source-units.md#source-scope-preservation PlazaHaze.seed keeps responsibility for Deterministic seed for the emission, declared rather than drawn in this declaration; the implementation fragment 1416 introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete PlazaHaze.seed declaration and implementation with the reviewed PLAZA composition, extent, atmosphere, and review decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion PlazaHaze.seed is a usable source artifact for Deterministic seed for the emission, declared rather than drawn; it is implemented directly as 1416 rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable PlazaHaze.seed signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing PlazaHaze.seed tested the reviewed PLAZA composition, extent, atmosphere, and review decisions through Deterministic seed for the emission, declared rather than drawn; the implementation fragment 1416 shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete PlazaHaze.seed implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public readonly seed: number = 1416;

  /**
   * @evidence principles/core/source-units.md#source-scope-preservation PlazaHaze.place keeps responsibility for the named place operation and its declared result in this declaration; the implementation fragment { return { effectRecipes: [ { id: this.recipe, kind: "smoke", seed: this.seed, emission: { rate: 40, burst: 64, duration: 4 }, particle: { lifetime: { min: 2, max: 4 }, size: { introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete PlazaHaze.place declaration and implementation with the reviewed PLAZA composition, extent, atmosphere, and review decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion PlazaHaze.place is a usable source artifact for the named place operation and its declared result; it is implemented directly as { return { effectRecipes: [ { id: this.recipe, kind: "smoke", seed: this.seed, emission: { rate: 40, burst: 64, duration: 4 }, particle: { lifetime: { min: 2, max: 4 }, size: { rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable PlazaHaze.place signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing PlazaHaze.place tested the reviewed PLAZA composition, extent, atmosphere, and review decisions through the named place operation and its declared result; the implementation fragment { return { effectRecipes: [ { id: this.recipe, kind: "smoke", seed: this.seed, emission: { rate: 40, burst: 64, duration: 4 }, particle: { lifetime: { min: 2, max: 4 }, size: { shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete PlazaHaze.place implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public place(): IAutoMovieSubjectContribution {
    return {
      effectRecipes: [
        {
          id: this.recipe,
          kind: "smoke",
          seed: this.seed,
          emission: { rate: 40, burst: 64, duration: 4 },
          particle: {
            lifetime: { min: 2, max: 4 },
            size: { min: 0.25, max: 0.8 },
            color: "#89918a",
            opacity: { min: 0.12, max: 0.38 },
          },
          motion: {
            wind: { x: 0.18, y: 0, z: -0.08 },
            rise: 0.2,
            turbulence: 0.15,
          },
          budget: { maxParticles: 256, lodDistance: 25 },
          blend: "alpha",
        },
      ],
      effectZones: [
        {
          id: this.id,
          recipe: this.recipe,
          bounds: {
            min: { x: -4, y: 0.05, z: -8 },
            max: { x: 4, y: 1.2, z: -2 },
          },
          seed: 7,
        },
      ],
    };
  }
}

/**
 * The plaza, as the one world this production stages on.
 *
 * The world is a group like any other: it holds pieces and is composed from
 * them. Its record is the merge of what its pieces place, so adding a step
 * means adding a piece rather than editing an array in the middle of a blob.
 *
 * @evidence models/040-plaza.md Owns the reviewed composition of level ground,
 *   centre landmark, bounded haze, and their shared world and surface records.
 * @evidenceReview models/040-plaza.md #b061784 Read models/040-plaza.md and Plaza in src/world/plaza.ts; confirmed that the class owns the reviewed composition of level ground, centre landmark, bounded haze, and their shared world and surface records without answering another model file.
 * @evidence models/040-plaza.md#plaza-world-composition Composes exactly the
 *   reviewed ground, origin marker, and atmosphere pieces into one world.
 * @evidenceReview models/040-plaza.md#plaza-world-composition #96ea0f6 Read models/040-plaza.md#plaza-world-composition and Plaza in src/world/plaza.ts; confirmed this citation after checking the claim that composes exactly the reviewed ground, origin marker, and atmosphere pieces into one world.
 * @evidence models/040-plaza.md#plaza-neutral-review-views Exposes the shared
 *   surface, bounds, and piece identities the neutral review set compares.
 * @evidenceReview models/040-plaza.md#plaza-neutral-review-views #a3be395 Read models/040-plaza.md#plaza-neutral-review-views and Plaza in src/world/plaza.ts; confirmed this citation after checking the claim that exposes the shared surface, bounds, and piece identities the neutral review set compares.
 * @evidence obligations/design/model-sources.md#design-owned-construction Adds no world
 *   piece or spatial relation outside the cited design.
 * @evidenceReview obligations/design/model-sources.md#design-owned-construction #ffa6690 Read obligations/design/model-sources.md#design-owned-construction and Plaza in src/world/plaza.ts; confirmed this citation after checking the claim that adds no world piece or spatial relation outside the cited design.
 * @evidence obligations/design/model-sources.md#deterministic-build Merges the same
 *   ordered piece contributions into the same world record.
 * @evidenceReview obligations/design/model-sources.md#deterministic-build #27790fe Read obligations/design/model-sources.md#deterministic-build and Plaza in src/world/plaza.ts; confirmed this citation after checking the claim that merges the same ordered piece contributions into the same world record.
 * @evidence obligations/design/model-sources.md#unsupported-fidelity-is-explicit Keeps
 *   enclosure and physically based atmosphere outside this blocking model.
 * @evidenceReview obligations/design/model-sources.md#unsupported-fidelity-is-explicit #15c03fa Read obligations/design/model-sources.md#unsupported-fidelity-is-explicit and Plaza in src/world/plaza.ts; confirmed this citation after checking the claim that keeps enclosure and physically based atmosphere outside this blocking model.
 * @evidence principles/core/source-units.md#source-scope-preservation Plaza keeps responsibility for The plaza, as the one world this production stages on in this declaration; the implementation fragment id, ground, mark, haze, members, space, design introduces no second creative owner.
 * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete Plaza declaration and implementation with the reviewed PLAZA composition, extent, atmosphere, and review decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
 * @evidence principles/core/source-units.md#source-substantive-completion Plaza is a usable source artifact for The plaza, as the one world this production stages on; it is implemented directly as id, ground, mark, haze, members, space, design rather than as a placeholder or future-work wrapper.
 * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable Plaza signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
 * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing Plaza tested the reviewed PLAZA composition, extent, atmosphere, and review decisions through The plaza, as the one world this production stages on; the implementation fragment id, ground, mark, haze, members, space, design shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
 * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete Plaza implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
 */
export class Plaza extends AutoMovieSubjectGroup<
  IAutoMovieWorldDesign,
  WorldPiece
> {
  /**
   * @evidence principles/core/source-units.md#source-scope-preservation Plaza.id keeps responsibility for the readonly id value materialized by its initializer in this declaration; the implementation fragment "starter-world" introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete Plaza.id declaration and implementation with the reviewed PLAZA composition, extent, atmosphere, and review decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion Plaza.id is a usable source artifact for the readonly id value materialized by its initializer; it is implemented directly as "starter-world" rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable Plaza.id signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing Plaza.id tested the reviewed PLAZA composition, extent, atmosphere, and review decisions through the readonly id value materialized by its initializer; the implementation fragment "starter-world" shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete Plaza.id implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public readonly id = "starter-world";

  /**
   * The ground, its named point, and the haze that drifts over it.
   * @evidence principles/core/source-units.md#source-scope-preservation Plaza.ground keeps responsibility for The ground, its named point, and the haze that drifts over it in this declaration; the implementation fragment new PlazaGround() introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete Plaza.ground declaration and implementation with the reviewed PLAZA composition, extent, atmosphere, and review decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion Plaza.ground is a usable source artifact for The ground, its named point, and the haze that drifts over it; it is implemented directly as new PlazaGround() rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable Plaza.ground signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing Plaza.ground tested the reviewed PLAZA composition, extent, atmosphere, and review decisions through The ground, its named point, and the haze that drifts over it; the implementation fragment new PlazaGround() shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete Plaza.ground implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public readonly ground = new PlazaGround();
  /**
   * @evidence principles/core/source-units.md#source-scope-preservation Plaza.mark keeps responsibility for the readonly mark value materialized by its initializer in this declaration; the implementation fragment new PlazaCenterMark() introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete Plaza.mark declaration and implementation with the reviewed PLAZA composition, extent, atmosphere, and review decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion Plaza.mark is a usable source artifact for the readonly mark value materialized by its initializer; it is implemented directly as new PlazaCenterMark() rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable Plaza.mark signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing Plaza.mark tested the reviewed PLAZA composition, extent, atmosphere, and review decisions through the readonly mark value materialized by its initializer; the implementation fragment new PlazaCenterMark() shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete Plaza.mark implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public readonly mark = new PlazaCenterMark();
  /**
   * @evidence principles/core/source-units.md#source-scope-preservation Plaza.haze keeps responsibility for the readonly haze value materialized by its initializer in this declaration; the implementation fragment new PlazaHaze() introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete Plaza.haze declaration and implementation with the reviewed PLAZA composition, extent, atmosphere, and review decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion Plaza.haze is a usable source artifact for the readonly haze value materialized by its initializer; it is implemented directly as new PlazaHaze() rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable Plaza.haze signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing Plaza.haze tested the reviewed PLAZA composition, extent, atmosphere, and review decisions through the readonly haze value materialized by its initializer; the implementation fragment new PlazaHaze() shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete Plaza.haze implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public readonly haze = new PlazaHaze();

  /**
   * @evidence principles/core/source-units.md#source-scope-preservation Plaza.members keeps responsibility for the named members operation and its declared result in this declaration; the implementation fragment { return [this.ground, this.mark, this.haze]; } introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete Plaza.members declaration and implementation with the reviewed PLAZA composition, extent, atmosphere, and review decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion Plaza.members is a usable source artifact for the named members operation and its declared result; it is implemented directly as { return [this.ground, this.mark, this.haze]; } rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable Plaza.members signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing Plaza.members tested the reviewed PLAZA composition, extent, atmosphere, and review decisions through the named members operation and its declared result; the implementation fragment { return [this.ground, this.mark, this.haze]; } shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete Plaza.members implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public members(): readonly WorldPiece[] {
    return [this.ground, this.mark, this.haze];
  }

  /**
   * The space a shot stages, composed from the pieces that are ground.
   *
   * A shot names the world and stands on it rather than restating its corners.
   * Everything a piece calls a patch is walkable here, because this world has
   * no standable-but-forbidden top; a world that grows one states it where the
   * piece is defined rather than here.
   *
   * @evidence models/040-plaza.md#plaza-world-composition Composes the reviewed
   *   ground patches into the one staged space.
   * @evidenceReview models/040-plaza.md#plaza-world-composition #96ea0f6 Read models/040-plaza.md#plaza-world-composition and space in src/world/plaza.ts; confirmed this citation after checking the claim that composes the reviewed ground patches into the one staged space.
   * @evidence principles/core/source-units.md#source-scope-preservation Plaza.space keeps responsibility for The space a shot stages, composed from the pieces that are ground in this declaration; the implementation fragment { const surfaces = this.members().flatMap((piece) => [...piece.patches()]); return { id: '${this.id}-space', surfaces, walkable: surfaces.map((surface) => surface.id), }; } introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete Plaza.space declaration and implementation with the reviewed PLAZA composition, extent, atmosphere, and review decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion Plaza.space is a usable source artifact for The space a shot stages, composed from the pieces that are ground; it is implemented directly as { const surfaces = this.members().flatMap((piece) => [...piece.patches()]); return { id: '${this.id}-space', surfaces, walkable: surfaces.map((surface) => surface.id), }; } rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable Plaza.space signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing Plaza.space tested the reviewed PLAZA composition, extent, atmosphere, and review decisions through The space a shot stages, composed from the pieces that are ground; the implementation fragment { const surfaces = this.members().flatMap((piece) => [...piece.patches()]); return { id: '${this.id}-space', surfaces, walkable: surfaces.map((surface) => surface.id), }; } shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete Plaza.space implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public space(): IAutoMovieSpace {
    const surfaces = this.members().flatMap((piece) => [...piece.patches()]);
    return {
      id: `${this.id}-space`,
      surfaces,
      walkable: surfaces.map((surface) => surface.id),
    };
  }

  /**
   * The world record, assembled from what its pieces place.
   *
   * @evidence models/040-plaza.md#plaza-world-composition Composes the reviewed
   *   surface, landmark, instance, and effect records without transcribing them.
   * @evidenceReview models/040-plaza.md#plaza-world-composition #96ea0f6 Read models/040-plaza.md#plaza-world-composition and design in src/world/plaza.ts; confirmed this citation after checking the claim that composes the reviewed surface, landmark, instance, and effect records without transcribing them.
   * @evidence principles/core/source-units.md#source-scope-preservation Plaza.design keeps responsibility for The world record, assembled from what its pieces place in this declaration; the implementation fragment { const placed = mergeAutoMovieSubjectContributions( this.members().map((piece) => piece.place()), ); return { id: this.id, units: "meter", landmarks: [...(placed.landmarks ?? introduces no second creative owner.
   * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete Plaza.design declaration and implementation with the reviewed PLAZA composition, extent, atmosphere, and review decisions; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
   * @evidence principles/core/source-units.md#source-substantive-completion Plaza.design is a usable source artifact for The world record, assembled from what its pieces place; it is implemented directly as { const placed = mergeAutoMovieSubjectContributions( this.members().map((piece) => piece.place()), ); return { id: this.id, units: "meter", landmarks: [...(placed.landmarks ?? rather than as a placeholder or future-work wrapper.
   * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable Plaza.design signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
   * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing Plaza.design tested the reviewed PLAZA composition, extent, atmosphere, and review decisions through The world record, assembled from what its pieces place; the implementation fragment { const placed = mergeAutoMovieSubjectContributions( this.members().map((piece) => piece.place()), ); return { id: this.id, units: "meter", landmarks: [...(placed.landmarks ?? shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
   * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared the complete Plaza.design implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
   */
  public design(): IAutoMovieWorldDesign {
    const placed = mergeAutoMovieSubjectContributions(
      this.members().map((piece) => piece.place()),
    );
    return {
      id: this.id,
      units: "meter",
      landmarks: [...(placed.landmarks ?? [])],
      surfaces: [...(placed.surfaces ?? [])],
      routes: [...(placed.routes ?? [])],
      effectRecipes: [...(placed.effectRecipes ?? [])],
      effectZones: [...(placed.effectZones ?? [])],
      // A piece that places a population (a row of planters, a set of markers)
      // must reach the record. Omitting the key would drop what the piece
      // placed without saying so, which is worse than refusing it.
      ...(placed.instanceSets === undefined
        ? {}
        : { instanceSets: [...placed.instanceSets] }),
    };
  }
}

/**
 * The production's one world.
 *
 * Carries the citation for the plaza and every piece standing on it, until a
 * class can carry its own (samchon/ttsc#1121).
 *
 * @evidence models/040-plaza.md#plaza-world-composition Instantiates the
 *   reviewed complete world once.
 * @evidenceReview models/040-plaza.md#plaza-world-composition #96ea0f6 Read models/040-plaza.md#plaza-world-composition and plaza in src/world/plaza.ts; confirmed this citation after checking the claim that instantiates the reviewed complete world once.
 * @evidence principles/core/source-units.md#source-scope-preservation plaza keeps responsibility for the exported plaza source owner and its declared value or behavior in this declaration; the implementation fragment new Plaza() introduces no second creative owner.
 * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared this exported binding with the reviewed PLAZA responsibility: it constructs `Plaza` once with no arguments and adds no composition, extent, or atmosphere decision of its own, so its scope is exactly the identity of the one world instance every other unit composes against.
 * @evidence principles/core/source-units.md#source-substantive-completion plaza is a usable source artifact for the exported plaza source owner and its declared value or behavior; it is implemented directly as new Plaza() rather than as a placeholder or future-work wrapper.
 * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced what a consumer actually receives from this binding: one fully constructed `Plaza` whose ground, landmark, and seeded haze owners are already assembled at the declaration, so a consumer obtains the composed world without invoking a builder or choosing a second origin.
 * @evidenceExclude upstream/design/model-sources.md#design-revision-from-model-source-work Implementing plaza tested the reviewed PLAZA composition, extent, atmosphere, and review decisions through the exported plaza source owner and its declared value or behavior; the implementation fragment new Plaza() shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
 * @evidenceExcludeReview upstream/design/model-sources.md#design-revision-from-model-source-work #508dfbe I compared this binding with its reviewed parent: constructing one instance introduces no extent, atmosphere, or origin decision the model design did not already settle, so the binding leaves the parent decision nothing to repair.
 */
export const plaza = new Plaza();
