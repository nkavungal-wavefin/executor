import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import {
  createSourceCatalogSyncResult,
  createCatalogImportMetadata,
  contentHash,
} from "@executor/source-core";
import { defineExecutorSourcePlugin } from "@executor/platform-sdk/plugins";
import { SourceSchema, SourceIdSchema } from "@executor/platform-sdk/schema";
import {
  provideExecutorRuntime,
  pluginScopeConfigSourceFromConfig,
  runtimeEffectError,
  createPluginScopeConfigEntrySchema,
} from "@executor/platform-sdk/runtime";
import {
  DatadogConnectInputSchema,
  DatadogConnectionAuthSchema,
  DatadogSourceConfigPayloadSchema,
  DatadogStoredSourceDataSchema,
  DatadogUpdateSourceInputSchema,
  DatadogLocalSourceConfigSchema,
  type DatadogConnectInput,
  type DatadogSourceConfigPayload,
  type DatadogUpdateSourceInput,
} from "@executor/plugin-datadog-shared";
import type { DatadogStoredSourceData } from "@executor/plugin-datadog-shared";

export { decodeDatadogBinding, DatadogExecutableBindingSchema } from "./executable-binding";
export type { DatadogExecutableBinding } from "./executable-binding";
export { createDatadogCatalogFragment } from "./catalog";
export type { DatadogCatalogOperationInput } from "./catalog";

import { createDatadogCatalogFragment, type DatadogCatalogOperationInput } from "./catalog";
import { invokeDatadogTool } from "./invoke";
import { DATADOG_STATIC_OPERATIONS } from "./catalog-static";
import { decodeDatadogBinding, type DatadogExecutableBinding } from "./executable-binding";

export const DATADOG_SOURCE_KIND = "datadog";
export const DATADOG_SOURCE_DISPLAY_NAME = "Datadog";

export type DatadogSourceStorage = {
  get: (input: {
    scopeId: string;
    sourceId: string;
  }) => Effect.Effect<DatadogStoredSourceData | null, Error, never>;
  put: (input: {
    scopeId: string;
    sourceId: string;
    value: DatadogStoredSourceData;
  }) => Effect.Effect<void, Error, never>;
  remove: (input: {
    scopeId: string;
    sourceId: string;
  }) => Effect.Effect<void, Error, never>;
};

export type DatadogSdkPluginOptions = {
  storage: DatadogSourceStorage;
};

const DatadogExecutorAddInputSchema = Schema.extend(
  DatadogConnectInputSchema,
  Schema.Struct({}),
);

type DatadogExecutorAddInput = typeof DatadogExecutorAddInputSchema.Type;

const decodeDatadogLocalConfigOption = Schema.decodeUnknownOption(
  createPluginScopeConfigEntrySchema({
    kind: "datadog",
    config: DatadogLocalSourceConfigSchema,
  }),
);

export const datadogSdkPlugin = (options: DatadogSdkPluginOptions) =>
  defineExecutorSourcePlugin<
    "datadog",
    DatadogExecutorAddInput,
    DatadogConnectInput,
    DatadogSourceConfigPayload,
    DatadogStoredSourceData,
    DatadogUpdateSourceInput
  >({
    key: DATADOG_SOURCE_KIND,
    source: {
      kind: DATADOG_SOURCE_KIND,
      displayName: DATADOG_SOURCE_DISPLAY_NAME,
      add: {
        inputSchema: DatadogExecutorAddInputSchema,
        helpText: [
          "Provide your Datadog API Key from https://app.datadoghq.com/organization/settings/api-keys",
          "Optionally provide an Application Key for additional operations from https://app.datadoghq.com/organization/settings/application-keys",
          "Store both as secrets first, then provide the secretIds.",
        ],
        toConnectInput: (input) => input,
      },
      storage: options.storage,
      source: {
        create: (input) => ({
          source: {
            name: input.name.trim(),
            kind: DATADOG_SOURCE_KIND,
            status: "connected",
            enabled: true,
            namespace: "datadog",
          },
          stored: {
            auth: input.auth,
          },
        }),
        update: ({ source, config }) => ({
          source: {
            ...source,
            name: config.name.trim(),
          },
          stored: {
            auth: config.auth,
          },
        }),
        toConfig: ({ source, stored }) => ({
          name: source.name,
          auth: stored.auth,
        }),
      },
      scopeConfig: {
        toConfigSource: ({ source, stored }) =>
          pluginScopeConfigSourceFromConfig({
            source,
            config: {
              auth: stored.auth,
            },
          }),
        recoverStored: ({ config }) => {
          const current = decodeDatadogLocalConfigOption(config);
          if (Option.isSome(current)) {
            return {
              auth: current.value.config.auth,
            };
          }
          throw new Error("Unsupported Datadog local source config.");
        },
      },
      catalog: {
        kind: "imported" as const,
        identity: ({ source }) => ({
          kind: DATADOG_SOURCE_KIND,
          sourceId: source.id,
        }),
        invoke: (input) =>
          Effect.gen(function* () {
            const { binding, args, source, catalog } = input;

            if (catalog.stored === null) {
              return yield* runtimeEffectError(
                "plugins/datadog/sdk",
                `Datadog source storage missing for ${source.id}`,
              );
            }

            // Extract credentials from stored data
            const auth = catalog.stored.auth;
            if (!auth.apiKeyRef) {
              return yield* runtimeEffectError(
                "plugins/datadog/sdk",
                "Datadog API Key is required but not configured",
              );
            }

            // Decode the binding to get the operation type
            const decodedBinding = yield* Effect.tryCatch(
              () => Promise.resolve(decodeDatadogBinding(binding)),
              (error) =>
                new Error(`Invalid Datadog binding: ${error}`),
            );

            // TODO: In a real implementation, resolve secrets from executor runtime
            // For now, use placeholder values - actual implementation needs secret resolution
            const apiKey = auth.apiKeyRef.secretId;
            const appKey = auth.appKeyRef ? auth.appKeyRef.secretId : undefined;

            const result = yield* Effect.tryCatch(
              () =>
                invokeDatadogTool({
                  binding: decodedBinding as any,
                  args,
                  stored: catalog.stored,
                  apiKey,
                  appKey,
                }),
              (error) =>
                new Error(
                  `Datadog API call failed: ${error instanceof Error ? error.message : String(error)}`,
                ),
            );

            return result;
          }),
        sync: ({ source, stored }) =>
          Effect.gen(function* () {
            if (stored === null) {
              return yield* runtimeEffectError(
                "plugins/datadog/sdk",
                `Datadog source storage missing for ${source.id}`,
              );
            }

            // Return static catalog of available operations
            const operations = DATADOG_STATIC_OPERATIONS.map((op): DatadogCatalogOperationInput => {
              const binding: DatadogExecutableBinding = { operation: op.id as any };
              return {
                toolId: op.id,
                title: op.name,
                description: op.description,
                effect: "read" as const,
                inputSchema: {}, // Placeholder - actual schemas from executable-binding
                binding,
              };
            });

            // Create a stable hash of the operations for tracking catalog changes
            const operationsJson = JSON.stringify(operations);
            const sourceHash = contentHash(operationsJson);

            return createSourceCatalogSyncResult({
              fragment: createDatadogCatalogFragment({
                source,
                documents: [],
                operations,
              }),
              importMetadata: {
                ...createCatalogImportMetadata({
                  source,
                  pluginKey: DATADOG_SOURCE_KIND,
                }),
              },
              sourceHash,
            } as any);
          }),
      },
    },
    tools: [
      {
        name: "createSource",
        description: "Create a Datadog source for logs and APM traces.",
        inputSchema: DatadogConnectInputSchema,
        outputSchema: SourceSchema,
        execute: ({ args, source }: { args: DatadogConnectInput; source: any }) =>
          source.createSource(args),
      },
      {
        name: "updateSource",
        description: "Update a Datadog source configuration.",
        inputSchema: DatadogUpdateSourceInputSchema,
        outputSchema: SourceSchema,
        execute: ({ args, source }: { args: DatadogUpdateSourceInput; source: any }) =>
          source.updateSource(args),
      },
      {
        name: "refreshSource",
        description: "Refresh a Datadog source.",
        inputSchema: Schema.Struct({ sourceId: Schema.String }),
        outputSchema: SourceSchema,
        execute: ({ args, source }: { args: { sourceId: string }; source: any }) =>
          source.refreshSource(args.sourceId),
      },
      {
        name: "removeSource",
        description: "Remove a Datadog source.",
        inputSchema: Schema.Struct({ sourceId: Schema.String }),
        outputSchema: Schema.Boolean,
        execute: ({ args, source }: { args: { sourceId: string }; source: any }) =>
          source.removeSource(args.sourceId),
      },
    ] as const,
    extendExecutor: ({ source, executor }) => {
      const provideRuntime = <A, E, R>(
        effect: Effect.Effect<A, E, R>,
      ): Effect.Effect<A, E, never> =>
        provideExecutorRuntime(effect, executor.runtime);

      return {
        datadog: {
          createSource: (input: DatadogConnectInput) =>
            provideRuntime(source.createSource(input)),
          getSourceConfig: (sourceId: string) =>
            provideRuntime(source.getSourceConfig(SourceIdSchema.make(sourceId))),
          updateSource: (input: DatadogUpdateSourceInput) =>
            provideRuntime(source.updateSource(input)),
          refreshSource: (sourceId: string) =>
            provideRuntime(source.refreshSource(SourceIdSchema.make(sourceId))),
          removeSource: (sourceId: string) =>
            provideRuntime(source.removeSource(SourceIdSchema.make(sourceId))),
        },
      };
    },
  });
