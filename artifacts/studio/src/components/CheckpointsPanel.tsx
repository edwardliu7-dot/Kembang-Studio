import { useState } from 'react';
import { 
  useListCheckpoints, 
  useCreateCheckpoint, 
  useRollbackCheckpoint 
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { History, Plus, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

export default function CheckpointsPanel({ projectId }: { projectId: number }) {
  const { data: checkpoints, isLoading, refetch } = useListCheckpoints({ projectId }, { query: { enabled: !!projectId } });
  const create = useCreateCheckpoint();
  const rollback = useRollbackCheckpoint();
  const { toast } = useToast();
  
  const [label, setLabel] = useState('');
  
  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label) return;
    
    create.mutate({ data: { projectId, label } }, {
      onSuccess: () => {
        toast({ title: 'Checkpoint created' });
        setLabel('');
        refetch();
      }
    });
  };
  
  const handleRollback = (id: number) => {
    if (!confirm('Are you sure you want to rollback to this checkpoint? All uncommitted changes will be lost.')) return;
    
    rollback.mutate({ id }, {
      onSuccess: () => {
        toast({ title: 'Rolled back successfully' });
        refetch();
      }
    });
  };

  return (
    <div className="flex h-full bg-[#0D0E15]">
      {/* Left: Create Checkpoint */}
      <div className="w-1/3 p-4 border-r border-border/50 flex flex-col shrink-0">
        <div className="flex items-center gap-2 text-white font-medium mb-6">
          <History className="w-4 h-4 text-primary" /> 
          <span>Checkpoints</span>
        </div>
        
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">New Checkpoint</label>
            <Input 
              value={label} 
              onChange={e => setLabel(e.target.value)} 
              placeholder="e.g. Added auth flow"
              className="h-9 text-sm bg-[#181818] border-border/50"
            />
          </div>
          <Button 
            type="submit" 
            className="w-full h-9" 
            disabled={!label || create.isPending}
          >
            <Plus className="w-4 h-4 mr-2" /> Save Checkpoint
          </Button>
        </form>
        
        <div className="mt-8 text-xs text-muted-foreground">
          Checkpoints are stable snapshots of your project. Roll back anytime to restore this exact state.
        </div>
      </div>
      
      {/* Right: List */}
      <div className="w-2/3 p-4 overflow-auto">
        <div className="space-y-3">
          {isLoading ? (
            <Skeleton className="h-16 w-full bg-[#181818]" />
          ) : checkpoints?.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 border border-dashed border-border/50 rounded-lg">
              No checkpoints created yet.
            </div>
          ) : (
            checkpoints?.map(cp => (
              <div key={cp.id} className="flex flex-col p-3 rounded-lg border border-border/50 bg-[#181818] hover:border-primary/30 transition-colors group">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-medium text-white text-sm">{cp.label}</h4>
                    {cp.summary && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{cp.summary}</p>}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10"
                    onClick={() => handleRollback(cp.id)}
                    disabled={rollback.isPending}
                  >
                    <RotateCcw className="w-3 h-3 mr-1" /> Rollback
                  </Button>
                </div>
                
                <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                  <span>{cp.commitHash.substring(0, 7)}</span>
                  <span>{formatDistanceToNow(new Date(cp.createdAt), { addSuffix: true })}</span>
                  {cp.filesChanged !== null && <span>{cp.filesChanged} files</span>}
                  {cp.buildPassed && <span className="text-green-500">✓ Build passing</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
