import {
  validateTestPlanActionGraph,
  type TestPlanActionGraphNode,
} from './test-plan-action-graph-validator';

describe('validateTestPlanActionGraph', () => {
  it('accepts an acyclic graph with one starting action', () => {
    const validation = validateTestPlanActionGraph([
      action(1, [2, 3]),
      action(2, [4]),
      action(3, [4]),
      action(4),
    ]);

    expect(validation).toEqual({ isValid: true, message: null });
  });

  it('rejects duplicate reference IDs', () => {
    const validation = validateTestPlanActionGraph([action(1), action(1)]);

    expect(validation).toEqual({
      isValid: false,
      message: 'Every action reference ID must be unique.',
    });
  });

  it('rejects references to missing actions', () => {
    const validation = validateTestPlanActionGraph([action(1, [2])]);

    expect(validation).toEqual({
      isValid: false,
      message: 'Action 1 references a missing next action.',
    });
  });

  it('rejects cyclic action graphs', () => {
    const validation = validateTestPlanActionGraph([action(1, [2]), action(2, [1])]);

    expect(validation).toEqual({
      isValid: false,
      message: 'The test-plan action graph must not contain cycles.',
    });
  });

  it('rejects action graphs with multiple starting actions', () => {
    const validation = validateTestPlanActionGraph([action(1), action(2)]);

    expect(validation).toEqual({
      isValid: false,
      message: 'The test-plan action graph must have exactly one starting action, but found 2.',
    });
  });
});

function action(referenceID: number, nextActions: number[] = []): TestPlanActionGraphNode {
  return { referenceID, nextActions };
}
