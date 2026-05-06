import { useEffect, useRef } from 'react';
import type { LogEntry } from '../../lib/types';

interface TerminalProps {
  logs: LogEntry[];
  eventId: string;
}

const SUB_CLS_MAP: Record<string, string> = {
  SYSTEM:   'sys',
  ORACLE:   'oracle',
  RULES:    'rule',
  BEHAVIOR: 'behavior',
  DECISION: 'decision',
  FRAUD:    'fraud'
};

export function Terminal({ logs, eventId }: TerminalProps) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bodyRef.current) {
      setTimeout(() => {
        if (bodyRef.current)
          bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
      }, 40);
    }
  }, [logs]);

  return (
    <div className="terminal-card" id="terminal">
      <div className="terminal-topbar">
        <div className="term-dots">
          <span className="tdot red" />
          <span className="tdot amber" />
          <span className="tdot green" />
        </div>
        <span className="term-title">ASTRA THINKING TERMINAL</span>
        <span className="term-event-id">EVENT: {eventId}</span>
      </div>
      <div className="term-body" ref={bodyRef}>
        {logs.map((log, idx) => (
          <div key={log.id} className={`log-line ${idx < 2 ? 'init' : ''}`}>
            <span className="log-ts">{log.timestamp}</span>
            <span className={`log-sub ${SUB_CLS_MAP[log.subsystem] || 'sys'}`}>
              [{log.subsystem}]
            </span>
            <span className={`log-msg ${log.cls || ''}`}>
              {log.message}
              {idx === logs.length - 1 && <span className="cursor-blink" />}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}