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
			if isProjectGlob(pattern) {
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
	problems := make([]string, 0)
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
				problems = append(problems, ancestryProblem)
				continue
			}
			if missing {
				continue
			}
			info, err := os.Lstat(location)
			if err == nil && info.Mode().IsRegular() {
				return true, ""
			}
			if err == nil && info.Mode()&os.ModeSymlink != 0 {
				problems = append(
					problems,
					"path '"+pattern+"' is a symbolic link rather than one project-owned regular file",
				)
				continue
			}
			if err == nil && !info.IsDir() {
				problems = append(
					problems,
					"path '"+pattern+"' is not one project-owned regular file",
				)
				continue
			}
			if err != nil && !os.IsNotExist(err) {
				problems = append(problems, err.Error())
			}
			continue
		}
		found, globProblem := projectGlobPresent(root, pattern)
		if globProblem != "" {
			problems = append(problems, globProblem)
			continue
		}
		if found {
			return true, ""
		}
	}
	if len(problems) != 0 {
		return false, strings.Join(problems, "; ")
	}
	return false, ""
}

func projectGlobPresent(root string, pattern string) (bool, string) {
	segments := strings.Split(pattern, "/")
	prefix := make([]string, 0, len(segments))
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
		return false, ancestryProblem
	}
	if missing {
		return false, ""
	}
	baseInfo, err := os.Lstat(base)
	if err != nil {
		if os.IsNotExist(err) {
			return false, ""
		}
		return false, err.Error()
	}
	if baseInfo.Mode()&os.ModeSymlink != 0 {
		return false, "glob prefix '" +
			filepath.ToSlash(strings.TrimPrefix(base, root+string(filepath.Separator))) +
			"' is a symbolic link rather than a project-owned directory"
	}
	if !baseInfo.IsDir() {
		return false, ""
	}
	found := false
	problems := make([]string, 0)
	err = filepath.WalkDir(base, func(location string, entry fs.DirEntry, err error) error {
		if err != nil {
			relative, relativeError := filepath.Rel(root, location)
			if relativeError != nil {
				problems = append(problems, relativeError.Error())
				return nil
			}
			candidateSegments := strings.Split(filepath.ToSlash(relative), "/")
			patternSegments := strings.Split(pattern, "/")
			if matchProjectGlob(root, patternSegments, candidateSegments) ||
				matchProjectGlobPrefix(root, patternSegments, candidateSegments) {
				problems = append(problems, err.Error())
			}
			if entry != nil && entry.IsDir() {
				return fs.SkipDir
			}
			return nil
		}
		if found {
			return fs.SkipAll
		}
		relative, relativeError := filepath.Rel(root, location)
		if relativeError != nil {
			return relativeError
		}
		candidate := filepath.ToSlash(relative)
		if entry.Type()&os.ModeSymlink != 0 {
			patternSegments := strings.Split(pattern, "/")
			candidateSegments := strings.Split(candidate, "/")
			if matchProjectGlob(root, patternSegments, candidateSegments) ||
				matchProjectGlobPrefix(root, patternSegments, candidateSegments) {
				problems = append(
					problems,
					(&symlinkPresenceError{path: candidate}).Error(),
				)
			}
			return nil
		}
		if entry.IsDir() {
			return nil
		}
		info, infoError := entry.Info()
		if infoError != nil {
			if matchProjectGlob(
				root,
				strings.Split(pattern, "/"),
				strings.Split(candidate, "/"),
			) {
				problems = append(problems, infoError.Error())
			}
			return nil
		}
		if !info.Mode().IsRegular() {
			return nil
		}
		if matchProjectGlob(
			root,
			strings.Split(pattern, "/"),
			strings.Split(candidate, "/"),
		) {
			found = true
			return fs.SkipAll
		}
		return nil
	})
	if err != nil && err != fs.SkipAll {
		return false, err.Error()
	}
	if found {
		return true, ""
	}
	return false, strings.Join(problems, "; ")
}

type symlinkPresenceError struct {
	path string
}

func (error *symlinkPresenceError) Error() string {
	return "glob encountered symbolic link '" + error.path +
		"'; replace it with project-owned files before evaluating state presence"
}

func isProjectGlob(pattern string) bool {
	return strings.ContainsAny(pattern, "*?")
}

func inspectPhysicalProjectPath(root string, location string) (bool, string) {
	relative, err := filepath.Rel(root, location)
	if err != nil || relative == ".." ||
		strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
		return false, "path escapes the physical TypeScript project root"
	}
	current := root
	segments := []string{}
	if relative != "." {
		segments = strings.Split(relative, string(filepath.Separator))
	}
	for _, segment := range segments {
		current = filepath.Join(current, segment)
		info, pathError := os.Lstat(current)
		if pathError != nil {
			if os.IsNotExist(pathError) {
				return true, ""
			}
			return false, pathError.Error()
		}
		if info.Mode()&os.ModeSymlink != 0 {
			return false, "path '" + filepath.ToSlash(relative) +
				"' crosses symbolic link '" +
				filepath.ToSlash(strings.TrimPrefix(
					current,
					root+string(filepath.Separator),
				)) +
				"' rather than staying in project-owned files"
		}
	}
	return false, ""
}

func hasWindowsDrivePrefix(value string) bool {
	return len(value) >= 2 &&
		(value[0] >= 'A' && value[0] <= 'Z' ||
			value[0] >= 'a' && value[0] <= 'z') &&
		value[1] == ':'
}

func matchProjectGlob(root string, pattern []string, candidate []string) bool {
	return matchProjectGlobAt(root, nil, pattern, candidate)
}

func matchProjectGlobAt(
	root string,
	parent []string,
	pattern []string,
	candidate []string,
) bool {
	if len(pattern) == 0 {
		return len(candidate) == 0
	}
	if pattern[0] == "**" {
		return matchProjectGlobAt(root, parent, pattern[1:], candidate) ||
			len(candidate) != 0 && matchProjectGlobAt(
				root,
				appendProjectSegment(parent, candidate[0]),
				pattern,
				candidate[1:],
			)
	}
	if len(candidate) == 0 {
		return false
	}
	directory := filepath.Join(
		append([]string{root}, filepath.FromSlash(strings.Join(parent, "/")))...,
	)
	return matchProjectSegment(
		[]rune(pattern[0]),
		[]rune(candidate[0]),
		directory,
		candidate[0],
		0,
	) && matchProjectGlobAt(
		root,
		appendProjectSegment(parent, candidate[0]),
		pattern[1:],
		candidate[1:],
	)
}

func matchProjectGlobPrefix(
	root string,
	pattern []string,
	candidate []string,
) bool {
	return matchProjectGlobPrefixAt(root, nil, pattern, candidate)
}

func matchProjectGlobPrefixAt(
	root string,
	parent []string,
	pattern []string,
	candidate []string,
) bool {
	if len(candidate) == 0 {
		return len(pattern) != 0
	}
	if len(pattern) == 0 {
		return false
	}
	if pattern[0] == "**" {
		return matchProjectGlobPrefixAt(root, parent, pattern[1:], candidate) ||
			matchProjectGlobPrefixAt(
				root,
				appendProjectSegment(parent, candidate[0]),
				pattern,
				candidate[1:],
			)
	}
	directory := filepath.Join(
		append([]string{root}, filepath.FromSlash(strings.Join(parent, "/")))...,
	)
	return matchProjectSegment(
		[]rune(pattern[0]),
		[]rune(candidate[0]),
		directory,
		candidate[0],
		0,
	) && matchProjectGlobPrefixAt(
		root,
		appendProjectSegment(parent, candidate[0]),
		pattern[1:],
		candidate[1:],
	)
}

func appendProjectSegment(parent []string, segment string) []string {
	next := make([]string, len(parent)+1)
	copy(next, parent)
	next[len(parent)] = segment
	return next
}

func matchProjectSegment(
	pattern []rune,
	candidate []rune,
	directory string,
	resident string,
	offset int,
) bool {
	if len(pattern) == 0 {
		return len(candidate) == 0
	}
	if pattern[0] == '*' {
		return matchProjectSegment(
			pattern[1:],
			candidate,
			directory,
			resident,
			offset,
		) || len(candidate) != 0 && matchProjectSegment(
			pattern,
			candidate[1:],
			directory,
			resident,
			offset+1,
		)
	}
	if len(candidate) == 0 {
		return false
	}
	return (pattern[0] == '?' ||
		equalProjectPathRune(
			directory,
			resident,
			offset,
			pattern[0],
			candidate[0],
		)) &&
		matchProjectSegment(
			pattern[1:],
			candidate[1:],
			directory,
			resident,
			offset+1,
		)
}

func equalProjectPathRune(
	directory string,
	resident string,
	offset int,
	left rune,
	right rune,
) bool {
	if left == right {
		return true
	}
	actual, actualError := os.Lstat(filepath.Join(directory, resident))
	if actualError != nil {
		return false
	}
	alternative := []rune(resident)
	if offset < 0 || offset >= len(alternative) {
		return false
	}
	alternative[offset] = left
	replacement, replacementError := os.Lstat(
		filepath.Join(directory, string(alternative)),
	)
	return replacementError == nil && os.SameFile(actual, replacement)
}

func init() {
	rule.RegisterProject(statePresenceRule{})
}
