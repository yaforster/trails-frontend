import { hasResourceLink, type LinkedResource } from '../../core/hateoas-links';
import type { ResourceTab } from './data-management.models';

type RetirableResource = LinkedResource & {
  retired?: boolean;
};

export function hasRestorableRetiredResource<TResource extends RetirableResource>(
  resources: TResource[],
): boolean {
  return resources.some(
    (resource) => resource.retired === true && hasResourceLink(resource, 'restore'),
  );
}

export function normalizeResourceTab<TResource extends RetirableResource>(
  selectedTab: ResourceTab,
  resources: TResource[],
): ResourceTab {
  return selectedTab === 'retired' && !hasRestorableRetiredResource(resources)
    ? 'active'
    : selectedTab;
}
