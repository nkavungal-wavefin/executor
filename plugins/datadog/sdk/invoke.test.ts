import { describe, it, expect, beforeEach, vi } from "vitest";
import { invokeDatadogTool } from "./invoke";
import type { DatadogExecutableBinding } from "./executable-binding";
import type { DatadogStoredSourceData } from "@executor/plugin-datadog-shared";

describe("invokeDatadogTool", () => {
  const mockStoredData: DatadogStoredSourceData = {
    auth: {
      kind: "api-key",
      apiKeyRef: { secretId: "test-api-key" },
      appKeyRef: { secretId: "test-app-key" },
    },
  };

  const mockStoredDataNoAppKey: DatadogStoredSourceData = {
    auth: {
      kind: "api-key",
      apiKeyRef: { secretId: "test-api-key" },
      appKeyRef: null,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe("logs.query", () => {
    it("should construct correct request with required parameters", async () => {
      const mockResponse = {
        ok: true,
        headers: new Map([["content-type", "application/json"]]),
        json: () => Promise.resolve([{ message: "test log" }]),
        text: () => Promise.resolve(""),
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const binding: DatadogExecutableBinding = {
        operation: "logs.query",
        query: "status:error",
        from: 1000000,
        to: 2000000,
      };

      const result = await invokeDatadogTool({
        binding,
        args: { query: "status:error", from: 1000000, to: 2000000 },
        stored: mockStoredData,
        apiKey: "test-api-key",
        appKey: "test-app-key",
      });

      expect(global.fetch).toHaveBeenCalled();
      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl).toContain("/api/v2/logs");
      expect(callUrl).toContain("filter=status%3Aerror");

      const headers = (global.fetch as any).mock.calls[0][1].headers;
      expect(headers["DD-API-KEY"]).toBe("test-api-key");
      expect(headers["DD-APPLICATION-KEY"]).toBe("test-app-key");
    });

    it("should work with only API key (no app key)", async () => {
      const mockResponse = {
        ok: true,
        headers: new Map([["content-type", "application/json"]]),
        json: () => Promise.resolve([]),
        text: () => Promise.resolve(""),
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const binding: DatadogExecutableBinding = {
        operation: "logs.query",
        query: "env:prod",
        from: 1000000,
        to: 2000000,
      };

      const result = await invokeDatadogTool({
        binding,
        args: { query: "env:prod", from: 1000000, to: 2000000 },
        stored: mockStoredDataNoAppKey,
        apiKey: "test-api-key",
      });

      const headers = (global.fetch as any).mock.calls[0][1].headers;
      expect(headers["DD-API-KEY"]).toBe("test-api-key");
      expect(headers["DD-APPLICATION-KEY"]).toBeUndefined();
    });

    it("should throw error if query is missing", async () => {
      const binding: DatadogExecutableBinding = {
        operation: "logs.query",
        query: "",
        from: 1000000,
        to: 2000000,
      };

      await expect(
        invokeDatadogTool({
          binding,
          args: {},
          stored: mockStoredData,
          apiKey: "test-api-key",
          appKey: "test-app-key",
        }),
      ).rejects.toThrow("query parameter is required");
    });
  });

  describe("logs.live_tail", () => {
    it("should return live tail metadata", async () => {
      const binding: DatadogExecutableBinding = {
        operation: "logs.live_tail",
        query: "service:api",
      };

      const result = await invokeDatadogTool({
        binding,
        args: { query: "service:api" },
        stored: mockStoredData,
        apiKey: "test-api-key",
        appKey: "test-app-key",
      });

      expect(result).toEqual({
        type: "live_tail",
        query: "service:api",
        message: "Live tail stream initiated. Use SSE client to consume events.",
        endpoint: "https://api.datadoghq.com/api/v2/logs/stream",
        headers: {
          "DD-API-KEY": "test-api-key",
          "DD-APPLICATION-KEY": "test-app-key",
        },
      });
    });

    it("should throw error if query is missing", async () => {
      const binding: DatadogExecutableBinding = {
        operation: "logs.live_tail",
        query: "",
      };

      await expect(
        invokeDatadogTool({
          binding,
          args: {},
          stored: mockStoredData,
          apiKey: "test-api-key",
          appKey: "test-app-key",
        }),
      ).rejects.toThrow("query parameter is required");
    });
  });

  describe("apm.traces.query", () => {
    it("should construct correct traces request", async () => {
      const mockResponse = {
        ok: true,
        headers: new Map([["content-type", "application/json"]]),
        json: () => Promise.resolve({ traces: [] }),
        text: () => Promise.resolve(""),
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const binding: DatadogExecutableBinding = {
        operation: "apm.traces.query",
        query: "service:api",
        from: 1000000,
        to: 2000000,
      };

      const result = await invokeDatadogTool({
        binding,
        args: { query: "service:api", from: 1000000, to: 2000000 },
        stored: mockStoredData,
        apiKey: "test-api-key",
        appKey: "test-app-key",
      });

      expect(global.fetch).toHaveBeenCalled();
      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl).toContain("/api/v2/traces");
      expect(callUrl).toContain("query_string=service%3Aapi");
    });
  });

  describe("apm.traces.get", () => {
    it("should construct correct trace get request", async () => {
      const mockResponse = {
        ok: true,
        headers: new Map([["content-type", "application/json"]]),
        json: () => Promise.resolve({ trace_id: "123", spans: [] }),
        text: () => Promise.resolve(""),
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const binding: DatadogExecutableBinding = {
        operation: "apm.traces.get",
        traceId: "abc123",
      };

      const result = await invokeDatadogTool({
        binding,
        args: { traceId: "abc123" },
        stored: mockStoredData,
        apiKey: "test-api-key",
        appKey: "test-app-key",
      });

      expect(global.fetch).toHaveBeenCalled();
      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl).toContain("/api/v2/traces/abc123");
    });

    it("should throw error if traceId is missing", async () => {
      const binding: DatadogExecutableBinding = {
        operation: "apm.traces.get",
        traceId: "",
      };

      await expect(
        invokeDatadogTool({
          binding,
          args: {},
          stored: mockStoredData,
          apiKey: "test-api-key",
          appKey: "test-app-key",
        }),
      ).rejects.toThrow("traceId parameter is required");
    });
  });

  describe("error handling", () => {
    it("should handle API errors gracefully", async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: () => Promise.resolve("Invalid API key"),
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const binding: DatadogExecutableBinding = {
        operation: "logs.query",
        query: "status:error",
        from: 1000000,
        to: 2000000,
      };

      await expect(
        invokeDatadogTool({
          binding,
          args: { query: "status:error", from: 1000000, to: 2000000 },
          stored: mockStoredData,
          apiKey: "invalid-key",
          appKey: "test-app-key",
        }),
      ).rejects.toThrow("Datadog API error");
    });

    it("should throw error for unknown operation", async () => {
      const binding: any = {
        operation: "unknown.operation",
      };

      await expect(
        invokeDatadogTool({
          binding,
          args: {},
          stored: mockStoredData,
          apiKey: "test-api-key",
          appKey: "test-app-key",
        }),
      ).rejects.toThrow("Unknown Datadog operation");
    });
  });
});
