import { useState } from 'react';
import { useLocation } from 'wouter';
import { useLogin } from '@workspace/api-client-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Terminal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  
  const loginMutation = useLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    
    loginMutation.mutate({ data: { password } }, {
      onSuccess: () => {
        setLocation('/projects');
      },
      onError: () => {
        toast({
          title: 'Access Denied',
          description: 'Incorrect password',
          variant: 'destructive',
        });
        setPassword('');
      }
    });
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background text-foreground font-mono">
      <div className="w-full max-w-sm px-8">
        <div className="flex flex-col items-center mb-12">
          <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-6 shadow-2xl border border-border">
            <Terminal className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-center">EOB5 CodeStudio</h1>
          <p className="text-muted-foreground text-sm mt-2">Personal AI Workspace</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-muted-foreground opacity-50">&gt;</span>
            </div>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password..."
              className="pl-8 bg-card border-border h-12 text-center text-lg focus-visible:ring-primary/50 shadow-inner"
              autoFocus
              data-testid="input-password"
            />
          </div>
          <Button 
            type="submit" 
            className="w-full h-12 text-md tracking-wider font-semibold hover-elevate"
            disabled={loginMutation.isPending || !password}
            data-testid="button-submit-login"
          >
            {loginMutation.isPending ? 'Authenticating...' : 'Enter'}
          </Button>
        </form>
      </div>
    </div>
  );
}
