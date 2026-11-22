const INDENT = 2;

export const serializeOpenApiDocument = (document: object): string => `${JSON.stringify(document, null, INDENT)}\n`;
