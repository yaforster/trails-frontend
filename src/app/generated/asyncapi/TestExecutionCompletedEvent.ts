import type {AnonymousSchema_8} from './AnonymousSchema_8';
import type {ReservedLink} from './ReservedLink';
export interface TestExecutionCompletedEvent {
  executionId?: string;
  reservedStatus?: AnonymousSchema_8;
  message?: string;
  testRunId?: number;
  links?: Map<string, ReservedLink>;
  additionalProperties?: Map<string, any>;
}
