import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { httpUrlValidator } from './http-url.validator';
import { LinkApiService } from './link-api.service';
import { ShortLink } from './link.model';

@Component({
  selector: 'app-root',
  imports: [ReactiveFormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly linkApi = inject(LinkApiService);

  readonly form = this.formBuilder.nonNullable.group({
    url: ['', [Validators.required, httpUrlValidator()]],
  });
  readonly links = signal<ShortLink[]>([]);
  readonly loading = signal(true);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');
  readonly loadError = signal('');
  readonly createdLink = signal<ShortLink | null>(null);

  get urlControl() {
    return this.form.controls.url;
  }

  ngOnInit(): void {
    this.refreshLinks();
  }

  createLink(): void {
    if (this.isSubmitting()) {
      return;
    }

    this.createdLink.set(null);
    this.errorMessage.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.linkApi
      .createLink(this.urlControl.value.trim())
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: (link) => {
          this.createdLink.set(link);
          this.form.reset({ url: '' });
          this.refreshLinks();
        },
        error: (error: unknown) => {
          this.errorMessage.set(this.getErrorMessage(error, 'shorten'));
        },
      });
  }

  refreshLinks(): void {
    this.loading.set(true);
    this.loadError.set('');

    this.linkApi
      .getLinks()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (links) => this.links.set(links),
        error: (error: unknown) => {
          this.loadError.set(this.getErrorMessage(error, 'load'));
        },
      });
  }

  private getErrorMessage(error: unknown, action: 'load' | 'shorten'): string {
    if (error instanceof HttpErrorResponse) {
      const responseBody: unknown = error.error;
      if (
        responseBody !== null &&
        typeof responseBody === 'object' &&
        'error' in responseBody &&
        typeof responseBody.error === 'string'
      ) {
        return responseBody.error;
      }

      if (error.status === 0) {
        return 'Could not reach Snip. Check that the service is running and try again.';
      }
    }

    return action === 'shorten'
      ? 'We could not shorten that link. Please try again.'
      : 'Your links could not be loaded. Please try again.';
  }
}
