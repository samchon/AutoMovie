import * as path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { parse, stringify } from "smol-toml";
import { z } from "zod";

import { digest } from "./internal/parseReference";
import { fail } from "./internal/referenceError";

const OWNER = "automovie_reference";
const BEGIN = "# automovie-reference managed begin v1";
const END = "# automovie-reference managed end v1";
const object = z.record(z.string(), z.unknown());
const command = {
  command: z.string(),
  args: z.tuple([z.string(), z.literal("--root"), z.string()]),
};
const claudeServer = z
  .object({ type: z.literal("stdio"), ...command })
  .strict();
const codexServer = z.object({ ...command, cwd: z.string() }).strict();

/**
 * Existing client configuration bytes and the installed production's launch identity.
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-transports Makes local registration an explicit candidate over user-owned configuration.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-transports Binds both client commands to the installed package and one absolute root.
 * @author Samchon
 */
export interface IAutoMovieReferenceClientConfigurationRequest {
  /** Normalized absolute production root that the installed reference binary will bind. */
  root: string;
  /** Normalized absolute current Node executable; no PATH lookup or installer is used. */
  nodeExecutable: string;
  /** Existing .mcp.json bytes decoded as text, or undefined when absent. */
  claude?: string;
  /** Existing .codex/config.toml text whose unrelated bytes must be preserved. */
  codex?: string;
}

/**
 * Two complete configuration candidates; publication remains the caller's operation.
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-transports Preserves the caller's ability to review and publish local registration separately from reference reads.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-transports Names only the two project-local client configuration outputs.
 * @author Samchon
 */
export interface IAutoMovieReferenceClientConfigurationPlan {
  /** Scoped Claude registration candidate; the caller decides whether to publish it. */
  claude: {
    /** Project-relative Claude configuration target. */
    path: ".mcp.json";
    /** Complete JSON candidate preserving all unrelated user configuration values. */
    content: string;
  };
  /** Scoped Codex registration candidate with an independently owned managed table. */
  codex: {
    /** Project-relative Codex configuration target. */
    path: ".codex/config.toml";
    /** Complete TOML candidate preserving bytes outside the owned registration span. */
    content: string;
  };
}

/**
 * Plan scoped Claude and Codex registration without writing files or installing tools.
 *
 * Claude ownership is the exact generated schema, current Node executable and
 * installed-bin/root relationship. Codex updates only an intact checksum-delimited
 * managed block; a matching unmarked registration is preserved byte-for-byte.
 * Other JSON values and all unrelated TOML bytes remain the user's configuration.
 *
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-transports Makes both clients discover the installed reference binary while preserving unrelated settings and refusing ownership conflicts.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-transports Produces deterministic project-local registration candidates whose command, args and cwd bind one production.
 */
export function planAutoMovieReferenceClientConfiguration(
  request: IAutoMovieReferenceClientConfigurationRequest,
): IAutoMovieReferenceClientConfigurationPlan {
  assertAbsolute(request.root);
  assertAbsolute(request.nodeExecutable);
  const args: [string, "--root", string] = [
    bin(request.root),
    "--root",
    request.root,
  ];
  const claude = {
    type: "stdio" as const,
    command: request.nodeExecutable,
    args,
  };
  const codex = { command: request.nodeExecutable, args, cwd: request.root };
  const document: Record<string, unknown> =
    request.claude === undefined ? {} : json(request.claude);
  const servers: Record<string, unknown> =
    document.mcpServers === undefined ? {} : record(document.mcpServers);
  const existing = servers[OWNER];
  if (existing !== undefined) {
    const admitted = claudeServer.safeParse(existing);
    if (!admitted.success || !owned(admitted.data, request.nodeExecutable))
      fail(
        "CONFIGURATION_CONFLICT",
        "The Claude automovie_reference entry is user-owned or edited.",
      );
  }
  const claudeContent =
    request.claude !== undefined && isDeepStrictEqual(existing, claude)
      ? request.claude
      : `${JSON.stringify({ ...document, mcpServers: { ...servers, [OWNER]: claude } }, null, 2)}\n`;
  return {
    claude: { path: ".mcp.json", content: claudeContent },
    codex: {
      path: ".codex/config.toml",
      content: planCodex(request.codex ?? "", codex, request.nodeExecutable),
    },
  };
}

function assertAbsolute(value: string): void {
  if (
    !path.isAbsolute(value) ||
    path.resolve(value) !== value ||
    value.includes("\0") ||
    value.includes("\r") ||
    value.includes("\n")
  )
    fail(
      "INVALID_ROOT",
      "Client registration requires normalized absolute root and Node executable paths.",
    );
}

function bin(root: string): string {
  return path.join(root, "node_modules", "@automovie", "mcp", "lib", "bin.js");
}

function record(input: unknown): Record<string, unknown> {
  const parsed = object.safeParse(input);
  return parsed.success
    ? parsed.data
    : fail(
        "CONFIGURATION_CONFLICT",
        "Client configuration and server maps must be objects.",
      );
}

function json(source: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    return fail(
      "INVALID_CONFIGURATION",
      "The existing Claude configuration is not valid JSON.",
    );
  }
  return record(value);
}

function toml(
  source: string,
  code:
    | "INVALID_CONFIGURATION"
    | "CONFIGURATION_CONFLICT" = "INVALID_CONFIGURATION",
): Record<string, unknown> {
  try {
    return parse(source, { integersAsBigInt: "asNeeded" });
  } catch {
    return fail(
      code,
      "Codex configuration cannot be parsed for this registration operation.",
    );
  }
}

function owned(
  value: { command: string; args: [string, "--root", string] },
  executable: string,
): boolean {
  const root = value.args[2];
  return (
    value.command === executable &&
    path.isAbsolute(root) &&
    path.resolve(root) === root &&
    value.args[0] === bin(root)
  );
}

function planCodex(
  source: string,
  next: z.infer<typeof codexServer>,
  executable: string,
): string {
  const document = toml(source);
  const servers: Record<string, unknown> =
    document.mcp_servers === undefined ? {} : record(document.mcp_servers);
  const existing = servers[OWNER];
  const body = `[mcp_servers.${OWNER}]\n${stringify(next).trimEnd()}\n`;
  const block = `${BEGIN} sha256:${digest(body)}\n${body}${END}\n`;
  const begins = [
    ...source.matchAll(
      /^# automovie-reference managed begin v1 sha256:([0-9a-f]{64})\r?\n/gmu,
    ),
  ];
  const ends = [
    ...source.matchAll(/^# automovie-reference managed end v1(?:\r?\n|$)/gmu),
  ];
  const marked = source.includes(BEGIN) || source.includes(END);
  if (!marked) {
    if (existing !== undefined) {
      if (!isDeepStrictEqual(existing, next))
        fail(
          "CONFIGURATION_CONFLICT",
          "An unmarked Codex automovie_reference entry conflicts with the installed production.",
        );
      return source;
    }
    const candidate = `${source}${source.length === 0 || source.endsWith("\n") ? "" : "\n"}${block}`;
    // The TOML parser owns whether an existing inline/dotted table may be extended.
    // A new absolute table header cannot change the preserved prefix's values.
    toml(candidate, "CONFIGURATION_CONFLICT");
    return candidate;
  }
  if (
    begins.length !== 1 ||
    ends.length !== 1 ||
    source.split(BEGIN).length !== 2 ||
    source.split(END).length !== 2
  )
    fail(
      "CONFIGURATION_CONFLICT",
      "Codex managed registration markers are incomplete or ambiguous.",
    );
  const begin = begins[0];
  const end = ends[0];
  const bodyStart = begin.index + begin[0].length;
  if (bodyStart > end.index)
    fail(
      "CONFIGURATION_CONFLICT",
      "Codex managed registration markers are reversed.",
    );
  const previousBody = source.slice(bodyStart, end.index);
  if (digest(previousBody) !== begin[1])
    fail(
      "CONFIGURATION_CONFLICT",
      "The managed Codex registration was edited; preserve and resolve the conflict explicitly.",
    );
  const previous = toml(previousBody, "CONFIGURATION_CONFLICT");
  const previousServers: Record<string, unknown> =
    previous.mcp_servers === undefined ? {} : record(previous.mcp_servers);
  const admitted = codexServer.safeParse(previousServers[OWNER]);
  const { mcp_servers: _servers, ...otherOptions } = previous;
  const { [OWNER]: _owner, ...otherServers } = previousServers;
  if (
    !admitted.success ||
    !owned(admitted.data, executable) ||
    admitted.data.cwd !== admitted.data.args[2] ||
    !isDeepStrictEqual(existing, admitted.data) ||
    Object.keys(otherOptions).length !== 0 ||
    Object.keys(otherServers).length !== 0
  )
    fail(
      "CONFIGURATION_CONFLICT",
      "The managed Codex block does not contain only the generated reference registration.",
    );
  const prefix = source.slice(0, begin.index);
  const suffix = source.slice(end.index + end[0].length);
  const rest = toml(prefix + suffix, "CONFIGURATION_CONFLICT");
  if (record(rest.mcp_servers ?? {})[OWNER] !== undefined)
    fail(
      "CONFIGURATION_CONFLICT",
      "Codex markers do not delimit an independent owned table.",
    );
  // The standalone body and complete document agree on the exact owned schema,
  // and removing the span removes that owner. Therefore the span is an actual
  // independent table, not marker text inside an unrelated multiline value.
  // Replace only that table; the prefix and suffix stay byte-for-byte intact.
  return prefix + block + suffix;
}
