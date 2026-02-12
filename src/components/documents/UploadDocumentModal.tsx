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

interface DocumentType {
  id: string;
  name: string;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface UploadDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedEmployeeId?: string;
}

export default function UploadDocumentModal({
  isOpen,
  onClose,
  onSuccess,
  preselectedEmployeeId,
}: UploadDocumentModalProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    employeeId: '',
    documentTypeId: '',
    title: '',
    description: '',
    expirationDate: '',
    notes: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchEmployees();
      fetchDocumentTypes();
      fetchTags();
      // Set preselected employee if provided
      if (preselectedEmployeeId) {
        setFormData((prev) => ({ ...prev, employeeId: preselectedEmployeeId }));
      }
    }
  }, [isOpen, preselectedEmployeeId]);

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/employees');
      const data = await response.json();
      setEmployees(data.employees || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchDocumentTypes = async () => {
    try {
      const response = await fetch('/api/document-types');
      const data = await response.json();
      setDocumentTypes(data.documentTypes || []);
    } catch (error) {
      console.error('Error fetching document types:', error);
    }
  };

  const fetchTags = async () => {
    try {
      const response = await fetch('/api/tags');
      const data = await response.json();
      setAvailableTags(data.tags || []);
    } catch (error) {
      console.error('Error fetching tags:', error);
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

  const handleAddTag = (tagName: string) => {
    const trimmedTag = tagName.trim();
    if (!trimmedTag || selectedTags.includes(trimmedTag)) return;

    setSelectedTags([...selectedTags, trimmedTag]);
    setNewTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setSelectedTags(selectedTags.filter((tag) => tag !== tagToRemove));
  };

  const handleSelectExistingTag = (tagName: string) => {
    if (!selectedTags.includes(tagName)) {
      setSelectedTags([...selectedTags, tagName]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      alert('Bitte wählen Sie eine Datei aus');
      return;
    }

    setUploading(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('employeeId', formData.employeeId);
      uploadFormData.append('documentTypeId', formData.documentTypeId);
      uploadFormData.append('title', formData.title);
      uploadFormData.append('description', formData.description);
      uploadFormData.append('expirationDate', formData.expirationDate);
      uploadFormData.append('notes', formData.notes);
      uploadFormData.append('tags', JSON.stringify(selectedTags));

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: uploadFormData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      onSuccess();
      onClose();
      resetForm();
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Fehler beim Hochladen des Dokuments');
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      employeeId: '',
      documentTypeId: '',
      title: '',
      description: '',
      expirationDate: '',
      notes: '',
    });
    setFile(null);
    setSelectedTags([]);
    setNewTagInput('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Dokument hochladen" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
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
                  <span>Datei auswählen</span>
                  <input
                    id="file-upload"
                    name="file-upload"
                    type="file"
                    className="sr-only"
                    accept=".pdf,.jpg,.jpeg,.png,.docx"
                    onChange={handleFileChange}
                  />
                </label>
                <p className="pl-1">oder Drag & Drop</p>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                PDF, JPG, PNG, DOCX bis zu 10 MB
              </p>
              {file && (
                <p className="mt-2 text-sm font-medium text-primary-600">
                  Ausgewählt: {file.name}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Employee Select */}
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
            <option value="">Bitte wählen...</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.employeeNumber} - {employee.firstName} {employee.lastName}
              </option>
            ))}
          </select>
        </div>

        {/* Document Type Select */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Dokumenttyp *
          </label>
          <select
            required
            value={formData.documentTypeId}
            onChange={(e) =>
              setFormData({ ...formData, documentTypeId: e.target.value })
            }
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
          >
            <option value="">Bitte wählen...</option>
            {documentTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
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

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <TagIcon className="inline h-4 w-4 mr-1" />
            Tags
          </label>

          {/* Selected Tags */}
          {selectedTags.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {selectedTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="rounded-full hover:bg-blue-200"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Tag Input */}
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag(newTagInput);
                }
              }}
              placeholder="Neuen Tag eingeben..."
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
            />
            <button
              type="button"
              onClick={() => handleAddTag(newTagInput)}
              disabled={!newTagInput.trim()}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              Hinzufügen
            </button>
          </div>

          {/* Existing Tags Dropdown */}
          {availableTags.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Oder wählen Sie aus bestehenden Tags:</p>
              <div className="flex flex-wrap gap-2">
                {availableTags
                  .filter((tag) => !selectedTags.includes(tag.name))
                  .map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => handleSelectExistingTag(tag.name)}
                      className="inline-flex items-center rounded-full border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <TagIcon className="mr-1 h-3 w-3" />
                      {tag.name}
                    </button>
                  ))}
              </div>
            </div>
          )}
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
            {uploading ? 'Wird hochgeladen...' : 'Hochladen'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
