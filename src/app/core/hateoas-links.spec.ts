import type { ProfileLinks } from '../generated/hateoas/types.gen';
import {
  appendQueryParams,
  expandQueryTemplate,
  hasResourceLink,
  linkHref,
  profileLinkHref,
  resourceLinkHref,
} from './hateoas-links';

describe('HATEOAS link helpers', () => {
  it('returns trimmed hrefs from links', () => {
    expect(linkHref({ href: ' /api/test ' })).toBe('/api/test');
    expect(linkHref({ href: '   ' })).toBeNull();
    expect(linkHref(null)).toBeNull();
  });

  it('finds resource links by relation', () => {
    const resource = {
      _links: {
        self: { href: '/api/resources/1' },
        delete: { href: '/api/resources/1', method: 'DELETE' },
      },
    };

    expect(resourceLinkHref(resource, 'self')).toBe('/api/resources/1');
    expect(hasResourceLink(resource, 'delete')).toBe(true);
    expect(hasResourceLink(resource, 'restore')).toBe(false);
  });

  it('finds profile links from the profile link shape', () => {
    expect(profileLinkHref({ update: { href: '/user/profile' } }, 'update')).toBe('/user/profile');
    expect(profileLinkHref({} as Partial<ProfileLinks>, 'update')).toBeNull();
  });

  it('expands URI query templates', () => {
    expect(expandQueryTemplate('/api/items/1/promote{?targetStageId}', { targetStageId: 2 })).toBe(
      '/api/items/1/promote?targetStageId=2',
    );
  });

  it('appends query params when no template is present', () => {
    expect(appendQueryParams('/api/items?includeRetired=true', { page: 1 })).toBe(
      '/api/items?includeRetired=true&page=1',
    );
  });
});
