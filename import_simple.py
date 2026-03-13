#!/usr/bin/env python3
"""Simple Employee Import - nur unverschlüsselte Basisdaten"""

import re
import subprocess

DB_URL = "postgresql://postgres:postgres@76.13.148.225:32770/hr-software"

def clean_string(s):
    """Bereinige String für SQL"""
    if s == 'NULL':
        return None
    return s.strip("'").replace("'", "''")

def main():
    print("=== Mitarbeiter Import (vereinfacht) ===\n")
    
    # Lösche alte Mitarbeiter
    print("1. Lösche bestehende Mitarbeiter...")
    subprocess.run(
        ['/home/linuxbrew/.linuxbrew/opt/postgresql@14/bin/psql', DB_URL, '-c', 
         "DELETE FROM employees WHERE \"employeeNumber\" LIKE 'EMP-%';"],
        capture_output=True
    )
    
    # Lese Backup
    with open('/tmp/hr_backup_fixed.sql', 'r') as f:
        content = f.read()
    
    # Finde alle Employee INSERTs
    pattern = r"INSERT INTO public\.employees VALUES \((.+?)\);"
    matches = re.findall(pattern, content, re.DOTALL)
    
    print(f"2. Gefunden: {len(matches)} Mitarbeiter im Backup\n")
    print("3. Importiere Mitarbeiter...\n")
    
    success = 0
    errors = 0
    
    for i, match in enumerate(matches):
        # Parse CSV-Werte
        values = []
        current = ""
        in_string = False
        
        for char in match:
            if char == "'":
                in_string = not in_string
                current += char
            elif char == ',' and not in_string:
                values.append(current.strip())
                current = ""
            else:
                current += char
        values.append(current.strip())
        
        if len(values) < 20:
            continue
        
        # Extrahiere unverschlüsselte Felder
        emp_id = clean_string(values[0])
        emp_num = clean_string(values[1])
        first_name = clean_string(values[2])
        last_name = clean_string(values[3])
        dob = values[4] if values[4] != 'NULL' else None
        dept_id = clean_string(values[7])
        position = clean_string(values[8])
        start_date = values[9] if values[9] != 'NULL' else None
        
        # Stundenlohn aus Feld 21 (index 21)
        hourly_wage = values[21] if len(values) > 21 and values[21] != 'NULL' else 'NULL'
        
        # Urlaubstage aus Feld 27
        vacation = values[27] if len(values) > 27 and values[27] != 'NULL' else '26'
        
        # Führerschein aus Feld 17
        drivers_lic = clean_string(values[17]) if len(values) > 17 else 'Nein'
        
        # Datum formatieren
        created_at = '2026-03-13 08:00:00'
        updated_at = '2026-03-13 08:00:00'
        
        # Baue SQL - nur sichere Felder
        sql_parts = [
            f"'{emp_id}'",  # id
            f"'{emp_num}'",  # employeeNumber
            f"'{first_name}'",  # firstName
            f"'{last_name}'",  # lastName
            f"'{dob}'" if dob else 'NULL',  # dateOfBirth
            'NULL',  # email
            'NULL',  # phone
            f"'{dept_id}'" if dept_id else 'NULL',  # departmentId
            f"'{position}'" if position else 'NULL',  # position
            f"'{start_date}'" if start_date else 'NULL',  # startDate
            '250.00',  # clothingBudget
            '250.00',  # remainingBudget
            'NULL',  # lastBudgetReset
            'NULL',  # street
            'NULL',  # zipCode
            'NULL',  # city
            'NULL',  # socialSecurityNumber
            'NULL',  # taxId
            'NULL',  # healthInsurance
            'false',  # isFixedTerm
            'NULL',  # fixedTermEndDate
            hourly_wage if hourly_wage != 'NULL' else 'NULL',  # hourlyWage
            vacation,  # vacationDays
            'NULL',  # keyNumber
            f"'{drivers_lic}'" if drivers_lic else "'Nein'",  # driversLicenseClass
            'false',  # forkliftLicense
            f"'{created_at}'",  # createdAt
            f"'{updated_at}'"  # updatedAt
        ]
        
        columns = [
            '"id"', '"employeeNumber"', '"firstName"', '"lastName"', '"dateOfBirth"',
            'email', 'phone', '"departmentId"', 'position', '"startDate"',
            '"clothingBudget"', '"remainingBudget"', '"lastBudgetReset"',
            'street', '"zipCode"', 'city', '"socialSecurityNumber"', '"taxId"',
            '"healthInsurance"', '"isFixedTerm"', '"fixedTermEndDate"',
            '"hourlyWage"', '"vacationDays"', '"keyNumber"', '"driversLicenseClass"',
            '"forkliftLicense"', '"createdAt"', '"updatedAt"'
        ]
        
        sql = f"INSERT INTO employees ({', '.join(columns)}) VALUES ({', '.join(sql_parts)});"
        
        result = subprocess.run(
            ['/home/linuxbrew/.linuxbrew/opt/postgresql@14/bin/psql', DB_URL, '-c', sql],
            capture_output=True, text=True
        )
        
        if result.returncode == 0:
            print(f"  {i+1:2d}. OK: {emp_num} - {first_name} {last_name}")
            success += 1
        else:
            err = result.stderr.strip()[:80] if result.stderr else 'Unknown'
            print(f"  {i+1:2d}. ERR: {emp_num} - {err}")
            errors += 1
    
    print(f"\n=== ERGEBNIS ===")
    print(f"Erfolgreich importiert: {success}")
    print(f"Fehler: {errors}")
    print(f"\nHinweis: Verschlüsselte Daten (Telefon, Adresse, Steuernummer)")
    print(f"müssen manuell in der App nachgetragen werden.")

if __name__ == '__main__':
    main()
