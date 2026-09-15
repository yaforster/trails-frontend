import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { TestPlanDefinitionPreviewDialogComponent } from './test-plan-definition-preview-dialog.component';

describe('TestPlanDefinitionPreviewDialogComponent', () => {
  let fixture: ComponentFixture<TestPlanDefinitionPreviewDialogComponent>;
  let component: TestPlanDefinitionPreviewDialogComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestPlanDefinitionPreviewDialogComponent],
    });
    fixture = TestBed.createComponent(TestPlanDefinitionPreviewDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('definitionJson', '{\n  "label": "Original"\n}');
    fixture.componentRef.setInput('downloadFileName', 'test-plan-definition.json');
    fixture.componentRef.setInput('importError', null);
    fixture.detectChanges();
  });

  it('imports the edited JSON only when the import button is clicked', () => {
    let importedJson: string | undefined;
    component.importDefinition.subscribe((json: string) => (importedJson = json));
    const root = fixture.nativeElement as HTMLElement;
    const textarea = root.querySelector<HTMLTextAreaElement>('textarea');

    if (!textarea) {
      throw new Error('Expected JSON textarea.');
    }

    textarea.value = '{"label":"Imported"}';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(importedJson).toBeUndefined();
    click(fixture, '.definition-preview-import');
    expect(importedJson).toBe('{"label":"Imported"}');
  });

  it('renders import errors from the page', () => {
    fixture.componentRef.setInput('importError', 'Invalid TestPlanDefinitionDTO JSON.');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.definition-preview-error')?.textContent).toContain(
      'Invalid TestPlanDefinitionDTO JSON.',
    );
  });

  it('loads selected JSON into the editable draft without importing it', async () => {
    let importedJson: string | undefined;
    component.importDefinition.subscribe((json: string) => (importedJson = json));
    fileControl(component).setValue(jsonFile('{"label":"Uploaded"}'));
    await fixture.whenStable();
    fixture.detectChanges();

    const textarea = (fixture.nativeElement as HTMLElement).querySelector<HTMLTextAreaElement>(
      'textarea',
    );
    expect(textarea?.value).toBe('{"label":"Uploaded"}');
    expect(importedJson).toBeUndefined();
  });

  it('shows file read and validation errors', async () => {
    fileControl(component).setValue(unreadableJsonFile());
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.definition-preview-error')?.textContent).toContain(
      'Could not read selected JSON file.',
    );

    fileDialog(component).onFileRejected();
    fixture.detectChanges();

    expect(root.querySelector('.definition-preview-error')?.textContent).toContain(
      'Select one JSON file smaller than 30 MiB.',
    );
  });

  it('moves focus into the dialog, traps Tab navigation, and restores its opener after close', async () => {
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    await fixture.whenStable();
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();

    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    const buttons = root.querySelectorAll<HTMLButtonElement>('.definition-preview-dialog button');
    const first = buttons[0];
    const last = root.querySelector<HTMLButtonElement>('.definition-preview-import');

    if (!first || !last) {
      throw new Error('Expected dialog focus controls.');
    }

    expect(document.activeElement).toBe(first);

    last.focus();
    last.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }));
    expect(document.activeElement).toBe(first);

    first.focus();
    first.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, key: 'Tab', shiftKey: true }),
    );
    expect(document.activeElement).toBe(last);

    component.close.subscribe(() => fixture.componentRef.setInput('open', false));
    first.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('closes when backdrop is clicked', () => {
    let closed = false;
    component.close.subscribe(() => (closed = true));

    click(fixture, '.definition-preview-backdrop');

    expect(closed).toBe(true);
  });
});

function click(
  fixture: ComponentFixture<TestPlanDefinitionPreviewDialogComponent>,
  selector: string,
): void {
  const root = fixture.nativeElement as HTMLElement;
  const button = root.querySelector<HTMLButtonElement>(selector);

  if (!button) {
    throw new Error(`Expected ${selector} button.`);
  }

  button.click();
}

function fileControl(
  component: TestPlanDefinitionPreviewDialogComponent,
): FormControl<File | null> {
  return (component as unknown as { fileControl: FormControl<File | null> }).fileControl;
}

function fileDialog(component: TestPlanDefinitionPreviewDialogComponent): {
  onFileRejected(): void;
} {
  return component as unknown as { onFileRejected(): void };
}

function jsonFile(text: string): File {
  return {
    name: 'definition.json',
    size: text.length,
    text: () => Promise.resolve(text),
    type: 'application/json',
  } as File;
}

function unreadableJsonFile(): File {
  return {
    name: 'definition.json',
    size: 1,
    text: () => Promise.reject(new Error('read failed')),
    type: 'application/json',
  } as File;
}
