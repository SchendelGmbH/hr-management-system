/**
 * LicenseManager - Lizenz- und Tenant-Verwaltung
 * 
 * Steuert den Zugriff auf Module basierend auf:
 * - Tenant-Lizenz (Subscription-Level)
 * - Modul-spezifische Lizenzierung
 * - Feature-Entitlements
 * - Nutzungslimits (z.B. Benutzer-Anzahl)
 */

import { prisma } from '@/lib/prisma';
import { eventBus, ModuleEvents } from '@/lib/events/EventBus';
import { moduleRegistry, type ModuleId } from '@/lib/modules/ModuleRegistry';
import type { EventPayload } from '@/lib/events/EventBus';

// Subscription-Tiers
export type SubscriptionTier = 
  | 'free' 
  | 'starter' 
  | 'professional' 
  | 'enterprise' 
  | 'custom';

// Lizenz-Status
export type LicenseStatus = 
  | 'active' 
  | 'trial' 
  | 'expired' 
  | 'suspended' 
  | 'cancelled';

// Feature-Entitlements pro Tier
export interface FeatureEntitlement {
  feature: string;
  enabled: boolean;
  limit?: number;
  unlimited?: boolean;
}

// Modul-Lizenz
export interface ModuleLicense {
  moduleId: ModuleId;
  enabled: boolean;
  trial?: boolean;
  trialEndsAt?: Date;
  expiresAt?: Date;
  maxUsers?: number;
  maxStorageGB?: number;
  restrictions?: string[];
}

// Tenant-Lizenz
export interface TenantLicense {
  id: string;
  tenantId: string;
  tenantName: string;
  subscriptionTier: SubscriptionTier;
  status: LicenseStatus;
  modules: ModuleLicense[];
  features: FeatureEntitlement[];
  limits: LicenseLimits;
  
  // Vertragsdaten
  contractStartDate: Date;
  contractEndDate?: Date;
  billingInterval?: 'monthly' | 'yearly';
  nextBillingDate?: Date;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastCheckedAt: Date;
}

// Lizenz-Limits
export interface LicenseLimits {
  maxUsers: number;
  maxEmployees: number;
  maxStorageGB: number;
  maxDocuments: number;
  maxConcurrentLogins: number;
}

// Standard-Limits pro Tier
export const TIER_LIMITS: Record<SubscriptionTier, Partial<LicenseLimits>> = {
  free: {
    maxUsers: 2,
    maxEmployees: 10,
    maxStorageGB: 1,
    maxDocuments: 100,
    maxConcurrentLogins: 2,
  },
  starter: {
    maxUsers: 5,
    maxEmployees: 50,
    maxStorageGB: 10,
    maxDocuments: 1000,
    maxConcurrentLogins: 5,
  },
  professional: {
    maxUsers: 25,
    maxEmployees: 250,
    maxStorageGB: 50,
    maxDocuments: 10000,
    maxConcurrentLogins: 25,
  },
  enterprise: {
    maxUsers: -1, // Unlimited
    maxEmployees: -1,
    maxStorageGB: -1,
    maxDocuments: -1,
    maxConcurrentLogins: -1,
  },
  custom: {
    // Individuelle Limits aus Lizenz
    maxUsers: 0,
    maxEmployees: 0,
    maxStorageGB: 0,
    maxDocuments: 0,
    maxConcurrentLogins: 0,
  },
};

// Standard-Module pro Tier
export const TIER_MODULES: Record<SubscriptionTier, ModuleId[]> = {
  free: ['core', 'hr-core'],
  starter: ['core', 'hr-core', 'chat'],
  professional: ['core', 'hr-core', 'chat', 'woocommerce', 'einsatzplanung'],
  enterprise: ['core', 'hr-core', 'chat', 'woocommerce', 'einsatzplanung', 'notifications', 'audit-log', 'templates'],
  custom: ['core'], // Individuell konfigurierbar
};

// Cache für Lizenz-Daten
interface LicenseCache {
  license: TenantLicense | null;
  timestamp: number;
  ttl: number;
}

/**
 * LicenseManager - Singleton für Lizenz-Verwaltung
 */
class LicenseManager {
  private currentTenantId: string | null = null;
  private cache: Map<string, LicenseCache> = new Map();
  private defaultTtl = 5 * 60 * 1000; // 5 Minuten

  constructor() {
    // Setup Event-Listener für Module-Registry
    this.setupEventListeners();
  }

  /**
   * Setup Event-Listener
   */
  private setupEventListeners(): void {
    // Höre auf Module-Aktivierungs-Versuche und prüfe Lizenz
    eventBus.subscribe(ModuleEvents.MODULE_ENABLED, (event) => {
      const { moduleId } = event.payload;
      this.validateModuleAccess(moduleId as ModuleId);
    });
  }

  /**
   * Setzt den aktuellen Tenant
   */
  setCurrentTenant(tenantId: string): void {
    if (this.currentTenantId !== tenantId) {
      this.currentTenantId = tenantId;
      // Cache leeren bei Tenant-Wechsel
      this.cache.clear();
    }
  }

  /**
   * Holt die Lizenz für einen Tenant
   */
  async getTenantLicense(tenantId?: string): Promise<TenantLicense | null> {
    const targetTenantId = tenantId || this.currentTenantId;
    
    if (!targetTenantId) {
      console.warn('[LicenseManager] Kein Tenant gesetzt');
      return null;
    }

    // Cache prüfen
    const cached = this.cache.get(targetTenantId);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.license;
    }

    try {
      // Hole aus DB
      const dbLicense = await prisma.tenantLicense.findUnique({
        where: { tenantId: targetTenantId },
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!dbLicense) {
        // Keine Lizenz gefunden - nutze Default (Free-Tier)
        const defaultLicense = this.createDefaultLicense(targetTenantId, 'free');
        this.cacheLicense(targetTenantId, defaultLicense);
        return defaultLicense;
      }

      const tenantLicense = this.mapDbToLicense(dbLicense);
      this.cacheLicense(targetTenantId, tenantLicense);
      
      return tenantLicense;
    } catch (error) {
      console.error('[LicenseManager] Fehler beim Laden der Lizenz:', error);
      return null;
    }
  }

  /**
   * Prüft ob ein Modul für den Tenant lizenziert ist
   */
  async isModuleLicensed(moduleId: ModuleId, tenantId?: string): Promise<boolean> {
    // Core-Modul ist immer erlaubt
    if (moduleId === 'core') return true;

    const license = await this.getTenantLicense(tenantId);
    if (!license) return false;

    // Prüfe ob Modul in Lizenz enthalten
    const moduleLicense = license.modules.find(m => m.moduleId === moduleId);
    if (!moduleLicense || !moduleLicense.enabled) return false;

    // Prüfe Ablaufdatum
    if (moduleLicense.expiresAt && new Date() > moduleLicense.expiresAt) {
      return false;
    }

    // Prüfe Trial-Ende
    if (moduleLicense.trial && moduleLicense.trialEndsAt && 
        new Date() > moduleLicense.trialEndsAt) {
      return false;
    }

    return true;
  }

  /**
   * Prüft ob ein Feature verfügbar ist
   */
  async isFeatureEnabled(feature: string, tenantId?: string): Promise<boolean> {
    const license = await this.getTenantLicense(tenantId);
    if (!license) return false;

    const entitlement = license.features.find(f => f.feature === feature);
    return entitlement?.enabled ?? false;
  }

  /**
   * Prüft ob ein Limit überschritten wurde
   */
  async checkLimit(
    limitType: keyof LicenseLimits,
    currentValue: number,
    tenantId?: string
  ): Promise<{ allowed: boolean; limit: number; remaining: number }> {
    const license = await this.getTenantLicense(tenantId);
    if (!license) {
      return { allowed: false, limit: 0, remaining: 0 };
    }

    const limit = license.limits[limitType];
    
    // -1 bedeutet unbegrenzt
    if (limit === -1) {
      return { allowed: true, limit: -1, remaining: Infinity };
    }

    const remaining = limit - currentValue;
    return {
      allowed: currentValue < limit,
      limit,
      remaining: Math.max(0, remaining),
    };
  }

  /**
   * Aktiviert ein Modul für einen Tenant
   */
  async enableModule(
    moduleId: ModuleId,
    options: { 
      trial?: boolean; 
      trialDays?: number;
      expiresAt?: Date;
      maxUsers?: number;
    } = {},
    tenantId?: string
  ): Promise<boolean> {
    const targetTenantId = tenantId || this.currentTenantId;
    if (!targetTenantId) return false;

    try {
      const license = await this.getTenantLicense(targetTenantId);
      if (!license) return false;

      const moduleLicense: ModuleLicense = {
        moduleId,
        enabled: true,
        trial: options.trial ?? false,
        trialEndsAt: options.trialDays 
          ? new Date(Date.now() + options.trialDays * 24 * 60 * 60 * 1000)
          : undefined,
        expiresAt: options.expiresAt,
        maxUsers: options.maxUsers,
      };

      // Aktualisiere Module-Liste
      const existingIndex = license.modules.findIndex(m => m.moduleId === moduleId);
      if (existingIndex >= 0) {
        license.modules[existingIndex] = moduleLicense;
      } else {
        license.modules.push(moduleLicense);
      }

      // Speichere in DB
      await this.saveLicense(targetTenantId, license);

      // Cache invalidieren
      this.invalidateCache(targetTenantId);

      // Aktiviere im ModuleRegistry
      await moduleRegistry.activate(moduleId);

      eventBus.emit(ModuleEvents.LICENSE_UPDATED, {
        tenantId: targetTenantId,
        moduleId,
        action: 'enabled',
      }, 'LicenseManager');

      return true;
    } catch (error) {
      console.error(`[LicenseManager] Fehler bei Modul-Aktivierung "${moduleId}":`, error);
      return false;
    }
  }

  /**
   * Deaktiviert ein Modul für einen Tenant
   */
  async disableModule(moduleId: ModuleId, tenantId?: string): Promise<boolean> {
    const targetTenantId = tenantId || this.currentTenantId;
    if (!targetTenantId) return false;

    try {
      const license = await this.getTenantLicense(targetTenantId);
      if (!license) return false;

      // Finde und deaktiviere Modul
      const moduleLicense = license.modules.find(m => m.moduleId === moduleId);
      if (moduleLicense) {
        moduleLicense.enabled = false;
        await this.saveLicense(targetTenantId, license);

        // Deaktiviere im Registry
        moduleRegistry.deactivate(moduleId);

        this.invalidateCache(targetTenantId);

        eventBus.emit(ModuleEvents.LICENSE_UPDATED, {
          tenantId: targetTenantId,
          moduleId,
          action: 'disabled',
        }, 'LicenseManager');
      }

      return true;
    } catch (error) {
      console.error(`[LicenseManager] Fehler bei Modul-Deaktivierung "${moduleId}":`, error);
      return false;
    }
  }

  /**
   * Erstellet eine neue Lizenz
   */
  async createLicense(
    tenantId: string,
    tier: SubscriptionTier,
    options: {
      modules?: ModuleId[];
      customLimits?: Partial<LicenseLimits>;
      contractEndDate?: Date;
    } = {}
  ): Promise<TenantLicense | null> {
    try {
      const modules = options.modules || TIER_MODULES[tier];
      const limits = tier === 'custom' 
        ? { ...TIER_LIMITS.enterprise, ...options.customLimits }
        : TIER_LIMITS[tier];

      const tenantLicense: TenantLicense = {
        id: crypto.randomUUID(),
        tenantId,
        tenantName: '', // Wird aus DB geladen
        subscriptionTier: tier,
        status: 'active',
        modules: modules.map(m => ({
          moduleId: m,
          enabled: true,
        })),
        features: this.getDefaultFeatures(tier),
        limits: limits as LicenseLimits,
        contractStartDate: new Date(),
        contractEndDate: options.contractEndDate,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastCheckedAt: new Date(),
      };

      await this.saveLicense(tenantId, tenantLicense);
      return tenantLicense;
    } catch (error) {
      console.error('[LicenseManager] Fehler beim Erstellen der Lizenz:', error);
      return null;
    }
  }

  /**
   * Prüft und aktualisiert den Lizenz-Status
   */
  async checkLicenseStatus(tenantId?: string): Promise<{
    status: LicenseStatus;
    expiresAt?: Date;
    warnings: string[];
  }> {
    const targetTenantId = tenantId || this.currentTenantId;
    const warnings: string[] = [];

    const license = await this.getTenantLicense(targetTenantId);
    if (!license) {
      return { status: 'expired', warnings: ['Keine Lizenz gefunden'] };
    }

    // Prüfe Vertragsende
    if (license.contractEndDate && new Date() > license.contractEndDate) {
      await this.updateLicenseStatus(targetTenantId, 'expired');
      return { status: 'expired', warnings: ['Vertrag abgelaufen'] };
    }

    // Prüfe ablaufende Module
    const expiringModules: string[] = [];
    for (const mod of license.modules) {
      if (mod.trial && mod.trialEndsAt) {
        const daysLeft = Math.ceil(
          (mod.trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        if (daysLeft <= 7 && daysLeft > 0) {
          expiringModules.push(`${mod.moduleId} (${daysLeft} Tage)`);
        }
      }
    }

    if (expiringModules.length > 0) {
      warnings.push(`Ablaufende Trials: ${expiringModules.join(', ')}`);
    }

    return {
      status: license.status,
      expiresAt: license.contractEndDate,
      warnings,
    };
  }

  /**
   * Validierungs-Helper für Module-Aktivierung
   */
  private async validateModuleAccess(moduleId: ModuleId): Promise<boolean> {
    const isAllowed = await this.isModuleLicensed(moduleId);
    
    if (!isAllowed) {
      console.warn(`[LicenseManager] Modul "${moduleId}" nicht lizenziert`);
      eventBus.emit(ModuleEvents.MODULE_ERROR, {
        moduleId,
        error: 'Modul nicht lizenziert',
        source: 'license',
      }, 'LicenseManager');
    }

    return isAllowed;
  }

  /**
   * Speichert Lizenz in DB
   */
  private async saveLicense(tenantId: string, license: TenantLicense): Promise<void> {
    try {
      await prisma.tenantLicense.upsert({
        where: { tenantId },
        create: {
          tenantId,
          subscriptionTier: license.subscriptionTier,
          status: license.status,
          modules: license.modules as unknown as Record<string, unknown>[],
          features: license.features as unknown as Record<string, unknown>[],
          limits: license.limits as unknown as Record<string, unknown>,
          contractStartDate: license.contractStartDate,
          contractEndDate: license.contractEndDate,
        },
        update: {
          subscriptionTier: license.subscriptionTier,
          status: license.status,
          modules: license.modules as unknown as Record<string, unknown>[],
          features: license.features as unknown as Record<string, unknown>[],
          limits: license.limits as unknown as Record<string, unknown>,
          contractEndDate: license.contractEndDate,
          lastCheckedAt: new Date(),
        },
      });
    } catch (error) {
      console.error('[LicenseManager] DB-Fehler:', error);
      throw error;
    }
  }

  /**
   * Aktualisiert Lizenz-Status
   */
  private async updateLicenseStatus(
    tenantId: string, 
    status: LicenseStatus
  ): Promise<void> {
    await prisma.tenantLicense.update({
      where: { tenantId },
      data: { status },
    });
  }

  /**
   * Mappt DB-Daten auf TenantLicense Interface
   */
  private mapDbToLicense(dbLicense: any): TenantLicense {
    return {
      id: dbLicense.id,
      tenantId: dbLicense.tenantId,
      tenantName: dbLicense.tenant?.name || '',
      subscriptionTier: dbLicense.subscriptionTier as SubscriptionTier,
      status: dbLicense.status as LicenseStatus,
      modules: (dbLicense.modules || []) as ModuleLicense[],
      features: (dbLicense.features || []) as FeatureEntitlement[],
      limits: (dbLicense.limits || {}) as LicenseLimits,
      contractStartDate: dbLicense.contractStartDate,
      contractEndDate: dbLicense.contractEndDate,
      billingInterval: dbLicense.billingInterval,
      nextBillingDate: dbLicense.nextBillingDate,
      createdAt: dbLicense.createdAt,
      updatedAt: dbLicense.updatedAt,
      lastCheckedAt: dbLicense.lastCheckedAt,
    };
  }

  /**
   * Erstellet eine Standard-Lizenz
   */
  private createDefaultLicense(tenantId: string, tier: SubscriptionTier): TenantLicense {
    return {
      id: 'default',
      tenantId,
      tenantName: 'Default',
      subscriptionTier: tier,
      status: 'active',
      modules: TIER_MODULES[tier].map(m => ({
        moduleId: m,
        enabled: true,
      })),
      features: this.getDefaultFeatures(tier),
      limits: TIER_LIMITS[tier] as LicenseLimits,
      contractStartDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      lastCheckedAt: new Date(),
    };
  }

  /**
   * Gibt Default-Features für ein Tier zurück
   */
  private getDefaultFeatures(tier: SubscriptionTier): FeatureEntitlement[] {
    const features: FeatureEntitlement[] = [];
    
    const allFeatures = [
      'employees.create',
      'employees.bulk',
      'documents.upload',
      'documents.ocr',
      'documents.export',
      'clothing.order',
      'clothing.woocommerce',
      'vacation.request',
      'vacation.approval',
      'dailyplan.schedule',
      'dailyplan.assignment',
      'notifications.email',
      'notifications.push',
      'audit.log',
      'templates.custom',
      'reports.basic',
      'reports.advanced',
      'api.access',
    ];

    for (const feature of allFeatures) {
      features.push({
        feature,
        enabled: tier !== 'free' || feature.startsWith('employees') || feature.startsWith('documents'),
        unlimited: tier === 'enterprise',
      });
    }

    return features;
  }

  /**
   * Cacht eine Lizenz
   */
  private cacheLicense(tenantId: string, license: TenantLicense | null): void {
    this.cache.set(tenantId, {
      license,
      timestamp: Date.now(),
      ttl: this.defaultTtl,
    });
  }

  /**
   * Invalidiert den Cache für einen Tenant
   */
  private invalidateCache(tenantId: string): void {
    this.cache.delete(tenantId);
  }

  /**
   * Leert den gesamten Cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Singleton-Instanz
export const licenseManager = new LicenseManager();

// Konvenienz-Exports
export const isModuleLicensed = (moduleId: ModuleId, tenantId?: string) => 
  licenseManager.isModuleLicensed(moduleId, tenantId);

export const isFeatureEnabled = (feature: string, tenantId?: string) => 
  licenseManager.isFeatureEnabled(feature, tenantId);
