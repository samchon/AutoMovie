package automovie

import (
	"crypto/sha256"
	"encoding/hex"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/samchon/ttsc/packages/lint/rule"
)

const assetProvenanceRuleName = "automovie/asset-provenance"

type assetProvenanceOptions struct {
	Manifests []string `json:"manifests"`
	Assets    []string `json:"assets"`
}

type assetProvenanceManifest struct {
	Version int                     `json:"version"`
	Assets  []assetProvenanceRecord `json:"assets"`
}

type assetProvenanceRecord struct {
	Path     string `json:"path"`
	Digest   string `json:"digest"`
	Original struct {
		URL    string `json:"url"`
		Digest string `json:"digest"`
	} `json:"original"`
	License struct {
		Identifier string `json:"identifier"`
		URL        string `json:"url"`
		Notice     string `json:"notice"`
	} `json:"license"`
	Processing []struct {
		Tool       string         `json:"tool"`
		Command    string         `json:"command"`
		Parameters map[string]any `json:"parameters"`
	} `json:"processing"`
	Uses []struct {
		Kind   string `json:"kind"`
		Target string `json:"target"`
		Reason string `json:"reason"`
	} `json:"uses"`
	Model *struct {
		IngestProfile string `json:"ingestProfile"`
		LOD           []struct {
			Level string `json:"level"`
			Asset string `json:"asset"`
		} `json:"lod"`
		CollisionProxy   string `json:"collisionProxy"`
		MeasurementProxy string `json:"measurementProxy"`
	} `json:"model"`
}

type assetProvenanceRule struct{}

func (assetProvenanceRule) Name() string { return assetProvenanceRuleName }

func (assetProvenanceRule) NeedsTypeChecker() bool { return false }

func (assetProvenanceRule) AcceptsTtscLintOptions() bool { return true }

func (assetProvenanceRule) ProjectInputs(
	ctx *rule.ProjectInputContext,
) []rule.ProjectInput {
	if ctx == nil {
		return nil
	}
	var options assetProvenanceOptions
	if ctx.DecodeOptions(&options) != nil {
		return nil
	}
	patterns := append([]string{}, options.Manifests...)
	patterns = append(patterns, options.Assets...)
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

func (assetProvenanceRule) Check(ctx *rule.ProjectContext) {
	if ctx == nil {
		return
	}
	var options assetProvenanceOptions
	if err := ctx.DecodeOptions(&options); err != nil {
		ctx.Report(
			"Asset-provenance configuration could not be decoded: " +
				err.Error() +
				". Asset bytes and their distribution rights cannot be joined. Correct the automovie/asset-provenance options and run lint again.",
		)
		return
	}
	if len(options.Manifests) == 0 || len(options.Assets) == 0 {
		ctx.Report(
			"Asset-provenance requires non-empty manifests and assets path lists. An unobserved file family could ship without rights or byte identity. Configure both and run lint again.",
		)
		return
	}
	root := ctx.Identity.PhysicalProjectRoot
	if root == "" {
		ctx.Report(
			"Asset-provenance has no physical TypeScript project root. Asset bytes cannot be hashed against a stable filesystem base. Run lint with a real tsconfig project path.",
		)
		return
	}
	manifests, manifestProblems := automovieProjectFiles(
		root,
		options.Manifests,
		"Asset-provenance",
	)
	assets, assetProblems := automovieProjectFiles(
		root,
		options.Assets,
		"Asset-provenance",
	)
	for _, problems := range [][]string{manifestProblems, assetProblems} {
		for _, problem := range problems {
			ctx.Report(problem)
		}
	}
	if len(manifests) == 0 {
		if len(assets) != 0 {
			ctx.Report(
				"Asset-provenance found " + itoa(len(assets)) +
					" distributable asset file(s), but no physical asset manifest. Their source, license and original identity are unknown. Restore .automovie/assets.json and run lint again.",
			)
		}
		return
	}
	if len(manifests) != 1 {
		ctx.Report(
			"Asset-provenance found " + itoa(len(manifests)) +
				" manifests. One project-global ledger must own every asset exactly once. Keep only the canonical manifest and run lint again.",
		)
		return
	}
	checkAssetProvenanceManifest(
		ctx,
		root,
		manifests[0],
		options.Assets,
		assets,
	)
}

func checkAssetProvenanceManifest(
	ctx *rule.ProjectContext,
	root string,
	manifestFile string,
	allowed []string,
	assetFiles []string,
) {
	relativeManifest := automovieRelative(root, manifestFile)
	anchor := "Asset manifest '" + relativeManifest + "'"
	var manifest assetProvenanceManifest
	if problem := readScreenplayJSON(manifestFile, &manifest); problem != "" {
		ctx.Report(
			anchor + " could not be decoded: " + problem +
				". Asset identity and distribution rights are unknown. Restore valid JSON and run lint again.",
		)
		return
	}
	if manifest.Version != 1 {
		ctx.Report(
			anchor + " does not declare version 1. No supported provenance contract owns its entries. Correct the version and run lint again.",
		)
		return
	}

	physical := map[string]string{}
	for _, file := range assetFiles {
		relative := filepath.ToSlash(automovieRelative(root, file))
		folded := strings.ToLower(relative)
		if prior, exists := physical[folded]; exists &&
			filepath.ToSlash(automovieRelative(root, prior)) != relative {
			ctx.Report(
				anchor + " finds physical asset path '" + relative +
					"' colliding case-insensitively with '" +
					filepath.ToSlash(automovieRelative(root, prior)) +
					"'. Keep one portable path spelling before distribution.",
			)
		}
		physical[folded] = file
	}
	entries := map[string]assetProvenanceRecord{}
	previous := ""
	for index, asset := range manifest.Assets {
		owner := anchor + " asset[" + itoa(index) + "]"
		normalized, pathProblem := normalizeProjectPattern(asset.Path)
		if pathProblem != "" ||
			isProjectGlob(normalized) ||
			normalized != asset.Path ||
			!automovieMatchesAnyPattern(root, normalized, allowed) {
			ctx.Report(
				owner + " path '" + asset.Path +
					"' is not one canonical project-relative file covered by the configured asset inputs. Correct the path or lint configuration and run lint again.",
			)
		}
		if previous != "" && previous >= asset.Path {
			ctx.Report(
				owner + " is not in unique code-unit path order after '" +
					previous +
					"'. Sort the ledger and remove duplicates so its identity is deterministic.",
			)
		}
		previous = asset.Path
		folded := strings.ToLower(asset.Path)
		if prior, exists := entries[folded]; exists {
			ctx.Report(
				owner + " path '" + asset.Path +
					"' collides case-insensitively with '" + prior.Path +
					"'. One physical asset needs one portable identity.",
			)
		}
		entries[folded] = asset
		file, exists := physical[folded]
		if !exists {
			ctx.Report(
				owner + " points to missing asset '" + asset.Path +
					"'. Restore the exact bytes or remove the dangling ledger entry.",
			)
		} else {
			bytes, err := os.ReadFile(file)
			if err != nil {
				ctx.Report(
					owner + " could not read asset '" + asset.Path + "': " +
						err.Error() +
						". Its current identity cannot be certified. Correct filesystem access and run lint again.",
				)
			} else {
				sum := sha256.Sum256(bytes)
				actual := "sha256:" + hex.EncodeToString(sum[:])
				if asset.Digest != actual {
					ctx.Report(
						owner + " records digest '" + asset.Digest +
							"', but current bytes are '" + actual +
							"'. Restore the licensed bytes or update provenance from the verified source.",
					)
				}
			}
		}
		validateAssetProvenanceRecord(ctx, owner, asset)
	}
	for _, file := range assetFiles {
		relative := filepath.ToSlash(automovieRelative(root, file))
		if _, exists := entries[strings.ToLower(relative)]; !exists {
			ctx.Report(
				anchor + " has no entry for distributable asset '" + relative +
					"'. Source, license, original digest, processing and use are unaccounted. Add the record and run lint again.",
			)
		}
	}
	for _, asset := range manifest.Assets {
		for _, lod := range asset.ModelLOD() {
			if _, exists := entries[strings.ToLower(lod.Asset)]; !exists {
				ctx.Report(
					anchor + " model asset '" + asset.Path + "' LOD '" +
						lod.Level + "' cites unknown manifest asset '" +
						lod.Asset +
						"'. Ground every level in the same byte ledger and run lint again.",
				)
			}
		}
	}
}

func validateAssetProvenanceRecord(
	ctx *rule.ProjectContext,
	owner string,
	asset assetProvenanceRecord,
) {
	if !assetDigestPattern.MatchString(asset.Digest) ||
		!assetDigestPattern.MatchString(asset.Original.Digest) ||
		!assetHTTPURL(asset.Original.URL) ||
		strings.TrimSpace(asset.License.Identifier) == "" ||
		!assetHTTPURL(asset.License.URL) ||
		len(asset.Uses) == 0 {
		ctx.Report(
			owner + " lacks a current/original SHA-256, source URL, license identity/URL, or use ledger. Distribution rights and byte identity are incomplete. Fill every field and run lint again.",
		)
	}
	for index, step := range asset.Processing {
		if strings.TrimSpace(step.Tool) == "" ||
			strings.TrimSpace(step.Command) == "" ||
			step.Parameters == nil {
			ctx.Report(
				owner + " processing[" + itoa(index) +
					"] lacks tool, command or explicit parameters. The derived bytes are not reproducible. Complete the step and run lint again.",
			)
		}
	}
	if len(asset.Processing) == 0 &&
		asset.Digest != asset.Original.Digest {
		ctx.Report(
			owner + " current bytes differ from the original digest but the processing chain is empty. Record every transformation and run lint again.",
		)
	}
	for index, use := range asset.Uses {
		if !assetUseKind[use.Kind] ||
			strings.TrimSpace(use.Target) == "" ||
			strings.TrimSpace(use.Reason) == "" {
			ctx.Report(
				owner + " use[" + itoa(index) +
					"] lacks a supported kind, target or reason. The asset has no auditable production purpose. Correct the use ledger and run lint again.",
			)
		}
	}
	if assetModelPath(asset.Path) {
		if asset.Model == nil ||
			strings.TrimSpace(asset.Model.IngestProfile) == "" ||
			len(asset.Model.LOD) == 0 ||
			strings.TrimSpace(asset.Model.CollisionProxy) == "" ||
			strings.TrimSpace(asset.Model.MeasurementProxy) == "" {
			ctx.Report(
				owner + " is an external model without ingest profile, explicit LOD, collision proxy or measurement proxy. Record all four model decisions and run lint again.",
			)
		} else {
			for index, lod := range asset.Model.LOD {
				if strings.TrimSpace(lod.Level) == "" ||
					strings.TrimSpace(lod.Asset) == "" {
					ctx.Report(
						owner + " model.lod[" + itoa(index) +
							"] lacks level or manifest asset identity. Make every LOD explicit and run lint again.",
					)
				}
			}
		}
	}
}

func (asset assetProvenanceRecord) ModelLOD() []struct {
	Level string `json:"level"`
	Asset string `json:"asset"`
} {
	if asset.Model == nil {
		return nil
	}
	return asset.Model.LOD
}

var assetDigestPattern = regexp.MustCompile(`^sha256:[0-9a-f]{64}$`)

var assetUseKind = map[string]bool{
	"audio":   true,
	"model":   true,
	"texture": true,
	"font":    true,
	"other":   true,
}

func assetHTTPURL(value string) bool {
	parsed, err := url.Parse(value)
	return err == nil &&
		(parsed.Scheme == "http" || parsed.Scheme == "https") &&
		parsed.Host != ""
}

func assetModelPath(value string) bool {
	extension := strings.ToLower(filepath.Ext(value))
	return extension == ".gltf" ||
		extension == ".glb" ||
		extension == ".vrm"
}

func init() {
	rule.RegisterProject(assetProvenanceRule{})
}
