import { useState } from 'react';
import { useLocation } from 'wouter';
import { 
  useListProjects, 
  useGetStudioStats,
  useCreateProject,
  useOpenProject,
  useLogout,
  Project
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  FolderGit2, 
  TerminalSquare, 
  Activity, 
  Clock,
  Plus,
  GitBranch,
  Github,
  Settings as SettingsIcon,
  Play,
  LogOut
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

export default function Projects() {
  const [, setLocation] = useLocation();
  const { data: stats, isLoading: statsLoading } = useGetStudioStats();
  const { data: projects, isLoading: projectsLoading } = useListProjects();
  
  const openProject = useOpenProject();
  
  const handleOpenProject = (id: number) => {
    openProject.mutate({ id }, {
      onSuccess: () => {
        setLocation('/studio');
      }
    });
  };

  const logout = useLogout();
  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => setLocation('/')
    });
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground p-8 max-w-6xl mx-auto font-sans">
      <header className="flex items-center justify-between mb-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center border border-primary/20">
            <TerminalSquare className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">EOB5 CodeStudio</h1>
            <p className="text-sm text-muted-foreground font-mono">Workspace Manager</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <CreateProjectDialog />
          <Button variant="outline" size="icon" onClick={() => setLocation('/settings')} data-testid="button-settings" title="Settings">
            <SettingsIcon className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={handleLogout} disabled={logout.isPending} title="Logout">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        <StatCard 
          icon={<FolderGit2 />}
          label="Total Projects" 
          value={statsLoading ? null : stats?.totalProjects} 
        />
        <StatCard 
          icon={<Activity />}
          label="Checkpoints" 
          value={statsLoading ? null : stats?.totalCheckpoints} 
        />
        <StatCard 
          icon={<TerminalSquare />}
          label="Total Requests" 
          value={statsLoading ? null : stats?.tokenUsage?.totalRequests} 
        />
        <StatCard 
          icon={<Activity />}
          label="Tokens Used" 
          value={statsLoading ? null : (stats?.tokenUsage?.totalTokens ? (stats.tokenUsage.totalTokens / 1000).toFixed(1) + 'k' : 0)} 
        />
      </div>

      <div className="space-y-6">
        <h2 className="text-lg font-semibold tracking-tight">Your Projects</h2>
        
        {projectsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-xl bg-card border border-border" />)}
          </div>
        ) : projects?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed rounded-xl border-border bg-card/30">
            <FolderGit2 className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No projects found</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">Create a new project from a local folder or clone a GitHub repository to get started.</p>
            <CreateProjectDialog />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects?.map(project => (
              <ProjectCard key={project.id} project={project} onOpen={() => handleOpenProject(project.id)} isOpening={openProject.isPending} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string, value: string | number | null | undefined, icon: React.ReactNode }) {
  return (
    <Card className="p-5 flex items-center gap-4 bg-card/50 border-border/50 hover-elevate transition-all">
      <div className="p-3 bg-primary/10 text-primary rounded-lg border border-primary/20">
        {icon}
      </div>
      <div>
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
        <div className="text-2xl font-bold tracking-tight">
          {value === null || value === undefined ? <Skeleton className="h-8 w-16 mt-1" /> : value}
        </div>
      </div>
    </Card>
  );
}

function ProjectCard({ project, onOpen, isOpening }: { project: Project, onOpen: () => void, isOpening: boolean }) {
  return (
    <Card className="flex flex-col overflow-hidden border-border bg-card hover:border-primary/50 transition-colors group">
      <div className="p-5 flex-1">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center border border-secondary-border">
              {project.githubUrl ? <Github className="w-5 h-5 text-muted-foreground" /> : <FolderGit2 className="w-5 h-5 text-muted-foreground" />}
            </div>
            <div>
              <h3 className="font-semibold text-lg truncate max-w-[180px]">{project.name}</h3>
              <p className="text-xs text-muted-foreground font-mono truncate max-w-[180px]">{project.localPath}</p>
            </div>
          </div>
          <div className={`w-2 h-2 rounded-full ${project.status === 'running' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : project.status === 'error' ? 'bg-destructive' : 'bg-muted-foreground'}`} />
        </div>
        
        <div className="space-y-3 mt-6">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-2"><GitBranch className="w-4 h-4" /> Branch</span>
            <span className="font-mono bg-secondary px-2 py-0.5 rounded text-xs">{project.activeBranch || 'main'}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-2"><Clock className="w-4 h-4" /> Accessed</span>
            <span>{project.lastOpenedAt ? formatDistanceToNow(new Date(project.lastOpenedAt), { addSuffix: true }) : 'Never'}</span>
          </div>
        </div>
      </div>
      <div className="p-3 bg-secondary/30 border-t border-border flex justify-end">
        <Button 
          variant="secondary" 
          size="sm" 
          onClick={onOpen}
          disabled={isOpening}
          className="w-full font-medium hover:bg-primary hover:text-primary-foreground transition-colors"
          data-testid={`button-open-${project.id}`}
        >
          {isOpening ? 'Opening...' : (
            <>
              <Play className="w-4 h-4 mr-2" /> Open Project
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}

function CreateProjectDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [localPath, setLocalPath] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  
  const createProject = useCreateProject();
  const [, setLocation] = useLocation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || (!localPath && !githubUrl)) return;
    
    createProject.mutate({ 
      data: { name, localPath: localPath || undefined, githubUrl: githubUrl || undefined } 
    }, {
      onSuccess: () => {
        setOpen(false);
        setLocation('/projects'); // usually you might want to open it immediately, but for now just close dialog
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-new-project">
          <Plus className="w-4 h-4 mr-2" /> New Project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-card border-border">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Project Name</label>
            <Input 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="my-awesome-app"
              required
              data-testid="input-project-name"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Local Path</label>
            <Input 
              value={localPath} 
              onChange={e => setLocalPath(e.target.value)} 
              placeholder="/home/user/projects/app"
              data-testid="input-project-path"
            />
          </div>
          <div className="relative py-2 flex items-center">
            <div className="flex-grow border-t border-border"></div>
            <span className="flex-shrink-0 mx-4 text-muted-foreground text-xs uppercase tracking-wider">OR</span>
            <div className="flex-grow border-t border-border"></div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">GitHub URL</label>
            <Input 
              value={githubUrl} 
              onChange={e => setGithubUrl(e.target.value)} 
              placeholder="https://github.com/user/repo"
              data-testid="input-project-github"
            />
          </div>
          
          <div className="pt-4 flex justify-end">
            <Button 
              type="submit" 
              disabled={createProject.isPending || !name || (!localPath && !githubUrl)}
              data-testid="button-submit-project"
            >
              {createProject.isPending ? 'Creating...' : 'Create Project'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
