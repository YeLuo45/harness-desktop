import React, { useState, useEffect, useRef, useCallback } from 'react';

interface LogEntry {
  timestamp: string;
  level: string;
  module: string;
  message: string;
  stack?: string;
}

const LEVEL_COLORS: Record<string, string> = {
  error: '#ff6b6b',
  warn: '#ffd93d',
  info: '#74c0fc',
  debug: '#888',
};

const LEVEL_OPTIONS = [
  { value: '', label: 'All Levels' },
  { value: 'error', label: 'Error' },
  { value: 'warn', label: 'Warning' },
  { value: 'info', label: 'Info' },
  { value: 'debug', label: 'Debug' },
];

export const LogViewer: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [levelFilter, setLevelFilter] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [modules, setModules] = useState<string[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(0);

  const fetchLogs = useCallback(async () => {
    try {
      const logs = await (window as any).electronAPI?.log?.getBuffer();
      if (Array.isArray(logs)) {
        setEntries(logs);
        const mods = [...new Set(logs.map((e: LogEntry) => e.module))];
        setModules(mods);
        lastCountRef.current = logs.length;
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
    if (autoRefresh) {
      const interval = setInterval(fetchLogs, 2000);
      return () => clearInterval(interval);
    }
  }, [fetchLogs, autoRefresh]);

  useEffect(() => {
    if (scrollRef.current && entries.length > lastCountRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length]);

  const filteredEntries = entries.filter((e) => {
    if (levelFilter && e.level !== levelFilter) return false;
    if (moduleFilter && e.module !== moduleFilter) return false;
    if (searchText) {
      const search = searchText.toLowerCase();
      if (!e.message.toLowerCase().includes(search) && !e.module.toLowerCase().includes(search)) {
        return false;
      }
    }
    return true;
  });

  const handleExport = async () => {
    const content = filteredEntries
      .map((e) => `[${e.timestamp}] [${e.level.toUpperCase()}] [${e.module}] ${e.message}${e.stack ? '\n' + e.stack : ''}`)
      .join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `harness-logs-${new Date().toISOString().slice(0, 10)}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = async () => {
    await (window as any).electronAPI?.log?.clear();
    setEntries([]);
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      right: 20,
      width: 600,
      height: 400,
      background: '#1e1e1e',
      border: '1px solid #333',
      borderRadius: 8,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 9999,
      fontFamily: 'monospace',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: '1px solid #333',
        background: '#252525',
        borderRadius: '8px 8px 0 0',
      }}>
        <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>🔍 Log Viewer</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            style={{
              background: '#333',
              color: '#ccc',
              border: '1px solid #444',
              borderRadius: 4,
              padding: '2px 6px',
              fontSize: 11,
            }}
          >
            {LEVEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            style={{
              background: '#333',
              color: '#ccc',
              border: '1px solid #444',
              borderRadius: 4,
              padding: '2px 6px',
              fontSize: 11,
            }}
          >
            <option value="">All Modules</option>
            {modules.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Search..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{
              background: '#333',
              color: '#ccc',
              border: '1px solid #444',
              borderRadius: 4,
              padding: '2px 6px',
              fontSize: 11,
              width: 100,
            }}
          />
          <button
            onClick={fetchLogs}
            style={{
              background: autoRefresh ? '#4a9eff' : '#444',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            {autoRefresh ? 'Live' : 'Paused'}
          </button>
          <button onClick={handleExport} style={{ background: '#333', color: '#ccc', border: '1px solid #444', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}>Export</button>
          <button onClick={handleClear} style={{ background: '#a00', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}>Clear</button>
          {onClose && (
            <button onClick={onClose} style={{ background: '#333', color: '#ccc', border: '1px solid #444', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}>✕</button>
          )}
        </div>
      </div>

      <div style={{ fontSize: 10, color: '#666', padding: '2px 12px', borderBottom: '1px solid #2a2a2a' }}>
        {filteredEntries.length} entries
      </div>

      {/* Log entries */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          fontSize: 12,
          padding: 4,
        }}
      >
        {filteredEntries.length === 0 ? (
          <div style={{ color: '#666', textAlign: 'center', padding: 20 }}>
            No logs available
          </div>
        ) : (
          filteredEntries.map((entry, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                gap: 6,
                padding: '1px 4px',
                borderBottom: '1px solid #2a2a2a',
                color: LEVEL_COLORS[entry.level] || '#ccc',
                lineHeight: 1.6,
              }}
            >
              <span style={{ color: '#555', flexShrink: 0 }}>
                {entry.timestamp.replace('T', ' ').slice(0, 19)}
              </span>
              <span style={{
                color: LEVEL_COLORS[entry.level] || '#888',
                flexShrink: 0,
                fontWeight: 600,
                fontSize: 10,
              }}>
                [{entry.level.toUpperCase()}]
              </span>
              <span style={{ color: '#8be9fd', flexShrink: 0 }}>[{entry.module}]</span>
              <span style={{ color: 'inherit', wordBreak: 'break-all' }}>{entry.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
