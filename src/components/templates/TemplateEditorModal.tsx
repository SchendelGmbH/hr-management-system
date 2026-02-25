'use client';

import { useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { X, Bold, Italic, UnderlineIcon, Heading1, Heading2, Heading3, List, ListOrdered } from 'lucide-react';
import { AVAILABLE_VARIABLES } from '@/lib/templateVariables';

interface Template {
  id: string;
  name: string;
  description: string | null;
  content: string;
  letterheadPath: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  template?: Template;
}

export default function TemplateEditorModal({ isOpen, onClose, onSuccess, template }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit, Underline],
    content: '',
    editorProps: {
      attributes: {
        class:
          'min-h-[340px] px-4 py-3 text-sm text-gray-900 focus:outline-none prose prose-sm max-w-none',
      },
    },
  });

  useEffect(() => {
    if (!isOpen) return;
    setName(template?.name ?? '');
    setDescription(template?.description ?? '');
    setError(null);
    if (editor) {
      editor.commands.setContent(template?.content ?? '');
    }
  }, [isOpen, template, editor]);

  const insertVariable = useCallback(
    (key: string) => {
      editor?.commands.insertContent(`{{${key}}}`);
      editor?.commands.focus();
    },
    [editor]
  );

  const handleSave = async () => {
    if (!name.trim()) { setError('Name ist erforderlich'); return; }
    const content = editor?.getHTML() ?? '';
    if (!content || content === '<p></p>') { setError('Inhalt ist erforderlich'); return; }

    setLoading(true);
    setError(null);
    try {
      const url = template ? `/api/templates/${template.id}` : '/api/templates';
      const method = template ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null, content }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Speichern fehlgeschlagen');
        return;
      }
      onSuccess();
      onClose();
    } catch {
      setError('Netzwerkfehler');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const ToolbarButton = ({
    onClick,
    active,
    title,
    children,
  }: {
    onClick: () => void;
    active?: boolean;
    title: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={`rounded p-1.5 transition-colors ${
        active
          ? 'bg-primary-100 text-primary-700'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-4xl flex-col rounded-xl bg-white shadow-xl" style={{ maxHeight: '92vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">
            {template ? 'Vorlage bearbeiten' : 'Neue Vorlage erstellen'}
          </h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body – scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Name & Beschreibung */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Vorlagenname <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z.B. Arbeitsvertrag"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Beschreibung</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Kurze Beschreibung (optional)"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Variable-Chips */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
              Variable einfügen – klicken um an Cursor-Position einzufügen
            </p>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_VARIABLES.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => insertVariable(v.key)}
                  className="rounded-md border border-primary-200 bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700 hover:bg-primary-100 transition-colors"
                  title={`{{${v.key}}}`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Editor */}
          <div className="rounded-lg border border-gray-300 overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center gap-1 border-b border-gray-200 bg-gray-50 px-3 py-2">
              <ToolbarButton
                onClick={() => editor?.chain().focus().toggleBold().run()}
                active={editor?.isActive('bold')}
                title="Fett"
              >
                <Bold className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor?.chain().focus().toggleItalic().run()}
                active={editor?.isActive('italic')}
                title="Kursiv"
              >
                <Italic className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor?.chain().focus().toggleUnderline().run()}
                active={editor?.isActive('underline')}
                title="Unterstrichen"
              >
                <UnderlineIcon className="h-4 w-4" />
              </ToolbarButton>
              <div className="mx-1 h-5 w-px bg-gray-300" />
              <ToolbarButton
                onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                active={editor?.isActive('heading', { level: 1 })}
                title="Überschrift 1"
              >
                <Heading1 className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                active={editor?.isActive('heading', { level: 2 })}
                title="Überschrift 2"
              >
                <Heading2 className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
                active={editor?.isActive('heading', { level: 3 })}
                title="Überschrift 3"
              >
                <Heading3 className="h-4 w-4" />
              </ToolbarButton>
              <div className="mx-1 h-5 w-px bg-gray-300" />
              <ToolbarButton
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
                active={editor?.isActive('bulletList')}
                title="Aufzählung"
              >
                <List className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                active={editor?.isActive('orderedList')}
                title="Nummerierte Liste"
              >
                <ListOrdered className="h-4 w-4" />
              </ToolbarButton>
            </div>

            {/* TipTap Editor Content */}
            <EditorContent editor={editor} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4 shrink-0">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? 'Wird gespeichert…' : template ? 'Speichern' : 'Vorlage erstellen'}
          </button>
        </div>
      </div>
    </div>
  );
}
