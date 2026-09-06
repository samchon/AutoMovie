# create-automovie

Create a blank AutoMovie authoring repository with an explicit production language:

```bash
npx create-automovie my-film --language korean
```

Choose `chinese`, `english`, `japanese`, or `korean`; omission is an error, not a default language. This package delegates to `automovie`, so the command is equivalent to `npx automovie start my-film --language korean` with the same arguments.

Install dependencies in the created directory and run `npm run lint:source` for the blank-project check. Follow the generated `AGENTS.md` before design, compilation, or capture. The [CLI README](../cli/README.md#generated-project-routes) owns those entry routes and prerequisites.
