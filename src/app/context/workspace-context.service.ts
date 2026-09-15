import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { EMPTY, Observable, catchError, expand, map, reduce, tap } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { HATEOAS_API_BASE_URL } from '../core/api-config';
import type {
  Application,
  PagedApplication,
  PagedStage,
  Stage,
} from '../generated/hateoas/types.gen';

@Injectable({
  providedIn: 'root',
})
export class WorkspaceContextService {
  private readonly apiBaseUrl = inject(HATEOAS_API_BASE_URL);
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);

  readonly applications = signal<Application[]>([]);
  readonly stages = signal<Stage[]>([]);
  readonly applicationsLoading = signal(false);
  readonly stagesLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedApplicationId = signal<number | null>(null);
  readonly selectedStageId = signal<number | null>(null);

  readonly selectedApplication = computed(() => {
    const id = this.selectedApplicationId();
    return this.applications().find((application) => application.id === id) ?? null;
  });

  readonly selectedStage = computed(() => {
    const id = this.selectedStageId();
    return this.stages().find((stage) => stage.id === id) ?? null;
  });

  ensureApplications(): void {
    if (this.applicationsLoading() || this.applications().length > 0) {
      return;
    }

    this.applicationsLoading.set(true);
    this.error.set(null);

    this.fetchApplications().subscribe({
      next: (applications) => {
        this.applications.set(applications);
        this.applicationsLoading.set(false);

        const firstActiveApplication = applications.find((application) => !application.retired);

        if (!this.selectedApplicationId() && firstActiveApplication?.id !== undefined) {
          this.selectApplication(firstActiveApplication.id);
        }
      },
      error: (error: Error) => {
        this.applicationsLoading.set(false);
        this.error.set(error.message);
      },
    });
  }

  reloadApplications(): void {
    if (this.applicationsLoading()) {
      return;
    }

    const selectedApplicationId = this.selectedApplicationId();
    this.applicationsLoading.set(true);
    this.error.set(null);

    this.fetchApplications().subscribe({
      next: (applications) => {
        this.applications.set(applications);
        this.applicationsLoading.set(false);

        const stillSelected =
          selectedApplicationId !== null &&
          applications.some((application) => application.id === selectedApplicationId);

        if (stillSelected) {
          this.selectApplication(selectedApplicationId);
        } else if (applications.find((application) => !application.retired)?.id !== undefined) {
          this.selectApplication(
            applications.find((application) => !application.retired)?.id ?? null,
          );
        } else {
          this.selectApplication(null);
        }
      },
      error: (error: Error) => {
        this.applicationsLoading.set(false);
        this.error.set(error.message);
      },
    });
  }

  reloadStages(): void {
    const applicationId = this.selectedApplicationId();

    if (applicationId !== null) {
      this.loadStages(applicationId);
    }
  }

  selectApplication(applicationId: number | null): void {
    this.selectedApplicationId.set(applicationId);
    this.selectedStageId.set(null);
    this.stages.set([]);

    if (applicationId !== null) {
      this.loadStages(applicationId);
    }
  }

  selectStage(stageId: number | null): void {
    this.selectedStageId.set(stageId);
  }

  private loadStages(applicationId: number): void {
    const selectedStageId = this.selectedStageId();
    this.stagesLoading.set(true);
    this.error.set(null);

    this.fetchStages(applicationId).subscribe({
      next: (stages) => {
        this.stages.set(stages);
        this.stagesLoading.set(false);

        const stillSelected =
          selectedStageId !== null && stages.some((stage) => stage.id === selectedStageId);
        const firstActiveStage = stages.find((stage) => !stage.retired);

        if (stillSelected) {
          this.selectedStageId.set(selectedStageId);
        } else if (firstActiveStage?.id !== undefined) {
          this.selectedStageId.set(firstActiveStage.id);
        }
      },
      error: (error: Error) => {
        this.stagesLoading.set(false);
        this.error.set(error.message);
      },
    });
  }

  private fetchApplications(): Observable<Application[]> {
    return this.fetchPaged<Application, PagedApplication>('/api/applications?includeRetired=true');
  }

  private fetchStages(applicationId: number): Observable<Stage[]> {
    return this.fetchPaged<Stage, PagedStage>(
      `/api/applications/${applicationId}/stages?includeRetired=true`,
    );
  }

  fetchPaged<TItem, TPage extends { items?: TItem[]; page?: number; totalPages?: number }>(
    url: string,
  ): Observable<TItem[]> {
    return this.getPage<TPage>(url, 0).pipe(
      expand((page) => {
        const currentPage = page.page ?? 0;
        const totalPages = page.totalPages ?? currentPage + 1;
        return currentPage + 1 < totalPages ? this.getPage<TPage>(url, currentPage + 1) : EMPTY;
      }),
      map((page) => page.items ?? []),
      reduce((all, pageItems) => all.concat(pageItems), [] as TItem[]),
    );
  }

  fetchResource<TResource>(url: string): Observable<TResource> {
    return this.getResource<TResource>(url);
  }

  fetchBlob(url: string): Observable<Blob> {
    const token = this.auth.accessToken();

    if (!token) {
      throw new Error('A valid token is required to load application context.');
    }

    return this.http
      .get(this.apiUrl(url), {
        headers: new HttpHeaders({
          Authorization: `Bearer ${token}`,
        }),
        responseType: 'blob',
      })
      .pipe(
        tap(() => this.error.set(null)),
        catchError((error: unknown) => {
          throw this.toLoadError(error);
        }),
      );
  }

  putResource<TBody, TResource>(url: string, body: TBody): Observable<TResource> {
    const token = this.auth.accessToken();

    if (!token) {
      throw new Error('A valid token is required to update application context.');
    }

    return this.http
      .put<TResource>(this.apiUrl(url), body, {
        headers: new HttpHeaders({
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        }),
      })
      .pipe(
        tap(() => this.error.set(null)),
        catchError((error: unknown) => {
          throw this.toLoadError(error);
        }),
      );
  }

  postResource<TBody, TResource>(url: string, body: TBody): Observable<TResource> {
    const token = this.auth.accessToken();

    if (!token) {
      throw new Error('A valid token is required to update application context.');
    }

    return this.http
      .post<TResource>(this.apiUrl(url), body, {
        headers: new HttpHeaders({
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        }),
      })
      .pipe(
        tap(() => this.error.set(null)),
        catchError((error: unknown) => {
          throw this.toLoadError(error);
        }),
      );
  }

  deleteResource<TResource>(url: string): Observable<TResource> {
    const token = this.auth.accessToken();

    if (!token) {
      throw new Error('A valid token is required to update application context.');
    }

    return this.http
      .delete<TResource>(this.apiUrl(url), {
        headers: new HttpHeaders({
          Authorization: `Bearer ${token}`,
        }),
      })
      .pipe(
        tap(() => this.error.set(null)),
        catchError((error: unknown) => {
          throw this.toLoadError(error);
        }),
      );
  }

  putFormData<TResource>(url: string, formData: FormData): Observable<TResource> {
    const token = this.auth.accessToken();

    if (!token) {
      throw new Error('A valid token is required to update application context.');
    }

    return this.http
      .put<TResource>(this.apiUrl(url), formData, {
        headers: new HttpHeaders({
          Authorization: `Bearer ${token}`,
        }),
      })
      .pipe(
        tap(() => this.error.set(null)),
        catchError((error: unknown) => {
          throw this.toLoadError(error);
        }),
      );
  }

  getPage<TPage>(url: string, page: number): Observable<TPage> {
    const token = this.auth.accessToken();

    if (!token) {
      throw new Error('A valid token is required to load application context.');
    }

    return this.http
      .get<TPage>(this.apiUrl(this.withoutPaginationParams(url)), {
        headers: new HttpHeaders({
          Authorization: `Bearer ${token}`,
        }),
        params: {
          page,
          size: 100,
        },
      })
      .pipe(
        tap(() => this.error.set(null)),
        catchError((error: unknown) => {
          throw this.toLoadError(error);
        }),
      );
  }

  private getResource<TResource>(url: string): Observable<TResource> {
    const token = this.auth.accessToken();

    if (!token) {
      throw new Error('A valid token is required to load application context.');
    }

    return this.http
      .get<TResource>(this.apiUrl(url), {
        headers: new HttpHeaders({
          Authorization: `Bearer ${token}`,
        }),
      })
      .pipe(
        tap(() => this.error.set(null)),
        catchError((error: unknown) => {
          throw this.toLoadError(error);
        }),
      );
  }

  private apiUrl(path: string): string {
    if (/^https?:\/\//i.test(path)) {
      return path;
    }

    return `${this.apiBaseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  }

  private withoutPaginationParams(pathOrUrl: string): string {
    const [base, query = ''] = pathOrUrl.split('?', 2);

    if (!query) {
      return pathOrUrl;
    }

    const params = new URLSearchParams(query);
    params.delete('page');
    params.delete('size');

    const remaining = params.toString();
    return remaining ? `${base}?${remaining}` : base;
  }

  private toLoadError(error: unknown): Error {
    if (error instanceof HttpErrorResponse) {
      return new Error(
        this.apiErrorMessage(error.error) || error.message || 'Failed to load application context.',
      );
    }

    if (error instanceof Error) {
      return new Error(error.message || 'Failed to load application context.');
    }

    return new Error('Failed to load application context.');
  }

  private apiErrorMessage(body: unknown): string | null {
    if (Array.isArray(body)) {
      const messages = body
        .map((item) => this.validationErrorMessage(item))
        .filter((message): message is string => message !== null);
      return messages.length > 0 ? messages.join(' ') : null;
    }

    if (this.isRecord(body) && typeof body['message'] === 'string') {
      return body['message'].trim() || null;
    }

    if (typeof body === 'string') {
      return body.trim() || null;
    }

    return null;
  }

  private validationErrorMessage(item: unknown): string | null {
    if (!this.isRecord(item) || typeof item['message'] !== 'string') {
      return null;
    }

    return item['message'].trim() || null;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
