import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ShortLink } from './link.model';

@Injectable({ providedIn: 'root' })
export class LinkApiService {
  private readonly http = inject(HttpClient);
  private readonly linksUrl = '/api/links';

  createLink(url: string): Observable<ShortLink> {
    return this.http.post<ShortLink>(this.linksUrl, { url });
  }

  getLinks(): Observable<ShortLink[]> {
    return this.http.get<ShortLink[]>(this.linksUrl);
  }
}
