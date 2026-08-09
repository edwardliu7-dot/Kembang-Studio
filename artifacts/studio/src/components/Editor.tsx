import { useEffect, useRef, useState } from 'react';
import { useGetFileContent, useSaveFileContent } from '@workspace/api-client-react';
import { Editor as MonacoEditor } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EditorProps {
  projectId: number;
  path: string;
}

export default function Editor({ projectId, path }: EditorProps) {
  const { toast } = useToast();
  const [content, setContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const { data: fileData, isLoading, isError } = useGetFileContent(
    { projectId, path }, 
    { query: { enabled: !!path, refetchOnWindowFocus: false, gcTime: 0 } } // don't cache deeply to avoid stale edits
  );
  
  const saveMutation = useSaveFileContent();

  useEffect(() => {
    if (fileData) {
      setContent(fileData.content);
      setIsDirty(false);
    }
  }, [fileData]);

  const handleSave = () => {
    if (!isDirty || !content) return;
    
    saveMutation.mutate(
      { data: { projectId, path, content } },
      {
        onSuccess: () => {
          setIsDirty(false);
          toast({ title: 'File saved', description: path });
        },
        onError: () => {
          toast({ title: 'Failed to save', variant: 'destructive' });
        }
      }
    );
  };

  // Keyboard shortcut Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDirty, content, projectId, path]); // react to state changes

  const handleEditorMount = (editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
    // Add command inside monaco context as well
    editor.addCommand(2048 | 49, () => { // KeyMod.CtrlCmd | KeyCode.KeyS
      handleSave();
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#1e1e1e]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !fileData) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#1e1e1e] text-destructive">
        Failed to load file content.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#1e1e1e]">
      <div className="h-9 flex items-center justify-between px-4 border-b border-border/50 bg-[#181818] shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{path}</span>
          {isDirty && <div className="w-2 h-2 rounded-full bg-yellow-500" title="Unsaved changes" />}
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className={`h-6 text-xs px-2 ${isDirty ? 'text-primary hover:text-primary' : 'text-muted-foreground opacity-50'}`}
          onClick={handleSave}
          disabled={!isDirty || saveMutation.isPending}
        >
          {saveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
          Save
        </Button>
      </div>
      <div className="flex-1">
        <MonacoEditor
          height="100%"
          language={fileData.language}
          theme="vs-dark"
          value={content}
          onChange={(val) => {
            setContent(val || '');
            setIsDirty(val !== fileData.content);
          }}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: 'JetBrains Mono, Menlo, monospace',
            padding: { top: 16 },
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            renderWhitespace: 'boundary',
            bracketPairColorization: { enabled: true },
            guides: { bracketPairs: true, indentation: true }
          }}
        />
      </div>
    </div>
  );
}
