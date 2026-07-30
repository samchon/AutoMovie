package automovie

import (
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/samchon/ttsc/packages/lint/rule"
)

const statePresenceRuleName = "automovie/state-presence"

type statePresenceOptions struct {
	Slots []statePresenceSlot `json:"slots"`
}

type statePresenceSlot struct {
	Name     string   `json:"name"`
	Files    []string `json:"files"`
	Requires []string `json:"requires"`
}

// statePresenceRule checks only graph residency. It never decodes a record, so
// a valid empty array remains present and prose can never affect the result.
type statePresenceRule struct{}

func (statePresenceRule) Name() string { return statePresenceRuleName }

func (statePresenceRule) NeedsTypeChecker() bool { return false }

func (statePresenceRule) AcceptsTtscLintOptions() bool { return true }

func (statePresenceRule) ProjectInputs(
	ctx *rule.ProjectInputContext,
) []rule.ProjectInput {
	if ctx == nil {
		return nil
	}
	var options statePresenceOptions
	if ctx.DecodeOptions(&options) != nil {
		return nil
	}
	inputs := make([]rule.ProjectInput, 0)
	seen := map[string]bool{}
	for _, slot := range options.Slots {
		for _, raw := range slot.Files {
			pattern, problem := normalizeProjectPattern(raw)
			if problem != "" || seen[pattern] {
				continue
			}
			seen[pattern] = true
			kind := rule.ProjectInputFile
			if strings.ContainsAny(pattern, "*?") {
				kind = rule.ProjectInputGlob
			}
			inputs = append(inputs, rule.ProjectInput{
				Kind:    kind,
				Pattern: pattern,
			})
		}
	}
	return inputs
}

func (statePresenceRule) Check(ctx *rule.ProjectContext) {
	if ctx == nil {
		return
	}
	var options statePresenceOptions
	if err := ctx.DecodeOptions(&options); err != nil {
		ctx.Report(
			"State-presence configuration could not be decoded: " + err.Error() +
				". The dependency graph cannot be evaluated, so no record ordering is proven. Correct the automovie/state-presence options and run the project's lint command again.",
		)
		return
	}
	root := ctx.Identity.PhysicalProjectRoot
	if root == "" {
		ctx.Report(
			"State-presence has no physical TypeScript project root. Record paths therefore have no stable filesystem base and the dependency graph cannot be evaluated. Run lint with a real tsconfig project path.",
		)
		return
	}
	slots, problem := validateStatePresenceOptions(options)
	if problem != "" {
		ctx.Report(problem)
		return
	}

	known := map[string]bool{}
	present := map[string]bool{}
	for _, slot := range slots {
		resident, matchProblem := slotPresent(root, slot.Files)
		if matchProblem != "" {
			ctx.Report(
				"State slot '" + slot.Name + "' could not be inspected: " +
					matchProblem +
					". Its residency is unknown, so obligations depending on it stand down. Correct the path or filesystem access and run the project's lint command again.",
			)
			continue
		}
		known[slot.Name] = true
		present[slot.Name] = resident
	}
	for _, slot := range slots {
		if !known[slot.Name] || !present[slot.Name] {
			continue
		}
		for _, upstream := range slot.Requires {
			if !known[upstream] {
				continue
			}
			if present[upstream] {
				continue
			}
			ctx.Report(
				"State slot '" + slot.Name + "' is present while required upstream slot '" +
					upstream +
					"' is absent. This leaves a downstream record resident without the fact graph it depends on, so compile or review could certify an orphan. Create the '" +
					upstream + "' record first or remove the '" + slot.Name +
					"' record, then run the project's lint command again.",
			)
		}
	}
}

func validateStatePresenceOptions(
	options statePresenceOptions,
) ([]statePresenceSlot, string) {
	if options.Slots == nil {
		return nil,
			"State-presence configuration has no 'slots' array. The rule has no dependency graph to evaluate. Supply the complete slots array, including an empty array when no slots are resident yet."
	}
	names := map[string]bool{}
	for _, slot := range options.Slots {
		if slot.Name == "" || strings.TrimSpace(slot.Name) != slot.Name {
			return nil,
				"State-presence configuration contains a slot with an empty or whitespace-padded name. Diagnostics need one stable slot identity. Give every slot a trimmed non-empty name."
		}
		if names[slot.Name] {
			return nil, "State-presence configuration declares slot '" + slot.Name +
				"' more than once. One name must identify one path population. Merge the duplicate definitions."
		}
		if len(slot.Files) == 0 {
			return nil, "State slot '" + slot.Name +
				"' has no files. Presence cannot be observed without a path. Add at least one project-relative file or glob."
		}
		names[slot.Name] = true
	}
	for _, slot := range options.Slots {
		for _, upstream := range slot.Requires {
			if !names[upstream] {
				return nil, "State slot '" + slot.Name + "' requires unknown slot '" +
					upstream +
					"'. The dependency edge has no observable upstream. Declare that slot or correct the requires entry."
			}
		}
		for _, raw := range slot.Files {
			if _, problem := normalizeProjectPattern(raw); problem != "" {
				return nil, "State slot '" + slot.Name + "' has path '" + raw +
					"': " + problem +
					" Correct the files entry so it stays inside the TypeScript project root."
			}
		}
	}
	return options.Slots, ""
}

func normalizeProjectPattern(raw string) (string, string) {
	if raw == "" || strings.TrimSpace(raw) != raw {
		return "", "the path must be trimmed and non-empty."
	}
	normalized := strings.TrimPrefix(strings.ReplaceAll(raw, "\\", "/"), "./")
	normalized = path.Clean(normalized)
	if normalized == "." || path.IsAbs(normalized) ||
		strings.HasPrefix(normalized, "//") || hasWindowsDrivePrefix(normalized) ||
		normalized == ".." || strings.HasPrefix(normalized, "../") {
		return "", "the path must be project-relative and may not escape with '..'."
	}
	return normalized, ""
}

func slotPresent(root string, patterns []string) (bool, string) {
	for _, raw := range patterns {
		pattern, problem := normalizeProjectPattern(raw)
		if problem != "" {
			return false, problem
		}
		if !strings.ContainsAny(pattern, "*?") {
			info, err := os.Stat(filepath.Join(root, filepath.FromSlash(pattern)))
			if err == nil && !info.IsDir() {
				return true, ""
			}
			if err != nil && !os.IsNotExist(err) {
				return false, err.Error()
			}
			continue
		}
		found, globProblem := projectGlobPresent(root, pattern)
		if globProblem != "" {
			return false, globProblem
		}
		if found {
			return true, ""
		}
	}
	return false, ""
}

func projectGlobPresent(root string, pattern string) (bool, string) {
	segments := strings.Split(pattern, "/")
	prefix := make([]string, 0, len(segments))
	for _, segment := range segments {
		if strings.ContainsAny(segment, "*?") {
			break
		}
		prefix = append(prefix, segment)
	}
	base := root
	if len(prefix) != 0 {
		base = filepath.Join(root, filepath.FromSlash(strings.Join(prefix, "/")))
	}
	if _, err := os.Stat(base); err != nil {
		if os.IsNotExist(err) {
			return false, ""
		}
		return false, err.Error()
	}
	found := false
	err := filepath.WalkDir(base, func(location string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if found || entry.IsDir() {
			return nil
		}
		relative, relativeError := filepath.Rel(root, location)
		if relativeError != nil {
			return relativeError
		}
		candidate := filepath.ToSlash(relative)
		if matchProjectGlob(strings.Split(pattern, "/"), strings.Split(candidate, "/")) {
			found = true
		}
		return nil
	})
	if err != nil {
		return false, err.Error()
	}
	return found, ""
}

func hasWindowsDrivePrefix(value string) bool {
	return len(value) >= 2 &&
		(value[0] >= 'A' && value[0] <= 'Z' ||
			value[0] >= 'a' && value[0] <= 'z') &&
		value[1] == ':'
}

func matchProjectGlob(pattern []string, candidate []string) bool {
	if len(pattern) == 0 {
		return len(candidate) == 0
	}
	if pattern[0] == "**" {
		return matchProjectGlob(pattern[1:], candidate) ||
			len(candidate) != 0 && matchProjectGlob(pattern, candidate[1:])
	}
	if len(candidate) == 0 {
		return false
	}
	matched, err := path.Match(pattern[0], candidate[0])
	return err == nil && matched &&
		matchProjectGlob(pattern[1:], candidate[1:])
}

func init() {
	rule.RegisterProject(statePresenceRule{})
}
