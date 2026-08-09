import { useState } from 'react';
import { 
  useGetGitStatus, 
  useGitCommit, 
  useGitPull, 
  useGitPush,
  useGetGitLog
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GitBranch, GitCommit, ArrowDown, ArrowUp, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

export default function GitPanel({ projectId }: { projectId: number }) {
  const { data: status, refetch: refetchStatus } = useGetGitStatus({ projectId }, { query: { enabled: !!projectId } });
  const { data: log, refetch: refetchLog } = useGetGitLog({ projectId, limit: 5 }, { query: { enabled: !!projectId } });
  
  const [message, setMessage] = useState('');
  const commit = useGitCommit();
  const push = useGitPush();
  const pull = useGitPull();
  const { toast } = useToast();

  const handleCommit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message) return;
    
    commit.mutate({ data: { projectId, message, stageAll: true } }, {
      onSuccess: () => {
        toast({ title: 'Committed successfully' });
        setMessage('');
        refetchStatus();
        refetchLog();
      }
    });
  };

  const handlePush = () => {
    push.mutate({ data: { projectId, approved: true } }, {
      onSuccess: () => {
        toast({ title: 'Pushed successfully' });
        refetchStatus();
      },
      onError: () => {
        toast({ title: 'Push failed', variant: 'destructive' });
      }
    });
  };

  const handlePull = () => {
    pull.mutate({ data: { projectId } }, {
      onSuccess: () => {
        toast({ title: 'Pulled successfully' });
        refetchStatus();
        refetchLog();
      },
      onError: () => {
        toast({ title: 'Pull failed', variant: 'destructive' });
      }
    });
  };

  return (
    <div className="flex h-full bg-[#0D0E15]">
      {/* Left Column: Status & Actions */}
      <div className="w-1/2 p-4 border-r border-border/50 flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-2 text-white font-medium">
            <GitBranch className="w-4 h-4 text-primary" /> 
            <span>{status?.branch || 'Unknown branch'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={() => refetchStatus()}>
              <RefreshCw className="w-3 h-3" />
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handlePull} disabled={pull.isPending}>
              <ArrowDown className="w-3 h-3 mr-1" /> Pull {status?.behind ? `(${status.behind})` : ''}
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handlePush} disabled={push.isPending}>
              <ArrowUp className="w-3 h-3 mr-1" /> Push {status?.ahead ? `(${status.ahead})` : ''}
            </Button>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto bg-[#181818] rounded border border-border/50 p-2 mb-4">
          {status?.isClean ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <CheckCircle2 className="w-8 h-8 mb-2 text-green-500/50" />
              <span className="text-sm">Working directory clean</span>
            </div>
          ) : (
            <ul className="space-y-1">
              {status?.files.map((file, i) => (
                <li key={i} className="text-xs font-mono flex items-start gap-2">
                  <span className={`w-4 text-center shrink-0 ${file.working === 'M' || file.index === 'M' ? 'text-yellow-500' : file.working === 'D' || file.index === 'D' ? 'text-destructive' : 'text-green-500'}`}>
                    {file.index !== ' ' ? file.index : file.working}
                  </span>
                  <span className="truncate text-muted-foreground">{file.path}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        
        <form onSubmit={handleCommit} className="shrink-0 space-y-2">
          <Input 
            value={message} 
            onChange={e => setMessage(e.target.value)} 
            placeholder="Commit message..."
            className="h-8 text-xs bg-[#181818] border-border/50 focus-visible:ring-primary/50"
            disabled={status?.isClean}
          />
          <Button 
            type="submit" 
            className="w-full h-8 text-xs" 
            disabled={!message || status?.isClean || commit.isPending}
          >
            <GitCommit className="w-3 h-3 mr-2" /> Commit All Changes
          </Button>
        </form>
      </div>
      
      {/* Right Column: History */}
      <div className="w-1/2 p-4 flex flex-col h-full overflow-hidden">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4 shrink-0">Recent Commits</h3>
        <div className="flex-1 overflow-auto space-y-3 pr-2">
          {log?.map((entry) => (
            <div key={entry.hash} className="text-sm border-l-2 border-border/50 pl-3 py-1">
              <div className="text-foreground font-medium truncate mb-1">{entry.message}</div>
              <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
                <span className="truncate max-w-[120px]">{entry.author}</span>
                <span>{formatDistanceToNow(new Date(entry.date), { addSuffix: true })}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
