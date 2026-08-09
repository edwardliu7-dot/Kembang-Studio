import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { 
  useGetActiveProject,
  useListGitBranches,
  useCheckoutGitBranch,
  useCreateGitBranch,
  useRunBuild,
  useStartPreview,
  useStopPreview,
  useGetPreviewStatus,
  Project
} from '@workspace/api-client-react';
import { 
  Panel, 
  PanelGroup, 
  PanelResizeHandle 
} from 'react-resizable-panels';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Play, Square, Hammer, Monitor, GitBranch, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

import FileTree from '@/components/FileTree';
import Editor from '@/components/Editor';
import AiChat from '@/components/AiChat';
import TerminalPanel from '@/components/TerminalPanel';
import BuildLogPanel from '@/components/BuildLogPanel';
import GitPanel from '@/components/GitPanel';
import CheckpointsPanel from '@/components/CheckpointsPanel';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Studio() {
  const [, setLocation] = useLocation();
  const { data: activeProjectResult, isLoading: loadingProject } = useGetActiveProject();
  const project = activeProjectResult?.project;
  
  const [activeFile, setActiveFile] = useState<string | null>(null);

  useEffect(() => {
    if (!loadingProject && !project) {
      setLocation('/projects');
    }
  }, [loadingProject, project, setLocation]);

  if (loadingProject || !project) {
    return <div className="h-screen w-full flex items-center justify-center bg-background"><div className="animate-pulse flex items-center gap-2"><Hammer className="w-5 h-5 text-primary" /> Loading workspace...</div></div>;
  }

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-background text-foreground overflow-hidden font-sans">
      <TopBar project={project} />
      
      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="horizontal">
          
          {/* LEFT SIDEBAR - File Tree */}
          <Panel defaultSize={15} minSize={10} maxSize={30} className="bg-sidebar border-r border-border flex flex-col">
            <div className="p-3 border-b border-border text-xs font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
              Explorer
            </div>
            <div className="flex-1 overflow-auto">
              <FileTree projectId={project.id} activeFile={activeFile} onSelectFile={setActiveFile} />
            </div>
          </Panel>
          
          <PanelResizeHandle className="w-1 bg-border hover:bg-primary/50 transition-colors" />
          
          {/* CENTER - Editor + Bottom Panels */}
          <Panel defaultSize={60} minSize={30}>
            <PanelGroup direction="vertical">
              
              {/* EDITOR */}
              <Panel defaultSize={70} minSize={20} className="flex flex-col bg-[#0D0E15]">
                {activeFile ? (
                  <Editor projectId={project.id} path={activeFile} />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground opacity-50 space-y-4">
                    <div className="w-16 h-16 border-2 border-dashed border-current rounded-xl flex items-center justify-center">
                      <Hammer className="w-8 h-8" />
                    </div>
                    <p className="font-mono text-sm">Select a file to edit</p>
                  </div>
                )}
              </Panel>
              
              <PanelResizeHandle className="h-1 bg-border hover:bg-primary/50 transition-colors" />
              
              {/* BOTTOM PANELS */}
              <Panel defaultSize={30} minSize={10} className="bg-card flex flex-col">
                <BottomPanels projectId={project.id} />
              </Panel>
            </PanelGroup>
          </Panel>
          
          <PanelResizeHandle className="w-1 bg-border hover:bg-primary/50 transition-colors" />
          
          {/* RIGHT SIDEBAR - AI Chat */}
          <Panel defaultSize={25} minSize={15} maxSize={40} className="bg-card border-l border-border flex flex-col">
            <AiChat projectId={project.id} />
          </Panel>
          
        </PanelGroup>
      </div>
    </div>
  );
}

function TopBar({ project }: { project: Project }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const { data: branches, refetch: refetchBranches } = useListGitBranches({ projectId: project.id }, { query: { enabled: !!project.id }});
  const checkoutBranch = useCheckoutGitBranch();
  const createBranch = useCreateGitBranch();
  const runBuild = useRunBuild();
  const startPreview = useStartPreview();
  const stopPreview = useStopPreview();
  const { data: previewStatus } = useGetPreviewStatus({ projectId: project.id }, { query: { enabled: !!project.id, refetchInterval: 3000 }});

  const handleCheckout = (val: string) => {
    if (val === '__new__') {
      const name = prompt('New branch name:');
      if (!name) return;
      createBranch.mutate({ data: { projectId: project.id, name } }, {
        onSuccess: () => {
          toast({ title: 'Branch created', description: name });
          refetchBranches();
        }
      });
      return;
    }

    checkoutBranch.mutate({ data: { projectId: project.id, branch: val } }, {
      onSuccess: () => {
        toast({ title: 'Branch checked out', description: `Switched to ${val}` });
        refetchBranches();
      }
    });
  };

  return (
    <div className="h-12 border-b border-border bg-sidebar flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => setLocation('/projects')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm tracking-tight">{project.name}</span>
          {project.githubUrl && <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-primary/10 text-primary border border-primary/20">GitHub</span>}
        </div>
        
        <div className="h-4 w-px bg-border mx-2" />
        
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-muted-foreground" />
          <Select value={project.activeBranch || 'main'} onValueChange={handleCheckout}>
            <SelectTrigger className="h-8 w-[180px] bg-background border-border text-xs font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {branches?.all.map(b => (
                <SelectItem key={b} value={b} className="font-mono text-xs">{b}</SelectItem>
              ))}
              <SelectItem value="__new__" className="font-sans text-xs text-primary font-medium border-t border-border mt-1 pt-1">
                + Create New Branch...
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <Button 
          variant="outline" 
          size="sm" 
          className="h-8 text-xs font-medium"
          onClick={() => runBuild.mutate({ data: { projectId: project.id } })}
          disabled={runBuild.isPending}
        >
          <Hammer className="w-3 h-3 mr-2" /> Build
        </Button>
        
        {previewStatus?.state === 'running' ? (
          <Button 
            variant="destructive" 
            size="sm" 
            className="h-8 text-xs font-medium"
            onClick={() => stopPreview.mutate({ data: { projectId: project.id } })}
          >
            <Square className="w-3 h-3 mr-2 fill-current" /> Stop
          </Button>
        ) : (
          <Button 
            variant="default" 
            size="sm" 
            className="h-8 text-xs font-medium bg-green-600 hover:bg-green-500 text-white"
            onClick={() => startPreview.mutate({ data: { projectId: project.id } })}
            disabled={startPreview.isPending}
          >
            <Play className="w-3 h-3 mr-2 fill-current" /> Start
          </Button>
        )}
        
        <Button 
          variant="secondary" 
          size="sm" 
          className="h-8 text-xs font-medium border border-secondary-border"
          onClick={() => setLocation('/studio/design')}
        >
          <Monitor className="w-3 h-3 mr-2" /> Design Mode
        </Button>
      </div>
    </div>
  );
}

function BottomPanels({ projectId }: { projectId: number }) {
  return (
    <Tabs defaultValue="terminal" className="flex flex-col h-full">
      <div className="border-b border-border bg-sidebar/50 px-2 shrink-0">
        <TabsList className="h-9 bg-transparent p-0 gap-4">
          <TabsTrigger value="terminal" className="text-xs h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">Terminal</TabsTrigger>
          <TabsTrigger value="build" className="text-xs h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">Build Log</TabsTrigger>
          <TabsTrigger value="git" className="text-xs h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">Source Control</TabsTrigger>
          <TabsTrigger value="checkpoints" className="text-xs h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">Checkpoints</TabsTrigger>
        </TabsList>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <TabsContent value="terminal" className="h-full m-0 p-0 outline-none">
          <TerminalPanel projectId={projectId} />
        </TabsContent>
        <TabsContent value="build" className="h-full m-0 p-0 outline-none">
          <BuildLogPanel projectId={projectId} />
        </TabsContent>
        <TabsContent value="git" className="h-full m-0 p-0 outline-none overflow-auto">
          <GitPanel projectId={projectId} />
        </TabsContent>
        <TabsContent value="checkpoints" className="h-full m-0 p-0 outline-none overflow-auto">
          <CheckpointsPanel projectId={projectId} />
        </TabsContent>
      </div>
    </Tabs>
  );
}
