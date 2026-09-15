
export interface Error {
  message?: string;
  stacktrace?: string;
  problematicElement?: string;
  additionalProperties?: Map<string, any>;
}
