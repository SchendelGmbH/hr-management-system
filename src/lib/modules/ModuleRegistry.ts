/**
 * ModuleRegistry - Zentrale Registrierung und Verwaltung von Modulen
 * 
 * Module können aktiviert/deaktiviert werden basierend auf:
 * - Lizenz-Status (TenantLicense)
 * - System-Konfiguration
 * - Abhängigkeiten zu anderen Modulen
 */

import { eventBus, ModuleEvents } from '@/lib/events/EventBus';
import type { EventPayload } from '@/lib/events/EventBus';

// Module-Typen
export type ModuleId = 
  | 'core' 
  | 'hr-core' 
  | 'chat' 
  | 'woocommerce' 
  | 'einsatzplanung' 
  | 'notifications' 
  | 'audit-log' 
  | 'templates' 
  | string;

export type ModuleStatus = 'active' | 'inactive' | 'error' | 'loading';
export type ModuleTier = 'core' | 'hr' | 'chat' | 'woocommerce' | 'planning' | 'custom';

// Navigation Item für Sidebar/Menu
export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon?: string;
  iconComponent?: string;
  children?: NavigationItem[];
  requiredPermission?: string;
  requiredModule?: ModuleId;
  badge?: string | number;
  position: number;
}

// Modul-Konfiguration
export interface ModuleConfig {
  id: ModuleId;
  name: string;
  description: string;
  version: string;
  tier: ModuleTier;
  author?: string;
  dependencies?: ModuleId[];
  optionalDependencies?: ModuleId[];
  requiredPermissions?: string[];
  navigation?: NavigationItem[];
  settings?: ModuleSettings[];
  features?: string[];
}

// Modul-Einstellungen
export interface ModuleSettings {
  key: string;
  label: string;
  type: 'boolean' | 'string' | 'number' | 'select' | 'json';
  defaultValue: unknown;
  options?: { label: string; value: unknown }[];
  description?: string;
  isSecret?: boolean;
}

// Registriertes Modul
export interface RegisteredModule extends ModuleConfig {
  status: ModuleStatus;
  errorMessage?: string;
  activatedAt?: Date;
  deactivatedAt?: Date;
  settings: Record<string, unknown>;
}

// Manifest-Struktur (aus module.json)
export interface ModuleManifest {
  id: ModuleId;
  name: string;
  description: string;
  version: string;
  tier: ModuleTier;
  author?: string;
  dependencies?: ModuleId[];
  optionalDependencies?: ModuleId[];
  requiredPermissions?: string[];
  navigation?: NavigationItem[];
  settings?: ModuleSettings[];
  features?: string[];
}

// Registry Konfiguration
export interface RegistryConfig {
  autoActivateCore?: boolean;
  strictMode?: boolean;
  checkDependencies?: boolean;
}

/**
 * ModuleRegistry - Singleton für Modul-Verwaltung
 */
class ModuleRegistry {
  private modules: Map<ModuleId, RegisteredModule> = new Map();
  private navigationItems: Map<string, NavigationItem> = new Map();
  private config: RegistryConfig;

  constructor(config: RegistryConfig = {}) {
    this.config = {
      autoActivateCore: true,
      strictMode: true,
      checkDependencies: true,
      ...config,
    };

    // Core-Modul immer registrieren
    this.registerCoreModule();
  }

  /**
   * Registriert das Core-Modul (immer aktiv)
   */
  private registerCoreModule(): void {
    const coreModule: RegisteredModule = {
      id: 'core',
      name: 'Core System',
      description: 'Grundlegende Systemfunktionen',
      version: '1.0.0',
      tier: 'core',
      status: 'active',
      activatedAt: new Date(),
      settings: {},
      navigation: [
        {
          id: 'core.dashboard',
          label: 'navigation.dashboard',
          href: '/dashboard',
          icon: 'LayoutDashboard',
          position: 0,
        },
        {
          id: 'core.users',
          label: 'navigation.users',
          href: '/users',
          icon: 'Users',
          requiredPermission: 'users:read',
          position: 100,
        },
        {
          id: 'core.settings',
          label: 'navigation.settings',
          href: '/settings',
          icon: 'Settings',
          requiredPermission: 'settings:read',
          position: 1000,
        },
      ],
    };

    this.modules.set('core', coreModule);
  }

  /**
   * Registriert ein neues Modul
   */
  register(moduleConfig: ModuleConfig): boolean {
    const { id } = moduleConfig;

    if (this.modules.has(id)) {
      console.warn(`[ModuleRegistry] Modul "${id}" ist bereits registriert`);
      return false;
    }

    // Validiere Abhängigkeiten
    if (this.config.checkDependencies && moduleConfig.dependencies) {
      for (const dep of moduleConfig.dependencies) {
        if (!this.modules.has(dep)) {
          console.error(`[ModuleRegistry] Abhängigkeit "${dep}" für "${id}" nicht erfüllt`);
          if (this.config.strictMode) {
            return false;
          }
        }
      }
    }

    // Erstelle registriertes Modul
    const registeredModule: RegisteredModule = {
      ...moduleConfig,
      status: 'inactive',
      settings: this.initializeSettings(moduleConfig.settings),
    };

    this.modules.set(id, registeredModule);

    // Registriere Navigation
    if (moduleConfig.navigation) {
      for (const item of moduleConfig.navigation) {
        this.navigationItems.set(item.id, { ...item, requiredModule: id });
      }
    }

    // Emit Event
    eventBus.emit(ModuleEvents.MODULE_LOADED, {
      moduleId: id,
      tier: moduleConfig.tier,
    }, 'ModuleRegistry');

    console.log(`[ModuleRegistry] Modul "${id}" registriert`);
    return true;
  }

  /**
   * Lädt ein Modul aus einem Manifest
   */
  registerFromManifest(manifest: ModuleManifest): boolean {
    return this.register({
      id: manifest.id,
      name: manifest.name,
      description: manifest.description,
      version: manifest.version,
      tier: manifest.tier,
      author: manifest.author,
      dependencies: manifest.dependencies,
      optionalDependencies: manifest.optionalDependencies,
      requiredPermissions: manifest.requiredPermissions,
      navigation: manifest.navigation,
      settings: manifest.settings,
      features: manifest.features,
    });
  }

  /**
   * Aktiviert ein Modul
   */
  async activate(moduleId: ModuleId): Promise<boolean> {
    const module = this.modules.get(moduleId);
    
    if (!module) {
      console.error(`[ModuleRegistry] Modul "${moduleId}" nicht gefunden`);
      return false;
    }

    if (module.status === 'active') {
      return true;
    }

    // Prüfe Abhängigkeiten
    if (module.dependencies) {
      for (const dep of module.dependencies) {
        const depModule = this.modules.get(dep);
        if (!depModule || depModule.status !== 'active') {
          console.error(`[ModuleRegistry] Abhängigkeit "${dep}" ist nicht aktiv`);
          return false;
        }
      }
    }

    module.status = 'loading';

    try {
      // Module initialisieren
      await this.initializeModule(module);

      module.status = 'active';
      module.activatedAt = new Date();
      module.errorMessage = undefined;

      eventBus.emit(ModuleEvents.MODULE_ENABLED, {
        moduleId: moduleId,
        dependencies: module.dependencies,
      }, 'ModuleRegistry');

      console.log(`[ModuleRegistry] Modul "${moduleId}" aktiviert`);
      return true;
    } catch (error) {
      module.status = 'error';
      module.errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';

      eventBus.emit(ModuleEvents.MODULE_ERROR, {
        moduleId: moduleId,
        error: module.errorMessage,
      }, 'ModuleRegistry');

      console.error(`[ModuleRegistry] Fehler beim Aktivieren von "${moduleId}":`, error);
      return false;
    }
  }

  /**
   * Deaktiviert ein Modul
   */
  deactivate(moduleId: ModuleId, force = false): boolean {
    const module = this.modules.get(moduleId);
    
    if (!module) {
      return false;
    }

    // Core-Modul kann nicht deaktiviert werden
    if (moduleId === 'core' && !force) {
      console.error('[ModuleRegistry] Core-Modul kann nicht deaktiviert werden');
      return false;
    }

    // Prüfe ob andere Module davon abhängen
    if (!force) {
      for (const [id, mod] of this.modules) {
        if (mod.status === 'active' && mod.dependencies?.includes(moduleId)) {
          console.error(`[ModuleRegistry] Modul "${id}" hängt von "${moduleId}" ab`);
          return false;
        }
      }
    }

    module.status = 'inactive';
    module.deactivatedAt = new Date();

    eventBus.emit(ModuleEvents.MODULE_DISABLED, {
      moduleId: moduleId,
    }, 'ModuleRegistry');

    console.log(`[ModuleRegistry] Modul "${moduleId}" deaktiviert`);
    return true;
  }

  /**
   * Gibt ein Modul zurück
   */
  get(moduleId: ModuleId): RegisteredModule | undefined {
    return this.modules.get(moduleId);
  }

  /**
   * Prüft ob ein Modul aktiv ist
   */
  isActive(moduleId: ModuleId): boolean {
    const module = this.modules.get(moduleId);
    return module?.status === 'active';
  }

  /**
   * Gibt alle Module zurück
   */
  getAll(): RegisteredModule[] {
    return Array.from(this.modules.values());
  }

  /**
   * Gibt alle aktiven Module zurück
   */
  getActiveModules(): RegisteredModule[] {
    return this.getAll().filter(m => m.status === 'active');
  }

  /**
   * Gibt Module nach Tier zurück
   */
  getByTier(tier: ModuleTier): RegisteredModule[] {
    return this.getAll().filter(m => m.tier === tier);
  }

  /**
   * Gibt alle Navigation-Items für aktive Module zurück
   */
  getNavigation(): NavigationItem[] {
    const items: NavigationItem[] = [];
    
    for (const [id, item] of this.navigationItems) {
      // Prüfe ob zugehöriges Modul aktiv ist
      if (!item.requiredModule || this.isActive(item.requiredModule)) {
        items.push(item);
      }
    }

    // Sortiere nach Position
    return items.sort((a, b) => a.position - b.position);
  }

  /**
   * Gibt Navigation-Items für ein spezifisches Modul zurück
   */
  getModuleNavigation(moduleId: ModuleId): NavigationItem[] {
    return Array.from(this.navigationItems.values())
      .filter(item => item.requiredModule === moduleId);
  }

  /**
   * Setzt eine Module-Einstellung
   */
  setSetting(moduleId: ModuleId, key: string, value: unknown): boolean {
    const module = this.modules.get(moduleId);
    if (!module) return false;

    module.settings[key] = value;
    
    eventBus.emit(ModuleEvents.SETTINGS_UPDATED, {
      moduleId,
      key,
      value,
    }, 'ModuleRegistry');

    return true;
  }

  /**
   * Gibt eine Module-Einstellung zurück
   */
  getSetting<T = unknown>(moduleId: ModuleId, key: string, defaultValue?: T): T | undefined {
    const module = this.modules.get(moduleId);
    return module?.settings[key] as T ?? defaultValue;
  }

  /**
   * Gibt alle verfügbaren Features zurück
   */
  getFeatures(): string[] {
    const features: string[] = [];
    for (const module of this.getActiveModules()) {
      if (module.features) {
        features.push(...module.features);
      }
    }
    return features;
  }

  /**
   * Prüft ob ein Feature verfügbar ist
   */
  hasFeature(feature: string): boolean {
    for (const module of this.getActiveModules()) {
      if (module.features?.includes(feature)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Initialisiert Module-Einstellungen
   */
  private initializeSettings(settings?: ModuleSettings[]): Record<string, unknown> {
    if (!settings) return {};
    
    const result: Record<string, unknown> = {};
    for (const setting of settings) {
      result[setting.key] = setting.defaultValue;
    }
    return result;
  }

  /**
   * Initialisiert ein Modul (kann überschrieben werden)
   */
  private async initializeModule(module: RegisteredModule): Promise<void> {
    // Hook für spezifische Initialisierung
    // Kann von außen mit setModuleInitializer() erweitert werden
  }

  /**
   * Setzt die Registry zurück (für Tests)
   */
  reset(): void {
    this.modules.clear();
    this.navigationItems.clear();
    this.registerCoreModule();
  }
}

// Singleton-Instanz
export const moduleRegistry = new ModuleRegistry();

// Konvenienz-Export
export const getActiveModules = () => moduleRegistry.getActiveModules();
export const isModuleActive = (moduleId: ModuleId) => moduleRegistry.isActive(moduleId);
export const getModuleNavigation = () => moduleRegistry.getNavigation();
