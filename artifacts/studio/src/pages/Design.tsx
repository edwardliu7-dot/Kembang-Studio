import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { 
  useGetActiveProject,
  useGetPreviewStatus,
  useStartPreview,
  useStopPreview,
  Project
} from '@workspace/api-client-react';
import { 
  Panel, 
  PanelGroup, 
  PanelResizeHandle 
} from 'react-resizable-panels';
import { Button } from '@/components/ui/button';
import { Play, Square, Code, ExternalLink, RefreshCw, Hammer, Monitor } from 'lucide-react';

import AiChat from '@/components/AiChat';

export default function Design() {
  const [, setLocation] = useLocation();
  const { data: activeProjectResult, isLoading: loadingProject } = useGetActiveProject();
  const project = activeProjectResult?.project;

  useEffect(() => {
    if (!loadingProject && !project) {
      setLocation('/projects');
    }
  }, [loadingProject, project, setLocation]);

  if (loadingProject || !project) {
    return <div className="h-screen w-full flex items-center justify-center bg-background"><div className="animate-pulse flex items-center gap-2"><Hammer className="w-5 h-5 text-primary" /> Loading design mode...</div></div>;
  }

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-background text-foreground overflow-hidden font-sans">
      <DesignTopBar project={project} />
      
      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="horizontal">
          {/* PREVIEW */}
          <Panel defaultSize={70} minSize={30} className="bg-muted flex flex-col relative">
            <PreviewPane project={project} />
          </Panel>
          
          <PanelResizeHandle className="w-1 bg-border hover:bg-primary/50 transition-colors" />
          
          {/* AI CHAT */}
          <Panel defaultSize={30} minSize={20} maxSize={50} className="bg-card border-l border-border flex flex-col">
            <AiChat projectId={project.id} mode="design" />
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}

function DesignTopBar({ project }: { project: Project }) {
  const [, setLocation] = useLocation();
  
  const startPreview = useStartPreview();
  const stopPreview = useStopPreview();
  const { data: previewStatus } = useGetPreviewStatus({ projectId: project.id }, { query: { enabled: !!project.id, refetchInterval: 3000 }});

  const isRunning = previewStatus?.state === 'running';

  return (
    <div className="h-14 border-b border-border bg-card flex items-center justify-between px-6 shrink-0 shadow-sm z-10 relative">
      <div className="flex items-center gap-4">
        <span className="font-bold text-lg tracking-tight flex items-center gap-2">
          {project.name} <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-widest bg-primary text-primary-foreground">Design</span>
        </span>
      </div>
      
      <div className="flex items-center gap-3">
        {isRunning ? (
          <Button 
            variant="destructive" 
            size="sm" 
            className="h-9 text-sm font-medium"
            onClick={() => stopPreview.mutate({ data: { projectId: project.id } })}
          >
            <Square className="w-4 h-4 mr-2 fill-current" /> Stop Preview
          </Button>
        ) : (
          <Button 
            variant="default" 
            size="sm" 
            className="h-9 text-sm font-medium bg-green-600 hover:bg-green-500 text-white shadow-[0_0_15px_rgba(22,163,74,0.3)]"
            onClick={() => startPreview.mutate({ data: { projectId: project.id } })}
            disabled={startPreview.isPending}
          >
            <Play className="w-4 h-4 mr-2 fill-current" /> Start Preview
          </Button>
        )}
        
        <div className="w-px h-6 bg-border mx-2" />
        
        <Button 
          variant="outline" 
          size="sm" 
          className="h-9 text-sm font-medium border-primary/30 hover:border-primary/60 hover:bg-primary/5 text-primary"
          onClick={() => setLocation('/studio')}
        >
          <Code className="w-4 h-4 mr-2" /> Build Mode
        </Button>
      </div>
    </div>
  );
}

function PreviewPane({ project }: { project: Project }) {
  const { data: previewStatus, refetch } = useGetPreviewStatus({ projectId: project.id }, { query: { enabled: !!project.id, refetchInterval: 3000 }});

  if (previewStatus?.state !== 'running' || !previewStatus.url) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center space-y-4 bg-[url('/noise.svg')]">
        <div className="w-20 h-20 bg-background rounded-2xl shadow-xl flex items-center justify-center border border-border">
          <Monitor className="w-10 h-10 text-muted-foreground/50" />
        </div>
        <div>
          <h3 className="text-lg font-medium text-foreground mb-1">Preview Offline</h3>
          <p className="text-sm max-w-md">Start the preview server to see your application here.</p>
        </div>
      </div>
    );
  }

  const iframeSrc = previewStatus.url;

  return (
    <div className="flex-1 flex flex-col bg-muted/30">
      <div className="h-10 border-b border-border bg-card flex items-center px-4 justify-between shrink-0">
        <div className="flex items-center gap-2 flex-1 max-w-md bg-background px-3 py-1 rounded-md border border-border">
          <span className="text-xs text-muted-foreground font-mono truncate">{iframeSrc}</span>
        </div>
        <div className="flex items-center gap-1 ml-4">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => {
            const iframe = document.getElementById('preview-iframe') as HTMLIFrameElement;
            if (iframe) iframe.src = iframe.src;
          }}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => window.open(iframeSrc, '_blank')}>
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex-1 relative bg-white">
        <iframe
          id="preview-iframe"
          src={iframeSrc}
          className="absolute inset-0 w-full h-full border-0"
          title="App Preview"
          sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
        />
      </div>
    </div>
  );
}
