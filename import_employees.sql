-- Mitarbeiter Import aus Backup mit Schema-Mapping
-- Altes Schema -> Neues Schema

-- Lösche bestehende Mitarbeiter (außer Seed-Daten wurden schon gelöscht)
DELETE FROM employees WHERE "employeeNumber" LIKE 'EMP-000%';

-- Temp-Tabelle für altes Schema
CREATE TEMP TABLE employees_old AS
SELECT 
  ''::text as id,
  ''::text as "employeeNumber",
  ''::text as "firstName",
  ''::text as "lastName",
  NULL::timestamp as "dateOfBirth",
  NULL::text as email,
  NULL::text as phone,
  NULL::text as "departmentId",
  NULL::text as position,
  NULL::timestamp as "startDate",
  0::numeric as "clothingBudget",
  0::numeric as "remainingBudget",
  NULL::timestamp as "lastBudgetReset",
  NULL::text as street,
  NULL::text as "zipCode",
  NULL::text as city,
  NULL::text as "socialSecurityNumber",
  NULL::text as "taxId",
  NULL::text as "healthInsurance",
  false::boolean as "isFixedTerm",
  NULL::timestamp as "fixedTermEndDate",
  NULL::timestamp as "probationEndDate",
  NULL::numeric as "hourlyWage",
  NULL::numeric as "overtariffSupplement",
  NULL::text as "payGradeId",
  NULL::integer as "vacationDays",
  NULL::text as "keyNumber",
  NULL::text as "chipNumber",
  NULL::text as "driversLicenseClass",
  false::boolean as "forkliftLicense",
  NULL::text as "userId",
  now() as "createdAt",
  now() as "updatedAt";

-- Lade die Daten aus dem Backup (manual inserts)
