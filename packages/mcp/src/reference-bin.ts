#!/usr/bin/env node
import { runAutoMovieReferenceCommand } from "./runAutoMovieReferenceCommand";

void runAutoMovieReferenceCommand(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch(() => {
    process.stderr.write("automovie-reference: command output failed.\n");
    process.exitCode = 1;
  });
