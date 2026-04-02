import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import {
  contentHash,
  createCatalogImportMetadata,
  createSourceCatalogSyncResult,
} from "@executor/source-core";
import {
  defineExecutorSourcePlugin,
} from "@executor/platform-sdk/plugins";
import {
  SecretMaterialResolverService,
  createPluginScopeConfigEntrySchema,
  pluginScopeConfigSourceFromConfig,
  provideExecutorRuntime,
  runtimeEffectError,
} from "@executor/platform-sdk/runtime";
import type { Source } from "@executor/platform-sdk/schema";
import { SourceIdSchema, SourceSchema } from "@executor/platform-sdk/schema";
import {
  AtlassianConnectInputSchema,
  AtlassianConnectionAuthSchema,
  AtlassianStoredSourceDataSchema,
  AtlassianUpdateSourceInputSchema,
  AtlassianSourceConfigPayloadSchema,
  type AtlassianConnectInput,
  type AtlassianSourceConfigPayload,
  type AtlassianStoredSourceData,
  type AtlassianUpdateSourceInput,
} from "@executor/plugin-atlassian-shared";

import { createAtlassianCatalogFragment } from "./catalog";
import { decodeAtlassianBinding } from "./executable-binding";
import { invokeAtlassianTool } from "./invoke";
import type { AtlassianCatalogOperationInput } from "./catalog";

export const ATLASSIAN_SOURCE_KIND = "atlassian";
export const ATLASSIAN_SOURCE_DISPLAY_NAME = "Atlassian";

export type AtlassianSourceStorage = {
  get: (input: {
    scopeId: string;
    sourceId: string;
  }) => Effect.Effect<AtlassianStoredSourceData | null, Error, never>;
  put: (input: {
    scopeId: string;
    sourceId: string;
    value: AtlassianStoredSourceData;
  }) => Effect.Effect<void, Error, never>;
  remove: (input: {
    scopeId: string;
    sourceId: string;
  }) => Effect.Effect<void, Error, never>;
};

export type AtlassianSdkPluginOptions = {
  storage: AtlassianSourceStorage;
};

const AtlassianExecutorAddInputSchema = Schema.extend(
  AtlassianConnectInputSchema,
  Schema.Struct({}),
);

type AtlassianExecutorAddInput = typeof AtlassianExecutorAddInputSchema.Type;

const AtlassianLocalSourceConfigSchema = Schema.Struct({
  cloudBaseUrl: Schema.String,
  auth: AtlassianConnectionAuthSchema,
  allowedProjects: Schema.NullOr(Schema.Array(Schema.String)),
  allowedSpaces: Schema.NullOr(Schema.Array(Schema.String)),
  enableJira: Schema.Boolean,
  enableConfluence: Schema.Boolean,
});

const decodeAtlassianLocalConfigOption = Schema.decodeUnknownOption(
  createPluginScopeConfigEntrySchema({
    kind: "atlassian",
    config: AtlassianLocalSourceConfigSchema,
  }),
);

const createStoredSourceData = (
  input: AtlassianConnectInput,
): AtlassianStoredSourceData => ({
  cloudBaseUrl: input.cloudBaseUrl.trim(),
  auth: input.auth,
  allowedProjects: input.allowedProjects ?? null,
  allowedSpaces: input.allowedSpaces ?? null,
  enableJira: input.enableJira ?? true,
  enableConfluence: input.enableConfluence ?? true,
});

const deriveAtlassianNamespace = (cloudBaseUrl: string): string => {
  const host = cloudBaseUrl.trim().replace(/^https?:\/\//, "");
  return host.split(".")[0] ?? host;
};

const resolveApiToken = (
  stored: AtlassianStoredSourceData,
): Effect.Effect<string, Error, SecretMaterialResolverService> =>
  Effect.flatMap(SecretMaterialResolverService, (resolver) =>
    resolver({ ref: stored.auth.apiTokenRef }).pipe(
      Effect.map((token) => token.trim()),
    ),
  );

type JiraProject = { key: string; name: string };
type ConfluenceSpace = { key: string; id: string; name: string };

// Bun-specific: bypass corporate TLS proxies with self-signed certs
const tlsOptions = { tls: { rejectUnauthorized: false } } as RequestInit;

const atlassianFetchInit = (auth: string): RequestInit => ({
  headers: { Authorization: auth, Accept: "application/json" },
  ...tlsOptions,
});

const fetchJiraProjects = async (
  cloudBaseUrl: string,
  email: string,
  apiToken: string,
  allowedProjects: readonly string[] | null,
): Promise<JiraProject[]> => {
  const auth = `Basic ${Buffer.from(`${email}:${apiToken}`).toString("base64")}`;
  const init = atlassianFetchInit(auth);

  // Explicit opt-in: only fetch when allowedProjects is explicitly set to a non-empty array
  if (allowedProjects === null || allowedProjects.length === 0) {
    return [];
  }

  const projects: JiraProject[] = [];
  for (const key of allowedProjects) {
    const response = await fetch(
      `https://${cloudBaseUrl}/rest/api/3/project/${encodeURIComponent(key)}`,
      init,
    );
    if (response.ok) {
      const data = (await response.json()) as { key: string; name: string };
      projects.push({ key: data.key, name: data.name });
    }
  }
  return projects;
};

const fetchConfluenceSpaces = async (
  cloudBaseUrl: string,
  email: string,
  apiToken: string,
  allowedSpaces: readonly string[] | null,
): Promise<ConfluenceSpace[]> => {
  const auth = `Basic ${Buffer.from(`${email}:${apiToken}`).toString("base64")}`;
  const init = atlassianFetchInit(auth);

  // Explicit opt-in: only fetch when allowedSpaces is explicitly set to a non-empty array
  if (allowedSpaces === null || allowedSpaces.length === 0) {
    return [];
  }

  const spaces: ConfluenceSpace[] = [];
  for (const key of allowedSpaces) {
    const params = new URLSearchParams({ keys: key });
    const response = await fetch(
      `https://${cloudBaseUrl}/wiki/api/v2/spaces?${params}`,
      init,
    );
    if (response.ok) {
      const data = (await response.json()) as {
        results: Array<{ id: string; key: string; name: string }>;
      };
      for (const s of data.results) {
        spaces.push({ id: s.id, key: s.key, name: s.name });
      }
    }
  }
  return spaces;
};

const buildCatalogOperations = (input: {
  cloudBaseUrl: string;
  jiraProjects: JiraProject[];
  confluenceSpaces: ConfluenceSpace[];
  enableJira: boolean;
  enableConfluence: boolean;
}): AtlassianCatalogOperationInput[] => {
  const operations: AtlassianCatalogOperationInput[] = [];

  if (input.enableJira) {
    for (const project of input.jiraProjects) {
      const key = project.key.toLowerCase();

      operations.push({
        toolId: `jira.${key}.issue.get`,
        title: `Get ${project.key} Issue`,
        description: `Fetch a single Jira issue from project ${project.name} (${project.key}) by its key (e.g. ${project.key}-123).`,
        effect: "read",
        inputSchema: {
          type: "object",
          properties: {
            issueKey: {
              type: "string",
              description: `The issue key, e.g. "${project.key}-123"`,
            },
          },
          required: ["issueKey"],
          additionalProperties: false,
        },
        binding: {
          operation: "jira.issue.get",
          projectKey: project.key,
          cloudBaseUrl: input.cloudBaseUrl,
        },
      });

      operations.push({
        toolId: `jira.${key}.issues.search`,
        title: `Search ${project.key} Issues`,
        description: `Search Jira issues in project ${project.name} (${project.key}) using JQL. Defaults to all issues in this project.`,
        effect: "read",
        inputSchema: {
          type: "object",
          properties: {
            jql: {
              type: "string",
              description: `JQL query string. Defaults to "project = ${project.key}"`,
            },
            maxResults: {
              type: "number",
              description: "Maximum number of results (1-100, default 50)",
            },
            startAt: {
              type: "number",
              description: "Start index for pagination (default 0)",
            },
          },
          additionalProperties: false,
        },
        binding: {
          operation: "jira.issues.search",
          projectKey: project.key,
          cloudBaseUrl: input.cloudBaseUrl,
        },
      });
    }
  }

  if (input.enableConfluence) {
    for (const space of input.confluenceSpaces) {
      const key = space.key.toLowerCase();

      operations.push({
        toolId: `confluence.${key}.pages.list`,
        title: `List ${space.key} Pages`,
        description: `List pages in Confluence space ${space.name} (${space.key}).`,
        effect: "read",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Number of pages to return (1-250, default 25)",
            },
            cursor: {
              type: "string",
              description: "Pagination cursor from a previous response",
            },
          },
          additionalProperties: false,
        },
        binding: {
          operation: "confluence.pages.list",
          spaceKey: space.key,
          spaceId: space.id,
          cloudBaseUrl: input.cloudBaseUrl,
        },
      });

      operations.push({
        toolId: `confluence.${key}.page.get`,
        title: `Get ${space.key} Page`,
        description: `Fetch a Confluence page by ID from space ${space.name} (${space.key}). Returns page body in storage format.`,
        effect: "read",
        inputSchema: {
          type: "object",
          properties: {
            pageId: {
              type: "string",
              description: "The numeric Confluence page ID",
            },
          },
          required: ["pageId"],
          additionalProperties: false,
        },
        binding: {
          operation: "confluence.page.get",
          spaceKey: space.key,
          spaceId: space.id,
          cloudBaseUrl: input.cloudBaseUrl,
        },
      });

      operations.push({
        toolId: `confluence.${key}.search`,
        title: `Search ${space.key} Content`,
        description: `Search for pages and content by keyword in Confluence space ${space.name} (${space.key}). Results are restricted to this space.`,
        effect: "read",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query string to find pages and content",
            },
            limit: {
              type: "number",
              description: "Number of results to return (1-100, default 25)",
            },
            cursor: {
              type: "string",
              description: "Pagination cursor from a previous response",
            },
          },
          required: ["query"],
          additionalProperties: false,
        },
        binding: {
          operation: "confluence.search",
          spaceKey: space.key,
          spaceId: space.id,
          cloudBaseUrl: input.cloudBaseUrl,
        },
      });
    }
  }

  return operations;
};

export const atlassianSdkPlugin = (options: AtlassianSdkPluginOptions) =>
  defineExecutorSourcePlugin<
    "atlassian",
    AtlassianExecutorAddInput,
    AtlassianConnectInput,
    AtlassianSourceConfigPayload,
    AtlassianStoredSourceData,
    AtlassianUpdateSourceInput
  >({
    key: ATLASSIAN_SOURCE_KIND,
    source: {
      kind: ATLASSIAN_SOURCE_KIND,
      displayName: ATLASSIAN_SOURCE_DISPLAY_NAME,
      add: {
        inputSchema: AtlassianExecutorAddInputSchema,
        helpText: [
          "Provide your Atlassian Cloud base URL (e.g. mycompany.atlassian.net).",
          "Use your email and an API token from https://id.atlassian.com/manage-profile/security/api-tokens.",
          "Optionally specify allowedProjects (Jira) and allowedSpaces (Confluence) to enable access to those resources.",
          "If not specified or empty, no projects/spaces will be accessible. List the project keys and space keys you want to grant access to.",
        ],
        toConnectInput: (input) => input,
      },
      storage: options.storage,
      source: {
        create: (input) => ({
          source: {
            name: input.name.trim(),
            kind: ATLASSIAN_SOURCE_KIND,
            status: "connected",
            enabled: true,
            namespace: deriveAtlassianNamespace(input.cloudBaseUrl),
          },
          stored: createStoredSourceData(input),
        }),
        update: ({ source, config }) => ({
          source: {
            ...source,
            name: config.name.trim(),
            namespace: deriveAtlassianNamespace(config.cloudBaseUrl),
          },
          stored: createStoredSourceData(config),
        }),
        toConfig: ({ source, stored }) => ({
          name: source.name,
          cloudBaseUrl: stored.cloudBaseUrl,
          auth: stored.auth,
          allowedProjects: stored.allowedProjects,
          allowedSpaces: stored.allowedSpaces,
          enableJira: stored.enableJira,
          enableConfluence: stored.enableConfluence,
        }),
      },
      scopeConfig: {
        toConfigSource: ({ source, stored }) =>
          pluginScopeConfigSourceFromConfig({
            source,
            config: {
              cloudBaseUrl: stored.cloudBaseUrl,
              auth: stored.auth,
              allowedProjects: stored.allowedProjects,
              allowedSpaces: stored.allowedSpaces,
              enableJira: stored.enableJira,
              enableConfluence: stored.enableConfluence,
            },
          }),
        recoverStored: ({ config }) => {
          const current = decodeAtlassianLocalConfigOption(config);
          if (Option.isSome(current)) {
            return current.value.config;
          }
          throw new Error("Unsupported Atlassian local source config.");
        },
      },
      catalog: {
        kind: "imported",
        identity: ({ source }) => ({
          kind: ATLASSIAN_SOURCE_KIND,
          sourceId: source.id,
        }),
        sync: ({ source, stored }) =>
          Effect.gen(function* () {
            if (stored === null) {
              return yield* runtimeEffectError(
                "plugins/atlassian/sdk",
                `Atlassian source storage missing for ${source.id}`,
              );
            }

            const apiToken = yield* resolveApiToken(stored);
            const email = stored.auth.email;
            const cloudBaseUrl = stored.cloudBaseUrl;

            const [jiraProjects, confluenceSpaces] = yield* Effect.tryPromise({
              try: () =>
                Promise.all([
                  stored.enableJira
                    ? fetchJiraProjects(
                      cloudBaseUrl,
                      email,
                      apiToken,
                      stored.allowedProjects,
                    )
                    : Promise.resolve([] as JiraProject[]),
                  stored.enableConfluence
                    ? fetchConfluenceSpaces(
                      cloudBaseUrl,
                      email,
                      apiToken,
                      stored.allowedSpaces,
                    )
                    : Promise.resolve([] as ConfluenceSpace[]),
                ]),
              catch: (cause) =>
                cause instanceof Error
                  ? cause
                  : new Error(String(cause)),
            });

            const operations = buildCatalogOperations({
              cloudBaseUrl,
              jiraProjects,
              confluenceSpaces,
              enableJira: stored.enableJira,
              enableConfluence: stored.enableConfluence,
            });

            const manifestData = {
              cloudBaseUrl,
              jiraProjects,
              confluenceSpaces,
              operationCount: operations.length,
            };
            const manifestJson = JSON.stringify(manifestData);
            const now = Date.now();

            return createSourceCatalogSyncResult({
              fragment: createAtlassianCatalogFragment({
                source,
                documents: [
                  {
                    documentKind: "atlassian_manifest",
                    documentKey: `atlassian:${cloudBaseUrl}`,
                    contentText: manifestJson,
                    fetchedAt: now,
                  },
                ],
                operations,
              }),
              importMetadata: {
                ...createCatalogImportMetadata({
                  source,
                  pluginKey: ATLASSIAN_SOURCE_KIND,
                }),
                importerVersion: "ir.v1.atlassian",
              },
              sourceHash: contentHash(manifestJson),
            });
          }),
        invoke: (input) =>
          Effect.gen(function* () {
            if (input.stored === null) {
              return yield* runtimeEffectError(
                "plugins/atlassian/sdk",
                `Atlassian source storage missing for ${input.source.id}`,
              );
            }

            const apiToken = yield* resolveApiToken(input.stored);
            const binding = decodeAtlassianBinding(input.executable.binding);
            const args =
              typeof input.args === "object" &&
              input.args !== null &&
              !Array.isArray(input.args)
                ? (input.args as Record<string, unknown>)
                : {};

            // Guard: ensure the binding's space/project is still in the allowed list
            if (
              "spaceKey" in binding &&
              input.stored.allowedSpaces !== null &&
              input.stored.allowedSpaces.length > 0 &&
              !input.stored.allowedSpaces.includes(binding.spaceKey)
            ) {
              return yield* runtimeEffectError(
                "plugins/atlassian/sdk",
                `Confluence space "${binding.spaceKey}" is not in the allowed spaces list. Allowed: ${input.stored.allowedSpaces.join(", ")}`,
              );
            }

            if (
              "projectKey" in binding &&
              input.stored.allowedProjects !== null &&
              input.stored.allowedProjects.length > 0 &&
              !input.stored.allowedProjects.includes(binding.projectKey)
            ) {
              return yield* runtimeEffectError(
                "plugins/atlassian/sdk",
                `Jira project "${binding.projectKey}" is not in the allowed projects list. Allowed: ${input.stored.allowedProjects.join(", ")}`,
              );
            }

            const data = yield* Effect.tryPromise({
              try: () =>
                invokeAtlassianTool({
                  binding,
                  args,
                  stored: input.stored!,
                  apiToken,
                }),
              catch: (cause) =>
                cause instanceof Error
                  ? cause
                  : new Error(String(cause)),
            });

            return {
              data,
              error: null,
              headers: {},
              status: 200,
            };
          }),
      },
    },
    tools: [
      {
        name: "getSourceConfig",
        description: "Load the saved configuration for an Atlassian source.",
        inputSchema: Schema.Struct({ sourceId: Schema.String }),
        outputSchema: AtlassianSourceConfigPayloadSchema,
        execute: ({ args, source }: { args: { sourceId: string }; source: any }) =>
          source.getSourceConfig(args.sourceId),
      },
      {
        name: "createSource",
        description: "Create an Atlassian source (Jira + Confluence). Store your API token as a secret first, then provide the secretId as apiTokenRef.",
        inputSchema: AtlassianConnectInputSchema,
        outputSchema: SourceSchema,
        execute: ({ args, source }: { args: AtlassianConnectInput; source: any }) =>
          source.createSource(args),
      },
      {
        name: "updateSource",
        description: "Update an Atlassian source configuration.",
        inputSchema: AtlassianUpdateSourceInputSchema,
        outputSchema: SourceSchema,
        execute: ({ args, source }: { args: AtlassianUpdateSourceInput; source: any }) =>
          source.updateSource(args),
      },
      {
        name: "refreshSource",
        description: "Refresh an Atlassian source and resync its tool catalog.",
        inputSchema: Schema.Struct({ sourceId: Schema.String }),
        outputSchema: SourceSchema,
        execute: ({ args, source }: { args: { sourceId: string }; source: any }) =>
          source.refreshSource(args.sourceId),
      },
      {
        name: "removeSource",
        description: "Remove an Atlassian source and its stored data.",
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
        atlassian: {
          createSource: (input: AtlassianConnectInput) => provideRuntime(source.createSource(input)),
          getSourceConfig: (sourceId: string) => provideRuntime(source.getSourceConfig(SourceIdSchema.make(sourceId))),
          updateSource: (input: AtlassianUpdateSourceInput) => provideRuntime(source.updateSource(input)),
          refreshSource: (sourceId: string) => provideRuntime(source.refreshSource(SourceIdSchema.make(sourceId))),
          removeSource: (sourceId: string) => provideRuntime(source.removeSource(SourceIdSchema.make(sourceId))),
        },
      };
    },
  });
