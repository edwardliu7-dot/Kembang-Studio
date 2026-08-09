import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { TerminalSquare } from 'lucide-react';

export default function TerminalPanel({ projectId }: { projectId: number }) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize xterm
    const xterm = new Terminal({
      theme: {
        background: '#0D0E15',
        foreground: '#E2E8F0',
        cursor: '#8B5CF6',
        selectionBackground: 'rgba(139, 92, 246, 0.3)',
        black: '#000000',
        red: '#EF4444',
        green: '#22C55E',
        yellow: '#EAB308',
        blue: '#3B82F6',
        magenta: '#8B5CF6',
        cyan: '#06B6D4',
        white: '#FFFFFF',
      },
      fontFamily: 'JetBrains Mono, Menlo, monospace',
      fontSize: 13,
      cursorBlink: true,
      cursorStyle: 'block',
    });
    
    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    
    xterm.open(terminalRef.current);
    fitAddon.fit();
    
    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Connect WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/terminal?projectId=${projectId}`;
    
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      xterm.writeln('\x1b[32m[EOB5]\x1b[0m Connected to terminal.');
    };

    socket.onmessage = (event) => {
      xterm.write(event.data);
    };

    socket.onclose = () => {
      xterm.writeln('\r\n\x1b[31m[EOB5]\x1b[0m Terminal connection closed.');
    };

    socket.onerror = () => {
      xterm.writeln('\r\n\x1b[31m[EOB5]\x1b[0m Terminal connection error.');
    };

    xterm.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    });

    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      socket.close();
      xterm.dispose();
    };
  }, [projectId]);

  return (
    <div className="w-full h-full bg-[#0D0E15] flex flex-col">
      <div className="flex-1 overflow-hidden p-2" ref={terminalRef} />
    </div>
  );
}
