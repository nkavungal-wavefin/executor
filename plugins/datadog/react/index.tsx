import React from "react";
import {
  defineExecutorFrontendPlugin,
  liveFrontendPluginComponent,
} from "@executor/react/plugins";
import { DatadogConnectInputSchema } from "@executor/plugin-datadog-shared";

/**
 * Datadog Source Configuration Component
 * Provides UI for entering API Key and Application Key credentials
 */
const DatadogSourceConfig: React.FC<{
  onConfigChange?: (config: unknown) => void;
}> = ({ onConfigChange }) => {
  const [name, setName] = React.useState("");
  const [apiKey, setApiKey] = React.useState("");
  const [appKey, setAppKey] = React.useState("");

  const handleConfigUpdate = React.useCallback(() => {
    const config = {
      name,
      auth: {
        kind: "api-key",
        apiKeyRef: {
          scope: "workspace",
          key: "datadog_api_key",
        },
        appKeyRef: appKey
          ? {
              scope: "workspace",
              key: "datadog_app_key",
            }
          : null,
      },
    };
    onConfigChange?.(config);
  }, [name, apiKey, appKey, onConfigChange]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <h3>Datadog Configuration</h3>

      <div>
        <label htmlFor="name">Source Name</label>
        <input
          id="name"
          type="text"
          placeholder="My Datadog Source"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ width: "100%", marginTop: "4px" }}
        />
      </div>

      <div>
        <label htmlFor="apiKey">API Key</label>
        <input
          id="apiKey"
          type="password"
          placeholder="Enter your Datadog API Key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          style={{ width: "100%", marginTop: "4px" }}
        />
        <small>Required for all operations</small>
      </div>

      <div>
        <label htmlFor="appKey">Application Key</label>
        <input
          id="appKey"
          type="password"
          placeholder="Enter your Datadog Application Key (optional)"
          value={appKey}
          onChange={(e) => setAppKey(e.target.value)}
          style={{ width: "100%", marginTop: "4px" }}
        />
        <small>Optional - enhances permissions</small>
      </div>

      <button
        onClick={handleConfigUpdate}
        style={{
          padding: "8px 16px",
          backgroundColor: "#0066cc",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
        }}
      >
        Update Configuration
      </button>
    </div>
  );
};

// Add/Edit/Detail page components - simplified for now
const DatadogAddSourcePage = DatadogSourceConfig;
const DatadogEditRoute = DatadogSourceConfig;

const DatadogDetailRoute: React.FC<{ sourceId: string }> = ({ sourceId }) => (
  <div>
    <h2>Datadog Source Details</h2>
    <p>Source ID: {sourceId}</p>
    <DatadogSourceConfig />
  </div>
);

export const DatadogReactPlugin = defineExecutorFrontendPlugin({
  key: "datadog",
  displayName: "Datadog",
  routes: [
    {
      key: "add",
      path: "add",
      component: liveFrontendPluginComponent(() => DatadogAddSourcePage),
    },
    {
      key: "detail",
      path: "sources/$sourceId",
      component: liveFrontendPluginComponent(() => DatadogDetailRoute),
    },
    {
      key: "edit",
      path: "sources/$sourceId/edit",
      component: liveFrontendPluginComponent(() => DatadogEditRoute),
    },
  ],
});

export { DatadogSourceConfig };
export default DatadogSourceConfig;
