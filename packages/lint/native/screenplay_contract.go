package automovie

import (
	"encoding/json"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"github.com/samchon/ttsc/packages/lint/rule"
)

const screenplayContractRuleName = "automovie/screenplay-contract"

type screenplayContractOptions struct {
	Indexes      []string `json:"indexes"`
	Documents    []string `json:"documents"`
	Shots        []string `json:"shots"`
	Acceptance   []string `json:"acceptance"`
	Models       []string `json:"models"`
	Formations   []string `json:"formations"`
	Worlds       []string `json:"worlds"`
	Realizations []string `json:"realizations"`
	Reviews      []string `json:"reviews"`
}

type screenplayContractIndex struct {
	Version    int    `json:"version"`
	Production string `json:"production"`
	Treatment  struct {
		Path      string                        `json:"path"`
		Sequences []screenplayTreatmentSequence `json:"sequences"`
	} `json:"treatment"`
	Screenplay struct {
		Path   string                    `json:"path"`
		Lock   *screenplayLock           `json:"lock"`
		Scenes []screenplayScene         `json:"scenes"`
	} `json:"screenplay"`
	Catalog struct {
		Characters []screenplayCatalogEntry `json:"characters"`
		Factions   []screenplayCatalogEntry `json:"factions"`
		Locations  []screenplayCatalogEntry `json:"locations"`
	} `json:"catalog"`
	Continuity []screenplayContinuityClaim `json:"continuity"`
}

type screenplayTreatmentSequence struct {
	ID    string           `json:"id"`
	Title string           `json:"title"`
	Beats []screenplayBeat `json:"beats"`
}

type screenplayBeat struct {
	ID   string `json:"id"`
	Text string `json:"text"`
}

type screenplayEvidence struct {
	Reason string `json:"reason"`
	Scene  string `json:"scene"`
	Claim  string `json:"claim"`
}

type screenplayCoverage struct {
	Reason string `json:"reason"`
	Beat   string `json:"beat"`
}

type screenplayDisposition struct {
	Phase  string `json:"phase"`
	Reason string `json:"reason"`
}

type screenplayScene struct {
	ID          string                 `json:"id"`
	Title       string                 `json:"title"`
	Status      string                 `json:"status"`
	Covers      []screenplayCoverage   `json:"covers"`
	Location    *string                `json:"location"`
	Disposition *screenplayDisposition `json:"disposition"`
}

type screenplayLock struct {
	ActivatedBy string   `json:"activatedBy"`
	Reason      string   `json:"reason"`
	SceneIDs    []string `json:"sceneIds"`
}

type screenplayCatalogEntry struct {
	ID       string               `json:"id"`
	Name     string               `json:"name"`
	Evidence []screenplayEvidence `json:"evidence"`
	Bindings []struct {
		Kind string `json:"kind"`
		ID   string `json:"id"`
	} `json:"bindings"`
}

type screenplayContinuityClaim struct {
	ID           string               `json:"id"`
	Text         string               `json:"text"`
	Verification string               `json:"verification"`
	Proof        struct {
		Owner    string `json:"owner"`
		Shot     string `json:"shot"`
		Scenario string `json:"scenario"`
		Outcome  struct {
			Kind string `json:"kind"`
			ID   string `json:"id"`
		} `json:"outcome"`
	} `json:"proof"`
	Evidence     []screenplayEvidence `json:"evidence"`
}

type screenplayShotRecord struct {
	ID           string               `json:"id"`
	Evidence     []screenplayEvidence `json:"evidence"`
	Participants []struct {
		Kind string `json:"kind"`
		ID   string `json:"id"`
	} `json:"participants"`
}

type screenplayAcceptanceRecord struct {
	ID       string               `json:"id"`
	Evidence []screenplayEvidence `json:"evidence"`
	Target   struct {
		Kind string `json:"kind"`
		ID   string `json:"id"`
	} `json:"target"`
	Criterion struct {
		Kind string `json:"kind"`
		Shot string `json:"shot"`
	} `json:"criterion"`
}

type screenplayRealizationOutcome struct {
	ID     string `json:"id"`
	Passed bool   `json:"passed"`
}

type screenplayRealizationRecord struct {
	Version    int    `json:"version"`
	Shot       string `json:"shot"`
	Opening    []screenplayRealizationOutcome `json:"opening"`
	Closing    []screenplayRealizationOutcome `json:"closing"`
	Events     []screenplayRealizationOutcome `json:"events"`
	Camera     []screenplayRealizationOutcome `json:"camera"`
	Formations []screenplayRealizationOutcome `json:"formations"`
}

type screenplayReviewRecord struct {
	Complete bool `json:"complete"`
	Target   struct {
		Kind string `json:"kind"`
		ID   string `json:"id"`
	} `json:"target"`
	Checks []struct {
		Criterion           string   `json:"criterion"`
		Verdict             string   `json:"verdict"`
		AcceptanceScenarios []string `json:"acceptanceScenarios"`
	} `json:"checks"`
}

type screenplayIDRecord struct {
	ID string `json:"id"`
}

type screenplayWorldRecord struct {
	Landmarks []screenplayIDRecord `json:"landmarks"`
}

type screenplayMarkdownScene struct {
	ID    string
	Title string
	Body  string
}

type screenplayContractRule struct{}

func (screenplayContractRule) Name() string { return screenplayContractRuleName }

func (screenplayContractRule) NeedsTypeChecker() bool { return false }

func (screenplayContractRule) AcceptsTtscLintOptions() bool { return true }

func (screenplayContractRule) ProjectInputs(
	ctx *rule.ProjectInputContext,
) []rule.ProjectInput {
	if ctx == nil {
		return nil
	}
	var options screenplayContractOptions
	if ctx.DecodeOptions(&options) != nil {
		return nil
	}
	patterns := append([]string{}, options.Indexes...)
	patterns = append(patterns, options.Documents...)
	patterns = append(patterns, options.Shots...)
	patterns = append(patterns, options.Acceptance...)
	patterns = append(patterns, options.Models...)
	patterns = append(patterns, options.Formations...)
	patterns = append(patterns, options.Worlds...)
	patterns = append(patterns, options.Realizations...)
	patterns = append(patterns, options.Reviews...)
	inputs := make([]rule.ProjectInput, 0, len(patterns))
	seen := map[string]bool{}
	for _, raw := range patterns {
		pattern, problem := normalizeProjectPattern(raw)
		if problem != "" || seen[pattern] {
			continue
		}
		seen[pattern] = true
		kind := rule.ProjectInputFile
		if isProjectGlob(pattern) {
			kind = rule.ProjectInputGlob
		}
		inputs = append(inputs, rule.ProjectInput{Kind: kind, Pattern: pattern})
	}
	return inputs
}

func (screenplayContractRule) Check(ctx *rule.ProjectContext) {
	if ctx == nil {
		return
	}
	var options screenplayContractOptions
	if err := ctx.DecodeOptions(&options); err != nil {
		ctx.Report(
			"Screenplay-contract configuration could not be decoded: " + err.Error() +
				". Treatment, scene and downstream evidence paths therefore have no observable contract. Correct the automovie/screenplay-contract options and run the project's lint command again.",
		)
		return
	}
	if problem := validateScreenplayContractOptions(options); problem != "" {
		ctx.Report(problem)
		return
	}
	root := ctx.Identity.PhysicalProjectRoot
	if root == "" {
		ctx.Report(
			"Screenplay-contract has no physical TypeScript project root. Markdown and index identities cannot be compared without a stable filesystem base. Run lint with a real tsconfig project path.",
		)
		return
	}
	indexes, indexProblems := automovieProjectFiles(
		root,
		options.Indexes,
		"Screenplay-contract",
	)
	for _, problem := range indexProblems {
		ctx.Report(problem)
	}
	if len(indexes) == 0 {
		return
	}
	shots, shotProblems := automovieProjectFiles(
		root,
		options.Shots,
		"Screenplay-contract",
	)
	acceptance, acceptanceProblems := automovieProjectFiles(
		root,
		options.Acceptance,
		"Screenplay-contract",
	)
	models, modelProblems := automovieProjectFiles(
		root,
		options.Models,
		"Screenplay-contract",
	)
	formations, formationProblems := automovieProjectFiles(
		root,
		options.Formations,
		"Screenplay-contract",
	)
	worlds, worldProblems := automovieProjectFiles(
		root,
		options.Worlds,
		"Screenplay-contract",
	)
	realizations, realizationProblems := automovieProjectFiles(
		root,
		options.Realizations,
		"Screenplay-contract",
	)
	reviews, reviewProblems := automovieProjectFiles(
		root,
		options.Reviews,
		"Screenplay-contract",
	)
	for _, problems := range [][]string{
		shotProblems,
		acceptanceProblems,
		modelProblems,
		formationProblems,
		worldProblems,
		realizationProblems,
		reviewProblems,
	} {
		for _, problem := range problems {
			ctx.Report(problem)
		}
	}
	for _, indexFile := range indexes {
		checkScreenplayIndex(
			ctx,
			root,
			indexFile,
			options,
			shots,
			acceptance,
			models,
			formations,
			worlds,
			realizations,
			reviews,
		)
	}
}

func validateScreenplayContractOptions(options screenplayContractOptions) string {
	groups := []struct {
		Name     string
		Patterns []string
	}{
		{"indexes", options.Indexes},
		{"documents", options.Documents},
		{"shots", options.Shots},
		{"acceptance", options.Acceptance},
		{"models", options.Models},
		{"formations", options.Formations},
		{"worlds", options.Worlds},
		{"realizations", options.Realizations},
		{"reviews", options.Reviews},
	}
	for _, group := range groups {
		if len(group.Patterns) == 0 {
			return "Screenplay-contract configuration has no '" + group.Name +
				"' paths. That evidence family cannot be observed, so the screenplay ledger could report a false pass. Add at least one project-relative path or glob and run the project's lint command again."
		}
		for _, raw := range group.Patterns {
			if _, problem := normalizeProjectPattern(raw); problem != "" {
				return "Screenplay-contract " + group.Name + " path '" + raw +
					"' is invalid: " + problem +
					" Keep every input inside the TypeScript project root and run lint again."
			}
		}
	}
	return ""
}

func checkScreenplayIndex(
	ctx *rule.ProjectContext,
	root string,
	indexFile string,
	options screenplayContractOptions,
	shotFiles []string,
	acceptanceFiles []string,
	modelFiles []string,
	formationFiles []string,
	worldFiles []string,
	realizationFiles []string,
	reviewFiles []string,
) {
	var index screenplayContractIndex
	if problem := readScreenplayJSON(indexFile, &index); problem != "" {
		ctx.Report(
			"Screenplay index '" + automovieRelative(root, indexFile) +
				"' could not be decoded: " + problem +
				". Scene, lock and coverage facts are unknown, so downstream certification must stand down. Restore one valid IAutoMovieScreenplayIndex and run lint again.",
		)
		return
	}
	anchor := "Screenplay index '" + automovieRelative(root, indexFile) + "'"
	if index.Version != 1 || strings.TrimSpace(index.Production) == "" {
		ctx.Report(
			anchor +
				" does not declare version 1 and one non-blank production id. No stable production owns its scene ledger. Correct version and production, then run lint again.",
		)
		return
	}
	owner := strings.TrimSuffix(
		filepath.ToSlash(automovieRelative(root, indexFile)),
		"/screenplay/index.json",
	)
	var production screenplayIDRecord
	productionFile := filepath.Join(
		root,
		filepath.FromSlash(owner),
		"production.json",
	)
	if problem := readScreenplayJSON(productionFile, &production); problem != "" {
		ctx.Report(
			anchor + " cannot read its namespace production design: " +
				problem +
				". The encoded physical segment cannot prove which raw production id owns this story. Restore production.json and run lint again.",
		)
	} else if production.ID != index.Production {
		ctx.Report(
			anchor + " declares production '" + index.Production +
				"' while namespace production.json declares '" +
				production.ID +
				"'. Story prose and downstream design would be joined across productions. Correct the index or move it to the owning namespace, then run lint again.",
		)
	}
	expectedDocumentRoot := "docs/" + index.Production + "/"
	for _, item := range []struct {
		Kind     string
		Document string
	}{
		{"treatment", index.Treatment.Path},
		{"screenplay", index.Screenplay.Path},
	} {
		if !strings.HasPrefix(
			filepath.ToSlash(item.Document),
			expectedDocumentRoot,
		) {
			ctx.Report(
				anchor + " names " + item.Kind + " document '" +
					item.Document +
					"' outside the production-owned '" + expectedDocumentRoot +
					"' directory. Human prose could collide across productions. Move the document beneath its production directory and run lint again.",
			)
		}
	}
	ownedShots := screenplayOwnedFiles(root, owner+"/shots/", shotFiles)
	ownedAcceptance := screenplayOwnedFiles(
		root,
		owner+"/acceptance/",
		acceptanceFiles,
	)
	ownedModels := append(
		screenplayOwnedFiles(root, owner+"/models/", modelFiles),
		screenplayOwnedFiles(
			root,
			".automovie/design/shared/models/",
			modelFiles,
		)...,
	)
	ownedFormations := append(
		screenplayOwnedFiles(root, owner+"/formations/", formationFiles),
		screenplayOwnedFiles(
			root,
			".automovie/design/shared/formations/",
			formationFiles,
		)...,
	)
	ownedWorlds := screenplayExactFiles(
		root,
		[]string{
			owner + "/world.json",
			".automovie/design/shared/world.json",
		},
		worldFiles,
	)
	realizationPrefix := "generated/realizations/"
	ownedReviews := append(
		screenplayOwnedFiles(
			root,
			".automovie/reviews/shots/",
			reviewFiles,
		),
		screenplayOwnedFiles(
			root,
			".automovie/reviews/film/",
			reviewFiles,
		)...,
	)
	if owner != ".automovie/design" {
		segment := strings.TrimPrefix(owner, ".automovie/design/")
		realizationPrefix = "generated/" + segment + "/realizations/"
		ownedReviews = screenplayOwnedFiles(
			root,
			".automovie/reviews/"+segment+"/",
			reviewFiles,
		)
	}
	ownedRealizations := screenplayOwnedFiles(
		root,
		realizationPrefix,
		realizationFiles,
	)

	treatmentText, treatmentReady := readScreenplayDocument(
		ctx,
		root,
		anchor,
		"treatment",
		index.Treatment.Path,
		options.Documents,
	)
	screenplayText, screenplayReady := readScreenplayDocument(
		ctx,
		root,
		anchor,
		"screenplay",
		index.Screenplay.Path,
		options.Documents,
	)

	beats := map[string]screenplayBeat{}
	beatIDs := map[string]bool{}
	if len(index.Treatment.Sequences) == 0 {
		ctx.Report(
			anchor + " has no treatment sequences. An empty machine index cannot certify the human story ladder. Index at least one titled sequence and beat, then run lint again.",
		)
	}
	for sequenceIndex, sequence := range index.Treatment.Sequences {
		if strings.TrimSpace(sequence.ID) == "" ||
			strings.TrimSpace(sequence.Title) == "" {
			ctx.Report(
				anchor + " treatment sequence at index " +
					itoa(sequenceIndex) +
					" has a blank id or human title. Beat ordering cannot be diagnosed without both. Fill both fields and run lint again.",
			)
		}
		if len(sequence.Beats) == 0 {
			ctx.Report(
				anchor + " treatment sequence '" + sequence.ID +
					"' has no beats. A title alone promises no causal work for screenplay scenes to cover. Index at least one exact prose beat and run lint again.",
			)
		}
		for beatIndex, beat := range sequence.Beats {
			if strings.TrimSpace(beat.ID) == "" ||
				strings.TrimSpace(beat.Text) == "" {
				ctx.Report(
					anchor + " treatment beat at sequence " +
						itoa(sequenceIndex) + ", index " + itoa(beatIndex) +
						" has a blank id or exact prose. A scene cannot cover an unnamed promise. Fill both fields and run lint again.",
				)
				continue
			}
			if beatIDs[beat.ID] {
				ctx.Report(
					anchor + " declares treatment beat id '" + beat.ID +
						"' more than once. Downstream coverage would be ambiguous. Keep one stable beat id and run lint again.",
				)
			}
			if previous, exists := beats[beat.Text]; exists {
				ctx.Report(
					anchor + " gives beat ids '" + previous.ID + "' and '" +
						beat.ID +
						"' identical exact prose. Verbatim scene coverage could not distinguish them. Make each causal promise exact and distinct, then run lint again.",
				)
			}
			beatIDs[beat.ID] = true
			beats[beat.Text] = beat
			if treatmentReady &&
				!strings.Contains(
					screenplayComparableProse(treatmentText),
					screenplayComparableProse(beat.Text),
				) {
				ctx.Report(
					anchor + " indexes treatment beat '" + beat.ID +
						"', but its exact prose is absent from '" +
						index.Treatment.Path +
						"'. The machine index would promise text the human document does not contain. Restore the exact prose or update both records, then run lint again.",
				)
			}
		}
	}

	scenes := map[string]screenplayScene{}
	coveredBeats := map[string]bool{}
	if len(index.Screenplay.Scenes) == 0 {
		ctx.Report(
			anchor + " has no screenplay scenes. An empty ledger cannot certify authored prose or downstream realization. Index at least one SCN heading and run lint again.",
		)
	}
	for sceneIndex, scene := range index.Screenplay.Scenes {
		if scenes[scene.ID].ID != "" {
			ctx.Report(
				anchor + " declares scene id '" + scene.ID +
					"' more than once. One locked number cannot address two scenes. Merge or renumber before lock, then run lint again.",
			)
			continue
		}
		if !screenplaySceneID(scene.ID) {
			ctx.Report(
				anchor + " scene id '" + scene.ID +
					"' is not a canonical SCN number. Use SCN-010 before lock or an alpha insertion such as SCN-A11 after lock, then run lint again.",
			)
		}
		if strings.TrimSpace(scene.Title) == "" ||
			(scene.Status != "active" && scene.Status != "OMITTED") {
			ctx.Report(
				anchor + " scene at index " + itoa(sceneIndex) +
					" has a blank title or unsupported status '" + scene.Status +
					"'. Give it a human title and status active or OMITTED, then run lint again.",
			)
		}
		scenes[scene.ID] = scene
		if scene.Status == "OMITTED" {
			if scene.Title != "OMITTED" {
				ctx.Report(
					anchor + " tombstone '" + scene.ID +
						"' is not titled OMITTED. The screenplay heading could look like live prose. Set both index and heading title to OMITTED, then run lint again.",
				)
			}
			continue
		}
		if scene.Location == nil || strings.TrimSpace(*scene.Location) == "" {
			ctx.Report(
				anchor + " active scene '" + scene.ID +
					"' has no location catalog id. Story place identity cannot be grounded or checked downstream. Cite one existing location and run lint again.",
			)
		}
		if scene.Disposition != nil &&
			scene.Disposition.Phase != "screenplay" &&
			scene.Disposition.Phase != "production" &&
			scene.Disposition.Phase != "edit" {
			ctx.Report(
				anchor + " scene '" + scene.ID +
					"' has unsupported disposition phase '" +
					scene.Disposition.Phase +
					"'. Keep exemptions local to screenplay, production or edit and run lint again.",
			)
		}
		for coverIndex, coverage := range scene.Covers {
			if strings.TrimSpace(coverage.Reason) == "" {
				ctx.Report(
					anchor + " scene '" + scene.ID + "' cover at index " +
						itoa(coverIndex) +
						" has no reason. Traceability has no WHY column. State why this scene owns the exact beat and run lint again.",
				)
			}
			if _, exists := beats[coverage.Beat]; !exists {
				ctx.Report(
					anchor + " scene '" + scene.ID +
						"' covers prose not present verbatim in the treatment index: '" +
						coverage.Beat +
						"'. Copy the exact beat text or correct the treatment and run lint again.",
				)
			} else {
				coveredBeats[coverage.Beat] = true
			}
		}
	}
	for _, beatText := range screenplaySortedKeys(beats) {
		beat := beats[beatText]
		if !coveredBeats[beatText] {
			ctx.Report(
				anchor + " treatment beat '" + beat.ID +
					"' is not covered verbatim by any active screenplay scene. The screenplay ladder drops a promised causal step. Add one scene cover with the exact beat text, then run lint again.",
			)
		}
	}

	if screenplayReady {
		markdownScenes := parseScreenplayMarkdown(screenplayText)
		for _, id := range screenplaySortedKeys(markdownScenes) {
			entries := markdownScenes[id]
			if len(entries) != 1 {
				ctx.Report(
					anchor + " finds scene heading id '" + id + "' " +
						itoa(len(entries)) +
						" times in '" + index.Screenplay.Path +
						"'. One stable id must occur on exactly one heading line. Keep one heading and run lint again.",
				)
				continue
			}
			indexed, exists := scenes[id]
			if !exists {
				ctx.Report(
					anchor + " finds undeclared screenplay heading '" + id +
						"' in '" + index.Screenplay.Path +
						"'. Downstream records cannot cite an unindexed scene. Add it to the index or remove the heading, then run lint again.",
				)
				continue
			}
			entry := entries[0]
			if entry.Title != indexed.Title {
				ctx.Report(
					anchor + " scene '" + id + "' title is '" + indexed.Title +
						"' in the index but '" + entry.Title +
						"' in the Markdown heading. Human prose and machine identity have diverged. Make the titles exact and run lint again.",
				)
			}
			if indexed.Status == "active" &&
				strings.TrimSpace(entry.Body) == "" {
				ctx.Report(
					anchor + " active scene '" + id +
						"' has a heading but no screenplay body. A heading-only index cannot satisfy authored dramatic work. Write scene prose beneath the heading and run lint again.",
				)
			}
		}
		for _, id := range screenplaySortedKeys(scenes) {
			if len(markdownScenes[id]) == 0 {
				ctx.Report(
					anchor + " indexes scene '" + id +
						"', but no exact SCN heading exists in '" +
						index.Screenplay.Path +
						"'. Downstream citations dangle from the human screenplay. Restore the heading and run lint again.",
				)
			}
		}
	}

	validateScreenplayLock(ctx, anchor, index.Screenplay.Lock, scenes, len(ownedShots))
	validateScreenplayDownstream(
		ctx,
		root,
		anchor,
		index,
		scenes,
		ownedShots,
		ownedAcceptance,
		ownedModels,
		ownedFormations,
		ownedWorlds,
		ownedRealizations,
		ownedReviews,
	)
}

func validateScreenplayLock(
	ctx *rule.ProjectContext,
	anchor string,
	lock *screenplayLock,
	scenes map[string]screenplayScene,
	shotCount int,
) {
	if lock == nil {
		if shotCount != 0 {
			ctx.Report(
				anchor + " is unlocked while " + itoa(shotCount) +
					" downstream shot contract(s) already exist. Scene numbers can no longer be safe join keys. Activate the lock as user or agent-before-first-shot, record every current scene id, and run lint again.",
			)
		}
		return
	}
	if strings.TrimSpace(lock.Reason) == "" ||
		(lock.ActivatedBy != "user" &&
			lock.ActivatedBy != "agent-before-first-shot") {
		ctx.Report(
			anchor + " has a lock without a valid actor and reason. Stable numbering has no auditable activation decision. Set activatedBy and a non-blank reason, then run lint again.",
		)
	}
	ledger := map[string]bool{}
	for _, id := range lock.SceneIDs {
		if ledger[id] {
			ctx.Report(
				anchor + " lock ledger repeats scene id '" + id +
					"'. One historic number needs one permanent entry. Remove the duplicate and run lint again.",
			)
		}
		ledger[id] = true
		if _, exists := scenes[id]; !exists {
			ctx.Report(
				anchor + " lock ledger retains scene id '" + id +
					"', but the current index removed it. Renumbering or deletion would orphan downstream joins. Restore it as active or as an OMITTED tombstone, then run lint again.",
			)
		}
	}
	for _, id := range screenplaySortedKeys(scenes) {
		if ledger[id] {
			continue
		}
		if !screenplayInsertedIDPattern.MatchString(id) {
			ctx.Report(
				anchor + " adds scene id '" + id +
					"' after lock without the alpha insertion form. Existing numbers may not shift. Rename only this new scene to a form such as SCN-A11 and run lint again.",
			)
		}
	}
}

func validateScreenplayDownstream(
	ctx *rule.ProjectContext,
	root string,
	anchor string,
	index screenplayContractIndex,
	scenes map[string]screenplayScene,
	shotFiles []string,
	acceptanceFiles []string,
	modelFiles []string,
	formationFiles []string,
	worldFiles []string,
	realizationFiles []string,
	reviewFiles []string,
) {
	models := screenplayDesignIDs(ctx, root, anchor, "model", modelFiles)
	formations := screenplayDesignIDs(
		ctx,
		root,
		anchor,
		"formation",
		formationFiles,
	)
	landmarks := screenplayWorldLandmarks(
		ctx,
		root,
		anchor,
		worldFiles,
	)
	characters := screenplayCatalog(
		ctx,
		anchor,
		"character",
		index.Catalog.Characters,
		scenes,
		index.Continuity,
		"model",
		models,
	)
	factions := screenplayCatalog(
		ctx,
		anchor,
		"faction",
		index.Catalog.Factions,
		scenes,
		index.Continuity,
		"formation",
		formations,
	)
	locations := screenplayCatalog(
		ctx,
		anchor,
		"location",
		index.Catalog.Locations,
		scenes,
		index.Continuity,
		"world-landmark",
		landmarks,
	)
	claims := map[string]screenplayContinuityClaim{}
	for _, claim := range index.Continuity {
		if claims[claim.ID].ID != "" {
			ctx.Report(
				anchor + " repeats continuity claim id '" + claim.ID +
					"'. One canon fact cannot have two proof owners. Merge the records and run lint again.",
			)
			continue
		}
		if strings.TrimSpace(claim.ID) == "" ||
			strings.TrimSpace(claim.Text) == "" ||
			len(claim.Evidence) == 0 ||
			(claim.Verification != "frame-review" &&
				claim.Verification != "geometry" &&
				claim.Verification != "acceptance") {
			ctx.Report(
				anchor + " contains a continuity claim with blank identity/text/evidence or unsupported verification owner '" +
					claim.Verification +
					"'. Give the canon fact one stable id and one supported owner, then run lint again.",
			)
		}
		if claim.Proof.Owner != claim.Verification ||
			(claim.Verification == "geometry" &&
				(strings.TrimSpace(claim.Proof.Shot) == "" ||
					strings.TrimSpace(claim.Proof.Outcome.ID) == "" ||
					(claim.Proof.Outcome.Kind != "opening" &&
						claim.Proof.Outcome.Kind != "closing" &&
						claim.Proof.Outcome.Kind != "event" &&
						claim.Proof.Outcome.Kind != "formation"))) ||
			(claim.Verification != "geometry" &&
				strings.TrimSpace(claim.Proof.Scenario) == "") {
			ctx.Report(
				anchor + " continuity claim '" + claim.ID +
					"' has an invalid exact proof selector for owner '" +
					claim.Verification +
					"'. Geometry must name one shot outcome; frame-review or acceptance must name one scenario, and proof.owner must match verification. Correct the selector and run lint again.",
			)
		}
		claims[claim.ID] = claim
	}
	for _, id := range screenplaySortedKeys(scenes) {
		scene := scenes[id]
		if scene.Status != "active" || scene.Location == nil {
			continue
		}
		if !locations.Entries[*scene.Location] {
			ctx.Report(
				anchor + " scene '" + scene.ID + "' cites unknown location '" +
					*scene.Location +
					"'. The scene cannot join the story place catalog. Add grounded location evidence or correct the scene, then run lint again.",
			)
		}
	}

	shots := map[string]screenplayShotRecord{}
	shotScenes := map[string][]string{}
	shotClaims := map[string][]string{}
	for _, file := range shotFiles {
		var shot screenplayShotRecord
		if problem := readScreenplayJSON(file, &shot); problem != "" {
			ctx.Report(
				anchor + " cannot decode shot contract '" +
					automovieRelative(root, file) + "': " + problem +
					". Scene intent is unknown and cannot drain coverage. Restore valid JSON and run lint again.",
			)
			continue
		}
		shots[shot.ID] = shot
		if len(shot.Evidence) == 0 {
			ctx.Report(
				anchor + " shot contract '" + shot.ID +
					"' has no scene evidence. A downstream intent is detached from authored screenplay work. Add at least one { reason, scene, claim? } citation and run lint again.",
			)
		}
		for _, evidence := range shot.Evidence {
			if validateScreenplayEvidence(
				ctx,
				anchor+" shot '"+shot.ID+"'",
				evidence,
				scenes,
				claims,
			) {
				shotScenes[evidence.Scene] = append(
					shotScenes[evidence.Scene],
					shot.ID,
				)
				if evidence.Claim != "" {
					shotClaims[evidence.Claim] = append(
						shotClaims[evidence.Claim],
						shot.ID,
					)
				}
			}
		}
		for _, participant := range shot.Participants {
			if participant.Kind == "actor" &&
				!characters.Bindings[participant.ID] {
				ctx.Report(
					anchor + " shot '" + shot.ID + "' actor participant '" +
						participant.ID +
						"' is not bound by the grounded character catalog. Bind that shared model to a production character or correct the participant and run lint again.",
				)
			}
			if participant.Kind == "formation" &&
				!factions.Bindings[participant.ID] {
				ctx.Report(
					anchor + " shot '" + shot.ID +
						"' formation participant '" + participant.ID +
						"' is not bound by the grounded faction catalog. Bind that formation to a production faction or correct the participant and run lint again.",
				)
			}
		}
	}

	acceptance := map[string]screenplayAcceptanceRecord{}
	acceptanceScenes := map[string][]string{}
	acceptanceClaims := map[string][]string{}
	for _, file := range acceptanceFiles {
		var scenario screenplayAcceptanceRecord
		if problem := readScreenplayJSON(file, &scenario); problem != "" {
			ctx.Report(
				anchor + " cannot decode acceptance scenario '" +
					automovieRelative(root, file) + "': " + problem +
					". Observable screenplay verification is unknown. Restore valid JSON and run lint again.",
			)
			continue
		}
		acceptance[scenario.ID] = scenario
		if len(scenario.Evidence) == 0 {
			ctx.Report(
				anchor + " acceptance scenario '" + scenario.ID +
					"' has no scene evidence. Passing review could not prove any screenplay obligation. Add at least one { reason, scene, claim? } citation and run lint again.",
			)
		}
		for _, evidence := range scenario.Evidence {
			if validateScreenplayEvidence(
				ctx,
				anchor+" acceptance '"+scenario.ID+"'",
				evidence,
				scenes,
				claims,
			) {
				acceptanceScenes[evidence.Scene] = append(
					acceptanceScenes[evidence.Scene],
					scenario.ID,
				)
				if evidence.Claim != "" {
					acceptanceClaims[evidence.Claim] = append(
						acceptanceClaims[evidence.Claim],
						scenario.ID,
					)
				}
			}
		}
	}

	realized := screenplayPassingRealizations(realizationFiles)
	passedReviews := screenplayPassedAcceptanceReviews(reviewFiles)
	for _, id := range screenplaySortedKeys(scenes) {
		scene := scenes[id]
		sceneRealizations := screenplayRealizedShots(shotScenes[id], realized)
		hasRealization := len(sceneRealizations) != 0
		hasAcceptance := screenplayHasPassedAcceptance(
			index.Production,
			acceptanceScenes[id],
			acceptance,
			passedReviews,
			sceneRealizations,
		)
		if scene.Status == "OMITTED" {
			if hasRealization || hasAcceptance {
				ctx.Report(
					anchor + " scene '" + id +
						"' is an OMITTED tombstone but still has passing realization or passed visual acceptance evidence. The ledger asserts both absence and realization. Remove the downstream contradiction or reactivate the scene, then run lint again.",
				)
			}
			continue
		}
		if scene.Disposition != nil {
			if strings.TrimSpace(scene.Disposition.Reason) == "" {
				ctx.Report(
					anchor + " scene '" + id +
						"' has a disposition without a reason. The local omission is unauditable. State the phase-local reason and run lint again.",
				)
			}
			if hasRealization || hasAcceptance {
				ctx.Report(
					anchor + " scene '" + id +
						"' has a disposition and passing realization evidence. Intentional omission and realized work contradict each other. Remove the disposition or the downstream claim, then run lint again.",
				)
			}
			continue
		}
		if !hasRealization {
			ctx.Report(
				anchor + " active scene '" + id +
					"' has no citing shot with a passing compiled realization. Shot intent alone cannot drain scene coverage. Compile a citing shot successfully or record a phase-local disposition, then run lint again.",
			)
		}
		if !hasAcceptance {
			ctx.Report(
				anchor + " active scene '" + id +
					"' has no citing acceptance scenario passed by a shot/film review for the same realized shot. A completed design review is not observation. Pass current acceptance evidence or record a phase-local disposition, then run lint again.",
			)
		}
	}

	for _, claim := range index.Continuity {
		for _, evidence := range claim.Evidence {
			validateScreenplayEvidence(
				ctx,
				anchor+" continuity claim '"+claim.ID+"'",
				evidence,
				scenes,
				claims,
			)
		}
		proven := screenplayContinuityProven(
			index.Production,
			claim,
			shotClaims[claim.ID],
			acceptanceClaims[claim.ID],
			acceptance,
			realized,
			passedReviews,
		)
		if !proven {
			ctx.Report(
				anchor + " continuity claim '" + claim.ID +
					"' has verification owner '" + claim.Verification +
					"' but its exact proof selector has no passing citing evidence from that owner. Generic shot or design-review success is only traceability. Produce and pass the named outcome or acceptance and run lint again.",
			)
		}
	}
}

type screenplayCatalogResult struct {
	Entries  map[string]bool
	Bindings map[string]bool
}

func screenplayDesignIDs(
	ctx *rule.ProjectContext,
	root string,
	anchor string,
	kind string,
	files []string,
) map[string]bool {
	out := map[string]bool{}
	for _, file := range files {
		var record screenplayIDRecord
		if problem := readScreenplayJSON(file, &record); problem != "" {
			ctx.Report(
				anchor + " cannot decode " + kind + " design '" +
					automovieRelative(root, file) + "': " + problem +
					". Catalog bindings to this design family are unknown. Restore valid JSON and run lint again.",
			)
			continue
		}
		if strings.TrimSpace(record.ID) != "" {
			out[record.ID] = true
		}
	}
	return out
}

func screenplayWorldLandmarks(
	ctx *rule.ProjectContext,
	root string,
	anchor string,
	files []string,
) map[string]bool {
	out := map[string]bool{}
	for _, file := range files {
		var world screenplayWorldRecord
		if problem := readScreenplayJSON(file, &world); problem != "" {
			ctx.Report(
				anchor + " cannot decode world design '" +
					automovieRelative(root, file) + "': " + problem +
					". Location bindings cannot be grounded. Restore valid JSON and run lint again.",
			)
			continue
		}
		for _, landmark := range world.Landmarks {
			if strings.TrimSpace(landmark.ID) != "" {
				out[landmark.ID] = true
			}
		}
	}
	return out
}

func screenplayCatalog(
	ctx *rule.ProjectContext,
	anchor string,
	kind string,
	entries []screenplayCatalogEntry,
	scenes map[string]screenplayScene,
	claims []screenplayContinuityClaim,
	bindingKind string,
	available map[string]bool,
) screenplayCatalogResult {
	claimMap := map[string]screenplayContinuityClaim{}
	for _, claim := range claims {
		claimMap[claim.ID] = claim
	}
	out := screenplayCatalogResult{
		Entries:  map[string]bool{},
		Bindings: map[string]bool{},
	}
	for _, entry := range entries {
		if out.Entries[entry.ID] {
			ctx.Report(
				anchor + " repeats " + kind + " catalog id '" + entry.ID +
					"'. Downstream identity is ambiguous. Keep one grounded catalog record and run lint again.",
			)
		}
		if strings.TrimSpace(entry.ID) == "" ||
			strings.TrimSpace(entry.Name) == "" ||
			len(entry.Evidence) == 0 ||
			len(entry.Bindings) == 0 {
			ctx.Report(
				anchor + " contains a " + kind +
					" catalog entry without id, name, scene evidence or downstream binding. Story identity must be discovered in authored prose and joined explicitly to shared design. Ground the entry and run lint again.",
			)
		}
		out.Entries[entry.ID] = true
		for _, evidence := range entry.Evidence {
			validateScreenplayEvidence(
				ctx,
				anchor+" "+kind+" '"+entry.ID+"'",
				evidence,
				scenes,
				claimMap,
			)
		}
		for _, binding := range entry.Bindings {
			if binding.Kind != bindingKind ||
				strings.TrimSpace(binding.ID) == "" ||
				!available[binding.ID] {
				ctx.Report(
					anchor + " " + kind + " '" + entry.ID +
						"' binding {" + binding.Kind + ", " +
						binding.ID + "} does not resolve to an existing " +
						bindingKind +
						". Correct the production-scoped cast/catalog join and run lint again.",
				)
				continue
			}
			if out.Bindings[binding.ID] {
				ctx.Report(
					anchor + " binds " + bindingKind + " '" +
						binding.ID +
						"' to more than one " + kind +
						". One downstream identity cannot play two story identities in the same production. Keep one binding and run lint again.",
				)
			}
			out.Bindings[binding.ID] = true
		}
	}
	return out
}

func validateScreenplayEvidence(
	ctx *rule.ProjectContext,
	owner string,
	evidence screenplayEvidence,
	scenes map[string]screenplayScene,
	claims map[string]screenplayContinuityClaim,
) bool {
	valid := true
	if strings.TrimSpace(evidence.Reason) == "" {
		ctx.Report(
			owner + " cites scene '" + evidence.Scene +
				"' without a reason. Traceability has no WHY column. State the dependency reason before the scene id and run lint again.",
		)
		valid = false
	}
	if _, exists := scenes[evidence.Scene]; !exists {
		ctx.Report(
			owner + " cites unknown scene '" + evidence.Scene +
				"'. The downstream join dangles outside the screenplay index. Correct the scene id or restore its active/OMITTED record, then run lint again.",
		)
		valid = false
	}
	if evidence.Claim != "" {
		if _, exists := claims[evidence.Claim]; !exists {
			ctx.Report(
				owner + " cites unknown continuity claim '" + evidence.Claim +
					"'. The trace is not attached to a canon fact or proof owner. Correct or add the claim, then run lint again.",
			)
			valid = false
		}
	}
	return valid
}

func screenplayPassingRealizations(
	files []string,
) map[string]screenplayRealizationRecord {
	out := map[string]screenplayRealizationRecord{}
	for _, file := range files {
		var realization screenplayRealizationRecord
		if readScreenplayJSON(file, &realization) != "" ||
			realization.Version != 1 ||
			strings.TrimSpace(realization.Shot) == "" ||
			len(realization.Camera) == 0 {
			continue
		}
		passed := true
		for _, group := range [][]screenplayRealizationOutcome{
			realization.Opening,
			realization.Closing,
			realization.Events,
			realization.Camera,
			realization.Formations,
		} {
			for _, outcome := range group {
				if !outcome.Passed {
					passed = false
				}
			}
		}
		if passed {
			out[realization.Shot] = realization
		}
	}
	return out
}

type screenplayReviewTarget struct {
	Kind string
	ID   string
}

func screenplayPassedAcceptanceReviews(
	files []string,
) map[string][]screenplayReviewTarget {
	out := map[string][]screenplayReviewTarget{}
	for _, file := range files {
		var review screenplayReviewRecord
		if readScreenplayJSON(file, &review) != "" ||
			!review.Complete ||
			(review.Target.Kind != "shot" && review.Target.Kind != "film") ||
			strings.TrimSpace(review.Target.ID) == "" {
			continue
		}
		for _, check := range review.Checks {
			if check.Criterion != "acceptance-scenarios" ||
				check.Verdict != "pass" {
				continue
			}
			for _, scenario := range check.AcceptanceScenarios {
				out[scenario] = append(
					out[scenario],
					screenplayReviewTarget{
						Kind: review.Target.Kind,
						ID:   review.Target.ID,
					},
				)
			}
		}
	}
	return out
}

func screenplayAcceptanceShot(
	production string,
	scenario screenplayAcceptanceRecord,
) string {
	if scenario.Target.Kind == "shot" {
		if strings.TrimSpace(scenario.Target.ID) == "" ||
			(strings.TrimSpace(scenario.Criterion.Shot) != "" &&
				scenario.Criterion.Shot != scenario.Target.ID) {
			return ""
		}
		return scenario.Target.ID
	}
	if scenario.Target.Kind == "film" &&
		scenario.Target.ID == production &&
		strings.TrimSpace(scenario.Criterion.Shot) != "" {
		return scenario.Criterion.Shot
	}
	return ""
}

func screenplayRealizedShots(
	shots []string,
	realized map[string]screenplayRealizationRecord,
) map[string]bool {
	out := map[string]bool{}
	for _, shot := range shots {
		if _, exists := realized[shot]; exists {
			out[shot] = true
		}
	}
	return out
}

func screenplayHasPassedAcceptance(
	production string,
	scenarios []string,
	acceptance map[string]screenplayAcceptanceRecord,
	reviews map[string][]screenplayReviewTarget,
	realizedShots map[string]bool,
) bool {
	for _, scenarioID := range scenarios {
		scenario, exists := acceptance[scenarioID]
		if !exists {
			continue
		}
		shot := screenplayAcceptanceShot(production, scenario)
		if shot == "" || !realizedShots[shot] {
			continue
		}
		for _, target := range reviews[scenarioID] {
			if (target.Kind == "film" && target.ID == production) ||
				(target.Kind == "shot" && target.ID == shot) {
				return true
			}
		}
	}
	return false
}

func screenplayContinuityProven(
	production string,
	claim screenplayContinuityClaim,
	citingShots []string,
	citingAcceptance []string,
	acceptance map[string]screenplayAcceptanceRecord,
	realized map[string]screenplayRealizationRecord,
	reviews map[string][]screenplayReviewTarget,
) bool {
	if claim.Proof.Owner != claim.Verification {
		return false
	}
	if claim.Verification == "geometry" {
		if !screenplayStringMember(citingShots, claim.Proof.Shot) {
			return false
		}
		realization, exists := realized[claim.Proof.Shot]
		if !exists {
			return false
		}
		var outcomes []screenplayRealizationOutcome
		switch claim.Proof.Outcome.Kind {
		case "opening":
			outcomes = realization.Opening
		case "closing":
			outcomes = realization.Closing
		case "event":
			outcomes = realization.Events
		case "formation":
			outcomes = realization.Formations
		default:
			return false
		}
		for _, outcome := range outcomes {
			if outcome.ID == claim.Proof.Outcome.ID && outcome.Passed {
				return true
			}
		}
		return false
	}
	if !screenplayStringMember(
		citingAcceptance,
		claim.Proof.Scenario,
	) {
		return false
	}
	scenario, exists := acceptance[claim.Proof.Scenario]
	if !exists ||
		(claim.Verification == "frame-review" &&
			scenario.Criterion.Kind != "frame") {
		return false
	}
	allRealized := map[string]bool{}
	for shot := range realized {
		allRealized[shot] = true
	}
	return screenplayHasPassedAcceptance(
		production,
		[]string{claim.Proof.Scenario},
		acceptance,
		reviews,
		allRealized,
	)
}

func screenplayStringMember(values []string, expected string) bool {
	for _, value := range values {
		if value == expected {
			return true
		}
	}
	return false
}

func screenplayComparableProse(value string) string {
	// Markdown soft-wraps are presentation whitespace, not changes to the
	// authored sentence that the index quotes verbatim.
	return strings.Join(strings.Fields(value), " ")
}

func screenplaySortedKeys[T any](values map[string]T) []string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func readScreenplayDocument(
	ctx *rule.ProjectContext,
	root string,
	anchor string,
	kind string,
	raw string,
	allowed []string,
) (string, bool) {
	relative, problem := normalizeProjectPattern(raw)
	if problem != "" || isProjectGlob(relative) {
		ctx.Report(
			anchor + " names " + kind + " document path '" + raw +
				"', which is not one canonical project-relative file. Human prose has no stable comparison target. Correct the path and run lint again.",
		)
		return "", false
	}
	if !automovieMatchesAnyPattern(root, relative, allowed) {
		ctx.Report(
			anchor + " names " + kind + " document '" + relative +
				"', but it is outside the configured document inputs. Edits would not invalidate lint. Add the path to screenplay-contract documents and run lint again.",
		)
		return "", false
	}
	location := filepath.Join(root, filepath.FromSlash(relative))
	missing, ancestryProblem := inspectPhysicalProjectPath(root, location)
	if ancestryProblem != "" || missing {
		fact := ancestryProblem
		if missing {
			fact = "the file does not exist"
		}
		ctx.Report(
			anchor + " cannot read " + kind + " document '" + relative +
				"': " + fact +
				". The index dangles from human-authored prose. Restore a physical Markdown file and run lint again.",
		)
		return "", false
	}
	bytes, err := os.ReadFile(location)
	if err != nil {
		ctx.Report(
			anchor + " cannot read " + kind + " document '" + relative +
				"': " + err.Error() +
				". Its authored structure is unknown. Correct filesystem access and run lint again.",
		)
		return "", false
	}
	return string(bytes), true
}

var screenplayHeadingPattern = regexp.MustCompile(
	`^#{1,6}[ \t]+(SCN-[A-Za-z0-9-]+)[ \t]+(—|-|:)[ \t]+(.+?)[ \t]*$`,
)

func parseScreenplayMarkdown(content string) map[string][]screenplayMarkdownScene {
	out := map[string][]screenplayMarkdownScene{}
	var current *screenplayMarkdownScene
	var fence byte
	fenceLength := 0
	flush := func() {
		if current == nil {
			return
		}
		out[current.ID] = append(out[current.ID], *current)
	}
	for _, line := range strings.Split(strings.ReplaceAll(content, "\r\n", "\n"), "\n") {
		trimmed := strings.TrimLeft(line, " \t")
		if len(line)-len(trimmed) <= 3 && len(trimmed) >= 3 &&
			(trimmed[0] == '`' || trimmed[0] == '~') {
			marker := trimmed[0]
			length := 0
			for length < len(trimmed) && trimmed[length] == marker {
				length++
			}
			if fence == 0 && length >= 3 {
				fence = marker
				fenceLength = length
			} else if marker == fence &&
				length >= fenceLength &&
				strings.TrimSpace(trimmed[length:]) == "" {
				fence = 0
				fenceLength = 0
			}
		}
		if fence == 0 {
			match := screenplayHeadingPattern.FindStringSubmatch(line)
			if match != nil {
				flush()
				current = &screenplayMarkdownScene{
					ID:    match[1],
					Title: strings.TrimSpace(match[3]),
				}
				continue
			}
		}
		if current != nil {
			current.Body += line + "\n"
		}
	}
	flush()
	return out
}

var screenplayNumericIDPattern = regexp.MustCompile(`^SCN-[0-9]+$`)
var screenplayInsertedIDPattern = regexp.MustCompile(`^SCN-[A-Z]+[0-9]+$`)

func screenplaySceneID(id string) bool {
	return screenplayNumericIDPattern.MatchString(id) ||
		screenplayInsertedIDPattern.MatchString(id)
}

func readScreenplayJSON(file string, output any) string {
	bytes, err := os.ReadFile(file)
	if err != nil {
		return err.Error()
	}
	if err := json.Unmarshal(bytes, output); err != nil {
		return err.Error()
	}
	return ""
}

func automovieProjectFiles(
	root string,
	patterns []string,
	label string,
) ([]string, []string) {
	files := map[string]bool{}
	problems := []string{}
	for _, raw := range patterns {
		pattern, problem := normalizeProjectPattern(raw)
		if problem != "" {
			problems = append(problems, problem)
			continue
		}
		if !isProjectGlob(pattern) {
			location := filepath.Join(root, filepath.FromSlash(pattern))
			missing, ancestryProblem := inspectPhysicalProjectPath(root, location)
			if ancestryProblem != "" {
				problems = append(
					problems,
					label+" path '"+pattern+"' could not be inspected: "+
						ancestryProblem+
						". Its evidence stands down until the path is physical.",
				)
				continue
			}
			if missing {
				continue
			}
			info, err := os.Lstat(location)
			if err == nil && info.Mode().IsRegular() {
				files[location] = true
			} else if err != nil {
				problems = append(problems, err.Error())
			} else {
				problems = append(
					problems,
					label+" path '"+pattern+
						"' is not one project-owned regular file. Replace the link or special entry and run lint again.",
				)
			}
			continue
		}
		segments := strings.Split(pattern, "/")
		prefix := []string{}
		for _, segment := range segments {
			if isProjectGlob(segment) {
				break
			}
			prefix = append(prefix, segment)
		}
		base := root
		if len(prefix) != 0 {
			base = filepath.Join(root, filepath.FromSlash(strings.Join(prefix, "/")))
		}
		missing, ancestryProblem := inspectPhysicalProjectPath(root, base)
		if ancestryProblem != "" {
			problems = append(problems, ancestryProblem)
			continue
		}
		if missing {
			continue
		}
		err := filepath.WalkDir(base, func(location string, entry fs.DirEntry, walkError error) error {
			if walkError != nil {
				problems = append(problems, walkError.Error())
				if entry != nil && entry.IsDir() {
					return fs.SkipDir
				}
				return nil
			}
			relative, relativeError := filepath.Rel(root, location)
			if relativeError != nil {
				problems = append(problems, relativeError.Error())
				return nil
			}
			candidate := filepath.ToSlash(relative)
			if entry.Type()&os.ModeSymlink != 0 {
				matched, _ := matchProjectGlobOrPrefix(
					root,
					strings.Split(pattern, "/"),
					strings.Split(candidate, "/"),
				)
				if matched {
					problems = append(
						problems,
						label+" glob '"+pattern+
							"' encountered symbolic link '"+candidate+
							"'. Replace it with project-owned files and run lint again.",
					)
				}
				if entry.IsDir() {
					return fs.SkipDir
				}
				return nil
			}
			if entry.IsDir() {
				return nil
			}
			info, infoError := entry.Info()
			if infoError != nil || !info.Mode().IsRegular() {
				return nil
			}
			matched, matchError := matchProjectGlob(
				root,
				strings.Split(pattern, "/"),
				strings.Split(candidate, "/"),
			)
			if matchError != nil {
				problems = append(problems, matchError.Error())
			} else if matched {
				files[location] = true
			}
			return nil
		})
		if err != nil {
			problems = append(problems, err.Error())
		}
	}
	out := make([]string, 0, len(files))
	for file := range files {
		out = append(out, file)
	}
	sort.Strings(out)
	return out, problems
}

func automovieMatchesAnyPattern(
	root string,
	relative string,
	patterns []string,
) bool {
	for _, raw := range patterns {
		pattern, problem := normalizeProjectPattern(raw)
		if problem != "" {
			continue
		}
		if !isProjectGlob(pattern) && pattern == relative {
			return true
		}
		if isProjectGlob(pattern) {
			matched, _ := matchProjectGlob(
				root,
				strings.Split(pattern, "/"),
				strings.Split(relative, "/"),
			)
			if matched {
				return true
			}
		}
	}
	return false
}

func screenplayOwnedFiles(
	root string,
	prefix string,
	files []string,
) []string {
	out := []string{}
	for _, file := range files {
		relative := filepath.ToSlash(automovieRelative(root, file))
		if strings.HasPrefix(relative, prefix) {
			out = append(out, file)
		}
	}
	return out
}

func screenplayExactFiles(
	root string,
	expected []string,
	files []string,
) []string {
	allowed := map[string]bool{}
	for _, relative := range expected {
		allowed[relative] = true
	}
	out := []string{}
	for _, file := range files {
		relative := filepath.ToSlash(automovieRelative(root, file))
		if allowed[relative] {
			out = append(out, file)
		}
	}
	return out
}

func automovieRelative(root string, file string) string {
	relative, err := filepath.Rel(root, file)
	if err != nil {
		return file
	}
	return filepath.ToSlash(relative)
}

func itoa(value int) string {
	if value == 0 {
		return "0"
	}
	digits := []byte{}
	for value > 0 {
		digits = append([]byte{byte('0' + value%10)}, digits...)
		value /= 10
	}
	return string(digits)
}

func init() {
	rule.RegisterProject(screenplayContractRule{})
}
