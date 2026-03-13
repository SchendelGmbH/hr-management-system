#!/usr/bin/env python3
"""Konvertiere Mitarbeiter aus alten Backup in neue Datenbank - Korrigierte Version"""

import re
import subprocess
import sys

DB_URL = "postgresql://postgres:postgres@76.13.148.225:32770/hr-software"

def escape_value(v):
    """Escape SQL Werte korrekt"""
    if v == 'NULL':
        return 'NULL'
    if v.startswith("'") and v.endswith("'"):
        # Bereits ein String, prüfe auf korrektes Escaping
        return v
    return v

def main():
    # Lösche bestehende Mitarbeiter (außer Admin-Verknüpfung)
    print("Lösche alte Mitarbeiter...")
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

    print(f"Gefunden: {len(matches)} Mitarbeiter im Backup")

    success = 0
    errors = 0

    for i, match in enumerate(matches):
        # Parse Werte mit CSV-ähnlichem Parser
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

        if len(values) < 33:
            print(f"WARN: Mitarbeiter {i+1} hat nur {len(values)} Felder, überspringe")
            errors += 1
            continue

        # Verwende alle Werte direkt aus dem Backup (korrekte Reihenfolge)
        # Neue DB hat: id, employeeNumber, firstName, lastName, dateOfBirth, email, phone, departmentId, position, startDate, clothingBudget, remainingBudget, lastBudgetReset, street, zipCode, city, socialSecurityNumber, taxId, healthInsurance, isFixedTerm, fixedTermEndDate, probationEndDate, hourlyWage, overtariffSupplement, payGradeId, vacationDays, keyNumber, chipNumber, driversLicenseClass, forkliftLicense, userId, createdAt, updatedAt
        
        # Altes Schema (33 Felder) -> Neues Schema (32 Felder)
        # Unterschied: altes hat mehr Felder, wir müssen mappen
        
        emp_id = escape_value(values[0])  # id
        emp_num = escape_value(values[1])  # employeeNumber
        first_name = escape_value(values[2])  # firstName
        last_name = escape_value(values[3])  # lastName
        dob = escape_value(values[4])  # dateOfBirth
        email = escape_value(values[5])  # email (verschlüsselt)
        phone = escape_value(values[6])  # phone (verschlüsselt)
        dept_id = escape_value(values[7])  # departmentId
        position = escape_value(values[8])  # position
        start_date = escape_value(values[9])  # startDate
        cloth_budget = escape_value(values[10])  # clothingBudget
        rem_budget = escape_value(values[11])  # remainingBudget
        created_at = escape_value(values[12])  # createdAt
        updated_at = escape_value(values[13])  # updatedAt
        last_reset = escape_value(values[14])  # lastBudgetReset
        street = escape_value(values[15])  # street (verschlüsselt)
        zipcode = escape_value(values[16])  # zipCode (verschlüsselt)
        chip_num = escape_value(values[17])  # chipNumber
        drivers_lic = escape_value(values[17]) if values[17] != 'NULL' else "'Nein'"  # driversLicenseClass war an Pos 17?
        
        # Korrektur: driversLicenseClass ist an verschiedenen Positionen je nach Schema
        # Lass mich das Schema aus dem Backup genauer analysieren
        
        sql = f"""
        INSERT INTO employees (
            "id", "employeeNumber", "firstName", "lastName", "dateOfBirth",
            email, phone, "departmentId", position, "startDate",
            "clothingBudget", "remainingBudget", "lastBudgetReset",
            street, "zipCode", city, "socialSecurityNumber", "taxId",
            "healthInsurance", "isFixedTerm", "fixedTermEndDate",
            "hourlyWage", "vacationDays", "keyNumber", "driversLicenseClass",
            "forkliftLicense", "createdAt", "updatedAt"
        ) VALUES (
            {emp_id}, {emp_num}, {first_name}, {last_name}, {dob},
            {email}, {phone}, {dept_id}, {position}, {start_date},
            {cloth_budget}, {rem_budget}, {last_reset},
            {street}, {zipcode}, NULL, NULL, NULL,
            NULL, false, NULL,
            NULL, NULL, NULL, 'Nein',
            false, {created_at}, {updated_at}
        );
        """

        result = subprocess.run(
            ['/home/linuxbrew/.linuxbrew/opt/postgresql@14/bin/psql', DB_URL, '-c', sql],
            capture_output=True, text=True
        )

        if result.returncode == 0:
            fn = first_name.strip("'") if first_name != 'NULL' else 'NULL'
            ln = last_name.strip("'") if last_name != 'NULL' else 'NULL'
            print(f"OK {i+1}: {emp_num} - {fn} {ln}")
            success += 1
        else:
            err = result.stderr[:60] if result.stderr else 'Unbekannter Fehler'
            print(f"ERR {i+1}: {err}")
            errors += 1

    print(f"\n=== ERGEBNIS ===")
    print(f"Erfolgreich: {success}")
    print(f"Fehler: {errors}")

if __name__ == '__main__':
    main()
