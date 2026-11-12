import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  function createLoadedFixture() {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    httpTesting.expectOne('/api/links').flush([]);
    fixture.detectChanges();
    return fixture;
  }

  it('rejects non-HTTP URLs before making a request', () => {
    const fixture = createLoadedFixture();
    const app = fixture.componentInstance;

    app.form.controls.url.setValue('ftp://example.com/file');
    app.createLink();

    expect(app.form.controls.url.hasError('httpUrl')).toBeTrue();
    httpTesting.expectNone({ method: 'POST', url: '/api/links' });
  });

  it('creates a link and refreshes the links list', () => {
    const fixture = createLoadedFixture();
    const app = fixture.componentInstance;
    const shortLink = {
      code: 'Ab12Cd',
      url: 'https://example.com/article',
      shortUrl: 'http://localhost:3000/Ab12Cd',
      hits: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    app.form.controls.url.setValue(shortLink.url);
    app.createLink();
    app.createLink();

    const createRequest = httpTesting.expectOne({ method: 'POST', url: '/api/links' });
    expect(createRequest.request.body).toEqual({ url: shortLink.url });
    createRequest.flush(shortLink);

    httpTesting.expectOne('/api/links').flush([shortLink]);
    fixture.detectChanges();

    expect(app.createdLink()).toEqual(shortLink);
    expect(app.links()).toEqual([shortLink]);
    expect(fixture.nativeElement.querySelector('.result-link')?.textContent).toContain(shortLink.shortUrl);
  });

  it('shows API errors inline', () => {
    const fixture = createLoadedFixture();
    const app = fixture.componentInstance;

    app.form.controls.url.setValue('https://example.com');
    app.createLink();
    httpTesting.expectOne({ method: 'POST', url: '/api/links' }).flush(
      { error: 'URL must be a valid HTTP or HTTPS URL' },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();

    expect(app.errorMessage()).toBe('URL must be a valid HTTP or HTTPS URL');
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('URL must be a valid');
  });
});
