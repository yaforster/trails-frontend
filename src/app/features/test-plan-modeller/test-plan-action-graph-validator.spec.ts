import {
  validateTestPlanActionGraph,
  type TestPlanActionGraphNode,
} from './test-plan-action-graph-validator';

describe('validateTestPlanActionGraph', () => {
  const diamond = [action(1, [2, 3]), action(2, [4]), action(3, [4]), action(4)];

  it('accepts inclusive graph limits and counts shared actions once per path', () => {
    expect(
      validateTestPlanActionGraph(diamond, {
        maximumActions: 4,
        maximumPaths: 2,
        maximumActionOccurrences: 6,
      }).isValid,
    ).toBe(true);
  });

  it.each([
    [{ maximumActions: 3, maximumPaths: 2, maximumActionOccurrences: 6 }, '3 actions'],
    [{ maximumActions: 4, maximumPaths: 1, maximumActionOccurrences: 6 }, '1 execution paths'],
    [
      { maximumActions: 4, maximumPaths: 2, maximumActionOccurrences: 5 },
      '5 total action occurrences',
    ],
  ])('rejects graphs beyond a server limit', (limits, message) => {
    expect(validateTestPlanActionGraph(diamond, limits).message).toContain(message);
  });

  it('rejects repeated edges', () => {
    expect(validateTestPlanActionGraph([action(1, [2, 2]), action(2)]).message).toContain(
      'duplicate next actions',
    );
  });

  it('validates deep chains without recursive stack growth', () => {
    const chain = Array.from({ length: 10_000 }, (_, index) =>
      action(index, index < 9_999 ? [index + 1] : []),
    );
    expect(
      validateTestPlanActionGraph(chain, {
        maximumActions: 10_000,
        maximumPaths: 1,
        maximumActionOccurrences: 10_000,
      }).isValid,
    ).toBe(true);
  });
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
