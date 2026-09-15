import { TestValidator } from "@nestia/e2e";
import {
  dispatchAutoMovieCommandArguments,
  readAutoMovieCommandArguments,
} from "automovie";

import { throwsError } from "../internal/predicates";

/**
 * CLI admission consumes a whole request before a dispatcher can act.
 *
 * Scenarios:
 *
 * 1. Supported source commands preserve their explicitly supplied inputs.
 * 2. Missing, repeated, extra, unsupported and retired inputs refuse dispatch.
 * 3. Valid input invokes its dispatcher exactly once and returns its result.
 */
export const test_cli_command_arguments = (): void => {
  const read = (...args: string[]) => readAutoMovieCommandArguments(args);
  for (const args of [[], ["-h"], ["--help"]])
    TestValidator.equals("standalone help", read(...args), { command: "help" });
  for (const flag of ["-v", "--version"])
    TestValidator.equals("standalone version", read(flag), {
      command: "version",
    });
  for (const language of ["chinese", "english", "japanese", "korean"] as const)
    TestValidator.equals(
      "explicit project language",
      read("start", "project", "--language", language),
      {
        command: "start",
        directory: "project",
        language,
        force: false,
      },
    );
  TestValidator.equals(
    "explicit replacement authority",
    read("start", "--force", "project", "--language", "english"),
    {
      command: "start",
      directory: "project",
      language: "english",
      force: true,
    },
  );
  TestValidator.equals("index publication", read("toc"), {
    command: "toc",
    check: false,
  });
  TestValidator.equals("index observation", read("toc", "--check"), {
    command: "toc",
    check: true,
  });
  for (const kind of ["film", "brief", "library"] as const)
    TestValidator.equals("source capability routes", read("routes", kind), {
      command: "routes",
      kind,
    });
  for (const profile of [
    "gltf-static-v1",
    "gltf-humanoid-v1",
    "gltf-motion-v1",
    "vrm-humanoid-v1",
  ] as const)
    TestValidator.equals(
      "explicit external profile",
      read("inspect-external", "model.glb", "--profile", profile),
      {
        command: "inspect-external",
        path: "model.glb",
        profile,
      },
    );

  const invalid = [
    ["--help", "extra"],
    ["--version", "extra"],
    ["unknown"],
    ["migrate"],
    ["contracts", "migrate"],
    ["verify"],
    ["render", "all"],
    ["start"],
    ["start", "project"],
    ["start", "project", "--language"],
    ["start", "project", "--language", "--force"],
    ["start", "project", "--language", "unsupported"],
    ["start", "project", "--language", "english", "--language", "korean"],
    ["start", "project", "--language", "english", "--force", "--force"],
    ["start", "project", "--language", "english", "--unknown"],
    ["start", "one", "two", "--language", "english"],
    ["start", " ", "--language", "english"],
    ["sync"],
    ["sync", "extra"],
    ["toc", "--check", "--check"],
    ["toc", "--unknown"],
    ["routes"],
    ["routes", "unknown"],
    ["routes", "film", "extra"],
    ["inspect-external"],
    ["inspect-external", "one", "two"],
    ["inspect-external", "model.glb", "--profile"],
    ["inspect-external", "model.glb", "--profile", "--unknown"],
    ["inspect-external", "model.glb", "--profile", "unknown"],
    ["inspect-external", "model.glb", "--unknown"],
    [
      "inspect-external",
      "model.glb",
      "--profile",
      "gltf-static-v1",
      "--profile",
      "gltf-static-v1",
    ],
  ];
  let calls = 0;
  for (const args of invalid)
    TestValidator.predicate(
      "invalid request refuses before dispatch",
      throwsError(() => dispatchAutoMovieCommandArguments(args, () => ++calls)),
    );
  TestValidator.equals("no invalid input reaches effects", calls, 0);
  const result = dispatchAutoMovieCommandArguments(["--help"], (command) => {
    ++calls;
    return command;
  });
  TestValidator.equals("valid dispatch returns its selected command", result, {
    command: "help",
  });
  TestValidator.equals("valid dispatch runs once", calls, 1);
};
