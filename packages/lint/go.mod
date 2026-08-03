// This module exists only for local Go tooling.
//
// ttsc copies ./native into @ttsc/lint's generated contributor workspace and
// supplies these shim modules itself. The published contributor ships Go
// source, not a precompiled binary.
module github.com/samchon/automovie/packages/lint

go 1.26

require (
	github.com/microsoft/typescript-go/shim/ast v0.0.0
	github.com/microsoft/typescript-go/shim/checker v0.0.0
	github.com/samchon/ttsc/packages/lint v0.0.0
)

replace (
	github.com/microsoft/typescript-go/shim/ast => ./node_modules/ttsc/shim/ast
	github.com/microsoft/typescript-go/shim/checker => ./node_modules/ttsc/shim/checker
	github.com/samchon/ttsc/packages/lint => ./node_modules/@ttsc/lint
)
