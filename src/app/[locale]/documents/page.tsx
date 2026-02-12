'use client';

import { useState, useEffect } from 'react';
import { FileText, Plus, Tag as TagIcon, X, User } from 'lucide-react';
import { formatDate, daysUntil, getExpirationStatus } from '@/lib/utils';
import UploadDocumentModal from '@/components/documents/UploadDocumentModal';

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Document {
  id: string;
  title: string;
  fileName: string;
  filePath: string;
  expirationDate: string | null;
  uploadedAt: string;
  employee: {
    firstName: string;
    lastName: string;
    employeeNumber: string;
  };
  documentType: {
    name: string;
  };
  tags: Array<{
    tag: Tag;
  }>;
}

interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTagId, setSelectedTagId] = useState<string>('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  useEffect(() => {
    fetchDocuments();
    fetchTags();
    fetchEmployees();
  }, [statusFilter, selectedTagId, selectedEmployeeId]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (selectedTagId) {
        params.append('tagId', selectedTagId);
      }
      if (selectedEmployeeId) {
        params.append('employeeId', selectedEmployeeId);
      }
      const queryString = params.toString();
      const response = await fetch(`/api/documents${queryString ? `?${queryString}` : ''}`);
      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTags = async () => {
    try {
      const response = await fetch('/api/tags');
      const data = await response.json();
      setAllTags(data.tags || []);
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/employees');
      const data = await response.json();
      setEmployees(data.employees || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const handleDocumentClick = (filePath: string) => {
    window.open(filePath, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dokumente</h1>
          <p className="mt-2 text-sm text-gray-600">
            Dokumentenmanagement mit Ablaufverfolgung
          </p>
        </div>
        <button
          onClick={() => setIsUploadModalOpen(true)}
          className="flex items-center space-x-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          <Plus className="h-5 w-5" />
          <span>Dokument hochladen</span>
        </button>
      </div>

      <UploadDocumentModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={fetchDocuments}
      />

      {/* Filters */}
      <div className="space-y-3">
        {/* Status Filter */}
        <div>
          <label className="text-xs font-medium text-gray-600 mb-2 block">Status:</label>
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'all', label: 'Alle' },
              { value: 'valid', label: 'Gültig' },
              { value: 'expiring', label: 'Läuft bald ab' },
              { value: 'expired', label: 'Abgelaufen' },
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() => setStatusFilter(filter.value)}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  statusFilter === filter.value
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Employee Filter */}
        {employees.length > 0 && (
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 flex items-center">
              <User className="h-4 w-4 mr-1" />
              Nach Mitarbeiter filtern:
            </label>
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="block w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
            >
              <option value="">Alle Mitarbeiter</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.employeeNumber} - {employee.firstName} {employee.lastName}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Tag Filter */}
        {allTags.length > 0 && (
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 flex items-center">
              <TagIcon className="h-4 w-4 mr-1" />
              Nach Tag filtern:
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedTagId('')}
                className={`rounded-full px-4 py-2 text-sm font-medium ${
                  !selectedTagId
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Alle Tags
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => setSelectedTagId(tag.id)}
                  className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-medium ${
                    selectedTagId === tag.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                  }`}
                >
                  <TagIcon className="mr-1 h-3 w-3" />
                  {tag.name}
                  {selectedTagId === tag.id && (
                    <X
                      className="ml-2 h-4 w-4"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTagId('');
                      }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Documents Table */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="text-gray-500">Laden...</div>
          </div>
        ) : documents.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center">
            <FileText className="h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">Keine Dokumente gefunden</h3>
            <p className="mt-2 text-sm text-gray-500">
              Laden Sie das erste Dokument hoch
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Mitarbeiter
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Dokumenttyp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Titel
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Tags
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Ablaufdatum
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Tage bis Ablauf
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {documents.map((doc) => {
                  const days = doc.expirationDate ? daysUntil(doc.expirationDate) : null;
                  const status = days !== null ? getExpirationStatus(days) : null;

                  return (
                    <tr
                      key={doc.id}
                      onClick={() => handleDocumentClick(doc.filePath)}
                      className="cursor-pointer transition-colors hover:bg-gray-50"
                    >
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {doc.employee.firstName} {doc.employee.lastName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {doc.employee.employeeNumber}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                        {doc.documentType.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{doc.title}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {doc.tags && doc.tags.length > 0 ? (
                            doc.tags.map((docTag) => (
                              <span
                                key={docTag.tag.id}
                                className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800"
                              >
                                <TagIcon className="mr-1 h-3 w-3" />
                                {docTag.tag.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                        {doc.expirationDate ? formatDate(doc.expirationDate) : '-'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                        {days !== null ? `${days} Tage` : '-'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        {status && (
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${status.bgColor} ${status.color}`}
                          >
                            {status.status === 'expired'
                              ? 'Abgelaufen'
                              : status.status === 'critical'
                                ? 'Kritisch'
                                : status.status === 'warning'
                                  ? 'Warnung'
                                  : 'Gültig'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
