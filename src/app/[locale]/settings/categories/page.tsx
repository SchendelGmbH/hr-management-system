'use client';

import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, Check, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface Category {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  isActive: boolean;
  _count: {
    documents: number;
  };
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', color: '#3B82F6' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', description: '', color: '#3B82F6' });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editConfirm, setEditConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!addForm.name.trim()) return;
    setError(null);

    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Fehler beim Erstellen');
        return;
      }

      setShowAddForm(false);
      setAddForm({ name: '', description: '', color: '#3B82F6' });
      fetchCategories();
    } catch (err) {
      console.error('Error:', err);
      setError('Fehler beim Erstellen der Kategorie');
    }
  };

  const startEdit = (category: Category) => {
    setEditingId(category.id);
    setEditForm({
      name: category.name,
      description: category.description || '',
      color: category.color || '#3B82F6',
    });
    setEditConfirm(null);
    setError(null);
  };

  const handleEdit = async (id: string) => {
    const category = categories.find((c) => c.id === id);
    if (!category) return;

    // If name changed and documents affected, show confirmation first
    if (category.name !== editForm.name.trim() && category._count.documents > 0 && editConfirm !== id) {
      setEditConfirm(id);
      return;
    }

    setError(null);
    try {
      const response = await fetch(`/api/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Fehler beim Bearbeiten');
        return;
      }

      setEditingId(null);
      setEditConfirm(null);
      fetchCategories();
    } catch (err) {
      console.error('Error:', err);
      setError('Fehler beim Bearbeiten der Kategorie');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/categories/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Fehler beim Löschen');
        return;
      }

      setDeleteConfirm(null);
      fetchCategories();
    } catch (err) {
      console.error('Error:', err);
      setError('Fehler beim Löschen der Kategorie');
    }
  };

  const toggleActive = async (category: Category) => {
    try {
      await fetch(`/api/categories/${category.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !category.isActive }),
      });
      fetchCategories();
    } catch (err) {
      console.error('Error:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/de/settings" className="text-sm text-primary-600 hover:text-primary-700">
            &larr; Zur&uuml;ck zu Einstellungen
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">Kategorien</h1>
          <p className="mt-2 text-sm text-gray-600">
            Verwalten Sie die Dokument-Kategorien
          </p>
        </div>
        <button
          onClick={() => {
            setShowAddForm(true);
            setError(null);
          }}
          className="flex items-center space-x-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          <Plus className="h-5 w-5" />
          <span>Neue Kategorie</span>
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Add Form */}
      {showAddForm && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Neue Kategorie erstellen</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name *</label>
              <input
                type="text"
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
                placeholder="z.B. Personalausweis"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Beschreibung</label>
              <input
                type="text"
                value={addForm.description}
                onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
                placeholder="Optionale Beschreibung"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Farbe</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={addForm.color}
                  onChange={(e) => setAddForm({ ...addForm, color: e.target.value })}
                  className="h-10 w-14 cursor-pointer rounded border border-gray-300"
                />
                <span className="text-sm text-gray-500">{addForm.color}</span>
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!addForm.name.trim()}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              Erstellen
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                setAddForm({ name: '', description: '', color: '#3B82F6' });
              }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (() => {
        const category = categories.find((c) => c.id === deleteConfirm);
        if (!category) return null;
        return (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600" />
              <div className="flex-1">
                <h4 className="font-semibold text-red-800">Kategorie l&ouml;schen?</h4>
                <p className="mt-1 text-sm text-red-700">
                  {category._count.documents > 0
                    ? `Achtung: ${category._count.documents} Dokument${category._count.documents === 1 ? '' : 'e'} ${category._count.documents === 1 ? 'ist' : 'sind'} von der Kategorie "${category.name}" betroffen. Die Kategorie wird bei allen betroffenen Dokumenten entfernt.`
                    : `Sind Sie sicher, dass Sie die Kategorie "${category.name}" löschen möchten?`}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleDelete(deleteConfirm)}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                  >
                    Ja, l&ouml;schen
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Categories Table */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="text-gray-500">Laden...</div>
          </div>
        ) : categories.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-gray-500">
            <p className="text-lg font-medium">Keine Kategorien vorhanden</p>
            <p className="mt-1 text-sm">Erstellen Sie Ihre erste Kategorie</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Farbe
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Beschreibung
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Dokumente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {categories.map((category) => (
                  <tr key={category.id} className="hover:bg-gray-50">
                    {editingId === category.id ? (
                      <>
                        <td className="whitespace-nowrap px-6 py-4">
                          <input
                            type="color"
                            value={editForm.color}
                            onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                            className="h-8 w-10 cursor-pointer rounded border border-gray-300"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-primary-500 focus:outline-none"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            value={editForm.description}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-primary-500 focus:outline-none"
                          />
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                          {category._count.documents}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            category.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {category.isActive ? 'Aktiv' : 'Inaktiv'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right">
                          {editConfirm === category.id ? (
                            <div className="flex items-center justify-end gap-1">
                              <span className="mr-2 text-xs text-orange-600">
                                {category._count.documents} Dok. betroffen
                              </span>
                              <button
                                onClick={() => handleEdit(category.id)}
                                className="rounded bg-orange-600 p-1.5 text-white hover:bg-orange-700"
                                title="Best&auml;tigen"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingId(null);
                                  setEditConfirm(null);
                                }}
                                className="rounded bg-gray-200 p-1.5 text-gray-600 hover:bg-gray-300"
                                title="Abbrechen"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleEdit(category.id)}
                                className="rounded bg-primary-600 p-1.5 text-white hover:bg-primary-700"
                                title="Speichern"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingId(null);
                                  setEditConfirm(null);
                                }}
                                className="rounded bg-gray-200 p-1.5 text-gray-600 hover:bg-gray-300"
                                title="Abbrechen"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="whitespace-nowrap px-6 py-4">
                          <div
                            className="h-6 w-6 rounded-full border border-gray-200"
                            style={{ backgroundColor: category.color || '#3B82F6' }}
                          />
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{category.name}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-500">
                            {category.description || '-'}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                            {category._count.documents}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <button
                            onClick={() => toggleActive(category)}
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                              category.isActive
                                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                : 'bg-red-100 text-red-800 hover:bg-red-200'
                            }`}
                          >
                            {category.isActive ? 'Aktiv' : 'Inaktiv'}
                          </button>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => startEdit(category)}
                              className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                              title="Bearbeiten"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(category.id)}
                              className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                              title="L&ouml;schen"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
