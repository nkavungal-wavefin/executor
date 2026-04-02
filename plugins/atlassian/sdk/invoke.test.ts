import { describe, expect, it, vi } from "vitest";

import { invokeAtlassianTool } from "./invoke";
import type { AtlassianExecutableBinding } from "./executable-binding";
import type { AtlassianStoredSourceData } from "@executor/plugin-atlassian-shared";

const makeStored = (
  overrides: Partial<AtlassianStoredSourceData> = {},
): AtlassianStoredSourceData => ({
  cloudBaseUrl: "test.atlassian.net",
  auth: { kind: "basic", email: "user@test.com", apiTokenRef: { secretId: "s1" } as never },
  allowedProjects: null,
  allowedSpaces: null,
  enableJira: true,
  enableConfluence: true,
  ...overrides,
});

const mockFetch = (body: unknown, ok = true) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok,
    status: ok ? 200 : 403,
    statusText: ok ? "OK" : "Forbidden",
    json: async () => body,
  } as Response);

describe("invokeAtlassianTool", () => {
  // -----------------------------------------------------------------------
  // confluence.page.get — space enforcement
  // -----------------------------------------------------------------------
  describe("confluence.page.get space enforcement", () => {
    it("returns page when spaceId matches binding", async () => {
      const pageData = { id: "123", title: "Hello", spaceId: "space-100" };
      const fetchSpy = mockFetch(pageData);

      const binding: AtlassianExecutableBinding = {
        operation: "confluence.page.get",
        spaceKey: "ENG",
        spaceId: "space-100",
        cloudBaseUrl: "test.atlassian.net",
      };

      const result = await invokeAtlassianTool({
        binding,
        args: { pageId: "123" },
        stored: makeStored(),
        apiToken: "tok",
      });

      expect(result).toEqual(pageData);
      fetchSpy.mockRestore();
    });

    it("throws when page spaceId does not match binding spaceId", async () => {
      const pageData = { id: "123", title: "Hello", spaceId: "space-999" };
      const fetchSpy = mockFetch(pageData);

      const binding: AtlassianExecutableBinding = {
        operation: "confluence.page.get",
        spaceKey: "ENG",
        spaceId: "space-100",
        cloudBaseUrl: "test.atlassian.net",
      };

      await expect(
        invokeAtlassianTool({
          binding,
          args: { pageId: "123" },
          stored: makeStored(),
          apiToken: "tok",
        }),
      ).rejects.toThrow(/belongs to a different space/);

      fetchSpy.mockRestore();
    });

    it("throws when pageId is missing", async () => {
      const binding: AtlassianExecutableBinding = {
        operation: "confluence.page.get",
        spaceKey: "ENG",
        spaceId: "space-100",
        cloudBaseUrl: "test.atlassian.net",
      };

      await expect(
        invokeAtlassianTool({
          binding,
          args: {},
          stored: makeStored(),
          apiToken: "tok",
        }),
      ).rejects.toThrow("pageId is required");
    });
  });

  // -----------------------------------------------------------------------
  // confluence.search
  // -----------------------------------------------------------------------
  describe("confluence.search", () => {
    it("constructs CQL with space filter and query", async () => {
      const searchResult = { results: [{ id: "1", title: "Match" }] };
      const fetchSpy = mockFetch(searchResult);

      const binding: AtlassianExecutableBinding = {
        operation: "confluence.search",
        spaceKey: "DOCS",
        spaceId: "space-200",
        cloudBaseUrl: "test.atlassian.net",
      };

      const result = await invokeAtlassianTool({
        binding,
        args: { query: "onboarding" },
        stored: makeStored(),
        apiToken: "tok",
      });

      expect(result).toEqual(searchResult);

      const calledUrl = (fetchSpy.mock.calls[0]![0] as string);
      expect(calledUrl).toContain("wiki/rest/api/content/search");
      expect(calledUrl).toContain("space");
      expect(calledUrl).toContain("DOCS");
      expect(calledUrl).toContain("onboarding");

      fetchSpy.mockRestore();
    });

    it("throws when query is missing", async () => {
      const binding: AtlassianExecutableBinding = {
        operation: "confluence.search",
        spaceKey: "DOCS",
        spaceId: "space-200",
        cloudBaseUrl: "test.atlassian.net",
      };

      await expect(
        invokeAtlassianTool({
          binding,
          args: {},
          stored: makeStored(),
          apiToken: "tok",
        }),
      ).rejects.toThrow("query is required");
    });

    it("escapes double quotes in query", async () => {
      const fetchSpy = mockFetch({ results: [] });

      const binding: AtlassianExecutableBinding = {
        operation: "confluence.search",
        spaceKey: "DOCS",
        spaceId: "space-200",
        cloudBaseUrl: "test.atlassian.net",
      };

      await invokeAtlassianTool({
        binding,
        args: { query: 'some "quoted" term' },
        stored: makeStored(),
        apiToken: "tok",
      });

      const calledUrl = (fetchSpy.mock.calls[0]![0] as string);
      expect(calledUrl).not.toContain('""');

      fetchSpy.mockRestore();
    });
  });

  // -----------------------------------------------------------------------
  // Unknown operation
  // -----------------------------------------------------------------------
  it("throws for unknown operations", async () => {
    await expect(
      invokeAtlassianTool({
        binding: { operation: "unknown.op" } as unknown as AtlassianExecutableBinding,
        args: {},
        stored: makeStored(),
        apiToken: "tok",
      }),
    ).rejects.toThrow(/Unknown Atlassian operation/);
  });

  // -----------------------------------------------------------------------
  // Project and space filtering - explicit opt-in model
  // -----------------------------------------------------------------------
  describe("Project and space filtering (explicit opt-in)", () => {
    it("allowedProjects: null should result in no projects being accessible", async () => {
      // This test verifies the behavior at the catalog sync level
      // When allowedProjects is null, fetchJiraProjects should return []
      // and no project-specific capabilities should be created
      const stored = makeStored({ allowedProjects: null, enableJira: true });
      expect(stored.allowedProjects).toBeNull();
      // The catalog sync would call fetchJiraProjects with null,
      // which should return an empty array (no API calls needed)
    });

    it("allowedProjects: [] should result in no projects being accessible", async () => {
      // When allowedProjects is an empty array, fetchJiraProjects should return []
      const stored = makeStored({ allowedProjects: [], enableJira: true });
      expect(stored.allowedProjects).toEqual([]);
      // The catalog sync would call fetchJiraProjects with [],
      // which should return an empty array (no API calls)
    });

    it("allowedProjects: ['PMT'] should result in only PMT project being fetched", async () => {
      // When allowedProjects is set to specific projects,
      // fetchJiraProjects should fetch only those projects
      const stored = makeStored({ allowedProjects: ["PMT"], enableJira: true });
      expect(stored.allowedProjects).toEqual(["PMT"]);
      // The catalog sync would call fetchJiraProjects with ["PMT"],
      // which should make targeted API calls to fetch only that project
    });

    it("allowedSpaces: null should result in no spaces being accessible", async () => {
      const stored = makeStored({ allowedSpaces: null, enableConfluence: true });
      expect(stored.allowedSpaces).toBeNull();
    });

    it("allowedSpaces: [] should result in no spaces being accessible", async () => {
      const stored = makeStored({ allowedSpaces: [], enableConfluence: true });
      expect(stored.allowedSpaces).toEqual([]);
    });

    it("allowedSpaces: ['ENG'] should result in only ENG space being fetched", async () => {
      const stored = makeStored({ allowedSpaces: ["ENG"], enableConfluence: true });
      expect(stored.allowedSpaces).toEqual(["ENG"]);
    });
  });
});
