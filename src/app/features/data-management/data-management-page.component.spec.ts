import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, Router, type Params } from '@angular/router';
import { provideTaiga } from '@taiga-ui/core';
import { BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';
import { WorkspaceContextService } from '../../context/workspace-context.service';
import { DeploymentReportSectionComponent } from './deployment-report-section.component';
import { DataManagementPageComponent } from './data-management-page.component';
import { ElementsSectionComponent } from './elements-section.component';
import { TestDataProfilesSectionComponent } from './test-data-profiles-section.component';
import { TestPlansSectionComponent } from './test-plans-section.component';

@Component({
  selector: 'app-test-plans-section',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestPlansSectionStub {}

@Component({
  selector: 'app-elements-section',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class ElementsSectionStub {}

@Component({
  selector: 'app-test-data-profiles-section',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestDataProfilesSectionStub {}

@Component({
  selector: 'app-deployment-report-section',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class DeploymentReportSectionStub {}

describe('DataManagementPageComponent', () => {
  const ensureApplications = vi.fn<() => void>();
  const queryParams = new BehaviorSubject<Params>({});
  const routeStub = { queryParams };
  const navigate = vi.fn<Router['navigate']>().mockResolvedValue(true);
  let fixture: ComponentFixture<DataManagementPageComponent>;

  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string): MediaQueryList =>
        ({
          matches: false,
          media: query,
          onchange: null,
          addEventListener: (): void => undefined,
          removeEventListener: (): void => undefined,
          dispatchEvent: (): boolean => false,
          addListener: (): void => undefined,
          removeListener: (): void => undefined,
        }) as MediaQueryList,
    });
  });

  beforeEach(() => {
    ensureApplications.mockClear();
    navigate.mockClear();
    queryParams.next({});
    TestBed.configureTestingModule({
      imports: [DataManagementPageComponent],
      providers: [
        provideTaiga(),
        { provide: ActivatedRoute, useValue: routeStub },
        { provide: Router, useValue: { navigate } },
        { provide: WorkspaceContextService, useValue: { ensureApplications } },
      ],
    });
    TestBed.overrideComponent(DataManagementPageComponent, {
      remove: {
        imports: [
          DeploymentReportSectionComponent,
          ElementsSectionComponent,
          TestDataProfilesSectionComponent,
          TestPlansSectionComponent,
        ],
      },
      add: {
        imports: [
          DeploymentReportSectionStub,
          ElementsSectionStub,
          TestDataProfilesSectionStub,
          TestPlansSectionStub,
        ],
      },
    });
  });

  it('uses valid URL state and shows only selected section', () => {
    queryParams.next({ section: 'elements' });
    createPage();
    const sections = pageRoot().querySelectorAll<HTMLElement>(
      'app-test-plans-section, app-elements-section, app-test-data-profiles-section, app-deployment-report-section',
    );

    expect(ensureApplications).toHaveBeenCalledTimes(1);
    expect(sections).toHaveLength(4);

    for (const [sectionIndex, section] of [
      'test-plans',
      'elements',
      'test-data',
      'deployments',
    ].entries()) {
      queryParams.next({ section });
      fixture.detectChanges();

      for (const [index, component] of Array.from(sections).entries()) {
        expect(component.hasAttribute('hidden')).toBe(index !== sectionIndex);

        if (index !== sectionIndex) {
          expect(getComputedStyle(component).display).toBe('none');
        }
      }
    }
  });

  it('defaults missing and invalid sections without rewriting query state', () => {
    queryParams.next({ keep: 'value' });
    createPage();

    expect(pageRoot().querySelector('app-test-plans-section')?.hasAttribute('hidden')).toBe(false);
    expect(navigate).not.toHaveBeenCalled();

    queryParams.next({ section: 'unknown', keep: 'value' });
    fixture.detectChanges();

    expect(pageRoot().querySelector('app-test-plans-section')?.hasAttribute('hidden')).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('selects every section through its button and restores query-param history state', () => {
    queryParams.next({ keep: 'value' });
    createPage();
    const root = pageRoot();
    const buttons = root.querySelectorAll<HTMLButtonElement>(
      '.data-management-section-scroll tui-segmented > button',
    );
    const sections = root.querySelectorAll<HTMLElement>(
      'app-test-plans-section, app-elements-section, app-test-data-profiles-section, app-deployment-report-section',
    );
    const testPlansSection = sections[0];

    for (const [index, section] of [
      [1, 'elements'],
      [2, 'test-data'],
      [3, 'deployments'],
      [0, 'test-plans'],
    ] as const) {
      buttons[index]?.click();

      expect(navigate).toHaveBeenLastCalledWith([], {
        relativeTo: routeStub,
        queryParams: { section },
        queryParamsHandling: 'merge',
      });

      queryParams.next({ keep: 'value', section });
      fixture.detectChanges();
      expect(sections[index]?.hasAttribute('hidden')).toBe(false);
    }

    queryParams.next({ keep: 'value', section: 'test-data' });
    fixture.detectChanges();
    expect(sections[2]?.hasAttribute('hidden')).toBe(false);

    queryParams.next({ keep: 'value' });
    fixture.detectChanges();

    expect(sections[0]).toBe(testPlansSection);
    expect(sections[0]?.hasAttribute('hidden')).toBe(false);
  });

  it('uses direct segmented buttons', () => {
    createPage();
    const root = pageRoot();
    const fieldset = root.querySelector('fieldset.data-management-section-picker');
    const scroll = fieldset?.querySelector(':scope > .data-management-section-scroll');
    const segmented = scroll?.querySelector(':scope > tui-segmented');
    const buttons = segmented?.querySelectorAll<HTMLButtonElement>(':scope > button');

    expect(fieldset?.querySelector(':scope > legend')?.textContent).toContain(
      'Data management section',
    );
    expect(buttons).toHaveLength(4);
    expect(Array.from(buttons ?? []).every((button) => button.type === 'button')).toBe(true);
    expect(Array.from(buttons ?? []).map((button) => button.textContent?.trim())).toEqual([
      'Test plans',
      'Elements',
      'Test data',
      'Deployments',
    ]);
  });

  function createPage(): void {
    fixture = TestBed.createComponent(DataManagementPageComponent);
    fixture.detectChanges();
  }

  function pageRoot(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }
});
