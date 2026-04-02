import * as Schema from "effect/Schema";

import { SecretRefSchema } from "@executor/platform-sdk/schema";

/**
 * Datadog connection auth schema.
 * Supports flexible authentication:
 * - API Key is required for all operations
 * - Application Key is required for some endpoints but optional in the schema
 */
export const DatadogConnectionAuthSchema = Schema.Struct({
  kind: Schema.Literal("api-key"),
  apiKeyRef: SecretRefSchema,
  appKeyRef: Schema.NullOr(SecretRefSchema),
});

/**
 * Datadog connection input schema for source creation.
 *
 * @property name - Display name for the Datadog source
 * @property apiKeyRef - Secret reference to the Datadog API Key
 * @property appKeyRef - Secret reference to the Datadog Application Key (required for most operations)
 */
export const DatadogConnectInputSchema = Schema.Struct({
  name: Schema.String,
  auth: DatadogConnectionAuthSchema,
});

/**
 * Local config schema - used when loading from executor.jsonc
 * Does not include name (name is stored at source level)
 */
export const DatadogLocalSourceConfigSchema = Schema.Struct({
  auth: DatadogConnectionAuthSchema,
});

export const DatadogSourceConfigPayloadSchema = DatadogConnectInputSchema;

export const DatadogUpdateSourceInputSchema = Schema.Struct({
  sourceId: Schema.String,
  config: DatadogSourceConfigPayloadSchema,
});

export const DatadogStoredSourceDataSchema = Schema.Struct({
  auth: DatadogConnectionAuthSchema,
});

export type DatadogConnectionAuth = typeof DatadogConnectionAuthSchema.Type;
export type DatadogConnectInput = typeof DatadogConnectInputSchema.Type;
export type DatadogLocalSourceConfig = typeof DatadogLocalSourceConfigSchema.Type;
export type DatadogSourceConfigPayload = typeof DatadogSourceConfigPayloadSchema.Type;
export type DatadogUpdateSourceInput = typeof DatadogUpdateSourceInputSchema.Type;
export type DatadogStoredSourceData = typeof DatadogStoredSourceDataSchema.Type;
