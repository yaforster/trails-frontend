import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { ActionDetailsType, TestDataSet } from '../../generated/hateoas/types.gen';
import {
  createDefaultActionFormState,
  type ElementFlowNode,
  type ElementPaletteItem,
} from './test-plan-modeller-graph.models';
import { TestPlanActionEditorComponent } from './test-plan-action-editor.component';
import { TestPlanModellerGraphService } from './test-plan-modeller-graph.service';

describe('TestPlanActionEditorComponent coordinate click', () => {
  let fixture: ComponentFixture<TestPlanActionEditorComponent>;
  let component: TestPlanActionEditorComponent;
  let graph: TestPlanModellerGraphService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestPlanActionEditorComponent],
    });
    fixture = TestBed.createComponent(TestPlanActionEditorComponent);
    component = fixture.componentInstance;
    graph = TestBed.inject(TestPlanModellerGraphService);
    graph.reset();
    graph.nodes.set([coordinateNode()]);
    fixture.componentRef.setInput('node', coordinateNode());
    fixture.componentRef.setInput('testDataSets', [] as TestDataSet[]);
    fixture.componentRef.setInput('testDataLoading', false);
    fixture.componentRef.setInput('testDataError', null);
    fixture.detectChanges();
  });

  it('renders coordinate constraints and help text', () => {
    const root = fixture.nativeElement as HTMLElement;
    const inputs = root.querySelectorAll<HTMLInputElement>('input[type="number"]');

    expect(inputs).toHaveLength(2);
    expect(inputs[0]?.min).toBe('0');
    expect(inputs[0]?.max).toBe('2147483647');
    expect(inputs[0]?.step).toBe('1');
    expect(root.textContent).toContain('Viewport CSS pixels from the visible top-left corner.');
  });

  it('preserves an empty coordinate input for graph validation', () => {
    const root = fixture.nativeElement as HTMLElement;
    const input = root.querySelector<HTMLInputElement>('input[type="number"]');

    if (!input) {
      throw new Error('Expected X coordinate input.');
    }

    input.value = '';
    input.dispatchEvent(new Event('input'));

    expect(graph.nodeAction('action-1')?.xCoordinate).toBe('');
  });

  it('excludes coordinate click from element action choices', () => {
    const selectableActionTypes = component as unknown as {
      selectableActionTypes(
        node: ElementPaletteItem & { action: { detailsType: ActionDetailsType | null } },
      ): readonly ActionDetailsType[];
    };
    const elementNode = {
      elementId: 1,
      label: 'Element',
      locatorString: '#element',
      locatorType: 'CSS',
      type: 'BUTTON',
      action: { detailsType: null },
    };

    expect(selectableActionTypes.selectableActionTypes(elementNode)).not.toContain(
      'COORDINATE_CLICK',
    );
    expect(selectableActionTypes.selectableActionTypes(elementNode)).not.toContain(
      'RESIZE_VIEWPORT',
    );
  });

  it('renders resize viewport constraints without default dimensions', () => {
    const resizeNode = viewportResizeNode();
    graph.nodes.set([resizeNode]);
    fixture.componentRef.setInput('node', resizeNode);
    fixture.detectChanges();

    const inputs = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>(
      'input[type="number"]',
    );

    expect(inputs).toHaveLength(2);
    expect(inputs[0]?.min).toBe('1');
    expect(inputs[0]?.max).toBe('2147483647');
    expect(inputs[0]?.step).toBe('1');
    expect(inputs[0]?.value).toBe('');
  });
});

function coordinateNode(): ElementFlowNode {
  return {
    id: 'action-1',
    referenceId: 1,
    label: 'Coordinate click',
    elementId: null,
    elementLabel: 'Coordinate click',
    locatorString: '',
    locatorType: '-',
    type: 'UTILITY',
    position: { x: 0, y: 0 },
    parentGroupId: null,
    action: {
      ...createDefaultActionFormState(),
      detailsType: 'COORDINATE_CLICK',
    },
  };
}

function viewportResizeNode(): ElementFlowNode {
  return {
    ...coordinateNode(),
    label: 'Resize viewport',
    action: {
      ...createDefaultActionFormState(),
      detailsType: 'RESIZE_VIEWPORT',
    },
  };
}
