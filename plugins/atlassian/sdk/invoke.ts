import type { AtlassianStoredSourceData } from "@executor/plugin-atlassian-shared";
import type { AtlassianExecutableBinding } from "./executable-binding";

const basicAuthHeader = (email: string, apiToken: string): string =>
  `Basic ${Buffer.from(`${email}:${apiToken}`).toString("base64")}`;

const jiraBaseUrl = (cloudBaseUrl: string): string =>
  `https://${cloudBaseUrl}/rest/api/3`;

const confluenceBaseUrl = (cloudBaseUrl: string): string =>
  `https://${cloudBaseUrl}/wiki/api/v2`;

// Bun-specific: bypass corporate TLS proxies with self-signed certs
const tlsOptions = { tls: { rejectUnauthorized: false } } as RequestInit;

const atlassianFetch = async (
  url: string,
  email: string,
  apiToken: string,
): Promise<unknown> => {
  const response = await fetch(url, {
    headers: {
      Authorization: basicAuthHeader(email, apiToken),
      Accept: "application/json",
    },
    ...tlsOptions,
  });

  if (!response.ok) {
    throw new Error(
      `Atlassian API error: ${response.status} ${response.statusText} for ${url}`,
    );
  }

  return response.json();
};

export const invokeAtlassianTool = async (input: {
  binding: AtlassianExecutableBinding;
  args: Record<string, unknown>;
  stored: AtlassianStoredSourceData;
  apiToken: string;
}): Promise<unknown> => {
  const { binding, args, stored, apiToken } = input;
  const email = stored.auth.email;

  if (binding.operation === "jira.issue.get") {
    const issueKey = String(args.issueKey ?? "");
    if (!issueKey) {
      throw new Error("issueKey is required");
    }
    const url = `${jiraBaseUrl(binding.cloudBaseUrl)}/issue/${encodeURIComponent(issueKey)}`;
    return atlassianFetch(url, email, apiToken);
  }

  if (binding.operation === "jira.issues.search") {
    const jql = String(args.jql ?? `project = ${binding.projectKey}`);
    const maxResults = Number(args.maxResults ?? 50);
    const startAt = Number(args.startAt ?? 0);
    const params = new URLSearchParams({
      jql,
      maxResults: String(Math.min(maxResults, 100)),
      startAt: String(startAt),
      fields: "summary,status,assignee,priority,description,created,updated,issuetype",
    });
    const url = `${jiraBaseUrl(binding.cloudBaseUrl)}/search?${params}`;
    return atlassianFetch(url, email, apiToken);
  }

  if (binding.operation === "confluence.pages.list") {
    const limit = Number(args.limit ?? 25);
    const cursor = args.cursor ? String(args.cursor) : undefined;
    const params = new URLSearchParams({
      "space-key": binding.spaceKey,
      limit: String(Math.min(limit, 250)),
    });
    if (cursor) {
      params.set("cursor", cursor);
    }
    const url = `${confluenceBaseUrl(binding.cloudBaseUrl)}/pages?${params}`;
    return atlassianFetch(url, email, apiToken);
  }

  if (binding.operation === "confluence.page.get") {
    const pageId = String(args.pageId ?? "");
    if (!pageId) {
      throw new Error("pageId is required");
    }
    const params = new URLSearchParams({
      "body-format": "storage",
    });
    const url = `${confluenceBaseUrl(binding.cloudBaseUrl)}/pages/${encodeURIComponent(pageId)}?${params}`;
    const data = (await atlassianFetch(url, email, apiToken)) as {
      spaceId?: string;
    };

    if (
      binding.spaceId &&
      data.spaceId !== undefined &&
      data.spaceId !== binding.spaceId
    ) {
      throw new Error(
        `Page ${pageId} belongs to a different space (spaceId ${data.spaceId}), not the allowed space "${binding.spaceKey}" (spaceId ${binding.spaceId}).`,
      );
    }

    return data;
  }

  if (binding.operation === "confluence.search") {
    const query = String(args.query ?? "");
    if (!query) {
      throw new Error("query is required");
    }
    const limit = Number(args.limit ?? 25);
    const cursor = args.cursor ? String(args.cursor) : undefined;

    const cql = `space = "${binding.spaceKey}" AND (text ~ "${query.replace(/"/g, '\\"')}")`;
    const params = new URLSearchParams({
      cql,
      limit: String(Math.min(limit, 100)),
    });
    if (cursor) {
      params.set("cursor", cursor);
    }
    const url = `https://${binding.cloudBaseUrl}/wiki/rest/api/content/search?${params}`;
    return atlassianFetch(url, email, apiToken);
  }

  throw new Error(`Unknown Atlassian operation: ${(binding as { operation: string }).operation}`);
};
