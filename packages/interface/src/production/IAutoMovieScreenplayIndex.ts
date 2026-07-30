/**
 * One downstream citation of an authored screenplay scene.
 *
 * The reason comes first because traceability starts with why the consumer
 * needs evidence; {@link scene} then names the stable locked production fact. A
 * continuity claim may be cited as additional traceability, but only its
 * declared verification owner can prove it.
 */
export interface IAutoMovieSceneEvidence {
  /** Why this downstream record depends on the cited scene. */
  reason: string;
  /** Existing screenplay scene id. */
  scene: string;
  /** Existing continuity claim id, or null when no canon claim is cited. */
  claim?: string;
}

/** One exact prose beat promised by the treatment. */
export interface IAutoMovieTreatmentBeat {
  /** Stable beat id used for diagnosis and human navigation. */
  id: string;
  /**
   * Exact non-blank prose copied by a scene's `covers` entry.
   *
   * Verbatim matching keeps the machine layer from pretending that a nearby
   * label proves the dramatic promise was actually carried forward.
   */
  text: string;
}

/** One ordered treatment sequence and its causal beat promises. */
export interface IAutoMovieTreatmentSequence {
  /** Stable sequence id. */
  id: string;
  /** Human-readable sequence title. */
  title: string;
  /** Ordered beats the screenplay must cover. */
  beats: IAutoMovieTreatmentBeat[];
}

/** One treatment beat cited verbatim by a screenplay scene. */
export interface IAutoMovieSceneBeatCoverage {
  /** Why this scene is responsible for the cited dramatic beat. */
  reason: string;
  /** Exact {@link IAutoMovieTreatmentBeat.text} value. */
  beat: string;
}

/** Explicit scene omission in a phase-local coverage ledger. */
export interface IAutoMovieSceneDisposition {
  /** Workflow phase whose output intentionally omits the scene. */
  phase: "screenplay" | "production" | "edit";
  /** Auditable reason the scene does not require a realized shot in this phase. */
  reason: string;
}

/** One indexed screenplay scene whose prose remains in Markdown. */
export interface IAutoMovieScreenplayScene {
  /**
   * Stable scene number, such as `SCN-010`.
   *
   * After lock, inserted scenes use the `SCN-A11` form and existing ids remain
   * forever addressable.
   */
  id: string;
  /** Human title following the exact id token in the Markdown heading. */
  title: string;
  /** Active prose scene or retained deletion tombstone. */
  status: "active" | "OMITTED";
  /** Exact treatment promises this scene realizes. */
  covers: IAutoMovieSceneBeatCoverage[];
  /** Existing location catalog id for an active scene. */
  location: string | null;
  /** Explicit local exemption from shot realization, or null when required. */
  disposition: IAutoMovieSceneDisposition | null;
}

/** Stable lock ledger retained after shooting-oriented downstream work starts. */
export interface IAutoMovieScreenplayLock {
  /** Actor that intentionally activated the soft lock. */
  activatedBy: "user" | "agent-before-first-shot";
  /** Why stable numbering is now required by downstream work. */
  reason: string;
  /**
   * Every scene id present when locked.
   *
   * Entries never disappear. Deleted scenes remain as `OMITTED` scene records;
   * newly inserted scenes use the alpha-prefixed insertion form.
   */
  sceneIds: string[];
}

/** One discovered character, faction, or location grounded in scene evidence. */
export interface IAutoMovieScreenplayCatalogEntry {
  /** Stable catalog identity consumed by downstream design. */
  id: string;
  /** Human-readable canonical name. */
  name: string;
  /** At least one authored scene proving this subject exists in the film. */
  evidence: IAutoMovieSceneEvidence[];
}

/** One canon fact and the only evidence family allowed to prove it. */
export interface IAutoMovieContinuityClaim {
  /** Stable claim identity cited by downstream evidence. */
  id: string;
  /** Human-readable canon fact, such as handedness or persistent weather. */
  text: string;
  /** Evidence family that alone can discharge this claim. */
  verification: "frame-review" | "geometry" | "acceptance";
  /** Authored scenes in which the canon fact must hold. */
  evidence: IAutoMovieSceneEvidence[];
}

/**
 * Machine index beside production-owned treatment and screenplay prose.
 *
 * Markdown remains the human-authored source. This record owns only stable
 * identity, exact coverage, lock history, catalogs and traceability facts that
 * project lint can compare without judging dramatic quality.
 */
export interface IAutoMovieScreenplayIndex {
  /** Screenplay-index format. */
  version: 1;
  /** Exact active production id. */
  production: string;
  /** Project-relative Markdown treatment path. */
  treatment: {
    /** Human-owned treatment document. */
    path: string;
    /** Ordered sequence and beat promises indexed from that document. */
    sequences: IAutoMovieTreatmentSequence[];
  };
  /** Project-relative Markdown screenplay and its stable scene ledger. */
  screenplay: {
    /** Human-owned screenplay document. */
    path: string;
    /** Null before lock, otherwise the permanent scene-number ledger. */
    lock: IAutoMovieScreenplayLock | null;
    /** Ordered active scenes and `OMITTED` tombstones. */
    scenes: IAutoMovieScreenplayScene[];
  };
  /** Discovered story identities grounded in authored scene evidence. */
  catalog: {
    /** Characters, independent of model or rig convenience. */
    characters: IAutoMovieScreenplayCatalogEntry[];
    /** Story factions or forces. */
    factions: IAutoMovieScreenplayCatalogEntry[];
    /** Canonical story locations. */
    locations: IAutoMovieScreenplayCatalogEntry[];
  };
  /** Canon facts with exactly one proof owner each. */
  continuity: IAutoMovieContinuityClaim[];
}
