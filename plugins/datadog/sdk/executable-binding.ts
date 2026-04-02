import * as Schema from "effect/Schema";

/**
 * Datadog executable bindings define all supported read-only operations.
 * Each operation is a union member with its specific parameters.
 */

export const DatadogExecutableBindingSchema = Schema.Union(
  // Logs API - Live tail
  Schema.Struct({
    operation: Schema.Literal("logs.live_tail"),
    query: Schema.String,
  }),
  // Logs API - Query
  Schema.Struct({
    operation: Schema.Literal("logs.query"),
    query: Schema.String,
    from: Schema.Number,
    to: Schema.Number,
  }),
  // Logs API - Archive read
  Schema.Struct({
    operation: Schema.Literal("logs.archive_read"),
    archiveId: Schema.String,
  }),
  // APM Traces API - Query traces
  Schema.Struct({
    operation: Schema.Literal("apm.traces.query"),
    query: Schema.String,
    from: Schema.Number,
    to: Schema.Number,
  }),
  // APM Traces API - Get single trace
  Schema.Struct({
    operation: Schema.Literal("apm.traces.get"),
    traceId: Schema.String,
  }),
);

export type DatadogExecutableBinding = typeof DatadogExecutableBindingSchema.Type;

const decodeBinding = Schema.decodeUnknownSync(DatadogExecutableBindingSchema);

export const decodeDatadogBinding = (binding: unknown): DatadogExecutableBinding =>
  decodeBinding(binding);
