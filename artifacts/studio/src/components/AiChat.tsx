import { useState, useRef, useEffect } from 'react';
import { 
  useListAiConversations, 
  useGetConversationMessages, 
  useSendAiMessage,
  AiMessage
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Bot, User, Send, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function AiChat({ projectId, mode = 'build' }: { projectId: number, mode?: 'build' | 'design' }) {
  const { data: conversations, refetch: refetchConvos } = useListAiConversations({ projectId }, { query: { enabled: !!projectId } });
  
  // Use the most recent conversation if it exists
  const activeConversationId = conversations?.[0]?.id;
  
  const { data: messages, isLoading: loadingMessages, refetch: refetchMessages } = useGetConversationMessages(
    activeConversationId as number, 
    { query: { enabled: !!activeConversationId } }
  );

  const [input, setInput] = useState('');
  const sendMessage = useSendAiMessage();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    
    const messageText = input;
    setInput('');
    
    sendMessage.mutate({
      data: {
        projectId,
        conversationId: activeConversationId,
        message: messageText,
        mode
      }
    }, {
      onSuccess: () => {
        refetchConvos();
        if (activeConversationId) refetchMessages();
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="h-10 border-b border-border flex items-center px-4 shrink-0 bg-sidebar/50">
        <Sparkles className="w-4 h-4 text-primary mr-2" />
        <span className="font-semibold text-sm">EOB5 AI</span>
        {mode === 'design' && <span className="ml-2 text-[10px] uppercase font-bold text-muted-foreground">Design Mode</span>}
      </div>
      
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6 flex flex-col" ref={scrollRef}>
          {loadingMessages ? (
            <div className="flex justify-center p-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : messages?.length === 0 || !messages ? (
            <div className="flex flex-col items-center justify-center text-center py-12 opacity-50">
              <Bot className="w-12 h-12 mb-4 text-muted-foreground" />
              <p className="text-sm">How can I help you build today?</p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <ChatMessage key={msg.id || i} message={msg} />
            ))
          )}
          
          {sendMessage.isPending && (
            <div className="flex gap-3 text-sm mr-auto bg-muted/30 border border-border p-3 rounded-lg rounded-tl-sm animate-pulse">
              <Bot className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div>Thinking...</div>
            </div>
          )}
        </div>
      </ScrollArea>
      
      <div className="p-3 border-t border-border bg-sidebar/30">
        <div className="relative flex items-end bg-background border border-border rounded-xl shadow-sm focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI to modify code..."
            className="min-h-[44px] max-h-32 border-0 focus-visible:ring-0 resize-none bg-transparent py-3 text-sm font-sans"
            rows={1}
          />
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-8 w-8 mb-1.5 mr-1.5 text-primary hover:bg-primary/20 hover:text-primary shrink-0"
            onClick={handleSend}
            disabled={!input.trim() || sendMessage.isPending}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function ChatMessage({ message }: { message: AiMessage }) {
  const isUser = message.role === 'user';
  
  if (message.role === 'system') return null;
  
  return (
    <div className={cn(
      "flex gap-3 text-sm max-w-[90%]",
      isUser ? "ml-auto" : "mr-auto"
    )}>
      {!isUser && (
        <div className="w-6 h-6 rounded-md bg-primary/20 flex items-center justify-center shrink-0 border border-primary/30">
          <Bot className="w-3.5 h-3.5 text-primary" />
        </div>
      )}
      
      <div className={cn(
        "px-3 py-2 rounded-xl whitespace-pre-wrap font-sans leading-relaxed",
        isUser ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-card border border-border rounded-tl-sm shadow-sm"
      )}>
        {message.content}
        
        {message.toolCalls && (
          <div className="mt-3 pt-3 border-t border-border/20">
            <span className="text-[10px] uppercase font-bold tracking-wider opacity-70 block mb-1">Actions Taken</span>
            <div className="font-mono text-[10px] bg-black/20 p-2 rounded truncate opacity-80">
              {message.toolCalls}
            </div>
          </div>
        )}
      </div>
      
      {isUser && (
        <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center shrink-0 border border-border">
          <User className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
