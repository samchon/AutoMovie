package automovie

import (
	shimast "github.com/microsoft/typescript-go/shim/ast"

	"github.com/samchon/ttsc/packages/lint/rule"
)

// resolvedImportedSymbol asks the checker for binding identity and unwraps an
// import alias. Future coupled rules compare this symbol and its declarations;
// they never identify an engine or generated-SDK API from identifier spelling,
// which would mistake a same-named local shadow for the imported contract.
func resolvedImportedSymbol(
	ctx *rule.Context,
	identifier *shimast.Node,
) *shimast.Symbol {
	if ctx == nil || ctx.Checker == nil || identifier == nil ||
		identifier.Kind != shimast.KindIdentifier {
		return nil
	}
	symbol := ctx.Checker.GetSymbolAtLocation(identifier)
	if symbol == nil {
		return nil
	}
	if symbol.Flags&shimast.SymbolFlagsAlias != 0 {
		if target := ctx.Checker.GetAliasedSymbol(symbol); target != nil {
			symbol = target
		}
	}
	return ctx.Checker.GetMergedSymbol(symbol)
}
