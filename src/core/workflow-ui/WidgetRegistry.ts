/**
 * CHATR Workflow UI SDK — Widget Registry
 *
 * Maps WidgetType (+ optional version) → React component.
 * The WorkflowRenderer never imports widget components directly.
 * It always asks the registry, making the system fully extensible.
 *
 * Usage:
 *   widgetRegistry.register('approval', ApprovalWidget);
 *   widgetRegistry.register('weather', WeatherWidget);
 *   widgetRegistry.register('selection', SelectionWidget, '2.0');
 *   const Component = widgetRegistry.resolve('progress'); // → ProgressWidget
 */

import type { ComponentType } from 'react';
import type { WidgetType, WidgetProps } from './types';
import { TaskWidget } from './widgets/TaskWidget';
import { ReminderWidget } from './widgets/ReminderWidget';
import { MeetingWidget } from './widgets/MeetingWidget';
import { FlightBookingWidget } from './widgets/FlightBookingWidget';
import { FoodOrderingWidget } from './widgets/FoodOrderingWidget';
import { WeatherWidget } from './widgets/WeatherWidget';
import { LoadingWidget } from './widgets/LoadingWidget';
import { ApprovalWidget } from './widgets/ApprovalWidget';
import { ResultWidget } from './widgets/ResultWidget';
import { ExtractionProgressWidget } from './widgets/ExtractionProgressWidget';
import { ATSResultWidget } from './widgets/ATSResultWidget';
import { DocumentPreviewWidget } from './widgets/DocumentPreviewWidget';

type WidgetComponent = ComponentType<WidgetProps>;

interface RegistryEntry {
  component: WidgetComponent;
  version: string;
  registeredAt: number;
}

class WidgetRegistry {
  private static instance: WidgetRegistry;
  /** Map key format: "{type}@{version}" or "{type}@latest" */
  private entries = new Map<string, RegistryEntry>();

  private constructor() {}

  static getInstance(): WidgetRegistry {
    if (!WidgetRegistry.instance) {
      WidgetRegistry.instance = new WidgetRegistry();
    }
    return WidgetRegistry.instance;
  }

  /**
   * Register a widget component for a given type and optional version.
   * Always registers as "latest" in addition to the versioned key.
   */
  register(
    type: WidgetType,
    component: WidgetComponent,
    version = '1.0'
  ): void {
    const entry: RegistryEntry = {
      component,
      version,
      registeredAt: Date.now(),
    };
    const versionedKey = `${type}@${version}`;
    const latestKey = `${type}@latest`;

    this.entries.set(versionedKey, entry);

    // Only overwrite "latest" if this is a newer version
    const existingLatest = this.entries.get(latestKey);
    if (!existingLatest || this.compareVersions(version, existingLatest.version) >= 0) {
      this.entries.set(latestKey, entry);
    }

    if (import.meta.env.DEV) {
      console.debug(`[WidgetRegistry] Registered ${type}@${version}`);
    }
  }

  /**
   * Resolve a widget component for a given type and optional version.
   * Falls back to "latest" if the requested version is not found.
   * Returns null if the type is not registered at all.
   */
  resolve(type: WidgetType, version?: string): WidgetComponent | null {
    if (version) {
      const versionedEntry = this.entries.get(`${type}@${version}`);
      if (versionedEntry) return versionedEntry.component;
    }
    const latestEntry = this.entries.get(`${type}@latest`);
    return latestEntry?.component ?? null;
  }

  /**
   * Check if a type is registered.
   */
  has(type: WidgetType, version?: string): boolean {
    return this.resolve(type, version) !== null;
  }

  /**
   * List all registered types (unique).
   */
  registeredTypes(): WidgetType[] {
    const types = new Set<WidgetType>();
    for (const key of this.entries.keys()) {
      if (key.endsWith('@latest')) {
        types.add(key.replace('@latest', '') as WidgetType);
      }
    }
    return Array.from(types);
  }

  /** Simple semver comparison. Returns 1 if a > b, -1 if a < b, 0 if equal. */
  private compareVersions(a: string, b: string): number {
    const parse = (v: string) => v.split('.').map(Number);
    const [aMajor, aMinor = 0] = parse(a);
    const [bMajor, bMinor = 0] = parse(b);
    if (aMajor !== bMajor) return aMajor > bMajor ? 1 : -1;
    if (aMinor !== bMinor) return aMinor > bMinor ? 1 : -1;
    return 0;
  }
}

export const widgetRegistry = WidgetRegistry.getInstance();
