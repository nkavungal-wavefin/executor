const GOOGLE_DISCOVERY_PLUGIN_KEY = "google-discovery" as const;
const GOOGLE_DISCOVERY_SOURCE_KIND = "google_discovery" as const;

export type SourcePreset =
  | {
      id: string;
      pluginKey: "mcp";
      kind: "mcp";
      name: string;
      summary: string;
      previewUrl: string;
      endpoint?: string;
      transport?: "auto" | "streamable-http" | "sse" | "stdio";
      command?: string;
      args?: string[];
      env?: Record<string, string>;
      cwd?: string;
    }
  | {
      id: string;
      pluginKey: "openapi";
      kind: "openapi";
      name: string;
      summary: string;
      previewUrl: string;
      baseUrl: string;
      specUrl: string;
    }
  | {
      id: string;
      pluginKey: "graphql";
      kind: "graphql";
      name: string;
      summary: string;
      previewUrl: string;
      endpoint: string;
    }
  | {
      id: string;
      pluginKey: typeof GOOGLE_DISCOVERY_PLUGIN_KEY;
      kind: typeof GOOGLE_DISCOVERY_SOURCE_KIND;
      name: string;
      summary: string;
      previewUrl: string;
      service: string;
      version: string;
      discoveryUrl: string;
    };

const googleDiscoveryPreset = (input: {
  id: string;
  name: string;
  summary: string;
  service: string;
  version: string;
  discoveryUrl: string;
}): SourcePreset => ({
  id: input.id,
  pluginKey: GOOGLE_DISCOVERY_PLUGIN_KEY,
  kind: GOOGLE_DISCOVERY_SOURCE_KIND,
  name: input.name,
  summary: input.summary,
  previewUrl: input.discoveryUrl,
  service: input.service,
  version: input.version,
  discoveryUrl: input.discoveryUrl,
});

export const sourcePresets: ReadonlyArray<SourcePreset> = [];

export const buildSourcePresetSearch = (
  preset: SourcePreset,
): Record<string, string> => {
  switch (preset.pluginKey) {
    case "openapi":
      return {
        preset: preset.id,
        presetName: preset.name,
        presetBaseUrl: preset.baseUrl,
        presetSpecUrl: preset.specUrl,
      };
    case "graphql":
      return {
        preset: preset.id,
        presetName: preset.name,
        presetEndpoint: preset.endpoint,
      };
    case "mcp":
      return {
        preset: preset.id,
        presetName: preset.name,
        ...(preset.endpoint ? { presetEndpoint: preset.endpoint } : {}),
        ...(preset.transport ? { presetTransport: preset.transport } : {}),
        ...(preset.command ? { presetCommand: preset.command } : {}),
        ...(preset.args ? { presetArgs: JSON.stringify(preset.args) } : {}),
        ...(preset.env ? { presetEnv: JSON.stringify(preset.env) } : {}),
        ...(preset.cwd ? { presetCwd: preset.cwd } : {}),
      };
    default:
      return {
        preset: preset.id,
        presetName: preset.name,
        presetService: preset.service,
        presetVersion: preset.version,
        presetDiscoveryUrl: preset.discoveryUrl,
      };
  }
};

const normalizeComparableUrl = (value: string): string => {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1);
    }
    return url.toString();
  } catch {
    return trimmed;
  }
};

const tryParseUrl = (value: string): URL | null => {
  try {
    return new URL(value.trim());
  } catch {
    return null;
  }
};

const sourceNameFromUrl = (url: URL, fallback: string): string => {
  const hostname = url.hostname.replace(/^www\./, "");
  if (hostname.length === 0) {
    return fallback;
  }

  const head = hostname.split(".")[0]?.trim();
  if (!head) {
    return fallback;
  }

  return `${head.charAt(0).toUpperCase()}${head.slice(1)} ${fallback}`;
};

const parseGoogleDiscoveryUrl = (value: string): {
  service: string;
  version: string;
  discoveryUrl: string;
} | null => {
  const url = tryParseUrl(value);
  if (!url) {
    return null;
  }

  const byDirectory = url.pathname.match(
    /^\/discovery\/v1\/apis\/([^/]+)\/([^/]+)\/rest$/,
  );
  if (byDirectory) {
    return {
      service: decodeURIComponent(byDirectory[1] ?? ""),
      version: decodeURIComponent(byDirectory[2] ?? ""),
      discoveryUrl: url.toString(),
    };
  }

  const versionParam = url.searchParams.get("version")?.trim();
  const isHostScopedDiscovery =
    url.pathname === "/$discovery/rest"
    && url.hostname.endsWith(".googleapis.com")
    && url.hostname !== "www.googleapis.com";

  if (versionParam && isHostScopedDiscovery) {
    const service = url.hostname.split(".")[0]?.trim();
    if (!service) {
      return null;
    }

    return {
      service,
      version: versionParam,
      discoveryUrl: url.toString(),
    };
  }

  return null;
};

const isGraphqlUrl = (url: URL): boolean => {
  const path = url.pathname.toLowerCase();
  const hostname = url.hostname.toLowerCase();
  return (
    path.endsWith("/graphql")
    || path === "/graphql"
    || hostname.startsWith("graphql.")
    || hostname.includes("graphql")
  );
};

const isMcpUrl = (url: URL): boolean => {
  const path = url.pathname.toLowerCase();
  const hostname = url.hostname.toLowerCase();
  return path.endsWith("/mcp") || path.includes("/mcp/") || hostname.startsWith("mcp.");
};

const isLikelyOpenApiSpecUrl = (url: URL): boolean => {
  const path = url.pathname.toLowerCase();
  return (
    path.endsWith(".json")
    || path.endsWith(".yaml")
    || path.endsWith(".yml")
    || path.includes("openapi")
    || path.includes("swagger")
  );
};

const findPresetByInput = (value: string): SourcePreset | null => {
  const comparable = normalizeComparableUrl(value);
  for (const preset of sourcePresets) {
    if (normalizeComparableUrl(preset.previewUrl) === comparable) {
      return preset;
    }

    if (preset.pluginKey === "openapi") {
      if (normalizeComparableUrl(preset.baseUrl) === comparable) {
        return preset;
      }
      if (normalizeComparableUrl(preset.specUrl) === comparable) {
        return preset;
      }
      continue;
    }

    if (preset.pluginKey === "graphql" || preset.pluginKey === "mcp") {
      if (preset.endpoint && normalizeComparableUrl(preset.endpoint) === comparable) {
        return preset;
      }
      continue;
    }

    if (normalizeComparableUrl(preset.discoveryUrl) === comparable) {
      return preset;
    }
  }

  return null;
};

export type ResolvedQuickSourceInput = {
  pluginKey: SourcePreset["pluginKey"];
  search: Record<string, string>;
};

export const resolveQuickSourceInput = (
  rawValue: string,
): ResolvedQuickSourceInput | null => {
  const trimmed = rawValue.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const commandParts =
    trimmed.match(/[^\s"]+|"([^"]*)"/g)?.map((part) =>
      part.startsWith("\"") && part.endsWith("\"")
        ? part.slice(1, -1)
        : part
    ) ?? null;
  if (commandParts && commandParts.length > 0) {
    const [command, ...args] = commandParts;
    const isKnownCommand =
      command === "npx"
      || command === "bunx"
      || command === "uvx"
      || (command === "pnpm" && args[0] === "dlx");

    if (isKnownCommand) {
      return {
        pluginKey: "mcp",
        search: {
          presetName: "Local MCP",
          presetTransport: "stdio",
          presetCommand: command,
          ...(args.length > 0 ? { presetArgs: JSON.stringify(args) } : {}),
          quickInput: trimmed,
        },
      };
    }
  }

  const preset = findPresetByInput(trimmed);
  if (preset) {
    return {
      pluginKey: preset.pluginKey,
      search: buildSourcePresetSearch(preset),
    };
  }

  const googleDiscovery = parseGoogleDiscoveryUrl(trimmed);
  if (googleDiscovery) {
    const googlePreset = sourcePresets.find(
      (presetEntry) =>
        presetEntry.pluginKey === GOOGLE_DISCOVERY_PLUGIN_KEY
        && presetEntry.service === googleDiscovery.service
        && presetEntry.version === googleDiscovery.version,
    );

    return {
      pluginKey: GOOGLE_DISCOVERY_PLUGIN_KEY,
      search: {
        ...(googlePreset ? buildSourcePresetSearch(googlePreset) : {}),
        presetName:
          googlePreset?.name
          ?? `Google ${googleDiscovery.service} ${googleDiscovery.version}`,
        presetService: googleDiscovery.service,
        presetVersion: googleDiscovery.version,
        presetDiscoveryUrl: googleDiscovery.discoveryUrl,
        quickInput: trimmed,
      },
    };
  }

  const url = tryParseUrl(trimmed);
  if (!url) {
    return null;
  }

  if (isGraphqlUrl(url)) {
    return {
      pluginKey: "graphql",
      search: {
        presetName: sourceNameFromUrl(url, "GraphQL"),
        presetEndpoint: trimmed,
        quickInput: trimmed,
      },
    };
  }

  if (isMcpUrl(url)) {
    return {
      pluginKey: "mcp",
      search: {
        presetName: sourceNameFromUrl(url, "MCP"),
        presetEndpoint: trimmed,
        presetTransport: "auto",
        quickInput: trimmed,
      },
    };
  }

  if (isLikelyOpenApiSpecUrl(url)) {
    return {
      pluginKey: "openapi",
      search: {
        presetName: sourceNameFromUrl(url, "OpenAPI"),
        presetSpecUrl: trimmed,
        quickInput: trimmed,
      },
    };
  }

  return {
    pluginKey: "openapi",
    search: {
      presetName: sourceNameFromUrl(url, "OpenAPI"),
      presetBaseUrl: trimmed,
      quickInput: trimmed,
    },
  };
};
