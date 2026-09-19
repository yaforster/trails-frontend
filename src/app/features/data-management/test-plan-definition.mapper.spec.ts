import type { Action } from '../../generated/hateoas/types.gen';
import { toTestPlanDefinition } from './test-plan-definition.mapper';

describe('toTestPlanDefinition', () => {
  it('retains coordinate clicks and maps predecessors to their reference IDs', () => {
    const definition = toTestPlanDefinition({ label: 'Coordinate click plan' }, [
      {
        actionID: 179,
        referenceID: 3,
        label: 'Open coordinate click',
        nextActions: [201],
        details: { detailsType: 'CLICK', elementID: 31 },
      },
      {
        actionID: 201,
        referenceID: 25,
        label: 'Coordinate click',
        details: { detailsType: 'COORDINATE_CLICK', xCoordinate: 0, yCoordinate: 0 },
      },
    ] satisfies Action[]);

    expect(definition.testSteps).toEqual([
      expect.objectContaining({ referenceID: 3, nextActions: [25] }),
      expect.objectContaining({
        referenceID: 25,
        details: expect.objectContaining({
          detailsType: 'COORDINATE_CLICK',
          xCoordinate: 0,
          yCoordinate: 0,
        }),
      }),
    ]);
  });
});
