import { appendQueryParams } from '../../core/hateoas-links';

export function includeRetired(url: string): string {
  return appendQueryParams(url, { includeRetired: 'true' });
}
