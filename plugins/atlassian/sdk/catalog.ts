import {
  CapabilityIdSchema,
  DocumentIdSchema,
  ExecutableIdSchema,
  ResponseSymbolIdSchema,
  ScopeIdSchema,
} from "@executor/ir/ids";
import type {
  Capability,
  Executable,
  ResponseSymbol,
} from "@executor/ir/model";
import {
  type BaseCatalogOperationInput,
  type CatalogFragmentBuilder,
  type CatalogSourceDocumentInput,
  type JsonSchemaImporter,
  type Source,
  EXECUTABLE_BINDING_VERSION,
  buildCatalogFragment,
  docsFrom,
  interactionForEffect,
  isObjectLikeJsonSchema,
  mutableRecord,
  provenanceFor,
  responseSetFromSingleResponse,
  schemaWithMergedDefs,
  stableHash,
} from "@executor/source-core";

import type { AtlassianExecutableBinding } from "./executable-binding";

export type AtlassianCatalogOperationInput = BaseCatalogOperationInput & {
  binding: AtlassianExecutableBinding;
};

const leafFromToolId = (toolId: string): string =>
  toolId.split(".").filter((s) => s.length > 0).at(-1) ?? toolId;

const toolPathFromId = (toolId: string): string[] =>
  toolId.split(".").filter((s) => s.length > 0);

const createAtlassianCapability = (input: {
  catalog: CatalogFragmentBuilder;
  source: Pick<Source, "id">;
  documentId: ReturnType<typeof DocumentIdSchema.make>;
  serviceScopeId: ReturnType<typeof ScopeIdSchema.make>;
  operation: AtlassianCatalogOperationInput;
  importer: JsonSchemaImporter;
}) => {
  const toolPath = toolPathFromId(input.operation.toolId);
  const pathText = toolPath.join(".");

  const capabilityId = CapabilityIdSchema.make(
    `cap_${stableHash({
      sourceId: input.source.id,
      toolPath: pathText,
    })}`,
  );
  const executableId = ExecutableIdSchema.make(
    `exec_${stableHash({
      sourceId: input.source.id,
      toolPath: pathText,
      protocol: "atlassian",
    })}`,
  );

  const callShapeId =
    input.operation.inputSchema === undefined
      ? input.importer.importSchema(
        { type: "object", properties: {}, additionalProperties: false },
        `#/atlassian/${pathText}/call`,
      )
      : isObjectLikeJsonSchema(input.operation.inputSchema)
        ? input.importer.importSchema(
          input.operation.inputSchema,
          `#/atlassian/${pathText}/call`,
          input.operation.inputSchema,
        )
        : input.importer.importSchema(
          schemaWithMergedDefs(
            {
              type: "object",
              properties: { input: input.operation.inputSchema },
              required: ["input"],
              additionalProperties: false,
            },
            input.operation.inputSchema,
          ),
          `#/atlassian/${pathText}/call`,
        );

  const outputShapeId =
    input.operation.outputSchema !== undefined
      ? input.importer.importSchema(
        input.operation.outputSchema,
        `#/atlassian/${pathText}/output`,
      )
      : undefined;

  const responseId = ResponseSymbolIdSchema.make(
    `response_${stableHash({ capabilityId })}`,
  );

  mutableRecord(input.catalog.symbols)[responseId] = {
    id: responseId,
    kind: "response",
    ...(docsFrom({ description: input.operation.description })
      ? { docs: docsFrom({ description: input.operation.description })! }
      : {}),
    ...(outputShapeId
      ? { contents: [{ mediaType: "application/json", shapeId: outputShapeId }] }
      : {}),
    synthetic: false,
    provenance: provenanceFor(
      input.documentId,
      `#/atlassian/${pathText}/response`,
    ),
  } satisfies ResponseSymbol;

  const responseSetId = responseSetFromSingleResponse({
    catalog: input.catalog,
    responseId,
    provenance: provenanceFor(
      input.documentId,
      `#/atlassian/${pathText}/responseSet`,
    ),
  });

  mutableRecord(input.catalog.executables)[executableId] = {
    id: executableId,
    capabilityId,
    scopeId: input.serviceScopeId,
    pluginKey: "atlassian",
    bindingVersion: EXECUTABLE_BINDING_VERSION,
    binding: input.operation.binding,
    projection: {
      responseSetId,
      callShapeId,
      ...(outputShapeId ? { resultDataShapeId: outputShapeId } : {}),
    },
    display: {
      protocol: "atlassian",
      method: "GET",
      pathTemplate: null,
      operationId: pathText,
      group: toolPath.length > 1 ? toolPath.slice(0, -1).join(".") : null,
      leaf: leafFromToolId(pathText),
      rawToolId: pathText,
      title: input.operation.title ?? pathText,
      summary: input.operation.description ?? null,
    },
    synthetic: false,
    provenance: provenanceFor(
      input.documentId,
      `#/atlassian/${pathText}/executable`,
    ),
  } satisfies Executable;

  mutableRecord(input.catalog.capabilities)[capabilityId] = {
    id: capabilityId,
    serviceScopeId: input.serviceScopeId,
    surface: {
      toolPath,
      title: input.operation.title ?? pathText,
      ...(input.operation.description
        ? { summary: input.operation.description }
        : {}),
    },
    semantics: {
      effect: "read",
      safe: true,
      idempotent: true,
      destructive: false,
    },
    auth: { kind: "none" },
    interaction: interactionForEffect("read"),
    executableIds: [executableId],
    synthetic: false,
    provenance: provenanceFor(
      input.documentId,
      `#/atlassian/${pathText}/capability`,
    ),
  } satisfies Capability;
};

export const createAtlassianCatalogFragment = (input: {
  source: Source;
  documents: readonly CatalogSourceDocumentInput[];
  operations: readonly AtlassianCatalogOperationInput[];
}) =>
  buildCatalogFragment({
    source: input.source,
    documents: input.documents,
    registerOperations: ({ catalog, documentId, serviceScopeId, importer }) => {
      for (const operation of input.operations) {
        createAtlassianCapability({
          catalog,
          source: input.source,
          documentId,
          serviceScopeId,
          operation,
          importer,
        });
      }
    },
  });

