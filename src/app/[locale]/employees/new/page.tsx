'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const employeeSchema = z.object({
  firstName: z.string().min(1, 'Vorname ist erforderlich'),
  lastName: z.string().min(1, 'Nachname ist erforderlich'),
  dateOfBirth: z.string().optional(),
  email: z.string().email('Ungültige E-Mail-Adresse').optional().or(z.literal('')),
  phone: z.string().optional(),
  departmentId: z.string().optional(),
  position: z.string().optional(),
  startDate: z.string().optional(),
  clothingBudget: z.number().min(0, 'Budget muss mindestens 0 sein'),
  // Adresse
  street: z.string().optional(),
  zipCode: z.string().optional(),
  city: z.string().optional(),
  // Steuern & Sozialversicherung
  socialSecurityNumber: z.string().optional(),
  taxId: z.string().optional(),
  healthInsurance: z.string().optional(),
  // Vertrag & Vergütung
  isFixedTerm: z.boolean().optional(),
  fixedTermEndDate: z.string().optional(),
  hourlyWage: z.number().min(0).optional().nullable(),
  payGrade: z.string().optional(),
  vacationDays: z.number().int().min(0).optional().nullable(),
  // Zugang & Identifikation
  keyNumber: z.string().optional(),
  chipNumber: z.string().optional(),
  // Qualifikationen & Lizenzen
  driversLicenseClass: z.string().optional(),
  forkliftLicense: z.boolean().optional(),
});

type EmployeeFormData = z.infer<typeof employeeSchema>;

export default function NewEmployeePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [departments, setDepartments] = useState<any[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      clothingBudget: 500,
      isFixedTerm: false,
      forkliftLicense: false,
      driversLicenseClass: 'Nein',
    },
  });

  const isFixedTerm = watch('isFixedTerm');

  // Fetch departments
  useState(() => {
    fetch('/api/departments')
      .then((res) => res.json())
      .then((data) => setDepartments(data.departments || []))
      .catch(console.error);
  });

  const onSubmit = async (data: EmployeeFormData) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          email: data.email || null,
          phone: data.phone || null,
          departmentId: data.departmentId || null,
          position: data.position || null,
          dateOfBirth: data.dateOfBirth || null,
          startDate: data.startDate || null,
          street: data.street || null,
          zipCode: data.zipCode || null,
          city: data.city || null,
          socialSecurityNumber: data.socialSecurityNumber || null,
          taxId: data.taxId || null,
          healthInsurance: data.healthInsurance || null,
          isFixedTerm: data.isFixedTerm ?? false,
          fixedTermEndDate: data.isFixedTerm ? (data.fixedTermEndDate || null) : null,
          hourlyWage: data.hourlyWage ?? null,
          payGrade: data.payGrade || null,
          vacationDays: data.vacationDays ?? null,
          keyNumber: data.keyNumber || null,
          chipNumber: data.chipNumber || null,
          driversLicenseClass: data.driversLicenseClass || 'Nein',
          forkliftLicense: data.forkliftLicense ?? false,
        }),
      });

      if (!response.ok) {
        throw new Error('Fehler beim Erstellen des Mitarbeiters');
      }

      const employee = await response.json();
      router.push(`/de/employees/${employee.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500";

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Link href="/de/employees" className="rounded-lg p-2 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Neuer Mitarbeiter</h1>
          <p className="mt-1 text-sm text-gray-600">Erstellen Sie einen neuen Mitarbeiter</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Persönliche Daten */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Persönliche Daten</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vorname <span className="text-red-500">*</span>
              </label>
              <input type="text" {...register('firstName')} className={inputClass} />
              {errors.firstName && <p className="mt-1 text-sm text-red-600">{errors.firstName.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nachname <span className="text-red-500">*</span>
              </label>
              <input type="text" {...register('lastName')} className={inputClass} />
              {errors.lastName && <p className="mt-1 text-sm text-red-600">{errors.lastName.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Geburtsdatum</label>
              <input type="date" {...register('dateOfBirth')} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
              <input type="email" {...register('email')} className={inputClass} />
              {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
              <input type="tel" {...register('phone')} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Straße und Hausnummer</label>
              <input type="text" {...register('street')} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PLZ</label>
              <input type="text" {...register('zipCode')} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stadt</label>
              <input type="text" {...register('city')} className={inputClass} />
            </div>
          </div>
        </div>

        {/* Unternehmen */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Unternehmen</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Abteilung</label>
              <select {...register('departmentId')} className={inputClass}>
                <option value="">Keine Abteilung</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
              <input type="text" {...register('position')} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Eintrittsdatum</label>
              <input type="date" {...register('startDate')} className={inputClass} />
            </div>
          </div>
        </div>

        {/* Steuern & Sozialversicherung */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Steuern &amp; Sozialversicherung</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sozialversicherungsnummer</label>
              <input type="text" {...register('socialSecurityNumber')} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Steuer-ID</label>
              <input type="text" {...register('taxId')} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Krankenkasse</label>
              <input type="text" {...register('healthInsurance')} className={inputClass} />
            </div>
          </div>
        </div>

        {/* Vertrag & Vergütung */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Vertrag &amp; Vergütung</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Befristung</label>
              <select {...register('isFixedTerm', { setValueAs: (v) => v === 'true' || v === true })} className={inputClass}>
                <option value="false">Nein</option>
                <option value="true">Ja</option>
              </select>
            </div>
            {isFixedTerm && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Befristung bis</label>
                <input type="date" {...register('fixedTermEndDate')} className={inputClass} />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stundenlohn (&euro;)</label>
              <input type="number" step="0.01" {...register('hourlyWage', { setValueAs: (v) => v === '' ? null : Number(v) })} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lohngruppe</label>
              <input type="text" {...register('payGrade')} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Urlaubsanspruch (Tage)</label>
              <input type="number" step="1" {...register('vacationDays', { setValueAs: (v) => v === '' ? null : Number(v) })} className={inputClass} />
            </div>
          </div>
        </div>

        {/* Zugang & Identifikation */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Zugang &amp; Identifikation</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Schlüsselnummer</label>
              <input type="text" {...register('keyNumber')} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Chipnummer</label>
              <input type="text" {...register('chipNumber')} className={inputClass} />
            </div>
          </div>
        </div>

        {/* Qualifikationen & Lizenzen */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Qualifikationen &amp; Lizenzen</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Führerschein Klasse</label>
              <select {...register('driversLicenseClass')} className={inputClass}>
                <option value="Nein">Nein</option>
                <option value="B">B</option>
                <option value="BE">BE</option>
                <option value="C1">C1</option>
                <option value="C1E">C1E</option>
                <option value="CE">CE</option>
                <option value="C">C</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Staplerschein</label>
              <select {...register('forkliftLicense', { setValueAs: (v) => v === 'true' || v === true })} className={inputClass}>
                <option value="false">Nein</option>
                <option value="true">Ja</option>
              </select>
            </div>
          </div>
        </div>

        {/* Budget */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Budget</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kleidungsbudget (&euro;) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                {...register('clothingBudget', { valueAsNumber: true })}
                className={inputClass}
              />
              {errors.clothingBudget && <p className="mt-1 text-sm text-red-600">{errors.clothingBudget.message}</p>}
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          <Link
            href="/de/employees"
            className="rounded-lg border border-gray-300 px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Abbrechen
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? 'Wird erstellt...' : 'Mitarbeiter erstellen'}
          </button>
        </div>
      </form>
    </div>
  );
}
