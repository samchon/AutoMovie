package automovie

import (
	"strings"
	"unicode"
	"unicode/utf8"

	shimast "github.com/microsoft/typescript-go/shim/ast"

	"github.com/samchon/ttsc/packages/lint/rule"
)

const (
	templateSentinelRuleName = "automovie/template-sentinel"
	templateSentinel         = "AUTOMOVIE_IMPLEMENT_ME"
)

// templateSentinelRule rejects a scaffold placeholder only after it is present
// in a compiled source file. A fresh or otherwise empty project is silent.
type templateSentinelRule struct{}

func (templateSentinelRule) Name() string { return templateSentinelRuleName }

func (templateSentinelRule) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindSourceFile}
}

func (templateSentinelRule) NeedsTypeChecker() bool { return false }

func (templateSentinelRule) VisitsDeclarationFiles() bool { return false }

func (templateSentinelRule) AcceptsTtscLintOptions() bool { return false }

func (templateSentinelRule) Check(ctx *rule.Context, node *shimast.Node) {
	if ctx == nil || ctx.File == nil || node == nil || node.Kind != shimast.KindSourceFile {
		return
	}
	content := ctx.File.Text()
	offset := 0
	for {
		index := strings.Index(content[offset:], templateSentinel)
		if index < 0 {
			return
		}
		start := offset + index
		end := start + len(templateSentinel)
		offset = end
		if !isSentinelBoundary(content, start, end) {
			continue
		}
		ctx.ReportRange(
			start,
			end,
			"Template sentinel 'AUTOMOVIE_IMPLEMENT_ME' remains in compiled source. "+
				"This placeholder says the scaffold section has no implementation, so downstream compile or review cannot treat it as resident work. "+
				"Implement the marked section, remove the exact sentinel, and run the project's lint command again.",
		)
	}
}

func isSentinelBoundary(content string, start int, end int) bool {
	before, _ := utf8.DecodeLastRuneInString(content[:start])
	after, _ := utf8.DecodeRuneInString(content[end:])
	return (start == 0 || !isIdentifierContinue(before)) &&
		(end == len(content) || !isIdentifierContinue(after))
}

func isIdentifierContinue(value rune) bool {
	return value == '$' ||
		value == '_' ||
		value == '\u200c' ||
		value == '\u200d' ||
		unicode.IsLetter(value) ||
		unicode.IsDigit(value) ||
		unicode.IsMark(value) ||
		unicode.Is(unicode.Pc, value)
}

func init() { rule.Register(templateSentinelRule{}) }
