'use client';

import { useState, useEffect } from 'react';
import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Edit, Trash2, FileText, Shirt, Calendar, Tag as TagIcon, X, Plus } from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/utils';
import UploadDocumentModal from '@/components/documents/UploadDocumentModal';
import EmployeeClothingInventory from '@/components/employees/EmployeeClothingInventory';

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
  department: {
    id: string;
    name: string;
  } | null;
  documents: any[];
  clothingOrders: any[];
  vacations: any[];
  employeeSize: any;
  customFieldValues: any[];
}

export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('stammdaten');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  useEffect(() => {
    fetchEmployee();
  }, [id]);

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

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-gray-500">Laden...</div>
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
          <button className="flex items-center space-x-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Edit className="h-4 w-4" />
            <span>Bearbeiten</span>
          </button>
          <button className="flex items-center space-x-2 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50">
            <Trash2 className="h-4 w-4" />
            <span>Löschen</span>
          </button>
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
        {activeTab === 'stammdaten' && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Vorname</label>
              <p className="mt-1 text-sm text-gray-900">{employee.firstName}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Nachname</label>
              <p className="mt-1 text-sm text-gray-900">{employee.lastName}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Geburtsdatum</label>
              <p className="mt-1 text-sm text-gray-900">
                {employee.dateOfBirth ? formatDate(employee.dateOfBirth) : '-'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <p className="mt-1 text-sm text-gray-900">{employee.email || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Telefon</label>
              <p className="mt-1 text-sm text-gray-900">{employee.phone || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Abteilung</label>
              <p className="mt-1 text-sm text-gray-900">{employee.department?.name || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Position</label>
              <p className="mt-1 text-sm text-gray-900">{employee.position || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Eintrittsdatum</label>
              <p className="mt-1 text-sm text-gray-900">
                {employee.startDate ? formatDate(employee.startDate) : '-'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Kleidungsbudget</label>
              <p className="mt-1 text-sm text-gray-900">{formatCurrency(employee.clothingBudget)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Verbleibendes Budget</label>
              <p className="mt-1 text-sm font-semibold text-primary-600">
                {formatCurrency(employee.remainingBudget)}
              </p>
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
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="flex items-center space-x-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
                <Plus className="h-4 w-4" />
                <span>Dokument hinzufügen</span>
              </button>
            </div>

            {/* Tag Filter */}
            {employee.documents.length > 0 && (() => {
              // Extract all unique tags from documents
              const allTags = Array.from(
                new Map(
                  employee.documents
                    .flatMap((doc: any) => doc.tags || [])
                    .map((dt: any) => [dt.tag.id, dt.tag])
                ).values()
              );

              return allTags.length > 0 ? (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    <TagIcon className="mr-1 inline h-4 w-4" />
                    Nach Tags filtern
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {allTags.map((tag: any) => {
                      const isSelected = selectedTagIds.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          onClick={() => {
                            setSelectedTagIds((prev) =>
                              isSelected
                                ? prev.filter((id) => id !== tag.id)
                                : [...prev, tag.id]
                            );
                          }}
                          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                            isSelected
                              ? 'border-primary-500 bg-primary-50 text-primary-700'
                              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <TagIcon className="h-3 w-3" />
                          {tag.name}
                          {isSelected && <X className="h-3 w-3" />}
                        </button>
                      );
                    })}
                    {selectedTagIds.length > 0 && (
                      <button
                        onClick={() => setSelectedTagIds([])}
                        className="rounded-full border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Filter zurücksetzen
                      </button>
                    )}
                  </div>
                </div>
              ) : null;
            })()}

            {/* Documents List */}
            {employee.documents.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center text-gray-500">
                <FileText className="h-12 w-12 text-gray-400" />
                <p className="mt-4">Keine Dokumente vorhanden</p>
              </div>
            ) : (() => {
              // Filter documents by selected tags
              const filteredDocuments = selectedTagIds.length > 0
                ? employee.documents.filter((doc: any) =>
                    selectedTagIds.some((tagId) =>
                      doc.tags?.some((dt: any) => dt.tag.id === tagId)
                    )
                  )
                : employee.documents;

              const getStatusInfo = (expirationDate: string | null) => {
                if (!expirationDate) {
                  return { label: 'Kein Ablauf', color: 'bg-gray-100 text-gray-800' };
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
                  <p className="mt-4">Keine Dokumente mit den ausgewählten Tags</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Titel
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Typ
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Ablaufdatum
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Tags
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Hochgeladen
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {filteredDocuments.map((doc: any) => {
                        const statusInfo = getStatusInfo(doc.expirationDate);
                        return (
                          <tr
                            key={doc.id}
                            onClick={() => handleDocumentClick(doc.filePath)}
                            className="cursor-pointer transition-colors hover:bg-gray-50"
                          >
                            <td className="whitespace-nowrap px-6 py-4">
                              <div className="flex items-center">
                                <FileText className="mr-2 h-5 w-5 text-gray-400" />
                                <div>
                                  <div className="text-sm font-medium text-gray-900">{doc.title}</div>
                                  {doc.description && (
                                    <div className="text-xs text-gray-500">{doc.description}</div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                              {doc.documentType?.name || '-'}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                              {doc.expirationDate ? formatDate(doc.expirationDate) : '-'}
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
                            <td className="px-6 py-4">
                              <div className="flex flex-wrap gap-1">
                                {doc.tags && doc.tags.length > 0 ? (
                                  doc.tags.map((dt: any) => (
                                    <span
                                      key={dt.id}
                                      className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"
                                    >
                                      {dt.tag.name}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-xs text-gray-400">-</span>
                                )}
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                              {formatDate(doc.uploadedAt)}
                            </td>
                          </tr>
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

      {/* Upload Modal */}
      <UploadDocumentModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={() => {
          setIsUploadModalOpen(false);
          fetchEmployee();
        }}
        preselectedEmployeeId={employee.id}
      />
    </div>
  );
}
