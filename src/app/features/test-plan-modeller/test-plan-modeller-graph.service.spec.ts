import { TestBed } from '@angular/core/testing';
import type { ActionDefinition, TestPlanDefinition } from '../../generated/hateoas/types.gen';
import {
  createDefaultActionFormState,
  type ElementFlowNode,
} from './test-plan-modeller-graph.models';
import { TestPlanModellerGraphService } from './test-plan-modeller-graph.service';
import { utilityPaletteItems } from './test-plan-modeller-palette';

describe('TestPlanModellerGraphService groups', () => {
  let graph: TestPlanModellerGraphService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    graph = TestBed.inject(TestPlanModellerGraphService);
    graph.reset();
  });

  it('stores grouped node positions relative to the group and derives membership on export', () => {
    graph.nodes.set([node(1, 160, 240), node(2, 520, 400)]);

    graph.addGroup({ x: 100, y: 200 }, { width: 600, height: 300 }, ['action-1', 'action-2']);

    expect(graph.nodes()).toEqual([
      expect.objectContaining({ parentGroupId: 'group-1', position: { x: 60, y: 40 } }),
      expect.objectContaining({ parentGroupId: 'group-1', position: { x: 420, y: 200 } }),
    ]);
    expect(graph.testPlanDefinition().groups).toEqual([
      expect.objectContaining({ actionReferenceIds: [1, 2] }),
    ]);
  });

  it('preserves canvas position while moving a member between groups', () => {
    graph.groups.set([group('group-1', 100, 200), group('group-2', 500, 100)]);
    graph.nodes.set([node(1, 60, 40, 'group-1')]);

    graph.addNodesToGroup('group-2', ['action-1']);

    expect(graph.nodes()[0]).toEqual(
      expect.objectContaining({ parentGroupId: 'group-2', position: { x: -340, y: 140 } }),
    );
    expect(graph.nodeCanvasPosition('action-1')).toEqual({ x: 160, y: 240 });
    expect(graph.testPlanDefinition().groups).toEqual([
      expect.objectContaining({ actionReferenceIds: [] }),
      expect.objectContaining({ actionReferenceIds: [1] }),
    ]);
  });

  it('restores canvas coordinates when deleting a group and omits deleted members from export', () => {
    graph.groups.set([group('group-1', 100, 200)]);
    graph.nodes.set([node(1, 60, 40, 'group-1'), node(2, 80, 60, 'group-1')]);

    graph.deleteGroup('group-1');
    graph.deleteNode('action-2');

    expect(graph.nodes()).toEqual([
      expect.objectContaining({ parentGroupId: null, position: { x: 160, y: 240 } }),
    ]);
    expect(graph.testPlanDefinition().groups).toEqual([]);
  });

  it('normalizes duplicate and missing imported memberships', () => {
    const definition: TestPlanDefinition = {
      testSteps: [action(1), action(2)],
      groups: [
        {
          label: 'First',
          xCoordinate: 100,
          yCoordinate: 100,
          widthPixels: 300,
          heightPixels: 200,
          actionReferenceIds: [1, 999],
        },
        {
          label: 'Second',
          xCoordinate: 500,
          yCoordinate: 100,
          widthPixels: 300,
          heightPixels: 200,
          actionReferenceIds: [1, 2],
        },
      ],
    };

    graph.importDefinition(definition, []);

    expect(graph.nodes()).toEqual([
      expect.objectContaining({ parentGroupId: 'group-2' }),
      expect.objectContaining({ parentGroupId: 'group-2' }),
    ]);
    expect(graph.testPlanDefinition().groups).toEqual([
      expect.objectContaining({ actionReferenceIds: [] }),
      expect.objectContaining({ actionReferenceIds: [1, 2] }),
    ]);
  });

  it('imports and exports coordinate click as a no-element node', () => {
    graph.importDefinition(
      {
        testSteps: [
          {
            referenceID: 1,
            label: 'Coordinate click',
            details: { detailsType: 'COORDINATE_CLICK', xCoordinate: 12, yCoordinate: 34 },
          },
        ],
      },
      [],
    );

    expect(graph.nodes()[0]).toEqual(
      expect.objectContaining({
        elementId: null,
        action: expect.objectContaining({
          detailsType: 'COORDINATE_CLICK',
          xCoordinate: 12,
          yCoordinate: 34,
        }),
      }),
    );
    expect(graph.testPlanDefinition().testSteps?.[0]?.details).toEqual({
      detailsType: 'COORDINATE_CLICK',
      xCoordinate: 12,
      yCoordinate: 34,
    });
  });

  it.each([0, 2147483647])('accepts coordinate boundary %s', (coordinate: number) => {
    graph.importDefinition(coordinateDefinition(coordinate, coordinate), []);

    expect(graph.canSaveTestPlanDefinition()).toBe(true);
  });

  it.each([
    [undefined, 0],
    [null, 0],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
    [1.5, 0],
    [-1, 0],
    [2147483648, 0],
  ])(
    'retains invalid coordinate values and blocks saving',
    (xCoordinate: unknown, yCoordinate: unknown) => {
      graph.importDefinition(coordinateDefinition(xCoordinate, yCoordinate), []);

      expect(graph.nodes()[0]?.action.xCoordinate).toBe(xCoordinate);
      expect(graph.nodes()[0]?.action.yCoordinate).toBe(yCoordinate);
      expect(graph.canSaveTestPlanDefinition()).toBe(false);
    },
  );

  it('retains invalid Y coordinate values and blocks saving', () => {
    graph.importDefinition(coordinateDefinition(0, Number.POSITIVE_INFINITY), []);

    expect(graph.nodes()[0]?.action.yCoordinate).toBe(Number.POSITIVE_INFINITY);
    expect(graph.canSaveTestPlanDefinition()).toBe(false);
  });

  it('adds coordinate click utility with zero coordinates', () => {
    const coordinateClick = utilityPaletteItems.find(
      (item) => item.defaultActionType === 'COORDINATE_CLICK',
    );

    if (!coordinateClick) {
      throw new Error('Expected coordinate click utility palette item.');
    }

    graph.addNode(coordinateClick, { x: 100, y: 100 });

    expect(graph.nodes()[0]?.action).toEqual(
      expect.objectContaining({ detailsType: 'COORDINATE_CLICK', xCoordinate: 0, yCoordinate: 0 }),
    );
  });

  it('adds resize viewport utility without default dimensions and blocks saving', () => {
    const resizeViewport = utilityPaletteItems.find(
      (item) => item.defaultActionType === 'RESIZE_VIEWPORT',
    );

    if (!resizeViewport) {
      throw new Error('Expected resize viewport utility palette item.');
    }

    graph.addNode(resizeViewport, { x: 100, y: 100 });
    graph.updateNodeLabel('action-1', 'Resize viewport');

    expect(graph.nodes()[0]?.action).toEqual(
      expect.objectContaining({
        detailsType: 'RESIZE_VIEWPORT',
        viewportWidth: undefined,
        viewportHeight: undefined,
      }),
    );
    expect(graph.canSaveTestPlanDefinition()).toBe(false);
  });

  it('imports and exports resize viewport as a no-element node', () => {
    graph.importDefinition(resizeDefinition(800, 600), []);

    expect(graph.nodes()[0]).toEqual(
      expect.objectContaining({
        elementId: null,
        action: expect.objectContaining({
          detailsType: 'RESIZE_VIEWPORT',
          viewportWidth: 800,
          viewportHeight: 600,
        }),
      }),
    );
    expect(graph.testPlanDefinition().testSteps?.[0]?.details).toEqual({
      detailsType: 'RESIZE_VIEWPORT',
      viewportWidth: 800,
      viewportHeight: 600,
    });
  });

  it.each([
    [undefined, 1],
    [null, 1],
    ['1', 1],
    [1.5, 1],
    [0, 1],
    [-1, 1],
    [2147483648, 1],
    [1, []],
  ])(
    'retains invalid resize dimensions and blocks saving',
    (viewportWidth: unknown, viewportHeight: unknown) => {
      graph.importDefinition(resizeDefinition(viewportWidth, viewportHeight), []);

      expect(graph.nodes()[0]?.action.viewportWidth).toBe(viewportWidth);
      expect(graph.nodes()[0]?.action.viewportHeight).toBe(viewportHeight);
      expect(graph.canSaveTestPlanDefinition()).toBe(false);
    },
  );
});

function node(
  referenceId: number,
  x: number,
  y: number,
  parentGroupId: string | null = null,
): ElementFlowNode {
  return {
    id: `action-${referenceId}`,
    referenceId,
    label: `Action ${referenceId}`,
    elementId: null,
    elementLabel: 'No element',
    locatorString: '',
    locatorType: '-',
    type: '-',
    position: { x, y },
    parentGroupId,
    action: createDefaultActionFormState(),
  };
}

function group(
  id: string,
  x: number,
  y: number,
): {
  id: string;
  label: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
} {
  return { id, label: id, position: { x, y }, size: { width: 300, height: 200 } };
}

function action(referenceID: number): ActionDefinition {
  return {
    referenceID,
    details: { detailsType: 'EXPLICIT_WAIT', delayMillis: 0 },
  };
}

function coordinateDefinition(xCoordinate: unknown, yCoordinate: unknown): TestPlanDefinition {
  return {
    testSteps: [
      {
        referenceID: 1,
        label: 'Coordinate click',
        details: { detailsType: 'COORDINATE_CLICK', xCoordinate, yCoordinate } as never,
      },
    ],
  };
}

function resizeDefinition(viewportWidth: unknown, viewportHeight: unknown): TestPlanDefinition {
  return {
    testSteps: [
      {
        referenceID: 1,
        label: 'Resize viewport',
        details: { detailsType: 'RESIZE_VIEWPORT', viewportWidth, viewportHeight } as never,
      },
    ],
  };
}
