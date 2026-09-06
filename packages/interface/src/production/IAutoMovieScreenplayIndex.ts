/**
 * One downstream citation of an authored screenplay scene.
 *
 * The reason comes first because traceability starts with why the consumer
 * needs evidence; {@link scene} then names the stable locked production fact. A
 * continuity claim may be cited as additional traceability, but only its
 * declared verification owner can prove it.
 *
 * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `IAutoMovieSceneEvidence` as the portable data boundary for the story screenplay index prose requirement.
 * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `IAutoMovieSceneEvidence` for the narrative intent scene prose index system contract.
 */
export interface IAutoMovieSceneEvidence {
  /**
   * Why this downstream record depends on the cited scene.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `reason` as the portable data boundary for the story screenplay index prose requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `reason` for the narrative intent scene prose index system contract.
   */
  reason: string;
  /**
   * Existing screenplay scene id.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `scene` as the portable data boundary for the story screenplay index prose requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `scene` for the narrative intent scene prose index system contract.
   */
  scene: string;
  /**
   * Existing continuity claim id, or null when no canon claim is cited.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `claim` as the portable data boundary for the story screenplay index prose requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `claim` for the narrative intent scene prose index system contract.
   */
  claim?: string;
}

/**
 * One exact prose beat promised by the treatment.
 *
 * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `IAutoMovieTreatmentBeat` as the portable data boundary for the story screenplay index prose requirement.
 * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `IAutoMovieTreatmentBeat` for the narrative intent scene prose index system contract.
 */
export interface IAutoMovieTreatmentBeat {
  /**
   * Stable beat id used for diagnosis and human navigation.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `id` as the portable data boundary for the story screenplay index prose requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `id` for the narrative intent scene prose index system contract.
   */
  id: string;
  /**
   * Exact non-blank prose copied by a scene's `covers` entry.
   *
   * Verbatim matching keeps the machine layer from pretending that a nearby
   * label proves the dramatic promise was actually carried forward.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `text` as the portable data boundary for the story screenplay index prose requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `text` for the narrative intent scene prose index system contract.
   */
  text: string;
}

/**
 * One ordered treatment sequence and its causal beat promises.
 *
 * @evidence requirements/story/treatment-and-sequences.md#story-treatment-coverage Exposes `IAutoMovieTreatmentSequence` as the portable data boundary for the story treatment coverage requirement.
 * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-sequence-refinement Types `IAutoMovieTreatmentSequence` for the narrative intent sequence refinement system contract.
 */
export interface IAutoMovieTreatmentSequence {
  /**
   * Stable sequence id.
   *
   * @evidence requirements/story/treatment-and-sequences.md#story-treatment-coverage Exposes `id` as the portable data boundary for the story treatment coverage requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-sequence-refinement Types `id` for the narrative intent sequence refinement system contract.
   */
  id: string;
  /**
   * Human-readable sequence title.
   *
   * @evidence requirements/story/treatment-and-sequences.md#story-treatment-coverage Exposes `title` as the portable data boundary for the story treatment coverage requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-sequence-refinement Types `title` for the narrative intent sequence refinement system contract.
   */
  title: string;
  /**
   * Project-relative document holding this sequence's prose, when the treatment
   * is split one file per sequence.
   *
   * Omit it while the treatment is a single document; the index's
   * `treatment.path` is then the address, exactly as before. A split layout
   * needs a per-unit address because a folder is only a population of units if
   * each unit is its own file, and the beats of a later sequence are not in the
   * first sequence's file.
   *
   * @evidence requirements/story/treatment-and-sequences.md#story-treatment-coverage Exposes `path` as the portable data boundary for the story treatment coverage requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-sequence-refinement Types `path` for the narrative intent sequence refinement system contract.
   */
  path?: string;
  /**
   * Ordered beats the screenplay must cover.
   *
   * @evidence requirements/story/treatment-and-sequences.md#story-treatment-coverage Exposes `beats` as the portable data boundary for the story treatment coverage requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-sequence-refinement Types `beats` for the narrative intent sequence refinement system contract.
   */
  beats: IAutoMovieTreatmentBeat[];
}

/**
 * One treatment beat cited verbatim by a screenplay scene.
 *
 * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `IAutoMovieSceneBeatCoverage` as the portable data boundary for the story screenplay index prose requirement.
 * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `IAutoMovieSceneBeatCoverage` for the narrative intent scene prose index system contract.
 */
export interface IAutoMovieSceneBeatCoverage {
  /**
   * Stable {@link IAutoMovieTreatmentBeat.id} carried by this scene.
   *
   * Identity, rather than coincidentally equal prose, keeps a beat in the
   * scene that owns it when two scenes use similar words.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes the exact treatment-beat join that authoritative scene prose must carry.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types the stable beat identity compared with the prose authority carrier.
   */
  id: string;
  /**
   * Why this scene is responsible for the cited dramatic beat.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `reason` as the portable data boundary for the story screenplay index prose requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `reason` for the narrative intent scene prose index system contract.
   */
  reason: string;
  /**
   * Exact {@link IAutoMovieTreatmentBeat.text} value.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `beat` as the portable data boundary for the story screenplay index prose requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `beat` for the narrative intent scene prose index system contract.
   */
  beat: string;
}

/**
 * Explicit scene omission in a phase-local coverage ledger.
 *
 * @evidence requirements/story/scenes-and-observable-action.md#story-scene-local-arc Exposes `IAutoMovieSceneDisposition` as the portable data boundary for the story scene local arc requirement.
 * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `IAutoMovieSceneDisposition` for the narrative intent scene prose index system contract.
 */
export interface IAutoMovieSceneDisposition {
  /**
   * Workflow phase whose output intentionally omits the scene.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-scene-local-arc Exposes `phase` as the portable data boundary for the story scene local arc requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `phase` for the narrative intent scene prose index system contract.
   */
  phase: "screenplay" | "production" | "edit";
  /**
   * Auditable reason the scene does not require a realized shot in this phase.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-scene-local-arc Exposes `reason` as the portable data boundary for the story scene local arc requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `reason` for the narrative intent scene prose index system contract.
   */
  reason: string;
}

/**
 * Closed participation modes a screenplay scene may declare.
 *
 * A cast entry is not automatically an on-screen performer. The mode keeps
 * presence, speech, crowds, objects, environmental agency and reference-only
 * mentions distinct without asking the compiler to infer prose.
 *
 * @evidence requirements/story/scenes-and-observable-action.md#story-scene-participant-modes Preserves every promised way a subject can participate in one scene.
 * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types the closed participant vocabulary used by the prose authority join.
 * @author Samchon
 */
export type AutoMovieScreenplayParticipantMode =
  | "on-screen"
  | "off-screen"
  | "crowd"
  | "object"
  | "environmental"
  | "referenced";

/**
 * One stable story identity participating in one screenplay scene.
 *
 * @evidence requirements/story/scenes-and-observable-action.md#story-scene-participant-modes Separates stable participant identity from its scene-local mode.
 * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types the exact participant pair compared between index and prose.
 * @author Samchon
 */
export interface IAutoMovieScreenplayParticipant {
  /** Stable character, faction, object or environmental identity. */
  id: string;
  /** How that identity participates in this exact scene. */
  mode: AutoMovieScreenplayParticipantMode;
}

/**
 * One indexed screenplay scene whose prose remains in Markdown.
 *
 * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `IAutoMovieScreenplayScene` as the portable data boundary for the story screenplay index prose requirement.
 * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `IAutoMovieScreenplayScene` for the narrative intent scene prose index system contract.
 */
export interface IAutoMovieScreenplayScene {
  /**
   * Stable scene number, such as `SCN-010`.
   *
   * After lock, inserted scenes use the `SCN-A11` form and existing ids remain
   * forever addressable.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `id` as the portable data boundary for the story screenplay index prose requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `id` for the narrative intent scene prose index system contract.
   */
  id: string;
  /**
   * Human title following the exact id token in the Markdown heading.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `title` as the portable data boundary for the story screenplay index prose requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `title` for the narrative intent scene prose index system contract.
   */
  title: string;
  /**
   * Active prose scene or retained deletion tombstone.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `status` as the portable data boundary for the story screenplay index prose requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `status` for the narrative intent scene prose index system contract.
   */
  status: "active" | "OMITTED";
  /**
   * Project-relative document holding this scene's prose, when the screenplay
   * is split one file per scene.
   *
   * Omit it while the screenplay is a single document; the index's
   * `screenplay.path` is then the address. An `OMITTED` tombstone has no prose
   * to hold, so it carries no path either.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `path` as the portable data boundary for the story screenplay index prose requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `path` for the narrative intent scene prose index system contract.
   */
  path?: string;
  /**
   * Exact treatment promises this scene realizes.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `covers` as the portable data boundary for the story screenplay index prose requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `covers` for the narrative intent scene prose index system contract.
   */
  covers: IAutoMovieSceneBeatCoverage[];
  /**
   * Existing location catalog id for an active scene.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `location` as the portable data boundary for the story screenplay index prose requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `location` for the narrative intent scene prose index system contract.
   */
  location: string | null;
  /**
   * Exact story-time identity stated by the authoritative prose carrier.
   *
   * Use `unknown` when the story deliberately leaves the time unresolved. An
   * absent carrier is different from that explicit state and is refused.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-scene-place-time Exposes the exact story-time identity shared with authoritative prose.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types the story-time half of the scene authority join.
   */
  storyTime: string;
  /**
   * Exact scene-local participant identities and modes.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-scene-participant-modes Exposes participation without inferring it from a global cast list.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types the participant set compared with the bounded prose carrier.
   */
  participants: IAutoMovieScreenplayParticipant[];
  /**
   * Explicit local exemption from shot realization, or null when required.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `disposition` as the portable data boundary for the story screenplay index prose requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `disposition` for the narrative intent scene prose index system contract.
   */
  disposition: IAutoMovieSceneDisposition | null;
}

/**
 * Stable lock ledger retained after shooting-oriented downstream work starts.
 *
 * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `IAutoMovieScreenplayLock` as the portable data boundary for the story screenplay index prose requirement.
 * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `IAutoMovieScreenplayLock` for the narrative intent scene prose index system contract.
 */
export interface IAutoMovieScreenplayLock {
  /**
   * Actor that intentionally activated the soft lock.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `activatedBy` as the portable data boundary for the story screenplay index prose requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `activatedBy` for the narrative intent scene prose index system contract.
   */
  activatedBy: "user" | "agent-before-first-shot";
  /**
   * Why stable numbering is now required by downstream work.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `reason` as the portable data boundary for the story screenplay index prose requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `reason` for the narrative intent scene prose index system contract.
   */
  reason: string;
  /**
   * Every scene id present when locked.
   *
   * Entries never disappear. Deleted scenes remain as `OMITTED` scene records;
   * newly inserted scenes use the alpha-prefixed insertion form.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `sceneIds` as the portable data boundary for the story screenplay index prose requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `sceneIds` for the narrative intent scene prose index system contract.
   */
  sceneIds: string[];
}

/**
 * One discovered character, faction, or location grounded in scene evidence.
 *
 * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `IAutoMovieScreenplayCatalogEntry` as the portable data boundary for the story screenplay index prose requirement.
 * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `IAutoMovieScreenplayCatalogEntry` for the narrative intent scene prose index system contract.
 */
export interface IAutoMovieScreenplayCatalogEntry {
  /**
   * Stable catalog identity consumed by downstream design.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `id` as the portable data boundary for the story screenplay index prose requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `id` for the narrative intent scene prose index system contract.
   */
  id: string;
  /**
   * Human-readable canonical name.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `name` as the portable data boundary for the story screenplay index prose requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `name` for the narrative intent scene prose index system contract.
   */
  name: string;
  /**
   * At least one authored scene proving this subject exists in the film.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `evidence` as the portable data boundary for the story screenplay index prose requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `evidence` for the narrative intent scene prose index system contract.
   */
  evidence: IAutoMovieSceneEvidence[];
  /**
   * Production-scoped joins to shared downstream design.
   *
   * Character entries bind model recipes, faction entries bind formations, and
   * location entries bind world landmarks. Keeping these joins in the
   * screenplay index lets two productions cast the same shared design
   * differently.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `bindings` as the portable data boundary for the story screenplay index prose requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `bindings` for the narrative intent scene prose index system contract.
   */
  bindings: Array<{
    /** Downstream design family allowed by this catalog section. */
    kind: "model" | "formation" | "world-landmark";
    /** Existing shared design identity. */
    id: string;
  }>;
}

/**
 * Exact evidence owner and selector that alone may prove a continuity claim.
 *
 * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `IAutoMovieContinuityProof` as the portable data boundary for the story screenplay index prose requirement.
 * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `IAutoMovieContinuityProof` for the narrative intent scene prose index system contract.
 */
export type IAutoMovieContinuityProof =
  | {
      /** Compiler-measured named contract outcome. */
      owner: "geometry";
      /** Exact shot carrying the named outcome. */
      shot: string;
      /** Claim-specific realization selector. */
      outcome: {
        /** Compiler realization family with stable ids. */
        kind: "opening" | "closing" | "event" | "formation";
        /** Exact state, event, or formation id. */
        id: string;
      };
    }
  | {
      /** Actual-frame acceptance observed by a current shot/film review. */
      owner: "frame-review";
      /** Exact frame acceptance scenario. */
      scenario: string;
    }
  | {
      /** Current required acceptance outcome observed by shot/film review. */
      owner: "acceptance";
      /** Exact acceptance scenario. */
      scenario: string;
    };

/**
 * One canon fact and the only evidence family allowed to prove it.
 *
 * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `IAutoMovieContinuityClaim` as the portable data boundary for the story screenplay index prose requirement.
 * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `IAutoMovieContinuityClaim` for the narrative intent scene prose index system contract.
 */
export interface IAutoMovieContinuityClaim {
  /**
   * Stable claim identity cited by downstream evidence.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `id` as the portable data boundary for the story screenplay index prose requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `id` for the narrative intent scene prose index system contract.
   */
  id: string;
  /**
   * Human-readable canon fact, such as handedness or persistent weather.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `text` as the portable data boundary for the story screenplay index prose requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `text` for the narrative intent scene prose index system contract.
   */
  text: string;
  /**
   * Evidence family that alone can discharge this claim.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `verification` as the portable data boundary for the story screenplay index prose requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `verification` for the narrative intent scene prose index system contract.
   */
  verification: "frame-review" | "geometry" | "acceptance";
  /**
   * Exact claim-specific evidence selected inside that family.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `proof` as the portable data boundary for the story screenplay index prose requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `proof` for the narrative intent scene prose index system contract.
   */
  proof: IAutoMovieContinuityProof;
  /**
   * Authored scenes in which the canon fact must hold.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `evidence` as the portable data boundary for the story screenplay index prose requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `evidence` for the narrative intent scene prose index system contract.
   */
  evidence: IAutoMovieSceneEvidence[];
}

/**
 * Machine index beside production-owned treatment and screenplay prose.
 *
 * Markdown remains the human-authored source. This record owns only stable
 * identity, exact coverage, lock history, catalogs and traceability facts that
 * project lint can compare without judging dramatic quality.
 *
 * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `IAutoMovieScreenplayIndex` as the portable data boundary for the story screenplay index prose requirement.
 * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `IAutoMovieScreenplayIndex` for the narrative intent scene prose index system contract.
 */
export interface IAutoMovieScreenplayIndex {
  /**
   * Screenplay-index format.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `version` as the portable data boundary for the story screenplay index prose requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `version` for the narrative intent scene prose index system contract.
   */
  version: 2;
  /**
   * Exact active production id.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `production` as the portable data boundary for the story screenplay index prose requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `production` for the narrative intent scene prose index system contract.
   */
  production: string;
  /**
   * Project-relative Markdown treatment path.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `treatment` as the portable data boundary for the story screenplay index prose requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `treatment` for the narrative intent scene prose index system contract.
   */
  treatment: {
    /** Human-owned treatment document. */
    path: string;
    /** Ordered sequence and beat promises indexed from that document. */
    sequences: IAutoMovieTreatmentSequence[];
  };
  /**
   * Project-relative Markdown screenplay and its stable scene ledger.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `screenplay` as the portable data boundary for the story screenplay index prose requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `screenplay` for the narrative intent scene prose index system contract.
   */
  screenplay: {
    /** Human-owned screenplay document. */
    path: string;
    /** Null before lock, otherwise the permanent scene-number ledger. */
    lock: IAutoMovieScreenplayLock | null;
    /** Ordered active scenes and `OMITTED` tombstones. */
    scenes: IAutoMovieScreenplayScene[];
  };
  /**
   * Discovered story identities grounded in authored scene evidence.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `catalog` as the portable data boundary for the story screenplay index prose requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `catalog` for the narrative intent scene prose index system contract.
   */
  catalog: {
    /** Characters, independent of model or rig convenience. */
    characters: IAutoMovieScreenplayCatalogEntry[];
    /** Story factions or forces. */
    factions: IAutoMovieScreenplayCatalogEntry[];
    /** Canonical story locations. */
    locations: IAutoMovieScreenplayCatalogEntry[];
  };
  /**
   * Canon facts with exactly one proof owner each.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Exposes `continuity` as the portable data boundary for the story screenplay index prose requirement.
   * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `continuity` for the narrative intent scene prose index system contract.
   */
  continuity: IAutoMovieContinuityClaim[];
}
