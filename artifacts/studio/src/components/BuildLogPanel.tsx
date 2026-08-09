import { useGetBuildStatus } from '@workspace/api-client-react';
import { Hammer, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function BuildLogPanel({ projectId }: { projectId: number }) {
  const { data: status } = useGetBuildStatus({ projectId }, { query: { enabled: !!projectId, refetchInterval: 2000 } });

  if (!status) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 bg-[#0D0E15]">
        <Hammer className="w-8 h-8 mb-4" />
        <p className="text-sm font-mono">No build info available</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-[#0D0E15] text-foreground font-mono text-sm p-4 overflow-auto">
      <div className="max-w-2xl">
        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
          <Hammer className="w-5 h-5 text-primary" /> Build Status
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-border/50 pb-2">
            <span className="text-muted-foreground">State</span>
            <div className="flex items-center gap-2">
              {status.state === 'running' && <><Loader2 className="w-4 h-4 animate-spin text-blue-400" /><span className="text-blue-400">Running</span></>}
              {status.state === 'success' && <><CheckCircle2 className="w-4 h-4 text-green-500" /><span className="text-green-500">Success</span></>}
              {status.state === 'failed' && <><XCircle className="w-4 h-4 text-destructive" /><span className="text-destructive">Failed</span></>}
              {status.state === 'idle' && <span className="text-muted-foreground">Idle</span>}
            </div>
          </div>
          
          {status.exitCode !== undefined && status.exitCode !== null && (
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground">Exit Code</span>
              <span className={status.exitCode === 0 ? "text-green-500" : "text-destructive"}>{status.exitCode}</span>
            </div>
          )}
          
          {status.startedAt && (
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground">Started</span>
              <span className="flex items-center gap-2"><Clock className="w-3 h-3" /> {formatDistanceToNow(new Date(status.startedAt), { addSuffix: true })}</span>
            </div>
          )}
          
          {status.finishedAt && (
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground">Finished</span>
              <span className="flex items-center gap-2"><Clock className="w-3 h-3" /> {formatDistanceToNow(new Date(status.finishedAt), { addSuffix: true })}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
