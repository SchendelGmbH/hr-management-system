import { PrismaClient, FieldType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // ============================================================================
  // 1. CREATE ADMIN USER
  // ============================================================================
  console.log('Creating admin user...');

  const adminPassword = await bcrypt.hash('Admin123!', 10);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@hr-system.local',
      passwordHash: adminPassword,
      isActive: true,
    },
  });

  console.log(`✓ Admin user created: ${admin.username} (${admin.email})`);

  // ============================================================================
  // 2. CREATE DEPARTMENTS
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
  // 3. CREATE DOCUMENT TYPES
  // ============================================================================
  console.log('\nCreating document types...');

  const documentTypes = [
    { name: 'Personalausweis', description: 'Personalausweis des Mitarbeiters', isDefault: true },
    { name: 'Reisepass', description: 'Reisepass des Mitarbeiters', isDefault: true },
    { name: 'Führerschein', description: 'Führerschein', isDefault: true },
    { name: 'Zertifikate', description: 'Berufliche Zertifikate und Qualifikationen', isDefault: true },
    { name: 'Arbeitsvertrag', description: 'Arbeitsvertrag', isDefault: true },
    { name: 'Zeugnisse', description: 'Arbeitszeugnisse', isDefault: true },
    { name: 'Gesundheitszeugnis', description: 'Gesundheitszeugnis', isDefault: true },
    { name: 'Sonstige', description: 'Sonstige Dokumente', isDefault: false },
  ];

  for (const docType of documentTypes) {
    const documentType = await prisma.documentType.upsert({
      where: { name: docType.name },
      update: {},
      create: docType,
    });
    console.log(`✓ Document type created: ${documentType.name}`);
  }

  // ============================================================================
  // 4. CREATE CLOTHING ITEMS
  // ============================================================================
  console.log('\nCreating clothing items...');

  const clothingItems = [
    {
      name: 'Arbeitshemd Blau',
      category: 'Hemden',
      basePrice: 29.99,
      availableSizes: ['S', 'M', 'L', 'XL', 'XXL'],
      isActive: true,
    },
    {
      name: 'Arbeitshose Grau',
      category: 'Hosen',
      basePrice: 49.99,
      availableSizes: ['46', '48', '50', '52', '54', '56'],
      isActive: true,
    },
    {
      name: 'Sicherheitsschuhe S3',
      category: 'Schuhe',
      basePrice: 89.99,
      availableSizes: ['39', '40', '41', '42', '43', '44', '45', '46'],
      isActive: true,
    },
    {
      name: 'Arbeitshandschuhe',
      category: 'Handschuhe',
      basePrice: 12.99,
      availableSizes: ['7', '8', '9', '10', '11'],
      isActive: true,
    },
    {
      name: 'Arbeitsjacke Winter',
      category: 'Jacken',
      basePrice: 79.99,
      availableSizes: ['M', 'L', 'XL', 'XXL', '3XL'],
      isActive: true,
    },
  ];

  for (const item of clothingItems) {
    const clothingItem = await prisma.clothingItem.create({
      data: item,
    });
    console.log(`✓ Clothing item created: ${clothingItem.name} (€${clothingItem.basePrice})`);
  }

  // ============================================================================
  // 5. CREATE TEST EMPLOYEES
  // ============================================================================
  console.log('\nCreating test employees...');

  const testEmployees = [
    {
      firstName: 'Max',
      lastName: 'Mustermann',
      email: 'max.mustermann@company.com',
      phone: '+49 123 456789',
      departmentId: createdDepartments[0].id, // IT
      position: 'Software Developer',
      startDate: new Date('2020-01-15'),
      dateOfBirth: new Date('1990-05-20'),
      clothingBudget: 500,
      remainingBudget: 500,
    },
    {
      firstName: 'Anna',
      lastName: 'Schmidt',
      email: 'anna.schmidt@company.com',
      phone: '+49 123 456790',
      departmentId: createdDepartments[1].id, // HR
      position: 'HR Manager',
      startDate: new Date('2018-03-01'),
      dateOfBirth: new Date('1985-08-12'),
      clothingBudget: 400,
      remainingBudget: 400,
    },
    {
      firstName: 'Thomas',
      lastName: 'Weber',
      email: 'thomas.weber@company.com',
      phone: '+49 123 456791',
      departmentId: createdDepartments[3].id, // Produktion
      position: 'Produktionsleiter',
      startDate: new Date('2015-06-10'),
      dateOfBirth: new Date('1980-11-30'),
      clothingBudget: 600,
      remainingBudget: 600,
    },
    {
      firstName: 'Julia',
      lastName: 'Becker',
      email: 'julia.becker@company.com',
      phone: '+49 123 456792',
      departmentId: createdDepartments[2].id, // Vertrieb
      position: 'Vertriebsmitarbeiter',
      startDate: new Date('2021-09-01'),
      dateOfBirth: new Date('1995-03-15'),
      clothingBudget: 350,
      remainingBudget: 350,
    },
    {
      firstName: 'Michael',
      lastName: 'Fischer',
      email: 'michael.fischer@company.com',
      phone: '+49 123 456793',
      departmentId: createdDepartments[4].id, // Verwaltung
      position: 'Buchhalter',
      startDate: new Date('2019-11-20'),
      dateOfBirth: new Date('1988-07-08'),
      clothingBudget: 300,
      remainingBudget: 300,
    },
  ];

  let employeeCounter = 1;

  for (const empData of testEmployees) {
    const employee = await prisma.employee.create({
      data: {
        ...empData,
        employeeNumber: `EMP-${employeeCounter.toString().padStart(5, '0')}`,
      },
    });

    // Create employee sizes
    await prisma.employeeSize.create({
      data: {
        employeeId: employee.id,
        shirtSize: 'L',
        pantsSize: '50',
        shoeSize: '42',
        gloveSize: '9',
        jacketSize: 'L',
      },
    });

    console.log(`✓ Employee created: ${employee.employeeNumber} - ${employee.firstName} ${employee.lastName}`);
    employeeCounter++;
  }

  // ============================================================================
  // 6. CREATE CUSTOM FIELD DEFINITIONS
  // ============================================================================
  console.log('\nCreating custom field definitions...');

  const customFields = [
    {
      fieldName: 'Führerscheinnummer',
      fieldType: FieldType.TEXT,
      isRequired: false,
      sortOrder: 1,
    },
    {
      fieldName: 'Gabelstapler-Zertifikat',
      fieldType: FieldType.BOOLEAN,
      isRequired: false,
      sortOrder: 2,
    },
    {
      fieldName: 'Notfallkontakt Name',
      fieldType: FieldType.TEXT,
      isRequired: false,
      sortOrder: 3,
    },
    {
      fieldName: 'Notfallkontakt Telefon',
      fieldType: FieldType.TEXT,
      isRequired: false,
      sortOrder: 4,
    },
    {
      fieldName: 'Zertifikat-Level',
      fieldType: FieldType.SELECT,
      isRequired: false,
      sortOrder: 5,
      selectOptions: ['Bronze', 'Silber', 'Gold'],
    },
    {
      fieldName: 'woocommerce_customer_id',
      fieldType: FieldType.TEXT,
      isRequired: false,
      sortOrder: 100,
    },
  ];

  for (const field of customFields) {
    const customField = await prisma.customFieldDefinition.upsert({
      where: { fieldName: field.fieldName },
      update: {},
      create: field,
    });
    console.log(`✓ Custom field created: ${customField.fieldName} (${customField.fieldType})`);
  }

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
