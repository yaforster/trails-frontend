import type { Link, Links } from '../generated/hateoas/types.gen';

export type LinkedResource = {
  _links?: Links;
};

export function linkHref(link: Link | null | undefined): string | null {
  const href = link?.href?.trim();
  return href ? href : null;
}

export function resourceLink(
  resource: LinkedResource | null | undefined,
  rel: string,
): Link | null {
  return resource?._links?.[rel] ?? null;
}

export function resourceLinkHref(
  resource: LinkedResource | null | undefined,
  rel: string,
): string | null {
  return linkHref(resourceLink(resource, rel));
}

export function hasResourceLink(resource: LinkedResource | null | undefined, rel: string): boolean {
  return resourceLinkHref(resource, rel) !== null;
}

export function profileLinkHref<TLinks extends Record<string, Link | undefined>>(
  links: TLinks | null | undefined,
  rel: keyof TLinks,
): string | null {
  return linkHref(links?.[rel]);
}

export function expandQueryTemplate(
  href: string,
  params: Record<string, string | number | null | undefined>,
): string {
  const templateMatch = href.match(/\{\?([^}]+)}/);

  if (!templateMatch) {
    return appendQueryParams(href, params);
  }

  const names = templateMatch[1]
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  const queryParams = new URLSearchParams();

  for (const name of names) {
    const value = params[name];

    if (value !== null && value !== undefined && `${value}`.trim() !== '') {
      queryParams.set(name, `${value}`);
    }
  }

  const query = queryParams.toString();
  return href.replace(templateMatch[0], query ? `?${query}` : '');
}

export function appendQueryParams(
  href: string,
  params: Record<string, string | number | null | undefined>,
): string {
  const [base, query = ''] = href.split('?', 2);
  const queryParams = new URLSearchParams(query);

  for (const [name, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && `${value}`.trim() !== '') {
      queryParams.set(name, `${value}`);
    }
  }

  const nextQuery = queryParams.toString();
  return nextQuery ? `${base}?${nextQuery}` : base;
}
