import { DOCUMENT } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TuiFiles } from '@taiga-ui/kit';

@Component({
  selector: 'app-test-plan-definition-preview-dialog',
  imports: [MatIconModule, ReactiveFormsModule, TuiFiles],
  templateUrl: './test-plan-definition-preview-dialog.component.html',
  styleUrl: './test-plan-modeller-page.component.css',
  styles: [':host { display: contents; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TestPlanDefinitionPreviewDialogComponent implements AfterViewInit, OnDestroy {
  private readonly document = inject<Document>(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private opener: HTMLElement | null = null;
  private readonly backgrounds: Array<{ element: HTMLElement; wasInert: boolean }> = [];
  private fileReadVersion = 0;
  private viewReady: boolean = false;

  private dialog: ElementRef<HTMLElement> | undefined;

  @ViewChild('dialog')
  set dialogElement(value: ElementRef<HTMLElement> | undefined) {
    this.dialog = value;

    if (value && this.open()) {
      this.activateModal();
    }
  }

  readonly open = input.required<boolean>();
  readonly definitionJson = input.required<string>();
  readonly downloadFileName = input.required<string>();
  readonly importError = input.required<string | null>();
  protected readonly draft = signal('');
  protected readonly clipboardError = signal<string | null>(null);
  protected readonly fileError = signal<string | null>(null);
  protected readonly fileControl = new FormControl<File | null>(null);

  readonly close = output<void>();
  readonly draftChange = output<void>();
  readonly importDefinition = output<string>();

  constructor() {
    this.fileControl.valueChanges.subscribe((file: File | null) => {
      if (file) {
        void this.readFile(file);
      }
    });

    effect(() => {
      if (this.open()) {
        this.draft.set(this.definitionJson());
        this.clipboardError.set(null);
        this.fileError.set(null);
        this.fileReadVersion++;
        this.fileControl.reset(null, { emitEvent: false });
        this.activateModal();
      } else {
        this.deactivateModal();
      }
    });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;

    if (this.open()) {
      this.activateModal();
    }
  }

  ngOnDestroy(): void {
    this.deactivateModal();
  }

  protected closeDialog(): void {
    this.close.emit();
  }

  protected trapFocus(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeDialog();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const focusable: HTMLElement[] = this.focusableElements();

    if (focusable.length === 0) {
      event.preventDefault();
      this.dialog?.nativeElement.focus();
      return;
    }

    const first: HTMLElement = focusable[0];
    const last: HTMLElement = focusable[focusable.length - 1];
    const activeElement: Element | null = this.document.activeElement;

    if (
      event.shiftKey &&
      (activeElement === first || !this.dialog?.nativeElement.contains(activeElement))
    ) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      (activeElement === last || !this.dialog?.nativeElement.contains(activeElement))
    ) {
      event.preventDefault();
      first.focus();
    }
  }

  protected onDraftInput(event: Event): void {
    const textarea = event.target instanceof HTMLTextAreaElement ? event.target : null;

    this.draft.set(textarea?.value ?? '');
    this.clipboardError.set(null);
    this.fileReadVersion++;
    this.draftChange.emit();
  }

  protected async copy(): Promise<void> {
    await this.writeClipboard(this.draft(), 'Could not copy JSON to the clipboard.');
  }

  protected async paste(): Promise<void> {
    const clipboard = this.document.defaultView?.navigator.clipboard;

    if (!clipboard) {
      this.clipboardError.set('Clipboard access is unavailable in this browser.');
      return;
    }

    try {
      this.draft.set(await clipboard.readText());
      this.clipboardError.set(null);
      this.fileReadVersion++;
      this.draftChange.emit();
    } catch {
      this.clipboardError.set('Could not read JSON from the clipboard.');
    }
  }

  protected download(): void {
    const url = URL.createObjectURL(new Blob([this.draft()], { type: 'application/json' }));
    const link = this.document.createElement('a');

    link.href = url;
    link.download = this.downloadFileName();
    link.click();
    URL.revokeObjectURL(url);
  }

  protected import(): void {
    this.importDefinition.emit(this.draft());
  }

  protected onFileRejected(): void {
    this.fileError.set('Select one JSON file smaller than 30 MiB.');
  }

  protected removeFile(): void {
    this.fileReadVersion++;
    this.fileControl.reset(null, { emitEvent: false });
    this.fileError.set(null);
  }

  private activateModal(): void {
    if (!this.viewReady || !this.dialog) {
      return;
    }

    this.opener ??=
      this.document.activeElement instanceof HTMLElement ? this.document.activeElement : null;
    if (this.backgrounds.length === 0) {
      for (const element of this.findBackgrounds()) {
        this.backgrounds.push({ element, wasInert: element.inert });
        element.inert = true;
      }
    }

    queueMicrotask(() => this.focusFirstElement());
  }

  private deactivateModal(): void {
    for (const background of this.backgrounds) {
      background.element.inert = background.wasInert;
    }
    this.backgrounds.length = 0;

    const opener: HTMLElement | null = this.opener;
    this.opener = null;

    if (opener?.isConnected) {
      opener.focus();
    }
  }

  private findBackgrounds(): HTMLElement[] {
    const parent: HTMLElement | null = this.host.nativeElement.parentElement;

    return parent
      ? Array.from(parent.children).filter(
          (element: Element): element is HTMLElement =>
            element instanceof HTMLElement && element !== this.host.nativeElement,
        )
      : [];
  }

  private focusFirstElement(): void {
    this.focusableElements()[0]?.focus();
  }

  private focusableElements(): HTMLElement[] {
    const dialog: HTMLElement | undefined = this.dialog?.nativeElement;

    if (!dialog) {
      return [];
    }

    return Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
  }

  private async writeClipboard(text: string, failureMessage: string): Promise<void> {
    const clipboard = this.document.defaultView?.navigator.clipboard;

    if (!clipboard) {
      this.clipboardError.set('Clipboard access is unavailable in this browser.');
      return;
    }

    try {
      await clipboard.writeText(text);
      this.clipboardError.set(null);
    } catch {
      this.clipboardError.set(failureMessage);
    }
  }

  private async readFile(file: File): Promise<void> {
    const fileReadVersion = ++this.fileReadVersion;
    this.fileError.set(null);

    try {
      const text = await file.text();

      if (fileReadVersion !== this.fileReadVersion) {
        return;
      }

      this.draft.set(text);
      this.draftChange.emit();
    } catch {
      if (fileReadVersion === this.fileReadVersion) {
        this.fileError.set('Could not read selected JSON file.');
      }
    }
  }
}
