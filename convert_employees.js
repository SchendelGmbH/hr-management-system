const fs = require('fs');

// Lese das Backup
const backup = fs.readFileSync('/tmp/hr_backup_fixed.sql', 'utf8');

// Finde alle INSERT INTO public.employees
const inserts = backup.match(/INSERT INTO public\.employees VALUES \([^)]+\);/g);

if (!insertes) {
  console.log('Keine INSERTs gefunden');
  process.exit(1);
}

console.log(`Gefunden: ${inserts.length} Mitarbeiter`);

// Schema-Mapping: Alte Position -> Neue Spalte
// Altes Schema hat 33 Felder, Neues hat 32 (andere Reihenfolge)
const newInserts = inserts.map((insert, index) => {
  // Extrahiere Werte
  const match = insert.match(/\((.*)\);/s);
  if (!match) return null;
  
  const values = match[1];
  
  // Parse CSV-ähnliche Werte (sehr vereinfacht)
  // Da es komplexe verschlüsselte Werte gibt, nutzen wir einen sichereren Ansatz
  
  // Extrahiere bekannte Felder mit Regex
  const fields = [];
  let depth = 0;
  let current = '';
  
  for (let i = 0; i < values.length; i++) {
    const char = values[i];
    if (char === "'") {
      // String-Verarbeitung
      let str = char;
      i++;
      while (i < values.length && values[i] !== "'") {
        if (values[i] === '\\' && i + 1 < values.length) {
          str += values[i] + values[i+1];
          i += 2;
        } else {
          str += values[i];
          i++;
        }
      }
      if (i < values.length) str += values[i];
      current += str;
    } else if (char === '(') {
      depth++;
      current += char;
    } else if (char === ')') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) fields.push(current.trim());
  
  console.log(`Mitarbeiter ${index + 1}: ${fields.length} Felder`);
  
  if (fields.length < 33) {
    console.log(`  WARNUNG: Erwartet 33 Felder, aber ${fields.length} gefunden`);
    return null;
  }
  
  // Mappe auf neues Schema
  const mapped = {
    id: fields[0],
    employeeNumber: fields[1],
    firstName: fields[2],
    lastName: fields[3],
    dateOfBirth: fields[4],
    email: fields[5],  // Verschlüsselt
    phone: fields[6],  // Verschlüsselt
    departmentId: fields[7],
    position: fields[8],
    startDate: fields[9],
    clothingBudget: fields[10],
    remainingBudget: fields[11],
    lastBudgetReset: fields[14],  // Index 14 in altem Schema
    street: fields[15],  // Verschlüsselt
    zipCode: fields[16],  // Verschlüsselt
    city: fields[25],  // War im alten Schema an Position 25
    socialSecurityNumber: fields[20],  // Verschlüsselt
    taxId: fields[24],  // Verschlüsselt
    healthInsurance: fields[26],  // Verschlüsselt
    isFixedTerm: fields[19],
    fixedTermEndDate: fields[23],
    probationEndDate: 'NULL',
    hourlyWage: fields[21],
    overtariffSupplement: 'NULL',
    payGradeId: 'NULL',
    vacationDays: fields[27],
    keyNumber: fields[28],  // War "keyNumber"
    chipNumber: fields[18],  // War "chipNumber"
    driversLicenseClass: fields[17],
    forkliftLicense: fields[22],
    userId: fields[32] || 'NULL',
    createdAt: fields[12],
    updatedAt: fields[13]
  };
  
  // Baue INSERT Statement
  const columns = Object.keys(mapped).join(', ');
  const values = Object.values(mapped).join(', ');
  
  return `INSERT INTO employees (${columns}) VALUES (${values});`;
}).filter(Boolean);

// Schreibe Output
const output = newInserts.join('\n');
fs.writeFileSync('/tmp/employees_converted.sql', output);
console.log(`\nKonvertiert: ${newInserts.length} Mitarbeiter`);
console.log('Output: /tmp/employees_converted.sql');
