import type {AnonymousSchema_3} from './AnonymousSchema_3';
import type {ReservedLink} from './ReservedLink';
export interface TestExecutionStartedEvent {
  executionId?: string;
  reservedStatus?: AnonymousSchema_3;
  message?: string;
  links?: Map<string, ReservedLink>;
  additionalProperties?: Map<string, any>;
}
