import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { ShortLink } from './links-api.service';

const endpoint =
  window.location.port === '4200'
    ? 'http://localhost:3000/api/links'
    : '/api/links';

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    http.expectOne(endpoint).flush([]);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
  });

  it('rejects invalid URLs before sending a request', () => {
    fixture.componentInstance.urlControl.setValue('ftp://example.com');
    fixture.componentInstance.onSubmit();
    fixture.detectChanges();

    expect(fixture.componentInstance.form.invalid).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain(
      'Enter a valid HTTP or HTTPS URL.',
    );
  });

  it('creates a short link and refreshes the links table', () => {
    const link: ShortLink = {
      code: 'a1B2c3',
      url: 'https://example.com/article',
      shortUrl: 'http://localhost:3000/a1B2c3',
      hits: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    fixture.componentInstance.urlControl.setValue(link.url);
    fixture.componentInstance.onSubmit();
    http
      .expectOne({ method: 'POST', url: endpoint })
      .flush(link, { status: 201, statusText: 'Created' });
    http.expectOne({ method: 'GET', url: endpoint }).flush([link]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(link.shortUrl);
    expect(fixture.nativeElement.textContent).toContain(link.url);
    expect(fixture.nativeElement.textContent).toContain('a1B2c3');
  });

  it('shows API errors beside the form', () => {
    fixture.componentInstance.urlControl.setValue('https://example.com');
    fixture.componentInstance.onSubmit();
    http.expectOne({ method: 'POST', url: endpoint }).flush(
      { error: 'A valid HTTP or HTTPS URL is required.' },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'A valid HTTP or HTTPS URL is required.',
    );
  });
});
