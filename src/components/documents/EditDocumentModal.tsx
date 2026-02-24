'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { X, Tag as TagIcon } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  color: string;
}

interface EditDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  document: {
    id: string;
    title: string;
    description: string | null;
    validFrom: string | null;
    expirationDate: string | null;
    notes: string | null;
    categories: Array<{ category: { id: string; name: string; color: string } }>;
  };
}

export default function EditDocumentModal({
  isOpen,
  onClose,
  onSuccess,
  document,
}: EditDocumentModalProps) {
  const [availableCategories, setAvailableCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    validFrom: '',
    expirationDate: '',
    notes: '',
  });

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
      setFormData({
        title: document.title || '',
        description: document.description || '',
        validFrom: document.validFrom ? document.validFrom.split('T')[0] : '',
        expirationDate: document.expirationDate ? document.expirationDate.split('T')[0] : '',
        notes: document.notes || '',
      });
      setSelectedCategories(document.categories.map((dc) => dc.category.name));
      setNewCategoryInput('');
    }
  }, [isOpen, document]);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      const data = await response.json();
      setAvailableCategories(data.categories || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleAddCategory = (categoryName: string) => {
    const trimmed = categoryName.trim();
    if (!trimmed || selectedCategories.includes(trimmed)) return;
    setSelectedCategories([...selectedCategories, trimmed]);
    setNewCategoryInput('');
  };

  const handleRemoveCategory = (cat: string) => {
    setSelectedCategories(selectedCategories.filter((c) => c !== cat));
  };

  const handleSelectExistingCategory = (name: string) => {
    if (!selectedCategories.includes(name)) {
      setSelectedCategories([...selectedCategories, name]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const finalCategories = [...selectedCategories];
    const pending = newCategoryInput.trim();
    if (pending && !finalCategories.includes(pending)) {
      finalCategories.push(pending);
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/documents/${document.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          validFrom: formData.validFrom || null,
          expirationDate: formData.expirationDate || null,
          notes: formData.notes,
          categories: finalCategories,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Speichern fehlgeschlagen');
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error updating document:', error);
      alert('Fehler beim Speichern: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Dokument bearbeiten" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Titel *</label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Beschreibung</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
          />
        </div>

        {/* Categories */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <TagIcon className="inline h-4 w-4 mr-1" />
            Kategorien
          </label>

          {selectedCategories.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {selectedCategories.map((cat) => {
                const existing = availableCategories.find(
                  (c) => c.name.toLowerCase() === cat.toLowerCase()
                );
                const color = existing?.color || '#3B82F6';
                return (
                  <span
                    key={cat}
                    className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium"
                    style={{ backgroundColor: `${color}20`, color }}
                  >
                    {cat}
                    <button
                      type="button"
                      onClick={() => handleRemoveCategory(cat)}
                      className="rounded-full hover:opacity-70"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newCategoryInput}
              onChange={(e) => setNewCategoryInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCategory(newCategoryInput);
                }
              }}
              placeholder="Neue Kategorie eingeben..."
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
            />
            <button
              type="button"
              onClick={() => handleAddCategory(newCategoryInput)}
              disabled={!newCategoryInput.trim()}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              Hinzuf&uuml;gen
            </button>
          </div>

          {availableCategories.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Oder w&auml;hlen Sie aus bestehenden Kategorien:</p>
              <div className="flex flex-wrap gap-2">
                {availableCategories
                  .filter((cat) => !selectedCategories.some((sc) => sc.toLowerCase() === cat.name.toLowerCase()))
                  .map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleSelectExistingCategory(cat.name)}
                      className="inline-flex items-center rounded-full border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <span
                        className="mr-1.5 h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: cat.color || '#3B82F6' }}
                      />
                      {cat.name}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Valid From */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">G&uuml;ltig ab</label>
            <input
              type="date"
              value={formData.validFrom}
              onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Ablaufdatum</label>
            <input
              type="date"
              value={formData.expirationDate}
              onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Notizen</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={2}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
          />
        </div>

        {/* Buttons */}
        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Wird gespeichert...' : 'Speichern'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
