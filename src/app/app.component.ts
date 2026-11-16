import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { LinksApiService, ShortLink } from './links-api.service';

@Component({
  selector: 'app-root',
  imports: [ReactiveFormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  private readonly linksApi = inject(LinksApiService);

  readonly form = new FormGroup({
    url: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, httpUrlValidator],
    }),
  });
  readonly urlControl = this.form.controls.url;
  readonly links = signal<ShortLink[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly createdLink = signal<ShortLink | null>(null);

  ngOnInit(): void {
    this.refreshLinks();
  }

  onSubmit(): void {
    if (this.submitting()) return;

    this.submitError.set(null);
    this.createdLink.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.linksApi.createLink(this.urlControl.value.trim()).subscribe({
      next: (link) => {
        this.createdLink.set(link);
        this.form.reset();
        this.submitting.set(false);
        this.refreshLinks();
      },
      error: (error: unknown) => {
        this.submitError.set(formatApiError(error));
        this.submitting.set(false);
      },
    });
  }

  refreshLinks(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.linksApi.listLinks().subscribe({
      next: (links) => this.links.set(links),
      error: (error: unknown) => {
        this.loadError.set(formatApiError(error));
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }
}

const httpUrlValidator: ValidatorFn = (control): ValidationErrors | null => {
  const value = String(control.value).trim();
  if (!value) return null;

  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname
      ? null
      : { httpUrl: true };
  } catch {
    return { httpUrl: true };
  }
};

function formatApiError(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) return 'An unexpected error occurred.';

  const body: unknown = error.error;
  if (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof body.error === 'string'
  ) {
    return body.error;
  }

  return error.status === 0
    ? 'Could not reach the Snip API. Make sure the backend is running on port 3000.'
    : `The request failed (HTTP ${error.status}).`;
}
