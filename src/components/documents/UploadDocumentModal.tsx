'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { Upload, X, Tag as TagIcon } from 'lucide-react';

interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
}

interface Category {
  id: string;
  name: string;
  color: string;
}

interface UploadDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedEmployeeId?: string;
  // Für "Neue Version hochladen"-Modus
  parentDocumentId?: string;
  prefillData?: {
    title: string;
    description?: string;
    categories?: string[];
  };
}

export default function UploadDocumentModal({
  isOpen,
  onClose,
  onSuccess,
  preselectedEmployeeId,
  parentDocumentId,
  prefillData,
}: UploadDocumentModalProps) {
  const isNewVersion = !!parentDocumentId;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [availableCategories, setAvailableCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    employeeId: '',
    title: '',
    description: '',
    validFrom: '',
    expirationDate: '',
    notes: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchEmployees();
      fetchCategories();
      if (preselectedEmployeeId) {
        setFormData((prev) => ({ ...prev, employeeId: preselectedEmployeeId }));
      }
      if (prefillData) {
        setFormData((prev) => ({
          ...prev,
          title: prefillData.title || '',
          description: prefillData.description || '',
          validFrom: '',
          expirationDate: '',
        }));
        setSelectedCategories(prefillData.categories || []);
      }
    }
  }, [isOpen, preselectedEmployeeId, prefillData]);

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/employees');
      const data = await response.json();
      setEmployees(data.employees || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      const data = await response.json();
      setAvailableCategories(data.categories || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleAddCategory = (categoryName: string) => {
    const trimmedCategory = categoryName.trim();
    if (!trimmedCategory || selectedCategories.includes(trimmedCategory)) return;
    setSelectedCategories([...selectedCategories, trimmedCategory]);
    setNewCategoryInput('');
  };

  const handleRemoveCategory = (categoryToRemove: string) => {
    setSelectedCategories(selectedCategories.filter((cat) => cat !== categoryToRemove));
  };

  const handleSelectExistingCategory = (categoryName: string) => {
    if (!selectedCategories.includes(categoryName)) {
      setSelectedCategories([...selectedCategories, categoryName]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      alert('Bitte wählen Sie eine Datei aus');
      return;
    }

    const finalCategories = [...selectedCategories];
    const pendingCategory = newCategoryInput.trim();
    if (pendingCategory && !finalCategories.includes(pendingCategory)) {
      finalCategories.push(pendingCategory);
    }

    setUploading(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('employeeId', formData.employeeId || preselectedEmployeeId || '');
      uploadFormData.append('title', formData.title);
      uploadFormData.append('description', formData.description);
      uploadFormData.append('validFrom', formData.validFrom);
      uploadFormData.append('expirationDate', formData.expirationDate);
      uploadFormData.append('notes', formData.notes);
      uploadFormData.append('categories', JSON.stringify(finalCategories));
      if (parentDocumentId) {
        uploadFormData.append('parentDocumentId', parentDocumentId);
      }

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: uploadFormData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Upload failed');
      }

      onSuccess();
      onClose();
      resetForm();
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Fehler beim Hochladen: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'));
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      employeeId: '',
      title: '',
      description: '',
      validFrom: '',
      expirationDate: '',
      notes: '',
    });
    setFile(null);
    setSelectedCategories([]);
    setNewCategoryInput('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isNewVersion ? 'Neue Version hochladen' : 'Dokument hochladen'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {isNewVersion && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
            Sie laden eine neue Version hoch. Die bisherige Version bleibt weiterhin abrufbar.
          </div>
        )}

        {/* File Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Datei *
          </label>
          <div
            className={`mt-1 flex justify-center rounded-lg border-2 border-dashed px-6 py-10 ${
              dragActive
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-300 bg-gray-50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <div className="mt-4 flex text-sm text-gray-600">
                <label
                  htmlFor="file-upload"
                  className="relative cursor-pointer rounded-md font-medium text-primary-600 hover:text-primary-500"
                >
                  <span>Datei ausw&auml;hlen</span>
                  <input
                    id="file-upload"
                    name="file-upload"
                    type="file"
                    className="sr-only"
                    accept=".pdf,.jpg,.jpeg,.png,.docx"
                    onChange={handleFileChange}
                  />
                </label>
                <p className="pl-1">oder Drag &amp; Drop</p>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                PDF, JPG, PNG, DOCX bis zu 10 MB
              </p>
              {file && (
                <p className="mt-2 text-sm font-medium text-primary-600">
                  Ausgew&auml;hlt: {file.name}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Employee Select - nur bei neuem Dokument */}
        {!isNewVersion && (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Mitarbeiter *
            </label>
            <select
              required
              value={formData.employeeId}
              onChange={(e) =>
                setFormData({ ...formData, employeeId: e.target.value })
              }
              disabled={!!preselectedEmployeeId}
              className={`mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500 ${
                preselectedEmployeeId ? 'bg-gray-100 cursor-not-allowed' : ''
              }`}
            >
              <option value="">Bitte w&auml;hlen...</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.employeeNumber} - {employee.firstName} {employee.lastName}
                </option>
              ))}
            </select>
          </div>
        )}

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
                    style={{ backgroundColor: `${color}20`, color: color }}
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
                  .filter((cat) => !selectedCategories.some(
                    (sc) => sc.toLowerCase() === cat.name.toLowerCase()
                  ))
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

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Titel *
          </label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) =>
              setFormData({ ...formData, title: e.target.value })
            }
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Beschreibung
          </label>
          <textarea
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            rows={3}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
          />
        </div>

        {/* Valid From Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            G&uuml;ltig ab
          </label>
          <input
            type="date"
            value={formData.validFrom}
            onChange={(e) =>
              setFormData({ ...formData, validFrom: e.target.value })
            }
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
          />
        </div>

        {/* Expiration Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Ablaufdatum
          </label>
          <input
            type="date"
            value={formData.expirationDate}
            onChange={(e) =>
              setFormData({ ...formData, expirationDate: e.target.value })
            }
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Notizen
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) =>
              setFormData({ ...formData, notes: e.target.value })
            }
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
            disabled={uploading}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {uploading
              ? 'Wird hochgeladen...'
              : isNewVersion
              ? 'Neue Version hochladen'
              : 'Hochladen'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
