'use client';

import { useState, useEffect, Fragment } from 'react';
import { use } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Edit, Trash2, FileText, Shirt, Calendar, Tag as TagIcon, X, Plus, Save, GitBranch, ChevronDown, ChevronRight, Upload, Pencil, Search, Printer } from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/utils';
import UploadDocumentModal from '@/components/documents/UploadDocumentModal';
import EditDocumentModal from '@/components/documents/EditDocumentModal';
import DeleteDocumentModal from '@/components/documents/DeleteDocumentModal';
import GenerateDocumentModal from '@/components/templates/GenerateDocumentModal';
import GroupGenerateDocumentModal from '@/components/templates/GroupGenerateDocumentModal';
import { Files } from 'lucide-react';
import { DetailFormSkeleton } from '@/components/ui/Skeleton';
import EmployeeClothingInventory from '@/components/employees/EmployeeClothingInventory';

interface Department {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  email: string | null;
  phone: string | null;
  position: string | null;
  startDate: string | null;
  clothingBudget: number;
  remainingBudget: number;
  department: Department | null;
  departmentId?: string | null;
  // Adresse
  street: string | null;
  zipCode: string | null;
  city: string | null;
  // Steuern & Sozialversicherung
  socialSecurityNumber: string | null;
  taxId: string | null;
  healthInsurance: string | null;
  // Vertrag & Vergütung
  isFixedTerm: boolean;
  fixedTermEndDate: string | null;
  probationEndDate: string | null;
  hourlyWage: number | null;
  overtariffSupplement: number | null;
  payGrade: { id: string; name: string; tariffWage: number | null } | null;
  vacationDays: number | null;
  // Zugang & Identifikation
  keyNumber: string | null;
  chipNumber: string | null;
  // Qualifikationen & Lizenzen
  driversLicenseClass: string | null;
  forkliftLicense: boolean;
  // Relations
  documents: any[];
  clothingOrders: any[];
  vacations: any[];
  employeeSize: any;
  customFieldValues: any[];
}

interface EditForm {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  email: string;
  phone: string;
  departmentId: string;
  position: string;
  startDate: string;
  clothingBudget: number;
  // Adresse
  street: string;
  zipCode: string;
  city: string;
  // Steuern & Sozialversicherung
  socialSecurityNumber: string;
  taxId: string;
  healthInsurance: string;
  // Vertrag & Vergütung
  isFixedTerm: boolean;
  fixedTermEndDate: string;
  probationEndDate: string;
  hourlyWage: string;
  payGradeId: string;
  vacationDays: string;
  // Zugang & Identifikation
  keyNumber: string;
  chipNumber: string;
  // Qualifikationen & Lizenzen
  driversLicenseClass: string;
  forkliftLicense: boolean;
}

export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('stammdaten');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Versioning state
  const [versionTypeModal, setVersionTypeModal] = useState<{
    doc: any;
  } | null>(null);
  const [newVersionModal, setNewVersionModal] = useState<{
    parentDocumentId: string;
    prefillData: { title: string; description?: string; categories?: string[] };
  } | null>(null);
  const [generateVersionModal, setGenerateVersionModal] = useState<{
    parentDocumentId: string;
    parentDocumentTitle: string;
  } | null>(null);
  const [expandedDocIds, setExpandedDocIds] = useState<Set<string>>(new Set());
  const [versionHistory, setVersionHistory] = useState<Record<string, any[]>>({});
  const [loadingVersions, setLoadingVersions] = useState<Set<string>>(new Set());
  const [editDocModal, setEditDocModal] = useState<any | null>(null);
  const [deleteDocModal, setDeleteDocModal] = useState<{ id: string; title: string } | null>(null);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [groupGenerateModalOpen, setGroupGenerateModalOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [docSearchQuery, setDocSearchQuery] = useState('');

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    email: '',
    phone: '',
    departmentId: '',
    position: '',
    startDate: '',
    clothingBudget: 0,
    street: '',
    zipCode: '',
    city: '',
    socialSecurityNumber: '',
    taxId: '',
    healthInsurance: '',
    isFixedTerm: false,
    fixedTermEndDate: '',
    probationEndDate: '',
    hourlyWage: '',
    payGradeId: '',
    vacationDays: '',
    keyNumber: '',
    chipNumber: '',
    driversLicenseClass: 'Nein',
    forkliftLicense: false,
  });
  const [saving, setSaving] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [payGrades, setPayGrades] = useState<any[]>([]);

  // Delete state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchEmployee();
    fetchDepartments();
    fetchPayGrades();
  }, [id]);

  // Auto-enter edit mode if ?edit=true in URL
  useEffect(() => {
    if (searchParams.get('edit') === 'true' && employee) {
      startEditing();
    }
  }, [searchParams, employee]);

  // Auto-navigate to documents tab and expand a specific document if requested
  useEffect(() => {
    const tab = searchParams.get('tab');
    const expandDoc = searchParams.get('expandDoc');
    if (tab === 'documents' && employee) {
      setActiveTab('documents');
      if (expandDoc) {
        setExpandedDocIds((prev) => {
          const next = new Set(prev);
          next.add(expandDoc);
          return next;
        });
        fetchVersionHistory(expandDoc);
      }
    }
  }, [searchParams, employee]);

  const fetchEmployee = async () => {
    try {
      const response = await fetch(`/api/employees/${id}`);
      const data = await response.json();
      setEmployee(data);
    } catch (error) {
      console.error('Error fetching employee:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchVersionHistory = async (docId: string) => {
    setLoadingVersions((prev) => new Set(prev).add(docId));
    try {
      const response = await fetch(`/api/documents/${docId}`);
      const data = await response.json();
      setVersionHistory((prev) => ({ ...prev, [docId]: data.versions || [] }));
    } catch (error) {
      console.error('Error fetching version history:', error);
    } finally {
      setLoadingVersions((prev) => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
    }
  };

  const toggleVersions = (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const isExpanded = expandedDocIds.has(docId);
    if (!isExpanded && !versionHistory[docId]) {
      fetchVersionHistory(docId);
    }
    setExpandedDocIds((prev) => {
      const next = new Set(prev);
      if (isExpanded) next.delete(docId); else next.add(docId);
      return next;
    });
  };

  const openVersionTypeModal = (doc: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setVersionTypeModal({ doc });
  };

  const openGenerateVersionModal = (doc: any) => {
    setVersionTypeModal(null);
    const display = doc.versions?.[0] || doc;
    setGenerateVersionModal({
      parentDocumentId: doc.id,
      parentDocumentTitle: display.title || doc.title,
    });
  };

  const openNewVersionModal = (doc: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setVersionTypeModal(null);
    const categoryNames = (doc.versions?.[0]?.categories || doc.categories || []).map(
      (dc: any) => dc.category.name
    );
    setNewVersionModal({
      parentDocumentId: doc.id,
      prefillData: {
        title: doc.versions?.[0]?.title || doc.title,
        categories: categoryNames,
      },
    });
  };

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/departments');
      const data = await response.json();
      setDepartments(data.departments || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchPayGrades = async () => {
    try {
      const response = await fetch('/api/pay-grades');
      const data = await response.json();
      setPayGrades(data.payGrades || []);
    } catch (error) {
      console.error('Error fetching pay grades:', error);
    }
  };

  const startEditing = () => {
    if (!employee) return;
    setEditForm({
      firstName: employee.firstName,
      lastName: employee.lastName,
      dateOfBirth: employee.dateOfBirth ? employee.dateOfBirth.split('T')[0] : '',
      email: employee.email || '',
      phone: employee.phone || '',
      departmentId: employee.department?.id || '',
      position: employee.position || '',
      startDate: employee.startDate ? employee.startDate.split('T')[0] : '',
      clothingBudget: Number(employee.clothingBudget) || 0,
      street: employee.street || '',
      zipCode: employee.zipCode || '',
      city: employee.city || '',
      socialSecurityNumber: employee.socialSecurityNumber || '',
      taxId: employee.taxId || '',
      healthInsurance: employee.healthInsurance || '',
      isFixedTerm: employee.isFixedTerm ?? false,
      fixedTermEndDate: employee.fixedTermEndDate ? employee.fixedTermEndDate.split('T')[0] : '',
      probationEndDate: employee.probationEndDate ? employee.probationEndDate.split('T')[0] : '',
      hourlyWage: employee.hourlyWage != null ? String(employee.hourlyWage) : '',
      payGradeId: (employee as any).payGradeId || '',
      vacationDays: employee.vacationDays != null ? String(employee.vacationDays) : '',
      keyNumber: employee.keyNumber || '',
      chipNumber: employee.chipNumber || '',
      driversLicenseClass: employee.driversLicenseClass || 'Nein',
      forkliftLicense: employee.forkliftLicense ?? false,
    });
    setIsEditing(true);
    setActiveTab('stammdaten');
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!editForm.firstName.trim() || !editForm.lastName.trim()) {
      alert('Vor- und Nachname sind Pflichtfelder');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/employees/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: editForm.firstName,
          lastName: editForm.lastName,
          dateOfBirth: editForm.dateOfBirth || null,
          email: editForm.email || null,
          phone: editForm.phone || null,
          departmentId: editForm.departmentId || null,
          position: editForm.position || null,
          startDate: editForm.startDate || null,
          clothingBudget: Number(editForm.clothingBudget) || 0,
          street: editForm.street || null,
          zipCode: editForm.zipCode || null,
          city: editForm.city || null,
          socialSecurityNumber: editForm.socialSecurityNumber || null,
          taxId: editForm.taxId || null,
          healthInsurance: editForm.healthInsurance || null,
          isFixedTerm: editForm.isFixedTerm,
          fixedTermEndDate: editForm.isFixedTerm ? (editForm.fixedTermEndDate || null) : null,
          probationEndDate: editForm.probationEndDate || null,
          hourlyWage: editForm.hourlyWage ? Number(editForm.hourlyWage) : null,
          payGradeId: editForm.payGradeId || null,
          vacationDays: editForm.vacationDays ? Number(editForm.vacationDays) : null,
          keyNumber: editForm.keyNumber || null,
          chipNumber: editForm.chipNumber || null,
          driversLicenseClass: editForm.driversLicenseClass || 'Nein',
          forkliftLicense: editForm.forkliftLicense,
        }),
      });
      if (!response.ok) {
        throw new Error('Fehler beim Speichern');
      }
      setIsEditing(false);
      fetchEmployee();
    } catch (error) {
      console.error('Error saving employee:', error);
      alert('Fehler beim Speichern des Mitarbeiters');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/employees/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Fehler beim Löschen');
      }
      router.push('/de/employees');
    } catch (error) {
      console.error('Error deleting employee:', error);
      alert('Fehler beim Löschen des Mitarbeiters');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
            <div className="space-y-2">
              <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
              <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-24 animate-pulse rounded-lg bg-gray-100" />
            <div className="h-9 w-24 animate-pulse rounded-lg bg-gray-100" />
          </div>
        </div>
        {/* Tabs skeleton */}
        <div className="border-b border-gray-200">
          <div className="flex gap-4">
            {['Stammdaten', 'Dokumente', 'Arbeitskleidung', 'Urlaube'].map((tab) => (
              <div key={tab} className="border-b-2 border-transparent px-1 pb-4 pt-2 text-sm font-medium text-gray-400">
                {tab}
              </div>
            ))}
          </div>
        </div>
        {/* Form skeleton */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6 h-6 w-40 animate-pulse rounded bg-gray-200" />
          <DetailFormSkeleton rows={10} />
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-gray-500">Mitarbeiter nicht gefunden</div>
      </div>
    );
  }

  const tabs = [
    { id: 'stammdaten', label: 'Stammdaten', icon: FileText },
    { id: 'documents', label: 'Dokumente', icon: FileText, count: employee.documents.length },
    { id: 'clothing', label: 'Arbeitskleidung', icon: Shirt, count: employee.clothingOrders.length },
    { id: 'vacations', label: 'Urlaube', icon: Calendar, count: employee.vacations.length },
  ];

  const inputClass = "w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            href="/de/employees"
            className="rounded-lg p-2 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {employee.firstName} {employee.lastName}
            </h1>
            <p className="mt-1 text-sm text-gray-600">{employee.employeeNumber}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {isEditing ? (
            <>
              <button
                onClick={cancelEditing}
                className="flex items-center space-x-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <X className="h-4 w-4" />
                <span>Abbrechen</span>
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center space-x-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                <span>{saving ? 'Speichern...' : 'Speichern'}</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={startEditing}
                className="flex items-center space-x-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Edit className="h-4 w-4" />
                <span>Bearbeiten</span>
              </button>
              <button
                onClick={() => setShowDeleteDialog(true)}
                className="flex items-center space-x-2 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                <span>Löschen</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 border-b-2 px-1 py-4 text-sm font-medium ${
                  isActive
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`rounded-full px-2 py-0.5 text-xs ${
                    isActive ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        {activeTab === 'stammdaten' && !isEditing && (
          <div className="space-y-8">
            {/* Persönliche Daten */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">Persönliche Daten</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500">Vorname</label>
                  <p className="mt-1 text-sm text-gray-900">{employee.firstName}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500">Nachname</label>
                  <p className="mt-1 text-sm text-gray-900">{employee.lastName}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500">Geburtsdatum</label>
                  <p className="mt-1 text-sm text-gray-900">{employee.dateOfBirth ? formatDate(employee.dateOfBirth) : '-'}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500">Email</label>
                  <p className="mt-1 text-sm text-gray-900">{employee.email || '-'}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500">Telefon</label>
                  <p className="mt-1 text-sm text-gray-900">{employee.phone || '-'}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500">Straße und Hausnummer</label>
                  <p className="mt-1 text-sm text-gray-900">{employee.street || '-'}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500">PLZ</label>
                  <p className="mt-1 text-sm text-gray-900">{employee.zipCode || '-'}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500">Stadt</label>
                  <p className="mt-1 text-sm text-gray-900">{employee.city || '-'}</p>
                </div>
              </div>
            </div>

            {/* Unternehmen */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">Unternehmen</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500">Abteilung</label>
                  <p className="mt-1 text-sm text-gray-900">{employee.department?.name || '-'}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500">Position</label>
                  <p className="mt-1 text-sm text-gray-900">{employee.position || '-'}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500">Eintrittsdatum</label>
                  <p className="mt-1 text-sm text-gray-900">{employee.startDate ? formatDate(employee.startDate) : '-'}</p>
                </div>
              </div>
            </div>

            {/* Steuern & Sozialversicherung */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">Steuern &amp; Sozialversicherung</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500">Sozialversicherungsnummer</label>
                  <p className="mt-1 text-sm text-gray-900">{employee.socialSecurityNumber || '-'}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500">Steuer-ID</label>
                  <p className="mt-1 text-sm text-gray-900">{employee.taxId || '-'}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500">Krankenkasse</label>
                  <p className="mt-1 text-sm text-gray-900">{employee.healthInsurance || '-'}</p>
                </div>
              </div>
            </div>

            {/* Vertrag & Vergütung */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">Vertrag &amp; Vergütung</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500">Befristung</label>
                  <p className="mt-1 text-sm text-gray-900">{employee.isFixedTerm ? 'Ja' : 'Nein'}</p>
                </div>
                {employee.isFixedTerm && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Befristung bis</label>
                    <p className="mt-1 text-sm text-gray-900">{employee.fixedTermEndDate ? formatDate(employee.fixedTermEndDate) : '-'}</p>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-500">Probezeit bis</label>
                  <p className="mt-1 text-sm text-gray-900">{employee.probationEndDate ? formatDate(employee.probationEndDate) : '-'}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500">Lohngruppe</label>
                  <p className="mt-1 text-sm text-gray-900">{employee.payGrade ? employee.payGrade.name : '-'}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500">Tariflohn</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {employee.payGrade?.tariffWage != null ? formatCurrency(employee.payGrade.tariffWage) : '-'}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500">Stundenlohn</label>
                  <p className="mt-1 text-sm text-gray-900">{employee.hourlyWage != null ? formatCurrency(employee.hourlyWage) : '-'}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500">Übertariflicher Zuschlag</label>
                  <p className={`mt-1 text-sm font-medium ${employee.overtariffSupplement != null ? (Number(employee.overtariffSupplement) >= 0 ? 'text-green-700' : 'text-red-600') : 'text-gray-900'}`}>
                    {employee.overtariffSupplement != null ? formatCurrency(employee.overtariffSupplement) : '-'}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500">Urlaubsanspruch</label>
                  <p className="mt-1 text-sm text-gray-900">{employee.vacationDays != null ? `${employee.vacationDays} Tage` : '-'}</p>
                </div>
              </div>
            </div>

            {/* Zugang & Identifikation */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">Zugang &amp; Identifikation</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500">Schlüsselnummer</label>
                  <p className="mt-1 text-sm text-gray-900">{employee.keyNumber || '-'}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500">Chipnummer</label>
                  <p className="mt-1 text-sm text-gray-900">{employee.chipNumber || '-'}</p>
                </div>
              </div>
            </div>

            {/* Qualifikationen & Lizenzen */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">Qualifikationen &amp; Lizenzen</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500">Führerschein Klasse</label>
                  <p className="mt-1 text-sm text-gray-900">{employee.driversLicenseClass || 'Nein'}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500">Staplerschein</label>
                  <p className="mt-1 text-sm text-gray-900">{employee.forkliftLicense ? 'Ja' : 'Nein'}</p>
                </div>
              </div>
            </div>

            {/* Budget */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">Budget</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500">Kleidungsbudget (pro Jahr)</label>
                  <p className="mt-1 text-sm text-gray-900">{formatCurrency(employee.clothingBudget)}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500">Verbleibendes Budget</label>
                  <p className="mt-1 text-sm font-semibold text-primary-600">
                    {formatCurrency(employee.remainingBudget)}
                  </p>
                  {employee.startDate && (() => {
                    const start = new Date(employee.startDate);
                    const now = new Date();
                    const quarterMonth = Math.floor(start.getMonth() / 3) * 3;
                    let pStart = new Date(start.getFullYear(), quarterMonth, 1);
                    while (true) {
                      const next = new Date(pStart);
                      next.setFullYear(next.getFullYear() + 1);
                      if (next > now) break;
                      pStart = next;
                    }
                    const pEnd = new Date(pStart);
                    pEnd.setFullYear(pEnd.getFullYear() + 1);
                    pEnd.setDate(pEnd.getDate() - 1);
                    return (
                      <p className="mt-1 text-xs text-gray-500">
                        Budgetperiode: {formatDate(pStart.toISOString())} - {formatDate(pEnd.toISOString())}
                      </p>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'stammdaten' && isEditing && (
          <div className="space-y-8">
            {/* Persönliche Daten */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">Persönliche Daten</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vorname <span className="text-red-500">*</span></label>
                  <input type="text" value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nachname <span className="text-red-500">*</span></label>
                  <input type="text" value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Geburtsdatum</label>
                  <input type="date" value={editForm.dateOfBirth} onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                  <input type="tel" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Straße und Hausnummer</label>
                  <input type="text" value={editForm.street} onChange={(e) => setEditForm({ ...editForm, street: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PLZ</label>
                  <input type="text" value={editForm.zipCode} onChange={(e) => setEditForm({ ...editForm, zipCode: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stadt</label>
                  <input type="text" value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} className={inputClass} />
                </div>
              </div>
            </div>

            {/* Unternehmen */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">Unternehmen</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Abteilung</label>
                  <select value={editForm.departmentId} onChange={(e) => setEditForm({ ...editForm, departmentId: e.target.value })} className={inputClass}>
                    <option value="">Keine Abteilung</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                  <input type="text" value={editForm.position} onChange={(e) => setEditForm({ ...editForm, position: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Eintrittsdatum</label>
                  <input type="date" value={editForm.startDate} onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })} className={inputClass} />
                </div>
              </div>
            </div>

            {/* Steuern & Sozialversicherung */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">Steuern &amp; Sozialversicherung</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sozialversicherungsnummer</label>
                  <input type="text" value={editForm.socialSecurityNumber} onChange={(e) => setEditForm({ ...editForm, socialSecurityNumber: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Steuer-ID</label>
                  <input type="text" value={editForm.taxId} onChange={(e) => setEditForm({ ...editForm, taxId: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Krankenkasse</label>
                  <input type="text" value={editForm.healthInsurance} onChange={(e) => setEditForm({ ...editForm, healthInsurance: e.target.value })} className={inputClass} />
                </div>
              </div>
            </div>

            {/* Vertrag & Vergütung */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">Vertrag &amp; Vergütung</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Befristung</label>
                  <select value={editForm.isFixedTerm ? 'Ja' : 'Nein'} onChange={(e) => setEditForm({ ...editForm, isFixedTerm: e.target.value === 'Ja' })} className={inputClass}>
                    <option value="Nein">Nein</option>
                    <option value="Ja">Ja</option>
                  </select>
                </div>
                {editForm.isFixedTerm && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Befristung bis</label>
                    <input type="date" value={editForm.fixedTermEndDate} onChange={(e) => setEditForm({ ...editForm, fixedTermEndDate: e.target.value })} className={inputClass} />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Probezeit bis</label>
                  <input type="date" value={editForm.probationEndDate} onChange={(e) => setEditForm({ ...editForm, probationEndDate: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lohngruppe</label>
                  <select value={editForm.payGradeId} onChange={(e) => setEditForm({ ...editForm, payGradeId: e.target.value })} className={inputClass}>
                    <option value="">Keine Lohngruppe</option>
                    {payGrades.map((pg) => (
                      <option key={pg.id} value={pg.id}>{pg.name}{pg.tariffWage != null ? ` – ${Number(pg.tariffWage).toFixed(2)} €/h` : ''}</option>
                    ))}
                  </select>
                </div>
                {/* Tariflohn readonly */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tariflohn (€/h)</label>
                  <div className={`${inputClass} bg-gray-50 text-gray-500`}>
                    {(() => {
                      const pg = payGrades.find((p) => p.id === editForm.payGradeId);
                      return pg?.tariffWage != null ? `${Number(pg.tariffWage).toFixed(2)} €` : '—';
                    })()}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stundenlohn (&euro;)</label>
                  <input type="number" step="0.01" value={editForm.hourlyWage} onChange={(e) => setEditForm({ ...editForm, hourlyWage: e.target.value })} className={inputClass} />
                </div>
                {/* Übertariflicher Zuschlag readonly – Vorschau */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Übertariflicher Zuschlag (€/h)</label>
                  <div className={`${inputClass} bg-gray-50 font-medium ${(() => {
                    const pg = payGrades.find((p) => p.id === editForm.payGradeId);
                    if (editForm.hourlyWage && pg?.tariffWage != null) {
                      const diff = Number(editForm.hourlyWage) - Number(pg.tariffWage);
                      return diff >= 0 ? 'text-green-700' : 'text-red-600';
                    }
                    return 'text-gray-500';
                  })()}`}>
                    {(() => {
                      const pg = payGrades.find((p) => p.id === editForm.payGradeId);
                      if (editForm.hourlyWage && pg?.tariffWage != null) {
                        return `${(Number(editForm.hourlyWage) - Number(pg.tariffWage)).toFixed(2)} €`;
                      }
                      return '—';
                    })()}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Urlaubsanspruch (Tage)</label>
                  <input type="number" step="1" value={editForm.vacationDays} onChange={(e) => setEditForm({ ...editForm, vacationDays: e.target.value })} className={inputClass} />
                </div>
              </div>
            </div>

            {/* Zugang & Identifikation */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">Zugang &amp; Identifikation</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Schlüsselnummer</label>
                  <input type="text" value={editForm.keyNumber} onChange={(e) => setEditForm({ ...editForm, keyNumber: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Chipnummer</label>
                  <input type="text" value={editForm.chipNumber} onChange={(e) => setEditForm({ ...editForm, chipNumber: e.target.value })} className={inputClass} />
                </div>
              </div>
            </div>

            {/* Qualifikationen & Lizenzen */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">Qualifikationen &amp; Lizenzen</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Führerschein Klasse</label>
                  <select value={editForm.driversLicenseClass} onChange={(e) => setEditForm({ ...editForm, driversLicenseClass: e.target.value })} className={inputClass}>
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
                  <select value={editForm.forkliftLicense ? 'Ja' : 'Nein'} onChange={(e) => setEditForm({ ...editForm, forkliftLicense: e.target.value === 'Ja' })} className={inputClass}>
                    <option value="Nein">Nein</option>
                    <option value="Ja">Ja</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Budget */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">Budget</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kleidungsbudget (&euro;) <span className="text-red-500">*</span></label>
                  <input type="number" step="0.01" value={editForm.clothingBudget} onChange={(e) => setEditForm({ ...editForm, clothingBudget: parseFloat(e.target.value) || 0 })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Verbleibendes Budget</label>
                  <p className="mt-2 text-sm font-semibold text-primary-600">{formatCurrency(employee.remainingBudget)}</p>
                  <p className="text-xs text-gray-500">Wird automatisch berechnet</p>
                </div>
              </div>
            </div>
          </div>
        )}

{activeTab === 'documents' && (
          <div className="space-y-4">
            {/* Header with Add Button */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                Dokumente ({employee.documents.length})
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setGroupGenerateModalOpen(true)}
                  className="flex items-center space-x-2 rounded-lg border border-primary-300 bg-white px-4 py-2 text-sm font-medium text-primary-700 hover:bg-primary-50"
                >
                  <Files className="h-4 w-4" />
                  <span>Dokumentengruppe</span>
                </button>
                <button
                  onClick={() => setGenerateModalOpen(true)}
                  className="flex items-center space-x-2 rounded-lg border border-primary-300 bg-white px-4 py-2 text-sm font-medium text-primary-700 hover:bg-primary-50"
                >
                  <FileText className="h-4 w-4" />
                  <span>Aus Vorlage</span>
                </button>
                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  className="flex items-center space-x-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                >
                  <Plus className="h-4 w-4" />
                  <span>Dokument hinzufügen</span>
                </button>
              </div>
            </div>

            {/* Search */}
            {employee.documents.length > 0 && (
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Nach Titel suchen…"
                  value={docSearchQuery}
                  onChange={(e) => setDocSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
                />
              </div>
            )}

            {/* Category Filter */}
            {employee.documents.length > 0 && (() => {
              const allCategories = Array.from(
                new Map(
                  employee.documents
                    .flatMap((doc: any) => doc.categories || [])
                    .map((dc: any) => [dc.category.id, dc.category])
                ).values()
              );

              return allCategories.length > 0 ? (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    <TagIcon className="mr-1 inline h-4 w-4" />
                    Nach Kategorie filtern
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {allCategories.map((cat: any) => {
                      const isSelected = selectedCategoryIds.includes(cat.id);
                      return (
                        <button
                          key={cat.id}
                          onClick={() => {
                            setSelectedCategoryIds((prev) =>
                              isSelected
                                ? prev.filter((cid) => cid !== cat.id)
                                : [...prev, cat.id]
                            );
                          }}
                          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                            isSelected
                              ? 'border-primary-500 bg-primary-50 text-primary-700'
                              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: cat.color || '#3B82F6' }}
                          />
                          {cat.name}
                          {isSelected && <X className="h-3 w-3" />}
                        </button>
                      );
                    })}
                    {selectedCategoryIds.length > 0 && (
                      <button
                        onClick={() => setSelectedCategoryIds([])}
                        className="rounded-full border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Filter zur&uuml;cksetzen
                      </button>
                    )}
                  </div>
                </div>
              ) : null;
            })()}

            {/* Status Filter */}
            {employee.documents.length > 0 && (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Status
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'all', label: 'Alle' },
                    { value: 'valid', label: 'Gültig' },
                    { value: 'expiring', label: 'Läuft bald ab' },
                    { value: 'expired', label: 'Abgelaufen' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setSelectedStatus(opt.value)}
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                        selectedStatus === opt.value
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Documents List */}
            {employee.documents.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center text-gray-500">
                <FileText className="h-12 w-12 text-gray-400" />
                <p className="mt-4">Keine Dokumente vorhanden</p>
              </div>
            ) : (() => {
              const categoryFiltered = selectedCategoryIds.length > 0
                ? employee.documents.filter((doc: any) =>
                    selectedCategoryIds.some((catId) =>
                      doc.categories?.some((dc: any) => dc.category.id === catId)
                    )
                  )
                : employee.documents;

              const statusFiltered = selectedStatus === 'all'
                ? categoryFiltered
                : categoryFiltered.filter((doc: any) => {
                    const display = doc.versions?.[0] || doc;
                    const expDate = display.expirationDate ? new Date(display.expirationDate) : null;
                    const diffDays = expDate
                      ? Math.ceil((expDate.getTime() - Date.now()) / 86400000)
                      : null;
                    if (selectedStatus === 'expired') return diffDays !== null && diffDays < 0;
                    if (selectedStatus === 'expiring') return diffDays !== null && diffDays >= 0 && diffDays <= 30;
                    if (selectedStatus === 'valid') return diffDays === null || diffDays > 30;
                    return true;
                  });

              const filteredDocuments = docSearchQuery.trim()
                ? statusFiltered.filter((doc: any) => {
                    const display = doc.versions?.[0] || doc;
                    return (display.title || doc.title || '').toLowerCase().includes(docSearchQuery.toLowerCase());
                  })
                : statusFiltered;

              const getStatusInfo = (expirationDate: string | null) => {
                if (!expirationDate) {
                  return { label: 'Gültig', color: 'bg-green-100 text-green-800' };
                }
                const now = new Date();
                const expDate = new Date(expirationDate);
                const diffDays = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                if (diffDays < 0) {
                  return { label: 'Abgelaufen', color: 'bg-red-100 text-red-800', days: diffDays };
                } else if (diffDays <= 30) {
                  return { label: 'Läuft bald ab', color: 'bg-orange-100 text-orange-800', days: diffDays };
                } else if (diffDays <= 90) {
                  return { label: 'Gültig', color: 'bg-yellow-100 text-yellow-800', days: diffDays };
                } else {
                  return { label: 'Gültig', color: 'bg-green-100 text-green-800', days: diffDays };
                }
              };

              const handleDocumentClick = (filePath: string) => {
                window.open(filePath, '_blank');
              };

              return filteredDocuments.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center text-gray-500">
                  <FileText className="h-12 w-12 text-gray-400" />
                  <p className="mt-4">Keine Dokumente mit den ausgewählten Kategorien</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Version
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Titel
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Kategorien
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          G&uuml;ltig ab
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Ablaufdatum
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Aktionen
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {filteredDocuments.map((doc: any) => {
                        const display = doc.versions?.[0] || doc;
                        const statusInfo = getStatusInfo(display.expirationDate);
                        const versionCount = doc._count?.versions ?? 0;
                        const latestVersionNum = doc.versions?.[0]?.versionNumber ?? doc.versionNumber ?? 1;
                        const isExpanded = expandedDocIds.has(doc.id);
                        const isLoadingV = loadingVersions.has(doc.id);
                        return (
                          <Fragment key={doc.id}>
                            <tr
                              key={doc.id}
                              onClick={() => handleDocumentClick(display.filePath)}
                              className="cursor-pointer transition-colors hover:bg-gray-50"
                            >
                              {/* Version badge */}
                              <td className="whitespace-nowrap px-6 py-4">
                                <div className="flex items-center gap-1">
                                  <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                                    v{latestVersionNum}
                                  </span>
                                  {versionCount > 0 && (
                                    <button
                                      onClick={(e) => toggleVersions(doc.id, e)}
                                      className="flex items-center gap-0.5 rounded text-xs text-gray-500 hover:text-gray-700"
                                    >
                                      {isLoadingV ? (
                                        <span className="text-gray-400">...</span>
                                      ) : isExpanded ? (
                                        <ChevronDown className="h-3.5 w-3.5" />
                                      ) : (
                                        <ChevronRight className="h-3.5 w-3.5" />
                                      )}
                                      <GitBranch className="h-3 w-3" />
                                      <span>{versionCount}</span>
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="whitespace-nowrap px-6 py-4">
                                <div className="flex items-center">
                                  <FileText className="mr-2 h-5 w-5 text-gray-400" />
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">{display.title}</div>
                                    {display.description && (
                                      <div className="text-xs text-gray-500">{display.description}</div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-wrap gap-1">
                                  {(display.categories || doc.categories || []).length > 0 ? (
                                    (display.categories || doc.categories).map((dc: any) => (
                                      <span
                                        key={dc.category.id}
                                        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                                        style={{
                                          backgroundColor: `${dc.category.color || '#3B82F6'}20`,
                                          color: dc.category.color || '#3B82F6',
                                        }}
                                      >
                                        {dc.category.name}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-xs text-gray-400">-</span>
                                  )}
                                </div>
                              </td>
                              <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                                {display.validFrom ? formatDate(display.validFrom) : '-'}
                              </td>
                              <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                                {display.expirationDate ? formatDate(display.expirationDate) : '-'}
                              </td>
                              <td className="whitespace-nowrap px-6 py-4">
                                <span
                                  className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusInfo.color}`}
                                >
                                  {statusInfo.label}
                                  {statusInfo.days !== undefined && statusInfo.days >= 0 && (
                                    <span className="ml-1">({statusInfo.days}d)</span>
                                  )}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center gap-2">
                                  {display.printFilePath && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); window.open(display.printFilePath, '_blank'); }}
                                      className="rounded p-1 text-gray-400 hover:text-gray-700"
                                      title="Druckversion öffnen (ohne Briefbogen)"
                                    >
                                      <Printer className="h-4 w-4" />
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setEditDocModal(doc); }}
                                    className="flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                    title="Bearbeiten"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                    Bearbeiten
                                  </button>
                                  <button
                                    onClick={(e) => openVersionTypeModal(doc, e)}
                                    className="flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                  >
                                    <Upload className="h-3.5 w-3.5" />
                                    Neue Version
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const display = doc.versions?.[0] || doc;
                                      setDeleteDocModal({ id: doc.id, title: display.title || doc.title });
                                    }}
                                    className="flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                                    title="Dokument löschen"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Löschen
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {/* Expandable version history */}
                            {isExpanded && (
                              <>
                                {isLoadingV ? (
                                  <tr key={`${doc.id}-loading`} className="bg-blue-50">
                                    <td colSpan={7} className="px-10 py-2 text-sm text-gray-500">
                                      Versionen werden geladen...
                                    </td>
                                  </tr>
                                ) : (
                                  (versionHistory[doc.id] || []).map((ver: any, idx: number) => {
                                    const isLatest = idx === (versionHistory[doc.id] || []).length - 1;
                                    const latestStatusInfo = isLatest ? getStatusInfo(ver.expirationDate) : null;
                                    return (
                                      <tr
                                        key={ver.id}
                                        onClick={() => handleDocumentClick(ver.filePath)}
                                        className="cursor-pointer bg-blue-50 hover:bg-blue-100"
                                      >
                                        <td className="whitespace-nowrap pl-10 pr-6 py-3">
                                          <span className="inline-flex rounded-full bg-blue-200 px-2 py-0.5 text-xs font-semibold text-blue-800">
                                            v{ver.versionNumber}
                                          </span>
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-3">
                                          <div className="text-sm text-gray-700">{ver.title}</div>
                                          <div className="text-xs text-gray-400">{formatDate(ver.uploadedAt)}</div>
                                        </td>
                                        <td className="px-6 py-3">
                                          <div className="flex flex-wrap gap-1">
                                            {(ver.categories || []).map((dc: any) => (
                                              <span
                                                key={dc.category.id}
                                                className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                                                style={{
                                                  backgroundColor: `${dc.category.color || '#3B82F6'}20`,
                                                  color: dc.category.color || '#3B82F6',
                                                }}
                                              >
                                                {dc.category.name}
                                              </span>
                                            ))}
                                          </div>
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-3 text-sm text-gray-700">
                                          {ver.validFrom ? formatDate(ver.validFrom) : '-'}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-3 text-sm text-gray-700">
                                          {ver.expirationDate ? formatDate(ver.expirationDate) : '-'}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-3">
                                          {isLatest && latestStatusInfo ? (
                                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${latestStatusInfo.color}`}>
                                              {latestStatusInfo.label}
                                            </span>
                                          ) : !isLatest ? (
                                            <span className="text-sm text-gray-500 italic">Archiviert</span>
                                          ) : null}
                                        </td>
                                        <td className="px-6 py-3" onClick={(e) => e.stopPropagation()}>
                                          {ver.printFilePath && (
                                            <button
                                              onClick={(e) => { e.stopPropagation(); window.open(ver.printFilePath, '_blank'); }}
                                              className="rounded p-1 text-gray-400 hover:text-gray-700"
                                              title="Druckversion öffnen (ohne Briefbogen)"
                                            >
                                              <Printer className="h-4 w-4" />
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })
                                )}
                              </>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        )}

        {activeTab === 'clothing' && (
          <EmployeeClothingInventory employeeId={employee.id} />
        )}

        {activeTab === 'vacations' && (
          <div>
            {employee.vacations.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center text-gray-500">
                <Calendar className="h-12 w-12 text-gray-400" />
                <p className="mt-4">Keine Urlaube vorhanden</p>
              </div>
            ) : (
              <div className="text-gray-500">
                {employee.vacations.length} Urlaub(e) - Kalender-Verwaltung folgt in Phase 9
              </div>
            )}
          </div>
        )}
      </div>

      {/* Upload Modal - new document */}
      <UploadDocumentModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={() => {
          setIsUploadModalOpen(false);
          fetchEmployee();
        }}
        preselectedEmployeeId={employee.id}
      />

      {/* Upload Modal - new version */}
      {newVersionModal && (
        <UploadDocumentModal
          isOpen={true}
          onClose={() => setNewVersionModal(null)}
          onSuccess={() => {
            setNewVersionModal(null);
            setVersionHistory({});
            setExpandedDocIds(new Set());
            fetchEmployee();
          }}
          parentDocumentId={newVersionModal.parentDocumentId}
          preselectedEmployeeId={employee.id}
          prefillData={newVersionModal.prefillData}
        />
      )}

      {/* Version Type Selection Modal */}
      {versionTypeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">Neue Version hinzufügen</h2>
              <button
                onClick={() => setVersionTypeModal(null)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-gray-500 mb-4">Wie möchtest du die neue Version erstellen?</p>
              <button
                onClick={() => openNewVersionModal(versionTypeModal.doc)}
                className="flex w-full items-center gap-4 rounded-lg border border-gray-200 px-4 py-3 text-left hover:border-primary-400 hover:bg-primary-50 transition-colors"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100">
                  <Upload className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Datei hochladen</p>
                  <p className="text-xs text-gray-500">PDF, Word oder andere Datei von deinem Gerät</p>
                </div>
              </button>
              <button
                onClick={() => openGenerateVersionModal(versionTypeModal.doc)}
                className="flex w-full items-center gap-4 rounded-lg border border-gray-200 px-4 py-3 text-left hover:border-primary-400 hover:bg-primary-50 transition-colors"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100">
                  <FileText className="h-5 w-5 text-primary-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Aus Vorlage generieren</p>
                  <p className="text-xs text-gray-500">Automatisch aus einer Dokumentvorlage erstellen</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Version from Template Modal */}
      {generateVersionModal && (
        <GenerateDocumentModal
          isOpen={true}
          onClose={() => setGenerateVersionModal(null)}
          onSuccess={() => {
            setGenerateVersionModal(null);
            setVersionHistory({});
            setExpandedDocIds(new Set());
            fetchEmployee();
          }}
          employeeId={employee.id}
          parentDocumentId={generateVersionModal.parentDocumentId}
          parentDocumentTitle={generateVersionModal.parentDocumentTitle}
        />
      )}

      {/* Edit Document Modal */}
      {editDocModal && (
        <EditDocumentModal
          isOpen={true}
          onClose={() => setEditDocModal(null)}
          onSuccess={() => {
            setEditDocModal(null);
            fetchEmployee();
          }}
          document={editDocModal}
        />
      )}

      {/* Delete Document Modal */}
      {deleteDocModal && (
        <DeleteDocumentModal
          isOpen={true}
          onClose={() => setDeleteDocModal(null)}
          onSuccess={() => {
            setDeleteDocModal(null);
            fetchEmployee();
          }}
          documentId={deleteDocModal.id}
          documentTitle={deleteDocModal.title}
        />
      )}

      {/* Generate Document from Template Modal */}
      <GenerateDocumentModal
        isOpen={generateModalOpen}
        onClose={() => setGenerateModalOpen(false)}
        onSuccess={() => {
          setGenerateModalOpen(false);
          fetchEmployee();
        }}
        employeeId={employee.id}
      />

      {/* Dokumentengruppe Modal */}
      <GroupGenerateDocumentModal
        isOpen={groupGenerateModalOpen}
        onClose={() => setGroupGenerateModalOpen(false)}
        onSuccess={() => {
          setGroupGenerateModalOpen(false);
          fetchEmployee();
        }}
        employeeId={employee.id}
        employeeFullName={`${employee.firstName} ${employee.lastName}`}
        employeeCity={employee.city ?? null}
      />

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Mitarbeiter löschen</h3>
            <p className="mt-2 text-sm text-gray-600">
              Möchten Sie <strong>{employee.firstName} {employee.lastName}</strong> ({employee.employeeNumber}) wirklich löschen?
            </p>
            <p className="mt-2 text-sm text-red-600">
              Achtung: Alle zugehörigen Dokumente ({employee.documents.length}), Bestellungen ({employee.clothingOrders.length}) und Urlaubsdaten ({employee.vacations.length}) werden ebenfalls gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            <div className="mt-4 flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteDialog(false)}
                disabled={deleting}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Wird gelöscht...' : 'Endgültig löschen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
