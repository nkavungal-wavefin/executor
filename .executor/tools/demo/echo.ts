import * as Schema from "effect/Schema";

const EchoInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    message: Schema.String,
  }),
);

const EchoOutputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    tool: Schema.String,
    echoed: Schema.String,
    at: Schema.String,
  }),
);

export default {
  tool: {
    description: "Demo tool that runs immediately without approval or pause",
    inputSchema: EchoInputSchema,
    outputSchema: EchoOutputSchema,
    execute: ({ message }: { message: string }) => ({
      tool: "demo.echo",
      echoed: message,
      at: new Date().toISOString(),
    }),
  },
  metadata: {
    interaction: "auto" as const,
  },
};
