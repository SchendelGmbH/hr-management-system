import { PrismaClient, FieldType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // ============================================================================
  // 1. CREATE ROLES
  // ============================================================================
  console.log('Creating roles...');

  const roles = [
    { name: 'ADMIN', description: 'Volle Administrationsrechte' },
    { name: 'MITARBEITER', description: 'Standard-Mitarbeiter' },
    { name: 'GEWERBLICH', description: 'Gewerbliche Mitarbeiter' },
    { name: 'PERSONALVERWALTUNG', description: 'Personalverwaltung' },
  ];

  const createdRoles: Record<string, any> = {};
  for (const r of roles) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description },
      create: { name: r.name, description: r.description },
    });
    createdRoles[r.name] = role;
    console.log(`✓ Role created: ${role.name}`);
  }

  // ============================================================================
  // 2. CREATE ADMIN USER (linked to ADMIN role)
  // ============================================================================
  console.log('\nCreating admin user...');

  const adminPassword = await bcrypt.hash('Admin123!', 10);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { roleId: createdRoles['ADMIN'].id },
    create: {
      username: 'admin',
      email: 'admin@hr-system.local',
      passwordHash: adminPassword,
      roleId: createdRoles['ADMIN'].id,
      isActive: true,
    },
  });

  console.log(`✓ Admin user created: ${admin.username} (${admin.email}) → ADMIN`);

  // ============================================================================
  // 3. CREATE DEPARTMENTS
  // ============================================================================
  console.log('\nCreating departments...');

  const departments = [
    { name: 'IT', description: 'Informationstechnologie' },
    { name: 'HR', description: 'Human Resources / Personalwesen' },
    { name: 'Vertrieb', description: 'Vertrieb und Marketing' },
    { name: 'Produktion', description: 'Produktion und Fertigung' },
    { name: 'Verwaltung', description: 'Verwaltung und Buchhaltung' },
  ];

  const createdDepartments: any[] = [];

  for (const dept of departments) {
    const department = await prisma.department.upsert({
      where: { name: dept.name },
      update: {},
      create: dept,
    });
    createdDepartments.push(department);
    console.log(`✓ Department created: ${department.name}`);
  }

  // ============================================================================
  // 4. CREATE CATEGORIES
  // ============================================================================
  console.log('\nCreating categories...');

  const categories = [
    { name: 'Personalausweis', description: 'Personalausweis des Mitarbeiters', color: '#3B82F6' },
    { name: 'Reisepass', description: 'Reisepass des Mitarbeiters', color: '#8B5CF6' },
    { name: 'Führerschein', description: 'Führerschein', color: '#10B981' },
    { name: 'Zertifikate', description: 'Berufliche Zertifikate und Qualifikationen', color: '#F59E0B' },
    { name: 'Arbeitsvertrag', description: 'Arbeitsvertrag', color: '#EF4444' },
    { name: 'Zeugnisse', description: 'Arbeitszeugnisse', color: '#6366F1' },
    { name: 'Gesundheitszeugnis', description: 'Gesundheitszeugnis', color: '#EC4899' },
    { name: 'Sonstige', description: 'Sonstige Dokumente', color: '#6B7280' },
  ];

  for (const cat of categories) {
    const category = await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
    console.log(`✓ Category created: ${category.name}`);
  }

  // ============================================================================
  // 5. CREATE CLOTHING ITEMS
  // ============================================================================
  console.log('\nCreating clothing items...');

  const clothingItems = [
    { name: 'Arbeitshemd Blau', category: 'Hemden', basePrice: 29.99, availableSizes: ['S', 'M', 'L', 'XL', 'XXL'], isActive: true },
    { name: 'Arbeitshose Grau', category: 'Hosen', basePrice: 49.99, availableSizes: ['46', '48', '50', '52', '54', '56'], isActive: true },
    { name: 'Sicherheitsschuhe S3', category: 'Schuhe', basePrice: 89.99, availableSizes: ['39', '40', '41', '42', '43', '44', '45', '46'], isActive: true },
    { name: 'Arbeitshandschuhe', category: 'Handschuhe', basePrice: 12.99, availableSizes: ['7', '8', '9', '10', '11'], isActive: true },
    { name: 'Arbeitsjacke Winter', category: 'Jacken', basePrice: 79.99, availableSizes: ['M', 'L', 'XL', 'XXL', '3XL'], isActive: true },
  ];

  for (const item of clothingItems) {
    const clothingItem = await prisma.clothingItem.create({ data: item });
    console.log(`✓ Clothing item created: ${clothingItem.name} (€${clothingItem.basePrice})`);
  }

  // ============================================================================
  // 6. CREATE TEST EMPLOYEES
  // ============================================================================
  console.log('\nCreating test employees...');

  const testEmployees = [
    { firstName: 'Max', lastName: 'Mustermann', email: 'max.mustermann@company.com', phone: '+49 123 456789', departmentId: createdDepartments[0].id, position: 'Software Developer', startDate: new Date('2020-01-15'), dateOfBirth: new Date('1990-05-20'), clothingBudget: 500, remainingBudget: 500 },
    { firstName: 'Anna', lastName: 'Schmidt', email: 'anna.schmidt@company.com', phone: '+49 123 456790', departmentId: createdDepartments[1].id, position: 'HR Manager', startDate: new Date('2018-03-01'), dateOfBirth: new Date('1985-08-12'), clothingBudget: 400, remainingBudget: 400 },
    { firstName: 'Thomas', lastName: 'Weber', email: 'thomas.weber@company.com', phone: '+49 123 456791', departmentId: createdDepartments[3].id, position: 'Produktionsleiter', startDate: new Date('2015-06-10'), dateOfBirth: new Date('1980-11-30'), clothingBudget: 600, remainingBudget: 600 },
    { firstName: 'Julia', lastName: 'Becker', email: 'julia.becker@company.com', phone: '+49 123 456792', departmentId: createdDepartments[2].id, position: 'Vertriebsmitarbeiter', startDate: new Date('2021-09-01'), dateOfBirth: new Date('1995-03-15'), clothingBudget: 350, remainingBudget: 350 },
    { firstName: 'Michael', lastName: 'Fischer', email: 'michael.fischer@company.com', phone: '+49 123 456793', departmentId: createdDepartments[4].id, position: 'Buchhalter', startDate: new Date('2019-11-20'), dateOfBirth: new Date('1988-07-08'), clothingBudget: 300, remainingBudget: 300 },
  ];

  let employeeCounter = 1;
  for (const empData of testEmployees) {
    const employee = await prisma.employee.create({
      data: { ...empData, employeeNumber: `EMP-${employeeCounter.toString().padStart(5, '0')}` },
    });
    await prisma.employeeSize.create({
      data: { employeeId: employee.id, shirtSize: 'L', pantsSize: '50', shoeSize: '42', gloveSize: '9', jacketSize: 'L' },
    });
    console.log(`✓ Employee created: ${employee.employeeNumber} - ${employee.firstName} ${employee.lastName}`);
    employeeCounter++;
  }

  // ============================================================================
  // 7. CREATE CUSTOM FIELD DEFINITIONS
  // ============================================================================
  console.log('\nCreating custom field definitions...');

  const customFields = [
    { fieldName: 'Führerscheinnummer', fieldType: FieldType.TEXT, isRequired: false, sortOrder: 1 },
    { fieldName: 'Gabelstapler-Zertifikat', fieldType: FieldType.BOOLEAN, isRequired: false, sortOrder: 2 },
    { fieldName: 'Notfallkontakt Name', fieldType: FieldType.TEXT, isRequired: false, sortOrder: 3 },
    { fieldName: 'Notfallkontakt Telefon', fieldType: FieldType.TEXT, isRequired: false, sortOrder: 4 },
    { fieldName: 'Zertifikat-Level', fieldType: FieldType.SELECT, isRequired: false, sortOrder: 5, selectOptions: ['Bronze', 'Silber', 'Gold'] },
    { fieldName: 'woocommerce_customer_id', fieldType: FieldType.TEXT, isRequired: false, sortOrder: 100 },
  ];

  for (const field of customFields) {
    const customField = await prisma.customFieldDefinition.upsert({
      where: { fieldName: field.fieldName },
      update: {},
      create: field,
    });
    console.log(`✓ Custom field created: ${customField.fieldName} (${customField.fieldType})`);
  }

  // ============================================================================
  // 8. CREATE DEFAULT ROLE PERMISSIONS (using FK roleId)
  // ============================================================================
  console.log('\nCreating default role permissions...');

  const permissions: Array<{ roleId: string; module: string; action: string; access: string }> = [];

  // ADMIN — Alles write
  const adminRoleId = createdRoles['ADMIN'].id;
  const adminPerms = [
    ['dashboard', 'view'], ['employees', 'view'], ['employees', 'details'], ['employees', 'create'], ['employees', 'edit'], ['employees', 'delete'], ['employees', 'portal'], ['employees', 'password'], ['employees', 'clothing'], ['employees', 'qualifications'],
    ['vacations', 'view_all'], ['vacations', 'view_own'], ['vacations', 'request'], ['vacations', 'approve'], ['vacations', 'edit'], ['vacations', 'delete'],
    ['qualifications', 'view'], ['qualifications', 'manage_types'], ['qualifications', 'create'], ['qualifications', 'edit'], ['qualifications', 'delete'],
    ['clothing', 'view_items'], ['clothing', 'view_orders'], ['clothing', 'create_order'], ['clothing', 'approve_order'], ['clothing', 'delete_order'], ['clothing', 'create_item'], ['clothing', 'edit_item'], ['clothing', 'delete_item'],
    ['documents', 'view'], ['documents', 'upload'], ['documents', 'download'], ['documents', 'edit'], ['documents', 'delete'], ['documents', 'templates'], ['documents', 'categories'],
    ['vehicles', 'view'], ['vehicles', 'create'], ['vehicles', 'edit'], ['vehicles', 'delete'],
    ['daily_plans', 'view'], ['daily_plans', 'edit'], ['daily_plans', 'manage_sites'],
    ['calendar', 'view'], ['calendar', 'add_absence'], ['calendar', 'edit_absence'], ['calendar', 'delete_absence'],
    ['settings', 'audit_log'], ['settings', 'roles'], ['settings', 'permissions'],
  ];
  for (const [mod, act] of adminPerms) {
    permissions.push({ roleId: adminRoleId, module: mod, action: act, access: 'write' });
  }

  // MITARBEITER — Vollzugriff (Standard)
  const mitarbeiterRoleId = createdRoles['MITARBEITER'].id;
  const mitarbeiterPerms = [
    ['dashboard', 'view'], ['employees', 'view'], ['employees', 'details'], ['employees', 'clothing'], ['employees', 'qualifications'],
    ['vacations', 'view_own'], ['vacations', 'request'],
    ['calendar', 'view'], ['calendar', 'add_absence'],
    ['daily_plans', 'view'],
    ['documents', 'view'], ['documents', 'upload'], ['documents', 'download'],
    ['qualifications', 'view'],
    ['clothing', 'view_items'], ['clothing', 'view_orders'], ['clothing', 'create_order'],
  ];
  for (const [mod, act] of mitarbeiterPerms) {
    permissions.push({ roleId: mitarbeiterRoleId, module: mod, action: act, access: 'read' });
  }
  // write-perms
  const mitarbeiterWrite = [
    ['vacations', 'request'], ['calendar', 'add_absence'], ['clothing', 'create_order'], ['daily_plans', 'view'],
  ];
  for (const [mod, act] of mitarbeiterWrite) {
    const p = permissions.find(p => p.roleId === mitarbeiterRoleId && p.module === mod && p.action === act);
    if (p) p.access = 'write';
  }

  // GEWERBLICH
  const gewerblichRoleId = createdRoles['GEWERBLICH'].id;
  const gewerblichPerms = [
    ['dashboard', 'view', 'read'], ['calendar', 'view', 'read'], ['calendar', 'add_absence', 'write'], ['calendar', 'delete_absence', 'write'],
    ['vacations', 'view_own', 'read'], ['vacations', 'request', 'write'],
    ['daily_plans', 'view', 'read'], ['daily_plans', 'edit', 'write'],
    ['vehicles', 'view', 'read'],
  ];
  for (const [mod, act, acc] of gewerblichPerms) {
    permissions.push({ roleId: gewerblichRoleId, module: mod, action: act, access: acc });
  }

  // PERSONALVERWALTUNG
  const personalverwaltungRoleId = createdRoles['PERSONALVERWALTUNG'].id;
  const pvPerms = [
    ['dashboard', 'view', 'read'],
    ['employees', 'view', 'write'], ['employees', 'details', 'write'], ['employees', 'create', 'write'], ['employees', 'edit', 'write'], ['employees', 'portal', 'write'], ['employees', 'clothing', 'write'], ['employees', 'qualifications', 'write'],
    ['vacations', 'view_all', 'write'], ['vacations', 'view_own', 'read'], ['vacations', 'approve', 'write'], ['vacations', 'request', 'read'], ['vacations', 'edit', 'write'],
    ['documents', 'view', 'write'], ['documents', 'upload', 'write'], ['documents', 'download', 'write'], ['documents', 'edit', 'write'], ['documents', 'categories', 'write'],
    ['clothing', 'view_items', 'write'], ['clothing', 'view_orders', 'write'], ['clothing', 'create_order', 'write'], ['clothing', 'approve_order', 'write'],
    ['calendar', 'view', 'write'], ['calendar', 'add_absence', 'write'], ['calendar', 'edit_absence', 'write'], ['calendar', 'delete_absence', 'write'],
    ['qualifications', 'view', 'write'], ['qualifications', 'manage_types', 'write'], ['qualifications', 'create', 'write'], ['qualifications', 'edit', 'write'], ['qualifications', 'delete', 'write'],
    ['daily_plans', 'view', 'read'],
  ];
  for (const [mod, act, acc] of pvPerms) {
    permissions.push({ roleId: personalverwaltungRoleId, module: mod, action: act, access: acc });
  }

  for (const perm of permissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_module_action: { roleId: perm.roleId, module: perm.module, action: perm.action } },
      update: { access: perm.access },
      create: perm,
    });
  }

  console.log(`✓ Role permissions created for ADMIN, MITARBEITER, GEWERBLICH, PERSONALVERWALTUNG`);

  console.log('\n✅ Database seed completed successfully!');
  console.log('\n📝 Login credentials:');
  console.log('   Username: admin');
  console.log('   Password: Admin123!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });