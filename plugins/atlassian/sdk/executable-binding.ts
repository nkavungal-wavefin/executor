import * as Schema from "effect/Schema";

export const AtlassianExecutableBindingSchema = Schema.Union(
  Schema.Struct({
    operation: Schema.Literal("jira.issue.get"),
    projectKey: Schema.String,
    cloudBaseUrl: Schema.String,
  }),
  Schema.Struct({
    operation: Schema.Literal("jira.issues.search"),
    projectKey: Schema.String,
    cloudBaseUrl: Schema.String,
  }),
  Schema.Struct({
    operation: Schema.Literal("confluence.pages.list"),
    spaceKey: Schema.String,
    spaceId: Schema.String,
    cloudBaseUrl: Schema.String,
  }),
  Schema.Struct({
    operation: Schema.Literal("confluence.page.get"),
    spaceKey: Schema.String,
    spaceId: Schema.String,
    cloudBaseUrl: Schema.String,
  }),
  Schema.Struct({
    operation: Schema.Literal("confluence.search"),
    spaceKey: Schema.String,
    spaceId: Schema.String,
    cloudBaseUrl: Schema.String,
  }),
);

export type AtlassianExecutableBinding = typeof AtlassianExecutableBindingSchema.Type;

const decodeBinding = Schema.decodeUnknownSync(AtlassianExecutableBindingSchema);

export const decodeAtlassianBinding = (binding: unknown): AtlassianExecutableBinding =>
  decodeBinding(binding);
