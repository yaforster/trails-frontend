import type {AnonymousSchema_13} from './AnonymousSchema_13';
import type {Error} from './Error';
import type {ReservedLink} from './ReservedLink';
export interface TestExecutionFailedEvent {
  executionId?: string;
  reservedStatus?: AnonymousSchema_13;
  message?: string;
  error?: Error;
  links?: Map<string, ReservedLink>;
  additionalProperties?: Map<string, any>;
}
