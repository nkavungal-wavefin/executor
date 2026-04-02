import { spawnSync } from "node:child_process";
import * as Schema from "effect/Schema";

const OKTETO_CONTAINER = "payroll-devcontainer-only";
const OKTETO_NAMESPACE = "slee";
const OKTETO_CWD = "/Users/slee/wave/src/payroll";

const inputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    task: Schema.String.annotations({
      description:
        "The rake task name to run (e.g. 'spec' or 'payroll:bank_account:disconnect'). Use '--tasks' to list all available tasks.",
    }),
    args: Schema.optional(Schema.String).annotations({
      description: "Optional space-separated extra arguments to pass after the task name (e.g. 'BUSINESS_ID=abc123')",
    }),
  }),
);

export const tool = {
  tool: {
    description:
      "Run a rake task inside the payroll container via okteto exec. " +
      "To list all available tasks, use task '--tasks'. " +
      "Pass arguments via the args field (e.g. args: 'BUSINESS_ID=abc123'). " +
      "Requires human approval before executing.",
    inputSchema,
    execute: async ({ task, args }: { task: string; args?: string }) => {
      const extraArgs = args ? args.split(/\s+/).filter(Boolean) : [];
      const result = spawnSync(
        "okteto",
        [
          "exec",
          OKTETO_CONTAINER,
          "--",
          "bundle",
          "exec",
          "rake",
          task,
          ...extraArgs,
        ],
        { encoding: "utf8", timeout: 120_000, cwd: OKTETO_CWD },
      );

      if (result.error) {
        throw new Error(`Failed to spawn okteto: ${result.error.message}`);
      }

      const stdout = (result.stdout ?? "").trim();
      const stderr = (result.stderr ?? "").trim();

      if (result.status !== 0) {
        throw new Error(
          `Rake task failed (exit ${result.status})\nstdout: ${stdout}\nstderr: ${stderr}`,
        );
      }

      return {
        exitCode: result.status,
        stdout,
        stderr,
      };
    },
  },
  metadata: {
    interaction: "auto" as const,
  },
};
