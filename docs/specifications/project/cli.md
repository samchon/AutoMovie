# Project lifecycle

## Portable project-state gates {#portable-project-state-gates}

<!-- @evidence requirements/07-non-functional.md#portable-licensed-proved Keeps scaffold and project state checks portable across the declared workspace platforms. -->

`@automovie/cli` normalizes scaffold paths and line endings, records template versions, and refuses stale or unsafe project state before it writes files. Build, formatting, license, and test gates remain repository commands rather than hidden CLI behavior.
