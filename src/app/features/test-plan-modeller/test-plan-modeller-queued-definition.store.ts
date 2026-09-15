import { Injectable, signal } from '@angular/core';
import type { TestPlanDefinition } from '../../generated/hateoas/types.gen';

const queuedDefinitionStorageKey = 'trails.modeller.queuedDefinition';

@Injectable({
  providedIn: 'root',
})
export class TestPlanModellerQueuedDefinitionStore {
  private readonly queuedDefinition = signal<TestPlanDefinition | null>(null);

  queue(definition: TestPlanDefinition): void {
    this.queuedDefinition.set(definition);
    sessionStorage.setItem(queuedDefinitionStorageKey, JSON.stringify(definition));
  }

  take(): TestPlanDefinition | null {
    const definition = this.queuedDefinition() ?? this.readFromSessionStorage();

    if (!definition) {
      return null;
    }

    this.queuedDefinition.set(null);
    sessionStorage.removeItem(queuedDefinitionStorageKey);
    return definition;
  }

  private readFromSessionStorage(): TestPlanDefinition | null {
    const value = sessionStorage.getItem(queuedDefinitionStorageKey);

    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as TestPlanDefinition;
    } catch {
      sessionStorage.removeItem(queuedDefinitionStorageKey);
      return null;
    }
  }
}
