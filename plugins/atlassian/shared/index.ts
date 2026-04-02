import * as Schema from "effect/Schema";

import { SecretRefSchema } from "@executor/platform-sdk/schema";

export const AtlassianConnectionAuthSchema = Schema.Struct({
  kind: Schema.Literal("basic"),
  email: Schema.String,
  apiTokenRef: SecretRefSchema,
});

/**
 * Atlassian connection input schema.
 *
 * @property allowedProjects - Jira project keys to enable access to.
 *   - If set to a non-empty array, only those projects will be available.
 *   - If set to null or an empty array, no Jira projects will be available (opt-in model).
 *   - Example: ["PMT", "PROJ"] enables access to PMT and PROJ projects only.
 *
 * @property allowedSpaces - Confluence space keys to enable access to.
 *   - If set to a non-empty array, only those spaces will be available.
 *   - If set to null or an empty array, no Confluence spaces will be available (opt-in model).
 *   - Example: ["ENG", "DOCS"] enables access to ENG and DOCS spaces only.
 */
export const AtlassianConnectInputSchema = Schema.Struct({
  name: Schema.String,
  cloudBaseUrl: Schema.String,
  auth: AtlassianConnectionAuthSchema,
  allowedProjects: Schema.NullOr(Schema.Array(Schema.String)),
  allowedSpaces: Schema.NullOr(Schema.Array(Schema.String)),
  enableJira: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  enableConfluence: Schema.optionalWith(Schema.Boolean, { default: () => true }),
});

export const AtlassianSourceConfigPayloadSchema = AtlassianConnectInputSchema;

export const AtlassianUpdateSourceInputSchema = Schema.Struct({
  sourceId: Schema.String,
  config: AtlassianSourceConfigPayloadSchema,
});

export const AtlassianStoredSourceDataSchema = Schema.Struct({
  cloudBaseUrl: Schema.String,
  auth: AtlassianConnectionAuthSchema,
  allowedProjects: Schema.NullOr(Schema.Array(Schema.String)),
  allowedSpaces: Schema.NullOr(Schema.Array(Schema.String)),
  enableJira: Schema.Boolean,
  enableConfluence: Schema.Boolean,
});

export type AtlassianConnectionAuth = typeof AtlassianConnectionAuthSchema.Type;
export type AtlassianConnectInput = typeof AtlassianConnectInputSchema.Type;
export type AtlassianSourceConfigPayload = typeof AtlassianSourceConfigPayloadSchema.Type;
export type AtlassianUpdateSourceInput = typeof AtlassianUpdateSourceInputSchema.Type;
export type AtlassianStoredSourceData = typeof AtlassianStoredSourceDataSchema.Type;
