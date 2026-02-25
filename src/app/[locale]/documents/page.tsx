'use client';

import { useState, useEffect, Fragment } from 'react';
import { FileText, Plus, Tag as TagIcon, X, User, GitBranch, ChevronDown, ChevronRight, Upload, Pencil, Search, Trash2 } from 'lucide-react';
import { formatDate, daysUntil, getExpirationStatus } from '@/lib/utils';
import UploadDocumentModal from '@/components/documents/UploadDocumentModal';
import EditDocumentModal from '@/components/documents/EditDocumentModal';
import DeleteDocumentModal from '@/components/documents/DeleteDocumentModal';
import { TableSkeleton } from '@/components/ui/Skeleton';

interface Category {
  id: string;
  name: string;
  color: string;
}

interface DocumentVersion {
  id: string;
  title: string;
  fileName: string;
  filePath: string;
  validFrom: string | null;
  expirationDate: string | null;
  uploadedAt: string;
  versionNumber: number;
  categories: Array<{ category: Category }>;
}

interface Document {
  id: string;
  employeeId: string;
  title: string;
  description: string | null;
  notes: string | null;
  fileName: string;
  filePath: string;
  validFrom: string | null;
  expirationDate: string | null;
  uploadedAt: string;
  versionNumber: number;
  employee: {
    firstName: string;
    lastName: string;
    employeeNumber: string;
  };
  categories: Array<{ category: Category }>;
  versions: DocumentVersion[]; // latest version (take: 1 desc)
  _count: { versions: number };
}

interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Versioning state
  const [newVersionModal, setNewVersionModal] = useState<{
    parentDocumentId: string;
    employeeId: string;
    prefillData: { title: string; description?: string; categories?: string[] };
  } | null>(null);
  const [expandedDocIds, setExpandedDocIds] = useState<Set<string>>(new Set());
  const [versionHistory, setVersionHistory] = useState<Record<string, DocumentVersion[]>>({});
  const [loadingVersions, setLoadingVersions] = useState<Set<string>>(new Set());
  const [editModal, setEditModal] = useState<Document | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ id: string; title: string } | null>(null);

  // Einmalig beim Mount: Kategorien und Mitarbeiter laden
  useEffect(() => {
    fetchCategories();
    fetchEmployees();
  }, []);

  // Bei Filter-Änderungen sofort neu laden; Suchfeld mit 300 ms Debounce
  useEffect(() => {
    fetchDocuments();
  }, [statusFilter, selectedCategoryId, selectedEmployeeId]);

  useEffect(() => {
    const timer = setTimeout(() => fetchDocuments(), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (selectedCategoryId) params.append('categoryId', selectedCategoryId);
      if (selectedEmployeeId) params.append('employeeId', selectedEmployeeId);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
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

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      const data = await response.json();
      setAllCategories(data.categories || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
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
      if (isExpanded) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  };

  const openNewVersionModal = (doc: Document, e: React.MouseEvent) => {
    e.stopPropagation();
    const categoryNames = (doc.versions[0]?.categories || doc.categories).map(
      (dc) => dc.category.name
    );
    setNewVersionModal({
      parentDocumentId: doc.id,
      employeeId: doc.employeeId,
      prefillData: {
        title: doc.versions[0]?.title || doc.title,
        categories: categoryNames,
      },
    });
  };

  const handleDocumentClick = (filePath: string) => {
    window.open(filePath, '_blank');
  };

  // Returns the display data: if there's a newer version, show that; otherwise show root
  const getDisplayDoc = (doc: Document) => {
    if (doc.versions && doc.versions.length > 0) {
      return doc.versions[0]; // already sorted desc (latest first)
    }
    return doc;
  };

  const totalVersionCount = (doc: Document) => doc._count?.versions ?? 0;

  const renderCategoryBadges = (categories: Array<{ category: Category }>) => {
    if (!categories || categories.length === 0) {
      return <span className="text-xs text-gray-400">-</span>;
    }
    return (
      <div className="flex flex-wrap gap-1">
        {categories.map((dc) => (
          <span
            key={dc.category.id}
            className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium"
            style={{
              backgroundColor: `${dc.category.color || '#3B82F6'}20`,
              color: dc.category.color || '#3B82F6',
            }}
          >
            {dc.category.name}
          </span>
        ))}
      </div>
    );
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

      {/* Upload modal for new documents */}
      <UploadDocumentModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={fetchDocuments}
      />

      {/* Upload modal for new version */}
      {newVersionModal && (
        <UploadDocumentModal
          isOpen={true}
          onClose={() => setNewVersionModal(null)}
          onSuccess={() => {
            setNewVersionModal(null);
            setVersionHistory({});
            setExpandedDocIds(new Set());
            fetchDocuments();
          }}
          parentDocumentId={newVersionModal.parentDocumentId}
          preselectedEmployeeId={newVersionModal.employeeId}
          prefillData={newVersionModal.prefillData}
        />
      )}

      {/* Edit modal */}
      {editModal && (
        <EditDocumentModal
          isOpen={true}
          onClose={() => setEditModal(null)}
          onSuccess={() => {
            setEditModal(null);
            fetchDocuments();
          }}
          document={editModal}
        />
      )}

      {/* Delete confirmation modal */}
      {deleteModal && (
        <DeleteDocumentModal
          isOpen={true}
          onClose={() => setDeleteModal(null)}
          onSuccess={() => {
            setDeleteModal(null);
            fetchDocuments();
          }}
          documentId={deleteModal.id}
          documentTitle={deleteModal.title}
        />
      )}

      {/* Filters */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Nach Titel suchen…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
          />
        </div>

        {/* Status Filter */}
        <div>
          <label className="text-xs font-medium text-gray-600 mb-2 block">Status:</label>
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'all', label: 'Alle' },
              { value: 'valid', label: 'G\u00fcltig' },
              { value: 'expiring', label: 'L\u00e4uft bald ab' },
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

        {/* Category Filter */}
        {allCategories.length > 0 && (
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 flex items-center">
              <TagIcon className="h-4 w-4 mr-1" />
              Nach Kategorie filtern:
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategoryId('')}
                className={`rounded-full px-4 py-2 text-sm font-medium ${
                  !selectedCategoryId
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Alle Kategorien
              </button>
              {allCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-medium ${
                    selectedCategoryId === cat.id ? 'text-white' : 'hover:opacity-80'
                  }`}
                  style={
                    selectedCategoryId === cat.id
                      ? { backgroundColor: cat.color || '#3B82F6' }
                      : { backgroundColor: `${cat.color || '#3B82F6'}20`, color: cat.color || '#3B82F6' }
                  }
                >
                  {cat.name}
                  {selectedCategoryId === cat.id && (
                    <X
                      className="ml-2 h-4 w-4"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCategoryId('');
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
          <TableSkeleton
            rows={8}
            headers={['Version', 'Mitarbeiter', 'Kategorien', 'Titel', 'Gültig ab', 'Ablaufdatum', 'Tage', 'Status', 'Aktionen']}
          />
        ) : documents.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center">
            <FileText className="h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">Keine Dokumente gefunden</h3>
            <p className="mt-2 text-sm text-gray-500">Laden Sie das erste Dokument hoch</p>
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
                    Mitarbeiter
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Kategorien
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Titel
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    G&uuml;ltig ab
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
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {documents.map((doc) => {
                  const display = getDisplayDoc(doc);
                  const days = display.expirationDate ? daysUntil(display.expirationDate) : null;
                  const status = days !== null ? getExpirationStatus(days) : null;
                  const versionCount = totalVersionCount(doc);
                  const isExpanded = expandedDocIds.has(doc.id);
                  const isLoadingV = loadingVersions.has(doc.id);
                  const latestVersionNum = doc.versions[0]?.versionNumber ?? doc.versionNumber;

                  return (
                    <Fragment key={doc.id}>
                      <tr
                        onClick={() => handleDocumentClick(display.filePath)}
                        className="cursor-pointer transition-colors hover:bg-gray-50"
                      >
                        {/* Version Badge */}
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="flex items-center gap-1">
                            <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                              v{latestVersionNum}
                            </span>
                            {versionCount > 0 && (
                              <button
                                onClick={(e) => toggleVersions(doc.id, e)}
                                className="flex items-center gap-0.5 rounded text-xs text-gray-500 hover:text-gray-700"
                                title={isExpanded ? 'Versionen ausblenden' : 'Versionen anzeigen'}
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
                          <div className="text-sm font-medium text-gray-900">
                            {doc.employee.firstName} {doc.employee.lastName}
                          </div>
                          <div className="text-xs text-gray-500">{doc.employee.employeeNumber}</div>
                        </td>

                        <td className="px-6 py-4">
                          {renderCategoryBadges(display.categories || doc.categories)}
                        </td>

                        <td className="px-6 py-4 text-sm text-gray-900">{display.title}</td>

                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {display.validFrom ? formatDate(display.validFrom) : '-'}
                        </td>

                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {display.expirationDate ? formatDate(display.expirationDate) : '-'}
                        </td>

                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {days !== null ? `${days} Tage` : '-'}
                        </td>

                        <td className="whitespace-nowrap px-6 py-4">
                          {status ? (
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${status.bgColor} ${status.color}`}
                            >
                              {status.status === 'expired'
                                ? 'Abgelaufen'
                                : status.status === 'critical'
                                  ? 'Kritisch'
                                  : status.status === 'warning'
                                    ? 'Warnung'
                                    : 'G\u00fcltig'}
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                              G&uuml;ltig
                            </span>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-6 py-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditModal(doc); }}
                              className="flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                              title="Bearbeiten"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Bearbeiten
                            </button>
                            <button
                              onClick={(e) => openNewVersionModal(doc, e)}
                              className="flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                              title="Neue Version hochladen"
                            >
                              <Upload className="h-3.5 w-3.5" />
                              Neue Version
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const display = getDisplayDoc(doc);
                                setDeleteModal({ id: doc.id, title: display.title || doc.title });
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

                      {/* Expandable version history rows */}
                      {isExpanded && (
                        <>
                          {isLoadingV ? (
                            <tr key={`${doc.id}-loading`} className="bg-blue-50">
                              <td colSpan={9} className="px-10 py-2 text-sm text-gray-500">
                                Versionen werden geladen...
                              </td>
                            </tr>
                          ) : (
                            (versionHistory[doc.id] || []).map((ver, idx) => {
                              const isLatest = idx === (versionHistory[doc.id] || []).length - 1;
                              const verDays = isLatest && ver.expirationDate ? daysUntil(ver.expirationDate) : null;
                              const verStatus = isLatest && verDays !== null ? getExpirationStatus(verDays) : null;
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
                                    <div className="text-xs text-gray-500">
                                      {formatDate(ver.uploadedAt)}
                                    </div>
                                  </td>
                                  <td className="px-6 py-3">
                                    {renderCategoryBadges(ver.categories)}
                                  </td>
                                  <td className="px-6 py-3 text-sm text-gray-700">{ver.title}</td>
                                  <td className="whitespace-nowrap px-6 py-3 text-sm text-gray-700">
                                    {ver.validFrom ? formatDate(ver.validFrom) : '-'}
                                  </td>
                                  <td className="whitespace-nowrap px-6 py-3 text-sm text-gray-700">
                                    {ver.expirationDate ? formatDate(ver.expirationDate) : '-'}
                                  </td>
                                  <td className="whitespace-nowrap px-6 py-3 text-sm text-gray-700">
                                    {isLatest ? (verDays !== null ? `${verDays} Tage` : '-') : ''}
                                  </td>
                                  <td className="whitespace-nowrap px-6 py-3">
                                    {isLatest ? (
                                      verStatus ? (
                                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${verStatus.bgColor} ${verStatus.color}`}>
                                          {verStatus.status === 'expired' ? 'Abgelaufen' : verStatus.status === 'critical' ? 'Kritisch' : verStatus.status === 'warning' ? 'Warnung' : 'Gültig'}
                                        </span>
                                      ) : (
                                        <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">Gültig</span>
                                      )
                                    ) : (
                                      <span className="text-sm text-gray-500 italic">Archiviert</span>
                                    )}
                                  </td>
                                  <td className="px-6 py-3" />
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
        )}
      </div>
    </div>
  );
}
