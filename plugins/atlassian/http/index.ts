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
  AtlassianConnectInputSchema,
  AtlassianSourceConfigPayloadSchema,
  AtlassianUpdateSourceInputSchema,
  type AtlassianConnectInput,
  type AtlassianSourceConfigPayload,
  type AtlassianUpdateSourceInput,
} from "@executor/plugin-atlassian-shared";

type AtlassianExecutorExtension = {
  atlassian: {
    createSource: (
      input: AtlassianConnectInput,
    ) => Effect.Effect<Source, Error, never>;
    getSourceConfig: (
      sourceId: Source["id"],
    ) => Effect.Effect<AtlassianSourceConfigPayload, Error, never>;
    updateSource: (
      input: AtlassianUpdateSourceInput,
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

export const AtlassianHttpGroup = HttpApiGroup.make("atlassian")
  .add(
    HttpApiEndpoint.post("createSource")`/workspaces/${workspaceIdParam}/plugins/atlassian/sources`
      .setPayload(AtlassianConnectInputSchema)
      .addSuccess(SourceSchema)
      .addError(ControlPlaneBadRequestError)
      .addError(ControlPlaneForbiddenError)
      .addError(ControlPlaneStorageError),
  )
  .add(
    HttpApiEndpoint.get("getSourceConfig")`/workspaces/${workspaceIdParam}/plugins/atlassian/sources/${sourceIdParam}`
      .addSuccess(AtlassianSourceConfigPayloadSchema)
      .addError(ControlPlaneBadRequestError)
      .addError(ControlPlaneForbiddenError)
      .addError(ControlPlaneNotFoundError)
      .addError(ControlPlaneStorageError),
  )
  .add(
    HttpApiEndpoint.put("updateSource")`/workspaces/${workspaceIdParam}/plugins/atlassian/sources/${sourceIdParam}`
      .setPayload(AtlassianSourceConfigPayloadSchema)
      .addSuccess(SourceSchema)
      .addError(ControlPlaneBadRequestError)
      .addError(ControlPlaneForbiddenError)
      .addError(ControlPlaneNotFoundError)
      .addError(ControlPlaneStorageError),
  )
  .add(
    HttpApiEndpoint.post("refreshSource")`/workspaces/${workspaceIdParam}/plugins/atlassian/sources/${sourceIdParam}/refresh`
      .addSuccess(SourceSchema)
      .addError(ControlPlaneBadRequestError)
      .addError(ControlPlaneForbiddenError)
      .addError(ControlPlaneNotFoundError)
      .addError(ControlPlaneStorageError),
  )
  .add(
    HttpApiEndpoint.del("removeSource")`/workspaces/${workspaceIdParam}/plugins/atlassian/sources/${sourceIdParam}`
      .addSuccess(Schema.Struct({ removed: Schema.Boolean }))
      .addError(ControlPlaneBadRequestError)
      .addError(ControlPlaneForbiddenError)
      .addError(ControlPlaneNotFoundError)
      .addError(ControlPlaneStorageError),
  )
  .prefix("/v1");

export const AtlassianHttpApi = HttpApi.make("executor").add(AtlassianHttpGroup);

export const atlassianHttpApiExtension = {
  key: "atlassian",
  group: AtlassianHttpGroup,
} satisfies ExecutorHttpApiExtension<typeof AtlassianHttpGroup>;

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

export const atlassianHttpPlugin = (): ExecutorHttpPlugin<
  typeof AtlassianHttpGroup,
  AtlassianExecutorExtension
> => ({
  key: "atlassian",
  group: AtlassianHttpGroup,
  build: ({ executor }) =>
    HttpApiBuilder.group(AtlassianHttpApi, "atlassian", (handlers) =>
      handlers
        .handle("createSource", ({ path, payload }) =>
          resolveRequestedLocalWorkspace(
            "atlassian.createSource",
            path.workspaceId,
          ).pipe(
            Effect.flatMap(() => executor.atlassian.createSource(payload)),
            Effect.mapError(toStorageError("atlassian.createSource")),
          )
        )
        .handle("getSourceConfig", ({ path }) =>
          resolveRequestedLocalWorkspace(
            "atlassian.getSourceConfig",
            path.workspaceId,
          ).pipe(
            Effect.flatMap(() => executor.atlassian.getSourceConfig(path.sourceId)),
            Effect.mapError(mapPluginStorageError("atlassian.getSourceConfig")),
          )
        )
        .handle("updateSource", ({ path, payload }) =>
          resolveRequestedLocalWorkspace(
            "atlassian.updateSource",
            path.workspaceId,
          ).pipe(
            Effect.flatMap(() =>
              executor.atlassian.updateSource({
                sourceId: path.sourceId,
                config: payload,
              })
            ),
            Effect.mapError(mapPluginStorageError("atlassian.updateSource")),
          )
        )
        .handle("refreshSource", ({ path }) =>
          resolveRequestedLocalWorkspace(
            "atlassian.refreshSource",
            path.workspaceId,
          ).pipe(
            Effect.flatMap(() => executor.atlassian.refreshSource(path.sourceId)),
            Effect.mapError(mapPluginStorageError("atlassian.refreshSource")),
          )
        )
        .handle("removeSource", ({ path }) =>
          resolveRequestedLocalWorkspace(
            "atlassian.removeSource",
            path.workspaceId,
          ).pipe(
            Effect.flatMap(() => executor.atlassian.removeSource(path.sourceId)),
            Effect.map((removed) => ({ removed })),
            Effect.mapError(mapPluginStorageError("atlassian.removeSource")),
          )
        )
    ),
});
