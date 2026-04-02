import type { Source } from "@executor/react";
import {
  Result,
  SecretReferenceField,
  defineExecutorPluginHttpApiClient,
  useAtomSet,
  useAtomValue,
  useExecutorMutation,
  useSource,
  useWorkspaceRequestContext,
} from "@executor/react";
import {
  Button,
  Input,
  Label,
  SourceToolExplorer,
  parseSourceToolExplorerSearch,
  type SourceToolExplorerSearch,
  useSourcePluginNavigation,
  useSourcePluginRouteParams,
  useSourcePluginSearch,
} from "@executor/react/plugins";
import { atlassianHttpApiExtension } from "@executor/plugin-atlassian-http";
import type {
  AtlassianConnectInput,
  AtlassianSourceConfigPayload,
} from "@executor/plugin-atlassian-shared";
import { startTransition, useState, type ReactNode } from "react";

type RouteToolSearch = SourceToolExplorerSearch;

// ---------------------------------------------------------------------------
// HTTP client
// ---------------------------------------------------------------------------

const getAtlassianHttpClient = defineExecutorPluginHttpApiClient<"AtlassianReactHttpClient">()(
  "AtlassianReactHttpClient",
  [atlassianHttpApiExtension] as const,
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const Section = (props: { title: string; children: ReactNode }) => (
  <section>
    <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {props.title}
    </h2>
    {props.children}
  </section>
);

const defaultAtlassianInput = (): AtlassianConnectInput => ({
  name: "Wave Atlassian",
  cloudBaseUrl: "waveaccounting.atlassian.net",
  auth: {
    kind: "basic",
    email: "",
    apiTokenRef: { secretId: "" as never },
  },
  allowedProjects: null,
  allowedSpaces: null,
  enableJira: true,
  enableConfluence: true,
});

const parseAllowedList = (value: string): string[] | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
};

const formatAllowedList = (value: readonly string[] | null): string =>
  value ? value.join(", ") : "";

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

function AtlassianSourceForm(props: {
  mode: "create" | "edit";
  workspaceId: Source["scopeId"];
  initialValue: AtlassianConnectInput;
  submitLabel: string;
  busyLabel: string;
  onSubmit: (input: AtlassianConnectInput) => Promise<void>;
}) {
  const [name, setName] = useState(props.initialValue.name);
  const [cloudBaseUrl, setCloudBaseUrl] = useState(props.initialValue.cloudBaseUrl);
  const [email, setEmail] = useState(props.initialValue.auth.email);
  const [apiTokenRef, setApiTokenRef] = useState(
    JSON.stringify(props.initialValue.auth.apiTokenRef),
  );
  const [allowedProjects, setAllowedProjects] = useState(
    formatAllowedList(props.initialValue.allowedProjects),
  );
  const [allowedSpaces, setAllowedSpaces] = useState(
    formatAllowedList(props.initialValue.allowedSpaces),
  );
  const [enableJira, setEnableJira] = useState(props.initialValue.enableJira ?? true);
  const [enableConfluence, setEnableConfluence] = useState(props.initialValue.enableConfluence ?? true);
  const [error, setError] = useState<string | null>(null);

  const submitMutation = useExecutorMutation<AtlassianConnectInput, void>(props.onSubmit);

  const handleSubmit = async () => {
    setError(null);
    const trimmedName = name.trim();
    const trimmedCloudBaseUrl = cloudBaseUrl.trim().replace(/^https?:\/\//, "");
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      setError("Name is required.");
      return;
    }
    if (!trimmedCloudBaseUrl) {
      setError("Cloud base URL is required.");
      return;
    }
    if (!trimmedEmail) {
      setError("Email is required.");
      return;
    }
    if (!apiTokenRef.trim()) {
      setError("API token secret is required.");
      return;
    }

    let parsedRef: { secretId: string };
    try {
      parsedRef = JSON.parse(apiTokenRef) as { secretId: string };
    } catch {
      setError("Invalid API token reference.");
      return;
    }

    try {
      await submitMutation.mutateAsync({
        name: trimmedName,
        cloudBaseUrl: trimmedCloudBaseUrl,
        auth: {
          kind: "basic",
          email: trimmedEmail,
          apiTokenRef: parsedRef as never,
        },
        allowedProjects: parseAllowedList(allowedProjects),
        allowedSpaces: parseAllowedList(allowedSpaces),
        enableJira,
        enableConfluence,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed saving source.");
    }
  };

  return (
    <div className="space-y-6 rounded-lg border border-border bg-card p-6 text-sm ring-1 ring-foreground/[0.04]">
      <Section title="Connection">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Atlassian"
            />
          </div>
          <div className="grid gap-2">
            <Label>Cloud Base URL</Label>
            <Input
              value={cloudBaseUrl}
              onChange={(e) => setCloudBaseUrl(e.target.value)}
              placeholder="yourcompany.atlassian.net"
            />
          </div>
        </div>
      </Section>

      <Section title="Authentication">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@yourcompany.com"
            />
          </div>
          <div className="grid gap-2">
            <Label>API Token</Label>
            <SecretReferenceField
              label="API Token"
              value={apiTokenRef}
              onChange={setApiTokenRef}
              emptyLabel="Select a secret"
              draftNamePlaceholder="atlassian-api-token"
              draftValuePlaceholder="Paste API token..."
            />
            <p className="text-xs text-muted-foreground">
              Generate at{" "}
              <a
                href="https://id.atlassian.com/manage-profile/security/api-tokens"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                id.atlassian.com
              </a>
            </p>
          </div>
        </div>
      </Section>

      <Section title="Scope">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Allowed Jira Projects</Label>
            <Input
              value={allowedProjects}
              onChange={(e) => setAllowedProjects(e.target.value)}
              placeholder="PROJ, ENG (leave blank for all)"
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated project keys. Leave blank to include all visible projects.
            </p>
          </div>
          <div className="grid gap-2">
            <Label>Allowed Confluence Spaces</Label>
            <Input
              value={allowedSpaces}
              onChange={(e) => setAllowedSpaces(e.target.value)}
              placeholder="ENG, DOCS (leave blank for all)"
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated space keys. Leave blank to include all visible spaces.
            </p>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enableJira}
                onChange={(e) => setEnableJira(e.target.checked)}
                className="h-4 w-4"
              />
              <span>Enable Jira</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enableConfluence}
                onChange={(e) => setEnableConfluence(e.target.checked)}
                className="h-4 w-4"
              />
              <span>Enable Confluence</span>
            </label>
          </div>
        </div>
      </Section>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-destructive">{error}</p>
      )}

      <div className="flex justify-end">
        <Button
          onClick={() => { void handleSubmit(); }}
          disabled={submitMutation.status === "pending"}
        >
          {submitMutation.status === "pending" ? props.busyLabel : props.submitLabel}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add page
// ---------------------------------------------------------------------------

export function AtlassianAddSourcePage() {
  const navigation = useSourcePluginNavigation();
  const atlassianHttpClient = getAtlassianHttpClient();
  const workspace = useWorkspaceRequestContext();
  const createSource = useAtomSet(
    atlassianHttpClient.mutation("atlassian", "createSource"),
    { mode: "promise" },
  );

  if (!workspace.enabled) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-6 py-10">
          <div className="text-sm text-muted-foreground">Loading workspace...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <div className="mb-8">
          <h1 className="font-display text-2xl tracking-tight text-foreground">
            Add Atlassian Source
          </h1>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
            Connect Jira and Confluence with read-only tools filtered to specific projects and spaces.
          </p>
        </div>

        <AtlassianSourceForm
          mode="create"
          workspaceId={workspace.workspaceId}
          initialValue={defaultAtlassianInput()}
          submitLabel="Create Source"
          busyLabel="Creating..."
          onSubmit={async (payload) => {
            const source = await createSource({
              path: { workspaceId: workspace.workspaceId },
              payload,
              reactivityKeys: {
                sources: [workspace.workspaceId],
              },
            });

            startTransition(() => {
              void navigation.detail(source.id, { tab: "model" });
            });
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit page
// ---------------------------------------------------------------------------

function AtlassianEditSourcePageReady(props: {
  source: Source;
  workspaceId: Source["scopeId"];
}) {
  const navigation = useSourcePluginNavigation();
  const atlassianHttpClient = getAtlassianHttpClient();
  const configResult = useAtomValue(
    atlassianHttpClient.query("atlassian", "getSourceConfig", {
      path: { workspaceId: props.workspaceId, sourceId: props.source.id },
      reactivityKeys: { source: [props.workspaceId, props.source.id] },
      timeToLive: "30 seconds",
    }),
  );
  const updateSource = useAtomSet(
    atlassianHttpClient.mutation("atlassian", "updateSource"),
    { mode: "promise" },
  );

  if (!Result.isSuccess(configResult)) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-6 py-10">
          <div className="text-sm text-muted-foreground">
            {Result.isFailure(configResult) ? "Failed to load source config." : "Loading..."}
          </div>
        </div>
      </div>
    );
  }

  const config = configResult.value as AtlassianSourceConfigPayload;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <div className="mb-8">
          <h1 className="font-display text-2xl tracking-tight text-foreground">
            Edit Atlassian Source
          </h1>
        </div>

        <AtlassianSourceForm
          mode="edit"
          workspaceId={props.workspaceId}
          initialValue={config}
          submitLabel="Save Changes"
          busyLabel="Saving..."
          onSubmit={async (payload) => {
            await updateSource({
              path: { workspaceId: props.workspaceId, sourceId: props.source.id },
              payload,
              reactivityKeys: {
                sources: [props.workspaceId],
                source: [props.workspaceId, props.source.id],
              },
            });

            startTransition(() => {
              void navigation.detail(props.source.id, { tab: "model" });
            });
          }}
        />
      </div>
    </div>
  );
}

export function AtlassianEditSourcePage(props: { source: Source }) {
  const workspace = useWorkspaceRequestContext();

  if (!workspace.enabled) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-6 py-10">
          <div className="text-sm text-muted-foreground">Loading workspace...</div>
        </div>
      </div>
    );
  }

  return (
    <AtlassianEditSourcePageReady
      source={props.source}
      workspaceId={workspace.workspaceId}
    />
  );
}

// ---------------------------------------------------------------------------
// Source route wrapper (handles Loadable)
// ---------------------------------------------------------------------------

function AtlassianSourceRoute(props: { children: (source: Source) => ReactNode }) {
  const params = useSourcePluginRouteParams<{ sourceId?: string }>();
  const sourceId = typeof params.sourceId === "string" ? params.sourceId : null;
  const source = useSource(sourceId ?? "");

  if (sourceId === null || source.status === "error") {
    return (
      <div className="px-6 py-8 text-sm text-destructive">
        This Atlassian source is unavailable.
      </div>
    );
  }

  if (source.status === "loading") {
    return (
      <div className="px-6 py-8 text-sm text-muted-foreground">
        Loading source...
      </div>
    );
  }

  if (source.data.kind !== "atlassian") {
    return (
      <div className="px-6 py-8 text-sm text-destructive">
        Expected an `atlassian` source, but received `{source.data.kind}`.
      </div>
    );
  }

  return props.children(source.data);
}

// ---------------------------------------------------------------------------
// Detail page (tool explorer)
// ---------------------------------------------------------------------------

function AtlassianDetailPage(props: { source: Source }) {
  const navigation = useSourcePluginNavigation();
  const search = parseSourceToolExplorerSearch(
    useSourcePluginSearch(),
  ) satisfies RouteToolSearch;
  const tab = search.tab === "discover" ? "discover" : "model";
  const query = search.query ?? "";

  return (
    <SourceToolExplorer
      sourceId={props.source.id}
      title={props.source.name}
      kind={props.source.kind}
      search={search}
      navigate={(next) =>
        navigation.updateSearch({
          tab: next.tab ?? tab,
          ...(next.tool !== undefined
            ? { tool: next.tool || undefined }
            : { tool: search.tool }),
          ...(next.query !== undefined
            ? { query: next.query || undefined }
            : { query }),
        })}
      actions={(
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={() => void navigation.edit(props.source.id)}
        >
          Edit
        </Button>
      )}
    />
  );
}

export function AtlassianDetailRoute() {
  return (
    <AtlassianSourceRoute>
      {(source) => <AtlassianDetailPage source={source} />}
    </AtlassianSourceRoute>
  );
}

export function AtlassianEditRoute() {
  return (
    <AtlassianSourceRoute>
      {(source) => <AtlassianEditSourcePage source={source} />}
    </AtlassianSourceRoute>
  );
}
