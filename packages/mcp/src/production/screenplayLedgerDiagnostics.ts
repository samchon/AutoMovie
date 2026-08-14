import type {
  AutoMovieDiagnosticCode,
  IAutoMovieAcceptanceScenario,
  IAutoMovieDiagnostic,
  IAutoMovieScreenplayCatalogEntry,
  IAutoMovieScreenplayIndex,
  IAutoMovieShotContract,
} from "@automovie/interface";

/**
 * A canonical scene number, before or after lock.
 *
 * `SCN-010` is the pre-lock form. After lock an existing number may never
 * shift, so an inserted scene takes the alpha form `SCN-A11`, which orders
 * between its neighbours without renumbering either of them.
 */
const NUMERIC_SCENE_ID = /^SCN-[0-9]+$/u;
const INSERTED_SCENE_ID = /^SCN-[A-Z]+[0-9]+$/u;

const canonicalSceneId = (id: string): boolean =>
  NUMERIC_SCENE_ID.test(id) || INSERTED_SCENE_ID.test(id);

const blank = (value: string): boolean => value.trim().length === 0;

/**
 * The ledger's own consistency, judged without reading a single document.
 *
 * `typia.validateEquals` already refuses a record whose shape or enum values
 * are wrong, and it refuses loudly at load, so nothing here re-states a type.
 * What remains are the facts a type cannot carry: an id used twice, a promise
 * nobody covers, a tombstone that still reads as live prose, a lock ledger that
 * lost an entry it swore to keep forever.
 *
 * Every diagnostic is an error at every scope. These are not "not finished yet"
 * conditions the way an uncovered scene is; a ledger that contradicts itself is
 * wrong at the moment it is written, and the earliest compile is the cheapest
 * place to hear it.
 *
 * @evidence requirements/story/coverage-and-acceptance.md#story-orphan-gap Refuses missing or contradictory joins between screenplay promises, shot contracts, and acceptance ownership.
 * @evidence specifications/narrative-and-intent/scene-coverage-and-acceptance.md#narrative-intent-coverage-gap-status Validates the current story coverage graph as one deterministic ledger.
 */
export const screenplayLedgerDiagnostics = (props: {
  acceptance: ReadonlyMap<string, IAutoMovieAcceptanceScenario>;
  contracts: ReadonlyMap<string, IAutoMovieShotContract>;
  screenplay: IAutoMovieScreenplayIndex | null;
}): IAutoMovieDiagnostic[] => {
  const screenplay = props.screenplay;
  if (screenplay === null) return [];
  const diagnostics: IAutoMovieDiagnostic[] = [];
  const refuse = (code: AutoMovieDiagnosticCode, message: string): void => {
    diagnostics.push({
      code,
      category: "error",
      phase: "compile",
      target: "screenplay",
      path: null,
      message,
    });
  };

  // --- Treatment -----------------------------------------------------------
  const beatsByText = new Map<string, string>();
  const beatIds = new Set<string>();
  if (screenplay.treatment.sequences.length === 0)
    refuse(
      "screenplay-treatment-empty",
      "The treatment indexes no sequences. An empty machine index cannot certify the human story, so nothing downstream can be traced to a dramatic promise. Index at least one sequence and compile again.",
    );
  screenplay.treatment.sequences.forEach((sequence, sequenceIndex) => {
    if (blank(sequence.id) || blank(sequence.title))
      refuse(
        "screenplay-sequence-unnamed",
        `Treatment sequence at index ${sequenceIndex} has a blank id or human title. Beat ordering cannot be diagnosed without both. Fill both fields and compile again.`,
      );
    if (sequence.beats.length === 0)
      refuse(
        "screenplay-sequence-beatless",
        `Treatment sequence "${sequence.id}" has no beats. A title alone promises no causal work for a scene to cover. Index at least one exact prose beat and compile again.`,
      );
    sequence.beats.forEach((beat, beatIndex) => {
      if (blank(beat.id) || blank(beat.text)) {
        refuse(
          "screenplay-beat-unnamed",
          `Treatment beat at sequence ${sequenceIndex}, index ${beatIndex} has a blank id or exact prose. A scene cannot cover an unnamed promise. Fill both fields and compile again.`,
        );
        return;
      }
      if (beatIds.has(beat.id))
        refuse(
          "screenplay-beat-id-repeated",
          `Treatment beat id "${beat.id}" is declared more than once. Downstream coverage would be ambiguous. Keep one stable beat id and compile again.`,
        );
      const twin = beatsByText.get(beat.text);
      if (twin !== undefined)
        refuse(
          "screenplay-beat-prose-repeated",
          `Treatment beats "${twin}" and "${beat.id}" carry identical exact prose. Verbatim scene coverage could not distinguish them. Make each causal promise exact and distinct, then compile again.`,
        );
      beatIds.add(beat.id);
      beatsByText.set(beat.text, beat.id);
    });
  });

  // --- Scenes --------------------------------------------------------------
  const locations = new Set(
    screenplay.catalog.locations.map((entry) => entry.id),
  );
  const scenes = new Map<
    string,
    (typeof screenplay.screenplay.scenes)[number]
  >();
  const coveredBeats = new Set<string>();
  if (screenplay.screenplay.scenes.length === 0)
    refuse(
      "screenplay-scenes-empty",
      "The screenplay indexes no scenes. An empty ledger cannot certify authored prose or downstream realization. Index at least one scene and compile again.",
    );
  screenplay.screenplay.scenes.forEach((scene, sceneIndex) => {
    if (scenes.has(scene.id)) {
      refuse(
        "screenplay-scene-id-repeated",
        `Scene id "${scene.id}" is declared more than once. One locked number cannot address two scenes. Merge or renumber before lock, then compile again.`,
      );
      return;
    }
    if (canonicalSceneId(scene.id) === false)
      refuse(
        "screenplay-scene-id-noncanonical",
        `Scene id "${scene.id}" is not a canonical SCN number. Use SCN-010 before lock or an alpha insertion such as SCN-A11 after lock, then compile again.`,
      );
    if (blank(scene.title))
      refuse(
        "screenplay-scene-untitled",
        `Scene at index ${sceneIndex} has a blank title. A heading cannot be matched to a nameless scene. Give it a human title and compile again.`,
      );
    scenes.set(scene.id, scene);
    if (scene.status === "OMITTED") {
      if (scene.title !== "OMITTED")
        refuse(
          "screenplay-tombstone-titled",
          `Tombstone "${scene.id}" is not titled OMITTED. Its screenplay heading would read as live prose. Set both index and heading title to OMITTED, then compile again.`,
        );
      return;
    }
    if (scene.location === null || blank(scene.location))
      refuse(
        "screenplay-scene-unplaced",
        `Active scene "${scene.id}" cites no location catalog id. Story place identity cannot be grounded or checked downstream. Cite one existing location and compile again.`,
      );
    else if (locations.has(scene.location) === false)
      refuse(
        "screenplay-scene-location-absent",
        `Active scene "${scene.id}" cites location "${scene.location}", which the catalog does not declare. A place downstream design cannot resolve is not grounded. Add the location to the catalog or cite an existing one, then compile again.`,
      );
    scene.covers.forEach((coverage, coverIndex) => {
      if (blank(coverage.reason))
        refuse(
          "screenplay-cover-unreasoned",
          `Scene "${scene.id}" cover at index ${coverIndex} states no reason. Traceability has no WHY column. State why this scene owns the exact beat and compile again.`,
        );
      if (beatsByText.has(coverage.beat) === false)
        refuse(
          "screenplay-cover-unpromised",
          `Scene "${scene.id}" covers prose the treatment index does not promise verbatim: "${coverage.beat}". Coverage that paraphrases proves nothing was carried forward. Copy the exact beat text or index the promise, then compile again.`,
        );
      else coveredBeats.add(coverage.beat);
    });
  });
  for (const [text, id] of beatsByText)
    if (coveredBeats.has(text) === false)
      refuse(
        "screenplay-beat-uncovered",
        `Treatment beat "${id}" is covered by no active scene. A promised causal step that no scene owns is a story the screenplay does not tell. Cover it verbatim or drop the promise, then compile again.`,
      );

  // --- Lock ----------------------------------------------------------------
  const lock = screenplay.screenplay.lock;
  if (lock !== null) {
    if (blank(lock.reason))
      refuse(
        "screenplay-lock-unreasoned",
        "The screenplay lock states no reason. Stable numbering has no auditable activation decision. Record why downstream work now requires it and compile again.",
      );
    const ledger = new Set<string>();
    for (const id of lock.sceneIds) {
      if (ledger.has(id))
        refuse(
          "screenplay-lock-repeated",
          `Lock ledger repeats scene id "${id}". One historic number needs one permanent entry. Remove the duplicate and compile again.`,
        );
      ledger.add(id);
      if (scenes.has(id) === false)
        refuse(
          "screenplay-lock-orphaned",
          `Lock ledger retains scene id "${id}", but the current index removed it. Renumbering or deletion would orphan every downstream join that cites it. Restore it as active or as an OMITTED tombstone, then compile again.`,
        );
    }
    // Insertion order, which is the index's own scene order: a ledger the
    // author reads top to bottom should be reported the same way, and a
    // comparator here would only be a second ordering nobody asked for.
    for (const id of scenes.keys())
      if (ledger.has(id) === false && INSERTED_SCENE_ID.test(id) === false)
        refuse(
          "screenplay-lock-renumbered",
          `Scene id "${id}" was added after lock without the alpha insertion form. Existing numbers may not shift. Rename only this new scene to a form such as SCN-A11 and compile again.`,
        );
  }

  // --- Catalog and continuity ---------------------------------------------
  const catalogSections: ReadonlyArray<
    readonly [string, readonly IAutoMovieScreenplayCatalogEntry[]]
  > = [
    ["character", screenplay.catalog.characters],
    ["faction", screenplay.catalog.factions],
    ["location", screenplay.catalog.locations],
  ];
  const claims = new Set<string>();
  for (const claim of screenplay.continuity) {
    if (blank(claim.id) || blank(claim.text) || claim.evidence.length === 0) {
      refuse(
        "screenplay-claim-unfounded",
        `Continuity claim "${claim.id}" has a blank identity, blank text, or no scene evidence. A canon fact nothing authored asserts cannot be verified against anything. State the fact and cite the scenes it must hold in, then compile again.`,
      );
      continue;
    }
    if (claims.has(claim.id))
      refuse(
        "screenplay-claim-repeated",
        `Continuity claim id "${claim.id}" is declared more than once. Downstream citations could not tell which fact they cite. Keep one stable claim id and compile again.`,
      );
    claims.add(claim.id);
    // The proof owner and the declared verification family must agree. They are
    // two spellings of one decision, and a record that disagrees with itself
    // lets a claim be discharged by evidence its author did not accept.
    if (claim.proof.owner !== claim.verification)
      refuse(
        "screenplay-claim-misowned",
        `Continuity claim "${claim.id}" declares verification "${claim.verification}" but selects proof owned by "${claim.proof.owner}". Exactly one evidence family may discharge a claim. Make the two agree and compile again.`,
      );
    for (const evidence of claim.evidence)
      if (scenes.has(evidence.scene) === false)
        refuse(
          "screenplay-claim-scene-absent",
          `Continuity claim "${claim.id}" cites scene "${evidence.scene}", which the ledger does not declare. A canon fact anchored to a scene that does not exist holds nowhere. Cite an indexed scene and compile again.`,
        );
  }
  for (const [kind, entries] of catalogSections) {
    const ids = new Set<string>();
    for (const entry of entries) {
      if (blank(entry.id) || blank(entry.name)) {
        refuse(
          "screenplay-catalog-unnamed",
          `A ${kind} catalog entry has a blank id or canonical name. Downstream design cannot join to an unnamed identity. Fill both fields and compile again.`,
        );
        continue;
      }
      if (ids.has(entry.id))
        refuse(
          "screenplay-catalog-repeated",
          `The ${kind} catalog declares id "${entry.id}" more than once. One identity cannot be two subjects. Merge the entries and compile again.`,
        );
      ids.add(entry.id);
      if (entry.evidence.length === 0)
        refuse(
          "screenplay-catalog-ungrounded",
          `The ${kind} "${entry.id}" cites no authored scene. A subject no scene proves exists is a downstream join to a story fact nobody wrote. Cite the scene that establishes it and compile again.`,
        );
      for (const evidence of entry.evidence) {
        if (scenes.has(evidence.scene) === false)
          refuse(
            "screenplay-catalog-scene-absent",
            `The ${kind} "${entry.id}" cites scene "${evidence.scene}", which the ledger does not declare. Cite an indexed scene and compile again.`,
          );
        if (
          evidence.claim !== undefined &&
          evidence.claim !== null &&
          claims.has(evidence.claim) === false
        )
          refuse(
            "screenplay-catalog-claim-absent",
            `The ${kind} "${entry.id}" cites continuity claim "${evidence.claim}", which the index does not declare. Cite an indexed claim or drop the citation, then compile again.`,
          );
      }
    }
  }

  // --- Downstream citations ------------------------------------------------
  // A shot or acceptance record naming a scene the ledger never declared is a
  // join dangling outside the screenplay: the citation looks like traceability
  // and resolves to nothing. Records without evidence are silent here, since
  // the coverage check owns whether evidence is required at all.
  const cite = (
    owner: string,
    evidence: IAutoMovieShotContract["evidence"],
  ): void => {
    for (const entry of evidence ?? []) {
      if (scenes.has(entry.scene) === false)
        refuse(
          "screenplay-citation-scene-absent",
          `${owner} cites scene "${entry.scene}", which the screenplay index does not declare. The downstream join dangles outside the ledger. Correct the scene id or restore its active or OMITTED record, then compile again.`,
        );
      if (
        entry.claim !== undefined &&
        entry.claim !== null &&
        claims.has(entry.claim) === false
      )
        refuse(
          "screenplay-citation-claim-absent",
          `${owner} cites continuity claim "${entry.claim}", which the screenplay index does not declare. The trace is not attached to a canon fact or a proof owner. Correct or add the claim, then compile again.`,
        );
    }
  };
  for (const [id, contract] of props.contracts)
    cite(`Shot contract "${id}"`, contract.evidence);
  for (const [id, scenario] of props.acceptance)
    cite(`Acceptance scenario "${id}"`, scenario.evidence);
  return diagnostics;
};
