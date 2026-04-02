import * as Schema from "effect/Schema";

const ApproveInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    action: Schema.String,
  }),
);

const ApproveOutputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    tool: Schema.String,
    status: Schema.String,
    action: Schema.String,
    approvedAt: Schema.String,
  }),
);

export default {
  tool: {
    description: "Demo tool intended to be blocked by executor approval policy before execution",
    inputSchema: ApproveInputSchema,
    outputSchema: ApproveOutputSchema,
    execute: ({ action }: { action: string }) => ({
      tool: "demo.approve",
      status: "approved-and-ran",
      action,
      approvedAt: new Date().toISOString(),
    }),
  },
  metadata: {
    interaction: "auto" as const,
  },
};
