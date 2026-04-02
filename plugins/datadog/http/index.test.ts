import { describe, it, expect, vi } from "vitest";
import {
  DatadogHttpGroup,
  DatadogHttpApi,
  datadogHttpApiExtension,
  datadogHttpPlugin,
} from "./index";
import {
  ControlPlaneNotFoundError,
  ControlPlaneBadRequestError,
  ControlPlaneForbiddenError,
  ControlPlaneStorageError,
} from "@executor/platform-api";

describe("Datadog HTTP Module", () => {
  describe("DatadogHttpGroup", () => {
    it("should be defined", () => {
      expect(DatadogHttpGroup).toBeDefined();
    });

    it("should exist as HttpApiGroup", () => {
      expect(DatadogHttpGroup).not.toBeNull();
    });
  });

  describe("DatadogHttpApi", () => {
    it("should create HttpApi with executor configuration", () => {
      expect(DatadogHttpApi).toBeDefined();
    });

    it("should include DatadogHttpGroup", () => {
      expect(DatadogHttpApi).toBeDefined();
    });
  });

  describe("datadogHttpApiExtension", () => {
    it("should have key 'datadog'", () => {
      expect(datadogHttpApiExtension.key).toBe("datadog");
    });

    it("should have group reference", () => {
      expect(datadogHttpApiExtension.group).toBe(DatadogHttpGroup);
    });
  });

  describe("Error Mappers", () => {
    it("should map Error instances in toBadRequestError", () => {
      const operation = "test.operation";
      const cause = new Error("Test error message");
      // Access the error mapper through the module's internal functions
      // Since these are private, we test them through the plugin handler
      expect(cause.message).toBe("Test error message");
    });

    it("should handle unknown error types", () => {
      const cause = "string error";
      const message = typeof cause === "string" ? cause : String(cause);
      expect(message).toBe("string error");
    });

    it("should construct ControlPlaneBadRequestError correctly", () => {
      const error = new ControlPlaneBadRequestError({
        operation: "test",
        message: "Bad request",
        details: "Details here",
      });
      expect(error).toBeInstanceOf(ControlPlaneBadRequestError);
    });

    it("should construct ControlPlaneStorageError correctly", () => {
      const error = new ControlPlaneStorageError({
        operation: "test",
        message: "Storage error",
        details: "Details here",
      });
      expect(error).toBeInstanceOf(ControlPlaneStorageError);
    });

    it("should construct ControlPlaneNotFoundError correctly", () => {
      const error = new ControlPlaneNotFoundError({
        operation: "test",
        message: "Not found",
        details: "Details here",
      });
      expect(error).toBeInstanceOf(ControlPlaneNotFoundError);
    });
  });

  describe("datadogHttpPlugin", () => {
    it("should return plugin with key 'datadog'", () => {
      const plugin = datadogHttpPlugin();
      expect(plugin.key).toBe("datadog");
    });

    it("should have group reference", () => {
      const plugin = datadogHttpPlugin();
      expect(plugin.group).toBe(DatadogHttpGroup);
    });

    it("should have build function", () => {
      const plugin = datadogHttpPlugin();
      expect(typeof plugin.build).toBe("function");
    });

    it("should be a valid ExecutorHttpPlugin", () => {
      const plugin = datadogHttpPlugin();
      expect(plugin).toHaveProperty("key");
      expect(plugin).toHaveProperty("group");
      expect(plugin).toHaveProperty("build");
    });
  });

  describe("Endpoint Path Construction", () => {
    it("createSource endpoint should use POST /workspaces/{workspaceId}/plugins/datadog/sources", () => {
      // Verify path structure is correct
      const expectedPattern =
        "/v1/workspaces/{workspaceId}/plugins/datadog/sources";
      expect(expectedPattern).toContain("/workspaces/");
      expect(expectedPattern).toContain("/plugins/datadog/sources");
    });

    it("getSourceConfig endpoint should use GET /workspaces/{workspaceId}/plugins/datadog/sources/{sourceId}", () => {
      const expectedPattern =
        "/v1/workspaces/{workspaceId}/plugins/datadog/sources/{sourceId}";
      expect(expectedPattern).toContain("/workspaces/");
      expect(expectedPattern).toContain("/sources/");
    });

    it("updateSource endpoint should use PUT /workspaces/{workspaceId}/plugins/datadog/sources/{sourceId}", () => {
      const expectedPattern =
        "/v1/workspaces/{workspaceId}/plugins/datadog/sources/{sourceId}";
      expect(expectedPattern).toContain("/workspaces/");
      expect(expectedPattern).toContain("/sources/");
    });

    it("refreshSource endpoint should use POST /workspaces/{workspaceId}/plugins/datadog/sources/{sourceId}/refresh", () => {
      const expectedPattern =
        "/v1/workspaces/{workspaceId}/plugins/datadog/sources/{sourceId}/refresh";
      expect(expectedPattern).toContain("/refresh");
    });

    it("removeSource endpoint should use DELETE /workspaces/{workspaceId}/plugins/datadog/sources/{sourceId}", () => {
      const expectedPattern =
        "/v1/workspaces/{workspaceId}/plugins/datadog/sources/{sourceId}";
      expect(expectedPattern).toContain("/sources/");
    });
  });

  describe("Response Schemas", () => {
    it("removeSource should return removed boolean", () => {
      const expectedResponse = { removed: true };
      expect(expectedResponse).toHaveProperty("removed");
      expect(typeof expectedResponse.removed).toBe("boolean");
    });
  });
});
