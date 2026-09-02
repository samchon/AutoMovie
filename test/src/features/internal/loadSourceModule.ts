/** Load one private TypeScript module through the test runner's require hook. */
export const loadSourceModule = <T>(file: string): T => require(file) as T;
