import type { DatadogStoredSourceData } from "@executor/plugin-datadog-shared";
import type { DatadogExecutableBinding } from "./executable-binding";

/**
 * Datadog API base URLs by region
 */
const getBaseUrl = (region: "us" | "eu" = "us"): string => {
  const baseUrls: Record<string, string> = {
    us: "https://api.datadoghq.com",
    eu: "https://api.datadoghq.eu",
  };
  return baseUrls[region];
};

/**
 * Build Datadog API authentication headers
 * Only apiKey is required; appKey is optional
 */
const buildDatadogHeaders = (apiKey: string, appKey?: string): HeadersInit => {
  const headers: HeadersInit = {
    "DD-API-KEY": apiKey,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (appKey) {
    headers["DD-APPLICATION-KEY"] = appKey;
  }

  return headers;
};

/**
 * Fetch helper for Datadog API
 */
const datadogFetch = async (
  url: string,
  apiKey: string,
  appKey?: string,
  options?: RequestInit,
): Promise<unknown> => {
  const response = await fetch(url, {
    ...options,
    headers: buildDatadogHeaders(apiKey, appKey),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `Datadog API error: ${response.status} ${response.statusText} - ${error}`,
    );
  }

  // Some endpoints may return empty responses
  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return response.json();
  }

  return response.text();
};

/**
 * Build query string with pagination and time range
 */
const buildLogsQuery = (
  filter: string,
  from: number,
  to: number,
  limit: number = 100,
): string => {
  const params = new URLSearchParams({
    filter,
    from: String(from),
    to: String(to),
    limit: String(limit),
  });
  return params.toString();
};

/**
 * Build trace query string
 */
const buildTracesQuery = (
  queryStr: string,
  from: number,
  to: number,
  limit: number = 100,
): string => {
  const params = new URLSearchParams({
    query_string: queryStr,
    from: String(from),
    to: String(to),
    page: JSON.stringify({
      cursor: "0",
      limit,
    }),
  });
  return params.toString();
};

/**
 * Invoke a Datadog tool operation
 */
export const invokeDatadogTool = async (input: {
  binding: DatadogExecutableBinding;
  args: Record<string, unknown>;
  stored: DatadogStoredSourceData;
  apiKey: string;
  appKey?: string;
}): Promise<unknown> => {
  const { binding, args, apiKey, appKey } = input;
  const baseUrl = getBaseUrl("us");

  if (binding.operation === "logs.query") {
    const filter = String(args.query ?? "");
    const from = Number(args.from ?? Date.now() - 3600000); // 1 hour ago
    const to = Number(args.to ?? Date.now());
    const limit = Number(args.limit ?? 100);

    if (!filter) {
      throw new Error("query parameter is required for logs.query");
    }

    const queryString = buildLogsQuery(filter, from, to, limit);
    const url = `${baseUrl}/api/v2/logs?${queryString}`;

    return datadogFetch(url, apiKey, appKey);
  }

  if (binding.operation === "logs.live_tail") {
    const query = String(args.query ?? "");

    if (!query) {
      throw new Error("query parameter is required for logs.live_tail");
    }

    // Live tail returns Server-Sent Events (SSE)
    // Return placeholder indicating live stream capability
    return {
      type: "live_tail",
      query,
      message: "Live tail stream initiated. Use SSE client to consume events.",
      endpoint: `${baseUrl}/api/v2/logs/stream`,
      headers: {
        "DD-API-KEY": apiKey,
        ...(appKey && { "DD-APPLICATION-KEY": appKey }),
      },
    };
  }

  if (binding.operation === "logs.archive_read") {
    const archiveId = String(args.archiveId ?? "");

    if (!archiveId) {
      throw new Error("archiveId parameter is required for logs.archive_read");
    }

    const url = `${baseUrl}/api/v2/logs/archives/${encodeURIComponent(archiveId)}/read`;

    return datadogFetch(url, apiKey, appKey);
  }

  if (binding.operation === "apm.traces.query") {
    const query = String(args.query ?? "");
    const from = Number(args.from ?? Date.now() - 3600000);
    const to = Number(args.to ?? Date.now());

    if (!query) {
      throw new Error("query parameter is required for apm.traces.query");
    }

    const queryString = buildTracesQuery(query, from, to);
    const url = `${baseUrl}/api/v2/traces?${queryString}`;

    return datadogFetch(url, apiKey, appKey);
  }

  if (binding.operation === "apm.traces.get") {
    const traceId = String(args.traceId ?? "");

    if (!traceId) {
      throw new Error("traceId parameter is required for apm.traces.get");
    }

    const url = `${baseUrl}/api/v2/traces/${encodeURIComponent(traceId)}`;

    return datadogFetch(url, apiKey, appKey);
  }

  throw new Error(
    `Unknown Datadog operation: ${(binding as { operation: string }).operation}`,
  );
};
