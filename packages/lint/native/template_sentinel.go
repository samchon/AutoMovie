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
	return (start == 0 ||
		!isIdentifierContinue(before) && !identifierEscapeEndsAt(content, start)) &&
		(end == len(content) ||
			!isIdentifierContinue(after) && !identifierEscapeStartsAt(content, end))
}

func isIdentifierContinue(value rune) bool {
	return value == '$' ||
		value == '_' ||
		value == '\u200c' ||
		value == '\u200d' ||
		unicode.IsLetter(value) ||
		unicode.IsDigit(value) ||
		unicode.IsMark(value) ||
		unicode.Is(unicode.Pc, value) ||
		value == '\u00b7' ||
		value == '\u0387' ||
		value == '\u1369' ||
		value == '\u19da' ||
		value == '\u2118' ||
		value == '\u212e' ||
		value == '\u309b' ||
		value == '\u309c'
}

func identifierEscapeStartsAt(content string, start int) bool {
	if start+6 <= len(content) &&
		content[start] == '\\' &&
		content[start+1] == 'u' &&
		isHex(content[start+2:start+6]) {
		return true
	}
	if start+4 > len(content) ||
		content[start:start+3] != "\\u{" {
		return false
	}
	close := strings.IndexByte(content[start+3:], '}')
	return close >= 1 && close <= 6 &&
		isHex(content[start+3:start+3+close])
}

func identifierEscapeEndsAt(content string, end int) bool {
	if end >= 6 &&
		content[end-6:end-4] == "\\u" &&
		isHex(content[end-4:end]) {
		return true
	}
	if end < 5 || content[end-1] != '}' {
		return false
	}
	open := strings.LastIndex(content[:end-1], "\\u{")
	return open >= 0 && end-open >= 5 && end-open <= 10 &&
		isHex(content[open+3:end-1])
}

func isHex(value string) bool {
	if value == "" {
		return false
	}
	for _, digit := range value {
		if !(digit >= '0' && digit <= '9' ||
			digit >= 'a' && digit <= 'f' ||
			digit >= 'A' && digit <= 'F') {
			return false
		}
	}
	return true
}

func init() { rule.Register(templateSentinelRule{}) }
