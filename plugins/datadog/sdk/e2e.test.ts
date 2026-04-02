/**
 * End-to-end integration tests for Datadog plugin
 * Tests the full workflow: source creation -> operation execution -> result handling
 */

import { describe, it, expect, beforeEach } from "vitest";
import { invokeDatadogTool } from "./invoke";
import {
  DatadogConnectInputSchema,
  DatadogStoredSourceDataSchema,
} from "@executor/plugin-datadog-shared";
import type {
  DatadogConnectInput,
  DatadogStoredSourceData,
} from "@executor/plugin-datadog-shared";
import type { DatadogExecutableBinding } from "./executable-binding";
import * as Schema from "effect/Schema";

describe("Datadog Plugin E2E Integration", () => {
  describe("Source Configuration", () => {
    it("should validate source config with API Key only", () => {
      const config: DatadogConnectInput = {
        name: "Production Datadog",
        auth: {
          kind: "api-key",
          apiKeyRef: { secretId: "dd-api-key-123" },
          appKeyRef: null,
        },
      };

      const decoded = Schema.decodeSync(DatadogConnectInputSchema)(config);
      expect(decoded.name).toBe("Production Datadog");
      expect(decoded.auth.apiKeyRef.secretId).toBe("dd-api-key-123");
      expect(decoded.auth.appKeyRef).toBeNull();
    });

    it("should validate source config with API Key and Application Key", () => {
      const config: DatadogConnectInput = {
        name: "Full Datadog Setup",
        auth: {
          kind: "api-key",
          apiKeyRef: { secretId: "dd-api-key-456" },
          appKeyRef: { secretId: "dd-app-key-456" },
        },
      };

      const decoded = Schema.decodeSync(DatadogConnectInputSchema)(config);
      expect(decoded.auth.apiKeyRef.secretId).toBe("dd-api-key-456");
      expect(decoded.auth.appKeyRef?.secretId).toBe("dd-app-key-456");
    });

    it("should reject config without API Key", () => {
      const config: any = {
        name: "Invalid",
        auth: {
          kind: "api-key",
          appKeyRef: { secretId: "dd-app-key" },
        },
      };

      expect(() => Schema.decodeSync(DatadogConnectInputSchema)(config)).toThrow();
    });
  });

  describe("Catalog Sync", () => {
    it("should provide static catalog of 5 operations", () => {
      const { DATADOG_STATIC_OPERATIONS } = require("./catalog-static");

      expect(DATADOG_STATIC_OPERATIONS).toHaveLength(5);

      const operations = DATADOG_STATIC_OPERATIONS.map((op: any) => op.id);
      expect(operations).toContain("datadog.logs.query");
      expect(operations).toContain("datadog.logs.live_tail");
      expect(operations).toContain("datadog.logs.archive_read");
      expect(operations).toContain("datadog.apm.traces.query");
      expect(operations).toContain("datadog.apm.traces.get");
    });
  });

  describe("Tool Invocation Workflow", () => {
    const mockStoredData: DatadogStoredSourceData = {
      auth: {
        kind: "api-key",
        apiKeyRef: { secretId: "test-api-key" },
        appKeyRef: { secretId: "test-app-key" },
      },
    };

    beforeEach(() => {
      global.fetch = vi.fn();
    });

    it("should handle successful logs.query operation", async () => {
      const mockResponse = {
        ok: true,
        headers: new Map([["content-type", "application/json"]]),
        json: () =>
          Promise.resolve({
            data: [
              {
                id: "log-1",
                attributes: {
                  message: "Error occurred",
                  status: "error",
                  timestamp: 1234567890,
                },
              },
            ],
          }),
        text: () => Promise.resolve(""),
      };

      global.fetch = vi.fn().mockResolvedValue(mockResponse);

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

      expect(result).toBeDefined();
      expect((result as any).data).toBeDefined();
    });

    it("should handle partial credentials (API Key only)", async () => {
      const mockResponse = {
        ok: true,
        headers: new Map([["content-type", "application/json"]]),
        json: () => Promise.resolve({ data: [] }),
        text: () => Promise.resolve(""),
      };

      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const binding: DatadogExecutableBinding = {
        operation: "logs.query",
        query: "service:web",
        from: 1000000,
        to: 2000000,
      };

      // Only API Key, no app key
      const result = await invokeDatadogTool({
        binding,
        args: { query: "service:web", from: 1000000, to: 2000000 },
        stored: mockStoredData,
        apiKey: "test-api-key",
      });

      expect(result).toBeDefined();

      // Verify only API Key header was set
      const headers = global.fetch.mock.calls[0][1].headers;
      expect(headers["DD-API-KEY"]).toBe("test-api-key");
      expect(headers["DD-APPLICATION-KEY"]).toBeUndefined();
    });

    it("should handle errors from Datadog API", async () => {
      const mockResponse = {
        ok: false,
        status: 403,
        statusText: "Forbidden",
        text: () => Promise.resolve("Invalid API credentials"),
      };

      global.fetch = vi.fn().mockResolvedValue(mockResponse);

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
          appKey: "invalid-key",
        }),
      ).rejects.toThrow("Datadog API error");
    });
  });

  describe("Error Handling", () => {
    const mockStoredData: DatadogStoredSourceData = {
      auth: {
        kind: "api-key",
        apiKeyRef: { secretId: "test-api-key" },
        appKeyRef: null,
      },
    };

    it("should provide helpful error for missing required parameters", async () => {
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
        }),
      ).rejects.toThrow("query parameter is required");
    });

    it("should handle network timeouts gracefully", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network timeout"));

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
          apiKey: "test-api-key",
        }),
      ).rejects.toThrow("Network timeout");
    });

    it("should reject invalid operation types", async () => {
      const binding: any = {
        operation: "invalid.operation",
      };

      await expect(
        invokeDatadogTool({
          binding,
          args: {},
          stored: mockStoredData,
          apiKey: "test-api-key",
        }),
      ).rejects.toThrow("Unknown Datadog operation");
    });
  });

  describe("Different Operation Types", () => {
    const mockStoredData: DatadogStoredSourceData = {
      auth: {
        kind: "api-key",
        apiKeyRef: { secretId: "test-api-key" },
        appKeyRef: { secretId: "test-app-key" },
      },
    };

    beforeEach(() => {
      global.fetch = vi.fn();
    });

    it("should construct correct URL for each operation type", async () => {
      const testCases = [
        {
          operation: "logs.query" as const,
          expected: "/api/v2/logs",
        },
        {
          operation: "logs.archive_read" as const,
          expected: "/api/v2/logs/archives",
        },
        {
          operation: "apm.traces.query" as const,
          expected: "/api/v2/traces",
        },
        {
          operation: "apm.traces.get" as const,
          expected: "/api/v2/traces",
        },
      ];

      for (const testCase of testCases) {
        const mockResponse = {
          ok: true,
          headers: new Map([["content-type", "application/json"]]),
          json: () => Promise.resolve({}),
          text: () => Promise.resolve(""),
        };

        global.fetch = vi.fn().mockResolvedValue(mockResponse);

        const binding: any = {
          operation: testCase.operation,
          query: "test",
          from: 1000000,
          to: 2000000,
          archiveId: "archive-1",
          traceId: "trace-1",
        };

        await invokeDatadogTool({
          binding,
          args: binding,
          stored: mockStoredData,
          apiKey: "test-api-key",
          appKey: "test-app-key",
        });

        const url = (global.fetch as any).mock.calls[0][0];
        expect(url).toContain(testCase.expected);
      }
    });
  });
});
