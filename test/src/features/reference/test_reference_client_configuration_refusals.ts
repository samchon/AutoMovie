import { planAutoMovieReferenceClientConfiguration } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import * as path from "node:path";

import { digest } from "../../../../packages/mcp/src/internal/parseReference";

/**
 * Registration ownership never authorizes overwriting another client setting.
 *
 * Scenarios:
 * 1. Invalid roots, parse errors, non-object maps and edited server shapes refuse.
 * 2. Damaged, duplicated, reversed or edited managed TOML blocks refuse.
 * 3. Marker-looking text inside another value cannot become a writable region.
 */
export const test_reference_client_configuration_refusals = (): void => {
  const root = path.resolve(
    path.parse(process.cwd()).root,
    "reference-production",
  );
  const nodeExecutable = path.resolve(
    path.parse(process.cwd()).root,
    "tools/node",
  );
  const initial = planAutoMovieReferenceClientConfiguration({
    root,
    nodeExecutable,
  });
  const server = JSON.parse(initial.claude.content).mcpServers
    .automovie_reference;
  const begin = initial.codex.content.split("\n")[0];
  const end = "# automovie-reference managed end v1\n";
  const body = initial.codex.content.slice(
    begin.length + 1,
    initial.codex.content.indexOf(end),
  );
  const block = (candidate: string): string =>
    `# automovie-reference managed begin v1 sha256:${digest(candidate)}\n${candidate}${end}`;
  const cases: {
    root?: string;
    nodeExecutable?: string;
    claude?: string;
    codex?: string;
    code: string;
  }[] = [
    { root: "relative", code: "INVALID_ROOT" },
    { nodeExecutable: "node", code: "INVALID_ROOT" },
    {
      root: `${root}${path.sep}..${path.sep}reference-production`,
      code: "INVALID_ROOT",
    },
    { root: `${root}\n`, code: "INVALID_ROOT" },
    { claude: "not json", code: "INVALID_CONFIGURATION" },
    { claude: "[]", code: "CONFIGURATION_CONFLICT" },
    { claude: '{"mcpServers":null}', code: "CONFIGURATION_CONFLICT" },
    {
      claude: JSON.stringify({
        mcpServers: {
          automovie_reference: { ...server, env: { EDITED: "yes" } },
        },
      }),
      code: "CONFIGURATION_CONFLICT",
    },
    {
      claude: JSON.stringify({
        mcpServers: {
          automovie_reference: { ...server, command: "user-tool" },
        },
      }),
      code: "CONFIGURATION_CONFLICT",
    },
    {
      claude: JSON.stringify({
        mcpServers: {
          automovie_reference: { ...server, args: ["user.js", "--root", root] },
        },
      }),
      code: "CONFIGURATION_CONFLICT",
    },
    {
      claude: JSON.stringify({
        mcpServers: {
          automovie_reference: {
            ...server,
            args: ["user.js", "--root", "relative"],
          },
        },
      }),
      code: "CONFIGURATION_CONFLICT",
    },
    {
      claude: JSON.stringify({
        mcpServers: {
          automovie_reference: {
            ...server,
            args: ["user.js", "--root", `${root}${path.sep}.`],
          },
        },
      }),
      code: "CONFIGURATION_CONFLICT",
    },
    { codex: "invalid = [", code: "INVALID_CONFIGURATION" },
    { codex: "mcp_servers = 1", code: "CONFIGURATION_CONFLICT" },
    { codex: "mcp_servers = {}", code: "CONFIGURATION_CONFLICT" },
    {
      codex: "[mcp_servers.automovie_reference]\ncommand = 'user-tool'\n",
      code: "CONFIGURATION_CONFLICT",
    },
    { codex: `${begin}\n${body}`, code: "CONFIGURATION_CONFLICT" },
    { codex: `${end}${body}`, code: "CONFIGURATION_CONFLICT" },
    { codex: `${end}${begin}\n${body}`, code: "CONFIGURATION_CONFLICT" },
    {
      codex: `${begin}\n${begin}\n${body}${end}`,
      code: "CONFIGURATION_CONFLICT",
    },
    {
      codex: initial.codex.content.replace("cwd =", "user_edit ="),
      code: "CONFIGURATION_CONFLICT",
    },
    {
      codex: block(body.replace("cwd =", "user_edit =")),
      code: "CONFIGURATION_CONFLICT",
    },
    {
      codex: block(`${body}\n[other]\nvalue=1\n`),
      code: "CONFIGURATION_CONFLICT",
    },
    {
      codex: block(`${body}\n[mcp_servers.other]\ncommand='other-tool'\n`),
      code: "CONFIGURATION_CONFLICT",
    },
    { codex: block(""), code: "CONFIGURATION_CONFLICT" },
    { codex: block("mcp_servers = 1\n"), code: "CONFIGURATION_CONFLICT" },
    {
      codex: block(body.replace(/^cwd = .+$/mu, 'cwd = "different-root"')),
      code: "CONFIGURATION_CONFLICT",
    },
    {
      codex: block(
        body.replace(/^command = .+$/mu, 'command = "different-node"'),
      ),
      code: "CONFIGURATION_CONFLICT",
    },
    {
      codex: initial.codex.content + "user_edit = true\n",
      code: "CONFIGURATION_CONFLICT",
    },
    {
      codex: `memo = '''\n${initial.codex.content}'''\n${body}`,
      code: "CONFIGURATION_CONFLICT",
    },
  ];
  for (const item of cases) {
    let code = "success";
    try {
      planAutoMovieReferenceClientConfiguration({
        root,
        nodeExecutable,
        ...item,
      });
    } catch (error) {
      code = (error as { code: string }).code;
    }
    TestValidator.equals(
      `configuration refusal ${JSON.stringify(item)}`,
      code,
      item.code,
    );
  }
};
