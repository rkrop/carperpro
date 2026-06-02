export * from "./generated/api";
export * from "./generated/types";
// `getProduct` has a path param, so the zod params schema in ./generated/api
// collides with the TS params type in ./generated/types. Prefer the zod schema
// (used for server-side validation) to resolve the star-export ambiguity.
export { GetProductParams } from "./generated/api";
