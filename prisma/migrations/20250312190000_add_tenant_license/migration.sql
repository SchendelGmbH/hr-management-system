-- =============================================================================
-- Tenant-License-System für modulare Lizenzierung
-- =============================================================================

-- Subscription-Tiers Enum
CREATE TYPE "SubscriptionTier" AS ENUM ('free', 'starter', 'professional', 'enterprise', 'custom');

-- License-Status Enum
CREATE TYPE "LicenseStatus" AS ENUM ('active', 'trial', 'expired', 'suspended', 'cancelled');

-- Tenant-Tabelle (falls noch nicht vorhanden)
CREATE TABLE IF NOT EXISTS "tenants" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "name" TEXT NOT NULL,
    "slug" TEXT UNIQUE NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- TenantLicense-Tabelle für Lizenz-Daten
CREATE TABLE "tenant_licenses" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "tenantId" TEXT NOT NULL UNIQUE,
    "subscriptionTier" "SubscriptionTier" NOT NULL DEFAULT 'free',
    "status" "LicenseStatus" NOT NULL DEFAULT 'active',
    
    -- Module-Konfiguration als JSON
    "modules" JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Features als JSON
    "features" JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Limits als JSON
    "limits" JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Vertragsdaten
    "contractStartDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contractEndDate" TIMESTAMP(3),
    "billingInterval" TEXT,
    "nextBillingDate" TIMESTAMP(3),
    
    -- Metadata
    "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "tenant_licenses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes
CREATE INDEX "tenant_licenses_status_idx" ON "tenant_licenses"("status");
CREATE INDEX "tenant_licenses_tier_idx" ON "tenant_licenses"("subscriptionTier");
CREATE INDEX "tenant_licenses_endDate_idx" ON "tenant_licenses"("contractEndDate");

-- Function for updatedAt
CREATE OR REPLACE FUNCTION update_tenant_licenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
CREATE TRIGGER update_tenant_licenses_updated_at_trigger
    BEFORE UPDATE ON "tenant_licenses"
    FOR EACH ROW
    EXECUTE FUNCTION update_tenant_licenses_updated_at();
