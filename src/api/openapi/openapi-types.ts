export type JsonSchema = { [key: string]: unknown };

export type OpenApiParameter = {
  name: string;
  in: 'header' | 'path';
  required: boolean;
  description: string;
  schema: JsonSchema;
};

export type OpenApiResponse = {
  description: string;
  headers?: Record<string, { description: string; schema: JsonSchema }>;
  content?: Record<string, { schema: JsonSchema }>;
};

export type OpenApiOperation = {
  operationId: string;
  tags: string[];
  summary: string;
  description: string;
  parameters?: OpenApiParameter[];
  requestBody?: { required: boolean; content: Record<string, { schema: JsonSchema }> };
  responses: Record<string, OpenApiResponse>;
};

export type OpenApiPaths = Record<string, Partial<Record<'get' | 'post', OpenApiOperation>>>;
