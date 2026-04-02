import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

const ConfirmInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    action: Schema.String,
  }),
);

const ConfirmOutputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    tool: Schema.String,
    status: Schema.String,
    action: Schema.String,
    reason: Schema.NullOr(Schema.String),
    resumedAt: Schema.String,
  }),
);

export default {
  tool: {
    description: "Demo tool that starts running, pauses for confirmation, then resumes with the response",
    inputSchema: ConfirmInputSchema,
    outputSchema: ConfirmOutputSchema,
    execute: async (
      { action }: { action: string },
      context?: {
        path?: string;
        sourceKey?: string;
        metadata?: unknown;
        invocation?: Record<string, unknown>;
        onElicitation?: (input: unknown) => unknown;
      },
    ) => {
      if (!context?.onElicitation) {
        throw new Error("demo.confirm requires an elicitation-capable host");
      }

      const response = await Effect.runPromise(
        context.onElicitation({
          interactionId:
            typeof context.invocation?.callId === "string" && context.invocation.callId.length > 0
              ? `demo.confirm:${context.invocation.callId}`
              : `demo.confirm:${crypto.randomUUID()}`,
          path: context.path ?? "demo.confirm",
          sourceKey: context.sourceKey ?? "local.tool.demo.confirm",
          args: { action },
          metadata: context.metadata,
          context: context.invocation,
          elicitation: {
            mode: "form",
            message: `demo.confirm paused while processing \"${action}\". Confirm to continue and optionally provide a reason.`,
            requestedSchema: {
              type: "object",
              properties: {
                proceed: {
                  type: "boolean",
                  title: "Proceed",
                  default: true,
                },
                reason: {
                  type: "string",
                  title: "Reason",
                },
              },
              required: ["proceed"],
              additionalProperties: false,
            },
          },
        }),
      );

      const reason =
        response.content && typeof response.content.reason === "string"
          ? response.content.reason
          : null;

      if (response.action !== "accept" || response.content?.proceed !== true) {
        return {
          tool: "demo.confirm",
          status: "declined-during-execution",
          action,
          reason,
          resumedAt: new Date().toISOString(),
        };
      }

      return {
        tool: "demo.confirm",
        status: "confirmed-and-resumed",
        action,
        reason,
        resumedAt: new Date().toISOString(),
      };
    },
  },
  metadata: {
    interaction: "auto" as const,
  },
};
