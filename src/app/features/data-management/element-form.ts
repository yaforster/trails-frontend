import type {
  Element,
  ElementDefinition,
  ElementType,
  LocatorType,
} from '../../generated/hateoas/types.gen';
import { elementTypes, locatorTypes } from './data-management.models';

export type ElementDefinitionResult =
  | {
      definition: ElementDefinition;
      error: null;
    }
  | {
      definition: null;
      error: string;
    };

export function buildElementDefinition(
  labelValue: string,
  locatorValue: string,
  type: ElementType,
  locatorType: LocatorType,
): ElementDefinitionResult {
  const label = labelValue.trim();
  const locator = locatorValue.trim();

  if (!label || !locator) {
    return {
      definition: null,
      error: 'Element label and locator are required.',
    };
  }

  return {
    definition: {
      label,
      type,
      locatorString: locator,
      locatorType,
    },
    error: null,
  };
}

export function toElementType(value: Element['type']): ElementType {
  return elementTypes.includes(value as ElementType) ? (value as ElementType) : 'BUTTON';
}

export function toLocatorType(value: Element['locatorType']): LocatorType {
  return locatorTypes.includes(value as LocatorType) ? (value as LocatorType) : 'CSS';
}
