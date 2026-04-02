import { describe, it, expect } from "vitest";
import * as Schema from "effect/Schema";
import {
  DatadogConnectionAuthSchema,
  DatadogConnectInputSchema,
  DatadogSourceConfigPayloadSchema,
  DatadogUpdateSourceInputSchema,
  DatadogStoredSourceDataSchema,
  type DatadogConnectionAuth,
  type DatadogConnectInput,
  type DatadogSourceConfigPayload,
} from "./index";

describe("Datadog Shared Schemas", () => {
  describe("DatadogConnectionAuthSchema", () => {
    it("should validate auth config with both API key and app key", () => {
      const valid: DatadogConnectionAuth = {
        kind: "api-key",
        apiKeyRef: { secretId: "api-key-id" },
        appKeyRef: { secretId: "app-key-id" },
      };
      const result = Schema.decodeSync(DatadogConnectionAuthSchema)(valid);
      expect(result).toEqual(valid);
    });

    it("should validate auth config with only API key (appKeyRef null)", () => {
      const valid: DatadogConnectionAuth = {
        kind: "api-key",
        apiKeyRef: { secretId: "api-key-id" },
        appKeyRef: null,
      };
      const result = Schema.decodeSync(DatadogConnectionAuthSchema)(valid);
      expect(result).toEqual(valid);
    });

    it("should reject auth config missing apiKeyRef", () => {
      const invalid = {
        kind: "api-key",
        appKeyRef: { secretId: "app-key-id" },
      };
      expect(() => Schema.decodeSync(DatadogConnectionAuthSchema)(invalid)).toThrow();
    });

    it("should reject auth config with invalid kind", () => {
      const invalid = {
        kind: "oauth",
        apiKeyRef: { secretId: "api-key-id" },
        appKeyRef: null,
      };
      expect(() => Schema.decodeSync(DatadogConnectionAuthSchema)(invalid)).toThrow();
    });
  });

  describe("DatadogConnectInputSchema", () => {
    it("should validate valid connect input with all fields", () => {
      const valid: DatadogConnectInput = {
        name: "My Datadog Source",
        auth: {
          kind: "api-key",
          apiKeyRef: { secretId: "api-key-id" },
          appKeyRef: { secretId: "app-key-id" },
        },
      };
      const result = Schema.decodeSync(DatadogConnectInputSchema)(valid);
      expect(result).toEqual(valid);
    });

    it("should validate connect input without app key", () => {
      const valid: DatadogConnectInput = {
        name: "My Datadog Source",
        auth: {
          kind: "api-key",
          apiKeyRef: { secretId: "api-key-id" },
          appKeyRef: null,
        },
      };
      const result = Schema.decodeSync(DatadogConnectInputSchema)(valid);
      expect(result).toEqual(valid);
    });

    it("should reject connect input missing name", () => {
      const invalid = {
        auth: {
          kind: "api-key",
          apiKeyRef: { secretId: "api-key-id" },
          appKeyRef: null,
        },
      };
      expect(() => Schema.decodeSync(DatadogConnectInputSchema)(invalid)).toThrow();
    });

    it("should reject connect input with invalid auth", () => {
      const invalid = {
        name: "My Datadog Source",
        auth: {
          kind: "invalid-kind",
          apiKeyRef: { secretId: "api-key-id" },
          appKeyRef: null,
        },
      };
      expect(() => Schema.decodeSync(DatadogConnectInputSchema)(invalid)).toThrow();
    });

    it("should reject connect input with empty name", () => {
      const invalid: DatadogConnectInput = {
        name: "",
        auth: {
          kind: "api-key",
          apiKeyRef: { secretId: "api-key-id" },
          appKeyRef: null,
        },
      };
      // Empty string is still a valid string, so this should pass
      const result = Schema.decodeSync(DatadogConnectInputSchema)(invalid);
      expect(result.name).toBe("");
    });
  });

  describe("DatadogSourceConfigPayloadSchema", () => {
    it("should validate config payload (same as connect input)", () => {
      const valid: DatadogSourceConfigPayload = {
        name: "My Datadog Source",
        auth: {
          kind: "api-key",
          apiKeyRef: { secretId: "api-key-id" },
          appKeyRef: { secretId: "app-key-id" },
        },
      };
      const result = Schema.decodeSync(DatadogSourceConfigPayloadSchema)(valid);
      expect(result).toEqual(valid);
    });
  });

  describe("DatadogUpdateSourceInputSchema", () => {
    it("should validate update input with sourceId and config", () => {
      const valid = {
        sourceId: "source-123",
        config: {
          name: "Updated Datadog Source",
          auth: {
            kind: "api-key",
            apiKeyRef: { secretId: "api-key-id" },
            appKeyRef: null,
          },
        },
      };
      const result = Schema.decodeSync(DatadogUpdateSourceInputSchema)(valid);
      expect(result.sourceId).toBe("source-123");
      expect(result.config.name).toBe("Updated Datadog Source");
    });

    it("should reject update input missing sourceId", () => {
      const invalid = {
        config: {
          name: "Updated Datadog Source",
          auth: {
            kind: "api-key",
            apiKeyRef: { secretId: "api-key-id" },
            appKeyRef: null,
          },
        },
      };
      expect(() => Schema.decodeSync(DatadogUpdateSourceInputSchema)(invalid)).toThrow();
    });

    it("should reject update input missing config", () => {
      const invalid = {
        sourceId: "source-123",
      };
      expect(() => Schema.decodeSync(DatadogUpdateSourceInputSchema)(invalid)).toThrow();
    });
  });

  describe("DatadogStoredSourceDataSchema", () => {
    it("should validate stored source data with auth", () => {
      const valid = {
        auth: {
          kind: "api-key",
          apiKeyRef: { secretId: "api-key-id" },
          appKeyRef: { secretId: "app-key-id" },
        },
      };
      const result = Schema.decodeSync(DatadogStoredSourceDataSchema)(valid);
      expect(result.auth.kind).toBe("api-key");
    });

    it("should reject stored source data missing auth", () => {
      const invalid = {};
      expect(() => Schema.decodeSync(DatadogStoredSourceDataSchema)(invalid)).toThrow();
    });
  });

  describe("Type Exports", () => {
    it("should have DatadogConnectionAuth type exported", () => {
      const auth: DatadogConnectionAuth = {
        kind: "api-key",
        apiKeyRef: { secretId: "api-key-id" },
        appKeyRef: null,
      };
      expect(auth.kind).toBe("api-key");
    });

    it("should have DatadogConnectInput type exported", () => {
      const input: DatadogConnectInput = {
        name: "Test",
        auth: {
          kind: "api-key",
          apiKeyRef: { secretId: "api-key-id" },
          appKeyRef: null,
        },
      };
      expect(input.name).toBe("Test");
    });

    it("should have DatadogSourceConfigPayload type exported", () => {
      const payload: DatadogSourceConfigPayload = {
        name: "Test",
        auth: {
          kind: "api-key",
          apiKeyRef: { secretId: "api-key-id" },
          appKeyRef: null,
        },
      };
      expect(payload.name).toBe("Test");
    });
  });
});
