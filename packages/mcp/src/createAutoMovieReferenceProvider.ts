import {
  digest,
  indexReference,
  parseReference,
  readReference,
} from "./internal/parseReference";
import {
  MAX_FILES,
  MAX_LAYER_BYTES,
  MAX_SOURCE_BYTES,
  ReferenceError,
  fail,
} from "./internal/referenceError";
import {
  admitReferencePath,
  splitReferenceLocation,
} from "./internal/referencePath";
import {
  autoMovieReferenceRequestError,
  parseAutoMovieReferenceRequest,
} from "./referenceRequest";
import type {
  AutoMovieReferenceResult,
  IAutoMovieReferenceLayerIndex,
  IAutoMovieReferenceReader,
} from "./structures/IAutoMovieReference";

/**
 * Bind four stateless reference operations to a read-only source capability.
 *
 * Each request reads current bytes. Layer continuation hashes the complete ordered
 * file revisions observed by that request, without claiming atomicity across files.
 *
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-selection Resolves actual authored files and explicit heading subtrees through one provider.
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-source Derives indices and content from current bytes and rejects stale digests.
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-bounds Enforces source, population, pagination and serialized-response budgets with classified refusals.
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-isolation Gives every request only the bound reader capability and never invokes graph or production execution.
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-transports Supplies the same result envelope to MCP and the local JSON command.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-selection Resolves section identity and hierarchy from the same parsed file snapshot.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-source Uses byte digests and exact source intervals for every projection.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-bounds Binds continuation to ordered revisions and refuses responses that cannot fit one complete result.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-isolation Admits only authored Markdown paths and performs no writes or runtime calls.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-transports Dispatches the four operation discriminants without maintaining client state.
 */
export function createAutoMovieReferenceProvider(
  reader: IAutoMovieReferenceReader,
): (input: unknown) => Promise<AutoMovieReferenceResult> {
  return async (input) => {
    const request = parseAutoMovieReferenceRequest(input);
    if (request === null)
      return {
        ok: false,
        error: autoMovieReferenceRequestError(input),
      };
    try {
      const fits = (data: unknown): boolean =>
        Buffer.byteLength(JSON.stringify({ ok: true, data }), "utf8") <=
        request.budgetBytes;
      const load = async (file: string) => {
        admitReferencePath(file);
        return parseReference(file, await reader.read(file));
      };
      let data: Extract<AutoMovieReferenceResult, { ok: true }>["data"];
      switch (request.operation) {
        case "get_index_of_layer": {
          const paths = [...(await reader.list(request.layer))].sort(
            (a, b) => Number(a > b) - Number(a < b),
          );
          if (paths.length > MAX_FILES)
            fail("RESOURCE_LIMIT", "Layer exceeds the 10,000 file limit.");
          if (
            new Set(paths).size !== paths.length ||
            paths.some((file) => !file.startsWith(`docs/${request.layer}/`))
          )
            fail(
              "PATH_IDENTITY_CHANGED",
              "Layer inventory contains an aliased or mismatched identity.",
            );
          const files: { file: string; bytes: Uint8Array; revision: string }[] =
            [];
          let sourceBytes = 0;
          for (const file of paths) {
            admitReferencePath(file);
            const inputBytes = await reader.read(file);
            if (inputBytes.byteLength > MAX_SOURCE_BYTES)
              fail("RESOURCE_LIMIT", "Source exceeds the 8 MiB file limit.");
            sourceBytes += inputBytes.byteLength;
            if (sourceBytes > MAX_LAYER_BYTES)
              fail("RESOURCE_LIMIT", "Layer exceeds the 32 MiB source limit.");
            // An injected reader may reuse its buffer on the next read.
            const bytes = Uint8Array.from(inputBytes);
            files.push({ file, bytes, revision: digest(bytes) });
          }
          const revision = digest(
            JSON.stringify(
              files.map(({ file, revision: fileRevision }) => [
                file,
                fileRevision,
              ]),
            ),
          );
          if (
            request.continuation !== undefined &&
            request.continuation.revision !== revision
          )
            fail(
              "STALE_REFERENCE",
              "Layer changed; restart its index without a continuation.",
            );
          const offset = request.continuation?.offset ?? 0;
          if (offset > files.length)
            fail(
              "INVALID_CONTINUATION",
              "Continuation offset exceeds this layer; restart the index.",
            );
          const page: IAutoMovieReferenceLayerIndex = {
            layer: request.layer,
            revision,
            atomic: false,
            total: files.length,
            files: [],
            continuation: null,
          };
          const limit = Math.min(offset + (request.limit ?? 20), files.length);
          for (let cursor = offset; cursor < limit; ++cursor) {
            const item = files[cursor];
            page.files.push(
              indexReference(await parseReference(item.file, item.bytes)),
            );
            page.continuation =
              cursor + 1 < files.length
                ? { revision, offset: cursor + 1 }
                : null;
            if (!fits(page)) {
              page.files.pop();
              page.continuation = { revision, offset: cursor };
              if (page.files.length === 0)
                fail(
                  "BUDGET_EXCEEDED",
                  "A file index exceeds the response budget; increase budgetBytes or read a known section directly.",
                );
              break;
            }
          }
          data = page;
          break;
        }
        case "get_index_of_file":
          data = indexReference(await load(request.file));
          break;
        case "read_file_without_annotations":
          data = readReference(await load(request.file), request);
          break;
        case "read_section_without_annotations": {
          const location = splitReferenceLocation(request.location);
          data = readReference(await load(location.file), {
            ...request,
            anchor: location.anchor,
          });
          break;
        }
      }
      if (!fits(data))
        fail(
          "BUDGET_EXCEEDED",
          "Result exceeds the response budget; read a smaller section or increase budgetBytes.",
        );
      return { ok: true, data };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof ReferenceError
            ? { code: error.code, message: error.message }
            : {
                code: "IO_ERROR",
                message:
                  "Reference read failed; inspect the canonical source and local access permissions.",
              },
      };
    }
  };
}
