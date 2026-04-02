import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
} from "@effect/platform";
import {
  ControlPlaneNotFoundError,
  ControlPlaneBadRequestError,
  ControlPlaneForbiddenError,
  ControlPlaneStorageError,
  type ExecutorHttpApiExtension,
  type ExecutorHttpPlugin,
} from "@executor/platform-api";
import { resolveRequestedLocalWorkspace } from "@executor/platform-api/local-context";
import {
  ScopeIdSchema,
  SourceIdSchema,
  SourceSchema,
  type Source,
} from "@executor/platform-sdk/schema";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import {
  DatadogConnectInputSchema,
  DatadogSourceConfigPayloadSchema,
  DatadogUpdateSourceInputSchema,
  type DatadogConnectInput,
  type DatadogSourceConfigPayload,
  type DatadogUpdateSourceInput,
} from "@executor/plugin-datadog-shared";

type DatadogExecutorExtension = {
  datadog: {
    createSource: (
      input: DatadogConnectInput,
    ) => Effect.Effect<Source, Error, never>;
    getSourceConfig: (
      sourceId: Source["id"],
    ) => Effect.Effect<DatadogSourceConfigPayload, Error, never>;
    updateSource: (
      input: DatadogUpdateSourceInput,
    ) => Effect.Effect<Source, Error, never>;
    refreshSource: (
      sourceId: Source["id"],
    ) => Effect.Effect<Source, Error, never>;
    removeSource: (
      sourceId: Source["id"],
    ) => Effect.Effect<boolean, Error, never>;
  };
};

const workspaceIdParam = HttpApiSchema.param("workspaceId", ScopeIdSchema);
const sourceIdParam = HttpApiSchema.param("sourceId", SourceIdSchema);

export const DatadogHttpGroup = HttpApiGroup.make("datadog")
  .add(
    HttpApiEndpoint.post("createSource")`/workspaces/${workspaceIdParam}/plugins/datadog/sources`
      .setPayload(DatadogConnectInputSchema)
      .addSuccess(SourceSchema)
      .addError(ControlPlaneBadRequestError)
      .addError(ControlPlaneForbiddenError)
      .addError(ControlPlaneStorageError),
  )
  .add(
    HttpApiEndpoint.get("getSourceConfig")`/workspaces/${workspaceIdParam}/plugins/datadog/sources/${sourceIdParam}`
      .addSuccess(DatadogSourceConfigPayloadSchema)
      .addError(ControlPlaneBadRequestError)
      .addError(ControlPlaneForbiddenError)
      .addError(ControlPlaneNotFoundError)
      .addError(ControlPlaneStorageError),
  )
  .add(
    HttpApiEndpoint.put("updateSource")`/workspaces/${workspaceIdParam}/plugins/datadog/sources/${sourceIdParam}`
      .setPayload(DatadogSourceConfigPayloadSchema)
      .addSuccess(SourceSchema)
      .addError(ControlPlaneBadRequestError)
      .addError(ControlPlaneForbiddenError)
      .addError(ControlPlaneNotFoundError)
      .addError(ControlPlaneStorageError),
  )
  .add(
    HttpApiEndpoint.post("refreshSource")`/workspaces/${workspaceIdParam}/plugins/datadog/sources/${sourceIdParam}/refresh`
      .addSuccess(SourceSchema)
      .addError(ControlPlaneBadRequestError)
      .addError(ControlPlaneForbiddenError)
      .addError(ControlPlaneNotFoundError)
      .addError(ControlPlaneStorageError),
  )
  .add(
    HttpApiEndpoint.del("removeSource")`/workspaces/${workspaceIdParam}/plugins/datadog/sources/${sourceIdParam}`
      .addSuccess(Schema.Struct({ removed: Schema.Boolean }))
      .addError(ControlPlaneBadRequestError)
      .addError(ControlPlaneForbiddenError)
      .addError(ControlPlaneNotFoundError)
      .addError(ControlPlaneStorageError),
  )
  .prefix("/v1");

export const DatadogHttpApi = HttpApi.make("executor").add(DatadogHttpGroup);

export const datadogHttpApiExtension = {
  key: "datadog",
  group: DatadogHttpGroup,
} satisfies ExecutorHttpApiExtension<typeof DatadogHttpGroup>;

const toBadRequestError = (operation: string) => (cause: unknown) =>
  new ControlPlaneBadRequestError({
    operation,
    message: cause instanceof Error ? cause.message : String(cause),
    details: cause instanceof Error ? cause.stack ?? cause.message : String(cause),
  });

const toStorageError = (operation: string) => (cause: unknown) =>
  new ControlPlaneStorageError({
    operation,
    message: cause instanceof Error ? cause.message : String(cause),
    details: cause instanceof Error ? cause.stack ?? cause.message : String(cause),
  });

const toNotFoundError = (operation: string, cause: unknown) =>
  new ControlPlaneNotFoundError({
    operation,
    message: cause instanceof Error ? cause.message : String(cause),
    details: cause instanceof Error ? cause.stack ?? cause.message : String(cause),
  });

const mapPluginStorageError = (operation: string) => (cause: unknown) => {
  const message = cause instanceof Error ? cause.message : String(cause);
  if (message.includes("not found") || message.includes("Not found")) {
    return toNotFoundError(operation, cause);
  }
  return toStorageError(operation)(cause);
};

export const datadogHttpPlugin = (): ExecutorHttpPlugin<
  typeof DatadogHttpGroup,
  DatadogExecutorExtension
> => ({
  key: "datadog",
  group: DatadogHttpGroup,
  build: ({ executor }) =>
    HttpApiBuilder.group(DatadogHttpApi, "datadog", (handlers) =>
      handlers
        .handle("createSource", ({ path, payload }) =>
          resolveRequestedLocalWorkspace(
            "datadog.createSource",
            path.workspaceId,
          ).pipe(
            Effect.flatMap(() => executor.datadog.createSource(payload)),
            Effect.mapError(toStorageError("datadog.createSource")),
          )
        )
        .handle("getSourceConfig", ({ path }) =>
          resolveRequestedLocalWorkspace(
            "datadog.getSourceConfig",
            path.workspaceId,
          ).pipe(
            Effect.flatMap(() => executor.datadog.getSourceConfig(path.sourceId)),
            Effect.mapError(mapPluginStorageError("datadog.getSourceConfig")),
          )
        )
        .handle("updateSource", ({ path, payload }) =>
          resolveRequestedLocalWorkspace(
            "datadog.updateSource",
            path.workspaceId,
          ).pipe(
            Effect.flatMap(() =>
              executor.datadog.updateSource({
                sourceId: path.sourceId,
                config: payload,
              })
            ),
            Effect.mapError(mapPluginStorageError("datadog.updateSource")),
          )
        )
        .handle("refreshSource", ({ path }) =>
          resolveRequestedLocalWorkspace(
            "datadog.refreshSource",
            path.workspaceId,
          ).pipe(
            Effect.flatMap(() => executor.datadog.refreshSource(path.sourceId)),
            Effect.mapError(mapPluginStorageError("datadog.refreshSource")),
          )
        )
        .handle("removeSource", ({ path }) =>
          resolveRequestedLocalWorkspace(
            "datadog.removeSource",
            path.workspaceId,
          ).pipe(
            Effect.flatMap(() => executor.datadog.removeSource(path.sourceId)),
            Effect.map((removed) => ({ removed })),
            Effect.mapError(mapPluginStorageError("datadog.removeSource")),
          )
        )
    ),
});
