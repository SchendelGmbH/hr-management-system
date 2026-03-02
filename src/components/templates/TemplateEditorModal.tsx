'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent, useEditorState } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle, FontSize } from '@tiptap/extension-text-style';
import {
  X,
  Bold,
  Italic,
  UnderlineIcon,
  List,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  IndentIncrease,
  IndentDecrease,
  SeparatorHorizontal,
} from 'lucide-react';
import { AVAILABLE_VARIABLES } from '@/lib/templateVariables';

const INDENT_SIZE = 24;
const MAX_INDENT = 10;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indent: {
      increaseIndent: () => ReturnType;
      decreaseIndent: () => ReturnType;
    };
  }
}

const IndentExtension = Extension.create({
  name: 'indent',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (el) => {
              const pl = (el as HTMLElement).style.paddingLeft;
              return pl ? Math.round(parseInt(pl) / INDENT_SIZE) : 0;
            },
            renderHTML: (attrs) => {
              if (!attrs.indent) return {};
              return { style: `padding-left: ${attrs.indent * INDENT_SIZE}px` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      increaseIndent: () => ({ editor, commands }) => {
        const current = editor.getAttributes('paragraph').indent ?? 0;
        return commands.updateAttributes('paragraph', { indent: Math.min(current + 1, MAX_INDENT) });
      },
      decreaseIndent: () => ({ editor, commands }) => {
        const current = editor.getAttributes('paragraph').indent ?? 0;
        if (current <= 0) return false;
        return commands.updateAttributes('paragraph', { indent: Math.max(current - 1, 0) });
      },
    };
  },
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        const { $from } = this.editor.state.selection;
        // Cursor at start of paragraph → block-level indent
        if ($from.parentOffset === 0) {
          return this.editor.commands.increaseIndent();
        }
        // Mid-paragraph (e.g. after Shift+Enter hardBreak) → insert inline spaces
        return this.editor.commands.insertContent('\u00A0\u00A0\u00A0\u00A0');
      },
      'Shift-Tab': () => this.editor.commands.decreaseIndent(),
    };
  },
});

const FONT_SIZES = ['8', '9', '10', '11', '12', '14', '16', '18', '20', '24', '28', '32'];

interface Template {
  id: string;
  name: string;
  description: string | null;
  content: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  template?: Template;
}

type AutosaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export default function TemplateEditorModal({ isOpen, onClose, onSuccess, template }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Autosave
  const [autosave, setAutosave] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('template-editor-autosave') === 'true';
  });
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Refs so the debounced callback always reads fresh values without stale closures
  const nameRef = useRef(name);
  const descriptionRef = useRef(description);

  const editor = useEditor({
    immediatelyRender: false,
    enableInputRules: false,
    extensions: [
      StarterKit.configure({ heading: false, orderedList: false }),
      Underline,
      TextStyle,
      FontSize,
      TextAlign.configure({ types: ['paragraph'] }),
      IndentExtension,
    ],
    content: '',
    editorProps: {
      attributes: {
        class:
          'min-h-full px-4 py-3 text-sm text-gray-900 focus:outline-none prose prose-sm max-w-none',
      },
    },
  });

  useEffect(() => {
    if (!isOpen) return;
    setName(template?.name ?? '');
    setDescription(template?.description ?? '');
    setError(null);
    setAutosaveStatus('idle');
    setLastSavedAt(null);
    if (editor) {
      editor.commands.setContent(template?.content ?? '');
    }
  }, [isOpen, template, editor]);

  // Refs immer aktuell halten
  useEffect(() => { nameRef.current = name; }, [name]);
  useEffect(() => { descriptionRef.current = description; }, [description]);

  // Kernfunktion: speichert sofort (kein Debounce hier, der Timer ist außerhalb)
  const performAutosave = useCallback(async () => {
    if (!template || !editor) return;
    const n = nameRef.current.trim();
    if (!n) return;
    const content = editor.getHTML();
    if (!content || content === '<p></p>') return;

    setAutosaveStatus('saving');
    try {
      const res = await fetch(`/api/templates/${template.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: n, description: descriptionRef.current.trim() || null, content }),
      });
      if (res.ok) {
        setAutosaveStatus('saved');
        setLastSavedAt(new Date());
      } else {
        setAutosaveStatus('error');
      }
    } catch {
      setAutosaveStatus('error');
    }
  }, [template, editor]);

  // Debounced Autosave auslösen
  const scheduleAutosave = useCallback(() => {
    if (!autosave || !template) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    setAutosaveStatus('pending');
    autosaveTimer.current = setTimeout(() => performAutosave(), 2000);
  }, [autosave, template, performAutosave]);

  // Editor-Änderungen beobachten
  useEffect(() => {
    if (!editor || !autosave || !template) return;
    editor.on('update', scheduleAutosave);
    return () => { editor.off('update', scheduleAutosave); };
  }, [editor, autosave, template, scheduleAutosave]);

  // Name / Beschreibung-Änderungen beobachten
  useEffect(() => {
    scheduleAutosave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, description]);

  const handleAutosaveToggle = (enabled: boolean) => {
    setAutosave(enabled);
    localStorage.setItem('template-editor-autosave', String(enabled));
    if (!enabled) {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      setAutosaveStatus('idle');
    }
  };

  const insertVariable = useCallback(
    (key: string) => {
      editor?.commands.insertContent(`{{${key}}}`);
      editor?.commands.focus();
    },
    [editor]
  );

  // Editor-State reaktiv abonnieren (TipTap v3 – triggert Re-Render bei Selection-Änderungen)
  const editorState = useEditorState({
    editor,
    selector: (ctx) => ({
      isBold: ctx.editor?.isActive('bold') ?? false,
      isItalic: ctx.editor?.isActive('italic') ?? false,
      isUnderline: ctx.editor?.isActive('underline') ?? false,
      isBulletList: ctx.editor?.isActive('bulletList') ?? false,
      alignLeft: ctx.editor?.isActive({ textAlign: 'left' }) ?? false,
      alignCenter: ctx.editor?.isActive({ textAlign: 'center' }) ?? false,
      alignRight: ctx.editor?.isActive({ textAlign: 'right' }) ?? false,
      alignJustify: ctx.editor?.isActive({ textAlign: 'justify' }) ?? false,
      fontSize: ctx.editor?.getAttributes('textStyle').fontSize?.replace('pt', '') ?? '',
    }),
  });

  const currentFontSize = editorState?.fontSize ?? '';

  const handleFontSizeChange = (size: string) => {
    if (!size) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (editor?.chain().focus() as any).unsetFontSize().run();
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (editor?.chain().focus() as any).setFontSize(`${size}pt`).run();
    }
  };

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

        {/* Body – nur Editor-Content scrollt */}
        <div className="flex-1 flex flex-col overflow-hidden px-6 py-5 gap-4">
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
          <div className="rounded-lg border border-gray-300 overflow-hidden flex flex-col flex-1 min-h-0">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50 px-3 py-2 shrink-0">

              {/* Schriftformatierung */}
              <ToolbarButton
                onClick={() => editor?.chain().focus().toggleBold().run()}
                active={editorState?.isBold}
                title="Fett"
              >
                <Bold className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor?.chain().focus().toggleItalic().run()}
                active={editorState?.isItalic}
                title="Kursiv"
              >
                <Italic className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor?.chain().focus().toggleUnderline().run()}
                active={editorState?.isUnderline}
                title="Unterstrichen"
              >
                <UnderlineIcon className="h-4 w-4" />
              </ToolbarButton>

              <div className="mx-1 h-5 w-px bg-gray-300" />

              {/* Schriftgröße */}
              <select
                value={currentFontSize}
                onChange={(e) => handleFontSizeChange(e.target.value)}
                title="Schriftgröße"
                onMouseDown={(e) => e.stopPropagation()}
                className="h-7 rounded border border-gray-300 bg-white px-1 text-xs text-gray-700 focus:border-primary-500 focus:outline-none cursor-pointer"
              >
                <option value="">Größe</option>
                {FONT_SIZES.map((s) => (
                  <option key={s} value={s}>{s} pt</option>
                ))}
              </select>

              <div className="mx-1 h-5 w-px bg-gray-300" />

              {/* Listen */}
              <ToolbarButton
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
                active={editorState?.isBulletList}
                title="Aufzählung"
              >
                <List className="h-4 w-4" />
              </ToolbarButton>

              <div className="mx-1 h-5 w-px bg-gray-300" />

              {/* Einrückung */}
              <ToolbarButton
                onClick={() => editor?.chain().focus().decreaseIndent().run()}
                title="Einrückung verringern (Shift+Tab)"
              >
                <IndentDecrease className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor?.chain().focus().increaseIndent().run()}
                title="Einrückung erhöhen (Tab)"
              >
                <IndentIncrease className="h-4 w-4" />
              </ToolbarButton>

              <div className="mx-1 h-5 w-px bg-gray-300" />

              {/* Textausrichtung */}
              <ToolbarButton
                onClick={() => editor?.chain().focus().setTextAlign('left').run()}
                active={editorState?.alignLeft}
                title="Linksbündig"
              >
                <AlignLeft className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor?.chain().focus().setTextAlign('center').run()}
                active={editorState?.alignCenter}
                title="Zentriert"
              >
                <AlignCenter className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor?.chain().focus().setTextAlign('right').run()}
                active={editorState?.alignRight}
                title="Rechtsbündig"
              >
                <AlignRight className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor?.chain().focus().setTextAlign('justify').run()}
                active={editorState?.alignJustify}
                title="Blocksatz"
              >
                <AlignJustify className="h-4 w-4" />
              </ToolbarButton>

              <div className="mx-1 h-5 w-px bg-gray-300" />

              {/* Trennlinie */}
              <ToolbarButton
                onClick={() => editor?.chain().focus().setHorizontalRule().run()}
                title="Trennlinie einfügen"
              >
                <SeparatorHorizontal className="h-4 w-4" />
              </ToolbarButton>

              {/* Autosave Toggle — nur im Bearbeiten-Modus sichtbar */}
              {template && (
                <>
                  <div className="mx-1 h-5 w-px bg-gray-300" />
                  <div className="flex items-center gap-2 ml-auto">
                    {/* Status-Anzeige */}
                    <span className="text-xs text-gray-400 min-w-[120px] text-right">
                      {autosaveStatus === 'pending' && 'Änderungen erkannt…'}
                      {autosaveStatus === 'saving' && 'Wird gespeichert…'}
                      {autosaveStatus === 'saved' && lastSavedAt && (
                        `Gespeichert ${lastSavedAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
                      )}
                      {autosaveStatus === 'error' && <span className="text-red-500">Fehler beim Speichern</span>}
                    </span>
                    {/* Toggle */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={autosave}
                      onClick={() => handleAutosaveToggle(!autosave)}
                      title={autosave ? 'Autosave deaktivieren' : 'Autosave aktivieren'}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                        autosave ? 'bg-primary-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          autosave ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <span className="text-xs text-gray-600 select-none">Autosave</span>
                  </div>
                </>
              )}
            </div>

            {/* TipTap Editor Content – nur dieser Bereich scrollt */}
            <div className="flex-1 overflow-y-auto min-h-0">
              <EditorContent editor={editor} />
            </div>
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
