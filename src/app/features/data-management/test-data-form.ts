import type { TestDataEntry, TestDataSetDefinition } from '../../generated/hateoas/types.gen';
import type { TestDataDraftEntry } from './data-management.models';

export type TestDataDefinitionResult =
  | {
      definition: TestDataSetDefinition;
      error: null;
    }
  | {
      definition: null;
      error: string;
    };

export function buildTestDataDefinition(
  labelValue: string,
  draftEntries: TestDataDraftEntry[],
): TestDataDefinitionResult {
  const label = labelValue.trim();

  if (!label) {
    return {
      definition: null,
      error: 'Test data profile label is required.',
    };
  }

  const values = draftEntries
    .map((entry) => ({
      key: entry.key.trim(),
      value: entry.value,
    }))
    .filter((entry) => entry.key || entry.value);

  const duplicateKey = values.find(
    (entry, index) => values.findIndex((candidate) => candidate.key === entry.key) !== index,
  )?.key;

  if (values.some((entry) => !entry.key)) {
    return {
      definition: null,
      error: 'Every test data value needs a key.',
    };
  }

  if (duplicateKey) {
    return {
      definition: null,
      error: `The key "${duplicateKey}" is used more than once.`,
    };
  }

  return {
    definition: {
      label,
      values,
    },
    error: null,
  };
}

export function toDraftTestDataEntry(entry: TestDataEntry, draftId: number): TestDataDraftEntry {
  return {
    draftId,
    key: entry.key,
    value: entry.value,
  };
}
