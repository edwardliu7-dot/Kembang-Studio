import { useState } from 'react';
import { 
  useGetFileTree, 
  useMakeDirectory,
  useDeleteFile,
  useRenameFile,
  FileNode 
} from '@workspace/api-client-react';
import { Folder, FolderOpen, FileText, FileCode2, FileImage, File, ChevronRight, ChevronDown, RefreshCw, FolderPlus, FilePlus, Trash2, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface FileTreeProps {
  projectId: number;
  activeFile: string | null;
  onSelectFile: (path: string) => void;
}

export default function FileTree({ projectId, activeFile, onSelectFile }: FileTreeProps) {
  const { data: tree, isLoading, refetch, isRefetching } = useGetFileTree({ projectId }, { query: { enabled: !!projectId } });
  const mkDir = useMakeDirectory();
  const delFile = useDeleteFile();
  const renFile = useRenameFile();
  const { toast } = useToast();

  const handleCreateNode = (type: 'file' | 'directory', parentPath: string = '') => {
    const name = prompt(`Enter ${type} name:`);
    if (!name) return;
    
    // Simplistic handling for demo purposes; assumes API handles file creation implicitly 
    // or we only create dirs since useMakeDirectory is provided.
    // The API might not have a useCreateFile. Wait, the brief didn't specify useCreateFile hook.
    // It specified useSaveFileContent which creates a file.
    
    const path = parentPath ? `${parentPath}/${name}` : name;
    
    if (type === 'directory') {
      mkDir.mutate({ data: { projectId, path } }, {
        onSuccess: () => refetch()
      });
    } else {
      // Create file implies saving empty content to new path
      // but we don't have useSaveFileContent in this component.
      // So we just instruct user to use save in editor, or we pass it down?
      // Actually, we can just trigger onSelectFile with the new path, and saving the editor will create it.
      onSelectFile(path);
      toast({ title: 'Draft file created', description: 'Save the file in the editor to persist it.' });
    }
  };

  const handleDelete = (path: string) => {
    if (!confirm(`Delete ${path}?`)) return;
    delFile.mutate({ data: { projectId, path } }, {
      onSuccess: () => {
        toast({ title: 'Deleted' });
        refetch();
        if (activeFile === path) onSelectFile('');
      }
    });
  };

  const handleRename = (oldPath: string) => {
    const parts = oldPath.split('/');
    const oldName = parts.pop();
    const newName = prompt('Enter new name:', oldName);
    if (!newName || newName === oldName) return;
    
    const newPath = [...parts, newName].join('/');
    renFile.mutate({ data: { projectId, oldPath, newPath } }, {
      onSuccess: () => {
        toast({ title: 'Renamed' });
        refetch();
        if (activeFile === oldPath) onSelectFile(newPath);
      }
    });
  };

  if (isLoading && !tree) {
    return (
      <div className="p-4 space-y-2">
        {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-5 w-full bg-border/50" />)}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-sidebar select-none">
      <div className="flex items-center justify-between px-2 py-1 bg-sidebar-accent/30 border-b border-border mb-1 shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Files</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground" onClick={() => handleCreateNode('file')} title="New File">
            <FilePlus className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground" onClick={() => handleCreateNode('directory')} title="New Folder">
            <FolderPlus className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground" onClick={() => refetch()} disabled={isRefetching} title="Refresh">
            <RefreshCw className={cn("w-3 h-3", isRefetching && "animate-spin")} />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto pb-4">
        {tree?.map((node, i) => (
          <TreeNode 
            key={node.path + i} 
            node={node} 
            level={0} 
            activeFile={activeFile} 
            onSelectFile={onSelectFile}
            onDelete={handleDelete}
            onRename={handleRename}
            onCreate={handleCreateNode}
          />
        ))}
      </div>
    </div>
  );
}

function TreeNode({ 
  node, 
  level, 
  activeFile, 
  onSelectFile, 
  onDelete, 
  onRename, 
  onCreate 
}: { 
  node: FileNode, 
  level: number, 
  activeFile: string | null, 
  onSelectFile: (path: string) => void,
  onDelete: (path: string) => void,
  onRename: (path: string) => void,
  onCreate: (type: 'file' | 'directory', path: string) => void
}) {
  const [isOpen, setIsOpen] = useState(level === 0 || level === 1);
  const isDir = node.type === 'directory';
  const isActive = activeFile === node.path;

  const getIcon = () => {
    if (isDir) return isOpen ? <FolderOpen className="w-3.5 h-3.5 text-blue-400" /> : <Folder className="w-3.5 h-3.5 text-blue-400" />;
    
    if (node.name.match(/\.(tsx?|jsx?|ts|js)$/)) return <FileCode2 className="w-3.5 h-3.5 text-yellow-400" />;
    if (node.name.match(/\.(css|scss|less)$/)) return <FileCode2 className="w-3.5 h-3.5 text-blue-300" />;
    if (node.name.match(/\.(json|md|txt)$/)) return <FileText className="w-3.5 h-3.5 text-green-300" />;
    if (node.name.match(/\.(png|jpg|svg)$/)) return <FileImage className="w-3.5 h-3.5 text-purple-400" />;
    return <File className="w-3.5 h-3.5 text-muted-foreground" />;
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDir) {
      setIsOpen(!isOpen);
    } else {
      onSelectFile(node.path);
    }
  };

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger>
          <div 
            className={cn(
              "flex items-center py-1 px-2 cursor-pointer hover:bg-sidebar-accent/50 text-sm transition-colors whitespace-nowrap",
              isActive && "bg-primary/20 text-primary hover:bg-primary/30 font-medium"
            )}
            style={{ paddingLeft: `${level * 12 + 8}px` }}
            onClick={handleClick}
          >
            <span className="w-4 h-4 flex items-center justify-center shrink-0 mr-1 text-muted-foreground/70">
              {isDir && (isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />)}
            </span>
            <span className="shrink-0 mr-2">{getIcon()}</span>
            <span className="truncate opacity-90">{node.name}</span>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48 bg-card border-border">
          {isDir && (
            <>
              <ContextMenuItem onClick={() => onCreate('file', node.path)} className="text-xs focus:bg-primary/20"><FilePlus className="mr-2 w-3 h-3" /> New File...</ContextMenuItem>
              <ContextMenuItem onClick={() => onCreate('directory', node.path)} className="text-xs focus:bg-primary/20"><FolderPlus className="mr-2 w-3 h-3" /> New Folder...</ContextMenuItem>
              <ContextMenuSeparator className="bg-border" />
            </>
          )}
          <ContextMenuItem onClick={() => onRename(node.path)} className="text-xs focus:bg-primary/20"><Edit2 className="mr-2 w-3 h-3" /> Rename...</ContextMenuItem>
          <ContextMenuItem onClick={() => onDelete(node.path)} className="text-xs text-destructive focus:text-destructive focus:bg-destructive/10"><Trash2 className="mr-2 w-3 h-3" /> Delete</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      
      {isDir && isOpen && node.children && (
        <div>
          {node.children.map((child, i) => (
            <TreeNode 
              key={child.path + i} 
              node={child} 
              level={level + 1} 
              activeFile={activeFile} 
              onSelectFile={onSelectFile}
              onDelete={onDelete}
              onRename={onRename}
              onCreate={onCreate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
