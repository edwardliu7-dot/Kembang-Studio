import { useState } from 'react';
import { useLocation } from 'wouter';
import { 
  useGetActiveProject,
  useUpdateProject,
  useDeleteProject,
  useListAiProviders,
  useSaveAiProvider,
  useDeleteAiProvider,
  useListSecrets,
  useCreateSecret,
  useDeleteSecret,
  Project,
  AiProvider
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Key, Bot, Settings as SettingsIcon, Trash2, Plus, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Settings() {
  const [, setLocation] = useLocation();
  const { data: activeProjectResult, isLoading: loadingProject } = useGetActiveProject();
  const project = activeProjectResult?.project;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground p-8 max-w-5xl mx-auto font-sans">
      <header className="flex items-center gap-4 mb-8 pb-8 border-b border-border">
        <Button variant="ghost" size="icon" onClick={() => setLocation(project ? '/studio' : '/projects')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your workspace configuration</p>
        </div>
      </header>

      <Tabs defaultValue="providers" className="w-full">
        <TabsList className="grid grid-cols-3 mb-8 w-[400px]">
          <TabsTrigger value="providers" className="flex items-center gap-2"><Bot className="w-4 h-4" /> AI Providers</TabsTrigger>
          {project && <TabsTrigger value="secrets" className="flex items-center gap-2"><Key className="w-4 h-4" /> Secrets</TabsTrigger>}
          {project && <TabsTrigger value="project" className="flex items-center gap-2"><SettingsIcon className="w-4 h-4" /> Project</TabsTrigger>}
        </TabsList>
        
        <TabsContent value="providers">
          <ProvidersSettings />
        </TabsContent>
        
        {project && (
          <>
            <TabsContent value="secrets">
              <SecretsSettings projectId={project.id} />
            </TabsContent>
            <TabsContent value="project">
              <ProjectSettings project={project} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}

function ProvidersSettings() {
  const { data: providers, isLoading, refetch } = useListAiProviders();
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">AI Providers</h2>
        <p className="text-sm text-muted-foreground mb-6">Configure AI models used for chat and generation.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          {isLoading ? (
            <Skeleton className="h-32 w-full rounded-xl" />
          ) : providers?.map(provider => (
            <ProviderCard key={provider.id} provider={provider} onUpdate={refetch} />
          ))}
        </div>
        
        <div>
          <Card className="border-border/50 bg-card/30">
            <CardHeader>
              <CardTitle className="text-base">Add Provider</CardTitle>
            </CardHeader>
            <CardContent>
              <AddProviderForm onSuccess={refetch} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ProviderCard({ provider, onUpdate }: { provider: AiProvider, onUpdate: () => void }) {
  const deleteProvider = useDeleteAiProvider();
  
  const handleDelete = () => {
    deleteProvider.mutate({ id: provider.id }, {
      onSuccess: onUpdate
    });
  };

  return (
    <Card className="border-border bg-card overflow-hidden">
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-md flex items-center gap-2">
              {provider.name}
              {provider.isDefault && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-500 font-bold uppercase tracking-wider">Default</span>}
            </h3>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{provider.providerType}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleDelete} disabled={deleteProvider.isPending}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
      <div className="bg-muted/30 px-4 py-3 border-t border-border flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Model: <span className="font-mono text-foreground">{provider.model || 'Default'}</span></span>
        {provider.baseUrl && <span className="text-xs text-muted-foreground truncate">Base URL: <span className="font-mono text-foreground">{provider.baseUrl}</span></span>}
      </div>
    </Card>
  );
}

function AddProviderForm({ onSuccess }: { onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [providerType, setProviderType] = useState('openai');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  
  const saveProvider = useSaveAiProvider();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveProvider.mutate({
      data: { name, providerType, apiKey, model: model || undefined, baseUrl: baseUrl || undefined }
    }, {
      onSuccess: () => {
        toast({ title: 'Provider saved' });
        setName('');
        setApiKey('');
        setModel('');
        setBaseUrl('');
        onSuccess();
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Name</label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="My OpenAI" required />
      </div>
      
      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Type</label>
        <Select value={providerType} onValueChange={setProviderType}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="openai">OpenAI</SelectItem>
            <SelectItem value="anthropic">Anthropic</SelectItem>
            <SelectItem value="gemini">Gemini</SelectItem>
            <SelectItem value="groq">Groq</SelectItem>
            <SelectItem value="ollama">Ollama</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">API Key</label>
        <Input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-..." required={providerType !== 'ollama'} />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Model (Optional)</label>
        <Input value={model} onChange={e => setModel(e.target.value)} placeholder="gpt-4o" />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Base URL (Optional)</label>
        <Input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" />
      </div>
      
      <Button type="submit" className="w-full mt-2" disabled={saveProvider.isPending || !name || (providerType !== 'ollama' && !apiKey)}>
        {saveProvider.isPending ? 'Saving...' : 'Save Provider'}
      </Button>
    </form>
  );
}

function SecretsSettings({ projectId }: { projectId: number }) {
  const { data: secrets, isLoading, refetch } = useListSecrets({ projectId }, { query: { enabled: !!projectId } });
  const createSecret = useCreateSecret();
  const deleteSecret = useDeleteSecret();
  const { toast } = useToast();
  
  const [name, setName] = useState('');
  const [value, setValue] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !value) return;
    
    createSecret.mutate({ data: { projectId, name, value } }, {
      onSuccess: () => {
        toast({ title: 'Secret saved' });
        setName('');
        setValue('');
        refetch();
      }
    });
  };

  const handleDelete = (id: number) => {
    deleteSecret.mutate({ id }, {
      onSuccess: () => {
        toast({ title: 'Secret deleted' });
        refetch();
      }
    });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold mb-1">Environment Secrets</h2>
        <p className="text-sm text-muted-foreground mb-6">Manage API keys and secrets for your project environment. Values are encrypted and never shown once saved.</p>
      </div>
      
      <Card className="border-border bg-card mb-8">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2"><Plus className="w-4 h-4" /> Add New Secret</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex items-end gap-4">
            <div className="space-y-2 flex-1">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Key Name</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="STRIPE_API_KEY" className="font-mono text-sm" required />
            </div>
            <div className="space-y-2 flex-1">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Value</label>
              <Input type="password" value={value} onChange={e => setValue(e.target.value)} placeholder="••••••••••••" required />
            </div>
            <Button type="submit" disabled={createSecret.isPending || !name || !value}>Save</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Stored Secrets</h3>
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : secrets?.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-border rounded-xl bg-muted/20 text-muted-foreground">
            <Shield className="w-8 h-8 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No secrets stored for this project.</p>
          </div>
        ) : (
          secrets?.map(secret => (
            <div key={secret.id} className="flex items-center justify-between p-4 border border-border rounded-lg bg-card shadow-sm">
              <div className="flex items-center gap-3">
                <Key className="w-4 h-4 text-primary" />
                <span className="font-mono font-medium">{secret.name}</span>
              </div>
              <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(secret.id)} disabled={deleteSecret.isPending}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ProjectSettings({ project }: { project: Project }) {
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [startCmd, setStartCmd] = useState(project.startCommand || '');
  const [buildCmd, setBuildCmd] = useState(project.buildCommand || '');
  const [port, setPort] = useState(project.previewPort?.toString() || '');

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    
    updateProject.mutate({
      id: project.id,
      data: {
        startCommand: startCmd || undefined,
        buildCommand: buildCmd || undefined,
        previewPort: port ? parseInt(port, 10) : undefined
      }
    }, {
      onSuccess: () => {
        toast({ title: 'Project updated' });
      }
    });
  };

  const handleDelete = () => {
    if (!confirm('Are you sure you want to delete this project? This will not delete the local files, only remove it from the studio.')) return;
    
    deleteProject.mutate({ id: project.id }, {
      onSuccess: () => {
        toast({ title: 'Project deleted' });
        setLocation('/projects');
      }
    });
  };

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="text-lg font-semibold mb-1">Project Settings</h2>
        <p className="text-sm text-muted-foreground mb-6">Configure how your project builds and runs.</p>
      </div>

      <Card className="border-border bg-card">
        <CardContent className="pt-6">
          <form onSubmit={handleUpdate} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Build Command</label>
              <Input 
                value={buildCmd} 
                onChange={e => setBuildCmd(e.target.value)} 
                placeholder="npm run build" 
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">Run this before starting the preview.</p>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Start Command</label>
              <Input 
                value={startCmd} 
                onChange={e => setStartCmd(e.target.value)} 
                placeholder="npm run dev" 
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">The command to launch the preview server.</p>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Preview Port</label>
              <Input 
                type="number"
                value={port} 
                onChange={e => setPort(e.target.value)} 
                placeholder="3000" 
                className="font-mono"
              />
            </div>
            
            <div className="pt-4 border-t border-border">
              <Button type="submit" disabled={updateProject.isPending}>
                {updateProject.isPending ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-destructive/30 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
          <CardDescription>Actions here cannot be undone.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleDelete} disabled={deleteProject.isPending}>
            {deleteProject.isPending ? 'Deleting...' : 'Remove Project'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
