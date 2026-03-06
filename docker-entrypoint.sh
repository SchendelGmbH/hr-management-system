#!/bin/sh
set -e

echo "==> Warte auf Datenbankverbindung..."
# Kurze Wartezeit, falls die DB noch hochfährt (ergänzend zu depends_on healthcheck)
sleep 2

echo "==> Führe Prisma DB Push durch (Schema synchronisieren)..."
npx prisma db push --skip-generate

echo "==> Starte HR-Management-System..."
exec npm start
