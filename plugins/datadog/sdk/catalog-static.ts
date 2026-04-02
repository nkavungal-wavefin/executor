import * as Schema from "effect/Schema";

/**
 * Static catalog of Datadog operations
 * Returns the same operations for all sources
 */

export const LogsQueryOperationSchema = Schema.Struct({
  id: Schema.Literal("datadog.logs.query"),
  name: Schema.Literal("Query Logs"),
  description: Schema.Literal(
    "Query Datadog logs with filtering and time range",
  ),
  inputs: Schema.Struct({
    query: Schema.String,
    from: Schema.Number,
    to: Schema.Number,
    limit: Schema.optional(Schema.Number),
  }),
});

export const LogsLiveTailOperationSchema = Schema.Struct({
  id: Schema.Literal("datadog.logs.live_tail"),
  name: Schema.Literal("Live Tail Logs"),
  description: Schema.Literal("Stream live log events from Datadog"),
  inputs: Schema.Struct({
    query: Schema.String,
  }),
});

export const LogsArchiveReadOperationSchema = Schema.Struct({
  id: Schema.Literal("datadog.logs.archive_read"),
  name: Schema.Literal("Read Log Archive"),
  description: Schema.Literal("Read logs from Datadog archive"),
  inputs: Schema.Struct({
    archiveId: Schema.String,
  }),
});

export const TracesQueryOperationSchema = Schema.Struct({
  id: Schema.Literal("datadog.apm.traces.query"),
  name: Schema.Literal("Query Traces"),
  description: Schema.Literal("Query APM traces with filtering and time range"),
  inputs: Schema.Struct({
    query: Schema.String,
    from: Schema.Number,
    to: Schema.Number,
    limit: Schema.optional(Schema.Number),
  }),
});

export const TracesGetOperationSchema = Schema.Struct({
  id: Schema.Literal("datadog.apm.traces.get"),
  name: Schema.Literal("Get Trace Details"),
  description: Schema.Literal("Retrieve details for a specific APM trace"),
  inputs: Schema.Struct({
    traceId: Schema.String,
  }),
});

/**
 * All available Datadog operations
 */
export const DATADOG_STATIC_OPERATIONS = [
  {
    id: "datadog.logs.query",
    name: "Query Logs",
    description: "Query Datadog logs with filtering and time range",
  },
  {
    id: "datadog.logs.live_tail",
    name: "Live Tail Logs",
    description: "Stream live log events from Datadog",
  },
  {
    id: "datadog.logs.archive_read",
    name: "Read Log Archive",
    description: "Read logs from Datadog archive",
  },
  {
    id: "datadog.apm.traces.query",
    name: "Query Traces",
    description: "Query APM traces with filtering and time range",
  },
  {
    id: "datadog.apm.traces.get",
    name: "Get Trace Details",
    description: "Retrieve details for a specific APM trace",
  },
];
