import { join } from "node:path";
import { FileSystem } from "@effect/platform";
import { NodeFileSystem } from "@effect/platform-node";
import type { DatadogSourceStorage } from "@executor/plugin-datadog-sdk";
import {
  DatadogStoredSourceDataSchema,
  type DatadogStoredSourceData,
} from "@executor/plugin-datadog-shared";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

export type { DatadogSourceStorage };

const decodeStoredSourceData = Schema.decodeUnknownSync(DatadogStoredSourceDataSchema);
const encodeStoredSourceData = Schema.encodeSync(DatadogStoredSourceDataSchema);

const storagePath = (input: {
  rootDir: string;
  scopeId: string;
  sourceId: string;
}) => join(input.rootDir, input.scopeId, `${input.sourceId}.json`);

const toError = (cause: unknown): Error =>
  cause instanceof Error ? cause : new Error(String(cause));

const bindNodeFileSystem = <A, E>(
  effect: Effect.Effect<A, E, FileSystem.FileSystem>,
): Effect.Effect<A, E, never> =>
  effect.pipe(Effect.provide(NodeFileSystem.layer));

const readStoredSourceData = (
  path: string,
): Effect.Effect<DatadogStoredSourceData | null, Error, never> =>
  bindNodeFileSystem(
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const exists = yield* fileSystem.exists(path).pipe(Effect.mapError(toError));
      if (!exists) {
        return null;
      }
      const contents = yield* fileSystem.readFileString(path, "utf8").pipe(
        Effect.mapError(toError),
      );
      return decodeStoredSourceData(JSON.parse(contents));
    }),
  );

export const createFileDatadogSourceStorage = (input: {
  rootDir: string;
}): DatadogSourceStorage => ({
  get: ({ scopeId, sourceId }) =>
    readStoredSourceData(
      storagePath({ rootDir: input.rootDir, scopeId, sourceId }),
    ),
  put: ({ scopeId, sourceId, value }) =>
    bindNodeFileSystem(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const path = storagePath({ rootDir: input.rootDir, scopeId, sourceId });
        yield* fileSystem.makeDirectory(join(input.rootDir, scopeId), {
          recursive: true,
        }).pipe(Effect.mapError(toError));
        yield* fileSystem.writeFileString(
          path,
          `${JSON.stringify(encodeStoredSourceData(value), null, 2)}\n`,
        ).pipe(Effect.mapError(toError));
      }),
    ),
  remove: ({ scopeId, sourceId }) =>
    bindNodeFileSystem(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const path = storagePath({ rootDir: input.rootDir, scopeId, sourceId });
        const exists = yield* fileSystem.exists(path).pipe(Effect.mapError(toError));
        if (exists) {
          yield* fileSystem.remove(path).pipe(Effect.mapError(toError));
        }
      }),
    ),
});
