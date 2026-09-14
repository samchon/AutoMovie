# @automovie/mcp

Read current production Markdown as compact indices and exact annotation-free source projections. The package provides four reference operations through one provider, a local JSON command, and a stdio MCP server. It does not run the production or own its graph, stage, review state or source.

This package name is reused for a new reference-only contract. The retired production application, guide getters, authoring tool catalog and stored review ledger are not compatibility exports. Existing production scripts and the `book` reader edition keep their separate contracts.

## Use

Generated projects install this package and expose `npm run reference`. The generated [production lifecycle](../template/scaffold/.agents/skills/production-lifecycle/index.md) owns the reference procedure and client registration instructions.

```sh
npm run reference -- --request '{"operation":"get_index_of_layer","layer":"settings"}'
npm run reference -- --request '{"operation":"get_index_of_file","file":"docs/settings/place.md"}'
npm run reference -- --request '{"operation":"read_section_without_annotations","location":"docs/settings/place.md#access"}'
```

The installed standalone binaries accept an explicit absolute production root. JSON quoting follows the invoking shell.

```sh
automovie-reference --root /absolute/production --request '{"operation":"read_file_without_annotations","file":"docs/settings/place.md","detail":true}'
automovie-mcp --root /absolute/production
```

Neither command installs dependencies or resolves a latest registry version while reading. MCP stdout belongs exclusively to the SDK protocol. Local stdout contains one `{ ok, data }` or `{ ok: false, error: { code, message } }` JSON envelope; startup diagnostics use stderr. Request failure exits the local command with status 1.

## Requests and results

| Operation | Required fields | Optional fields |
| --- | --- | --- |
| `get_index_of_layer` | `layer` | `limit`, `continuation`, `budgetBytes` |
| `get_index_of_file` | `file` | `budgetBytes` |
| `read_section_without_annotations` | `location` (`file#anchor`) | `expectedDigest`, `detail`, `budgetBytes` |
| `read_file_without_annotations` | `file` | `expectedDigest`, `detail`, `budgetBytes` |

Layers share the authoritative `@automovie/evidence` authored-layer tuple: settings, research, maps, models, spaces, materials, instances, motions, systems, treatments, scripts, screenplays and briefs. The reader never loads or executes `lint.config.ts`. Drafts, files without H1 and group indices without H2 are readable.

An index exposes source revision, source byte count, original title or `null`, compact source ranges, and H2/H3/H4 heading order and parent ordinal. Parent ordinals refer to original document headings, including its optional H1. Explicit anchors are the only section addresses. Drafts without anchors are `unaddressable`; repeated anchors are `ambiguous`. A section read separates the selected heading into metadata and preserves its original body and descendant headings until the next sibling or parent.

Revision is SHA-256 of the actual source UTF-8 bytes. Pass an index revision as `expectedDigest` when reading its section; `STALE_REFERENCE` means rediscover the current index. Coordinates carry zero-based UTF-16 `offset` and one-based `line` and UTF-16 `column`; range starts are inclusive and ends exclusive. File content retains headings and anchors. Detail is opt-in: concatenating the source slices in `projection.contentRanges` exactly reconstructs `content`.

Only actual comments in CommonMark HTML syntax are removed. Code examples, escapes, ordinary HTML, scene carriers, timing selectors, whitespace and line endings remain original. An unterminated block comment is omitted through EOF with a location-only `UNTERMINATED_ANNOTATION` diagnostic; an incomplete inline opener classified as ordinary Markdown text remains literal. Invalid UTF-8 fails. Filtered reference is not a substitute for canonical raw source when editing, checking annotations or reviewing a complete population.

## Bounds

`budgetBytes` measures the complete success envelope serialized as UTF-8 JSON, default 65,536, minimum 256 and maximum 1,048,576. Error envelopes are outside this success budget. Metadata counts against the budget; source characters are not tokens. Reads exceeding it return `BUDGET_EXCEEDED`, never partial content. Increase the budget or select a smaller section.

Layer pages default to 20 files and accept 1 through 100. A small response budget may return fewer complete file indices. `continuation: { revision, offset }` identifies the next page; modification of any file changes the layer revision and rejects old continuation. Layer revisions describe the ordered file snapshots observed during that request, not an atomic repository snapshot.

One file is limited to 8 MiB. A layer is limited to 10,000 files, 32 MiB total source bytes and 32 directory levels below its root. Hidden entries, including `.gitkeep`, are excluded. Disallowed populations, extensions, noncanonical paths, aliases and linked or special entries are refused. An absent layer is empty; a missing requested file is an error. Permission, physical identity, decoding, parsing, resource and unexpected I/O failures have distinct codes and sanitized messages.

## Public integration surface

`createAutoMovieReferenceReader(root, io?)` binds one absolute physical root. `createAutoMovieReferenceProvider(reader)` accepts unknown input and returns the shared typed result. `autoMovieReferenceSchemas` and `parseAutoMovieReferenceRequest` provide common admission. `registerAutoMovieReferenceTools`, `createAutoMovieMcpServer` and `startAutoMovieMcpServer` connect that provider to MCP. `runAutoMovieReferenceCommand(argv, runtime?)` returns a process exit status and supports an injected read/output capability.

`IAutoMovieReferenceReader`, `IAutoMovieReferenceFileSystem` and the source identity/result types expose read-only injection boundaries. Physical checks compare root and ancestor identities, realpaths, and lstat/handle metadata before and after bounded reads. These pathname observations do not provide an OS namespace lock against an adversary with unrestricted concurrent filesystem control. Pure cases exercise our admission and refusal policy; real Windows/POSIX, client registration, and packed-consumer observations remain separate validation.

`planAutoMovieReferenceClientConfiguration({ root, nodeExecutable, claude?, codex? })` synchronously returns `.mcp.json` and `.codex/config.toml` candidates without writing. It preserves unrelated JSON values and TOML bytes. Claude updates require the exact generated schema and installed-bin/root binding; Codex updates require an intact digest-marked block. The recorded Node executable is a fact about the machine that published the entry, so a registration written by another Node install is updated rather than refused. Matching current unmarked Codex registration remains untouched. Edited entries and conflicting unmarked entries require explicit reconciliation by the configuration owner. Client trust and enablement remain client decisions.

The CommonMark AST and HTML tokenizer are trusted dependencies. This package selects original source intervals from their syntax, without reproducing Markdown, evidence or MCP protocol parsers. It uses native dynamic imports for ESM Markdown parsing dependencies while publishing the repository's CommonJS package surface. Synchronous client planning uses the TOML package's published CommonJS entry with its public declaration types.

See the [product requirements](../../docs/requirements/agent-authoring/reference-navigation.md) and [system contract](../../docs/specifications/authoring-and-authority/reference-navigation.md) for the authoritative promises and source, budget, refusal and transport semantics.
