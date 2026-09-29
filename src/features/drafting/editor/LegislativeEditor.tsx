import Editor, { type OnMount } from '@monaco-editor/react';
import { Maximize2, Minimize2, Printer, Redo2, Save, Undo2, Wand2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { DraftComponent, InlineFeedbackMarker, SaveStatus } from '../types/drafting.types';
import { countWords } from '../utils/draftingUtils';

interface LegislativeEditorProps {
  component: DraftComponent | undefined;
  markers: InlineFeedbackMarker[];
  value: string;
  saveStatus: SaveStatus;
  fullscreen: boolean;
  printMode: boolean;
  onChange(value: string): void;
  onSaveVersion(): void;
  onToggleFullscreen(): void;
  onTogglePrintMode(): void;
  onMarkerSelect(id: string): void;
}

export function LegislativeEditor({ component, markers, value, saveStatus, fullscreen, printMode, onChange, onSaveVersion, onToggleFullscreen, onTogglePrintMode, onMarkerSelect }: LegislativeEditorProps) {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const decorationsRef = useRef<string[]>([]);
  const stats = useMemo(() => ({ words: countWords(value), characters: value.length, sections: (value.match(/\bsection\s+\d+/gi) ?? []).length }), [value]);

  const mount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    monaco.languages.register({ id: 'legislative-draft' });
    monaco.languages.setMonarchTokensProvider('legislative-draft', {
      tokenizer: {
        root: [
          [/\b(shall|may|must|means|includes|provided|notwithstanding|subject to)\b/i, 'keyword'],
          [/\b(section|sub-section|clause|schedule|chapter|part)\s+\d+[A-Z]?\b/i, 'type.identifier'],
          [/"[^"]*"/, 'string'],
          [/\b\d+\b/, 'number'],
        ],
      },
    });
  }, []);

  const applyMarkers = useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, markers.map((marker) => ({
      range: new monaco.Range(marker.line, marker.column, marker.endLine ?? marker.line, marker.endColumn ?? marker.column + 12),
      options: {
        isWholeLine: false,
        className: `draft-marker-${marker.severity}`,
        glyphMarginClassName: `draft-glyph-${marker.severity}`,
        hoverMessage: { value: `**${marker.title}**\n\n${marker.explanation}` },
      },
    })));
    editor.onMouseDown((event: any) => {
      if (!event.target?.position) return;
      const hit = markers.find((marker) => marker.line === event.target.position.lineNumber);
      if (hit) onMarkerSelect(hit.id);
    });
  }, [markers, onMarkerSelect]);

  useEffect(() => {
    applyMarkers();
  }, [applyMarkers]);

  const insertSection = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const position = editor.getPosition();
    editor.executeEdits('insert-section', [{ range: { startLineNumber: position.lineNumber, startColumn: position.column, endLineNumber: position.lineNumber, endColumn: position.column }, text: `\nSection ${stats.sections + 1}. ${component?.label ?? 'Provision'}\n(1) ` }]);
    editor.focus();
  };

  return (
    <section className={`draft-editor-shell ${fullscreen ? 'fullscreen' : ''} ${printMode ? 'print-mode' : ''}`} aria-label="Legislative drafting editor">
      <header className="draft-editor-toolbar">
        <div>
          <strong>{component?.label ?? 'Draft component'}</strong>
          <span>{stats.words} words · {stats.characters} chars · {saveStatus}</span>
        </div>
        <nav aria-label="Editor actions">
          <button type="button" onClick={() => editorRef.current?.trigger('keyboard', 'undo', null)}><Undo2 size={15} />Undo</button>
          <button type="button" onClick={() => editorRef.current?.trigger('keyboard', 'redo', null)}><Redo2 size={15} />Redo</button>
          <button type="button" onClick={insertSection}><Wand2 size={15} />Section</button>
          <button type="button" onClick={onSaveVersion}><Save size={15} />Version</button>
          <button type="button" onClick={onTogglePrintMode}><Printer size={15} />Print</button>
          <button type="button" onClick={onToggleFullscreen}>{fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}{fullscreen ? 'Exit' : 'Full'}</button>
        </nav>
      </header>
      <div className="draft-editor-frame">
        <Editor
          height="100%"
          language="legislative-draft"
          theme="vs-dark"
          value={value}
          onMount={(editor, monaco) => { mount(editor, monaco); requestAnimationFrame(applyMarkers); }}
          onChange={(next) => onChange(next ?? '')}
          options={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: 16,
            lineHeight: 27,
            wordWrap: 'on',
            minimap: { enabled: false },
            lineNumbers: 'on',
            glyphMargin: true,
            renderLineHighlight: 'line',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
          }}
        />
      </div>
    </section>
  );
}

