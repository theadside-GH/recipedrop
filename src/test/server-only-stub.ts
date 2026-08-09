/**
 * Test stand-in for the "server-only" marker package, which throws when
 * imported outside a React Server environment. Tests exercise server modules
 * directly, so the guard is aliased away in vitest.config.ts.
 */
export {};
