import React, { useState, useEffect } from 'react';
import { Terminal, RefreshCw, Database } from 'lucide-react';

export default function QueryConsole({ selectedSensor, hbaseRecords, onRefresh, isLoading }) {
  const [consoleLog, setConsoleLog] = useState([]);
  const [filterSensor, setFilterSensor] = useState('ALL');

  useEffect(() => {
    // Agregar un log inicial
    setConsoleLog([
      { type: 'info', text: 'HBase Serving Layer connection initialized.' },
      { type: 'success', text: 'Table "telemetry_metrics" scanned successfully.' }
    ]);
  }, []);

  const handleScan = () => {
    onRefresh(filterSensor === 'ALL' ? null : filterSensor);
    
    const filterText = filterSensor === 'ALL' ? 'scanning all rows' : `filtering by row key prefix "${filterSensor}"`;
    const newLogs = [
      { type: 'command', text: `hbase> scan 'telemetry_metrics', {LIMIT => 10, FILTER => "${filterText}"}` },
      { type: 'info', text: `Fetching cells from columns [cf_stats:avg_val, cf_stats:min_val, cf_stats:max_val, cf_stats:count]...` },
      { type: 'success', text: `Query finished. Retreived ${hbaseRecords.length} rows.` }
    ];
    setConsoleLog(prev => [...prev, ...newLogs].slice(-15)); // Mantener últimos 15 logs
  };

  const getLogColor = (type) => {
    switch (type) {
      case 'command': return 'var(--accent-cyan)';
      case 'success': return 'var(--status-ok)';
      case 'error': return 'var(--status-danger)';
      default: return 'var(--text-secondary)';
    }
  };

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Database size={18} className="text-glow-cyan" style={{ color: 'var(--accent-cyan)' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white' }}>Serving Layer - HBase Explorer</h3>
        </div>

        {/* Controles de Consulta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <select
            value={filterSensor}
            onChange={(e) => setFilterSensor(e.target.value)}
            style={{
              background: 'var(--bg-secondary)',
              color: 'white',
              border: '1px solid var(--glass-border)',
              borderRadius: 6,
              padding: '0.25rem 0.5rem',
              fontSize: '0.75rem',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="ALL">Todas las RowKeys</option>
            <option value="sensor-temp-01">TEMP-01</option>
            <option value="sensor-vib-02">VIB-02</option>
            <option value="sensor-press-03">PRESS-03</option>
            <option value="sensor-hum-04">HUM-04</option>
          </select>
          <button
            onClick={handleScan}
            disabled={isLoading}
            style={{
              background: 'var(--bg-tertiary)',
              color: 'var(--accent-cyan)',
              border: '1.5px solid var(--accent-cyan)',
              borderRadius: 6,
              padding: '0.25rem 0.65rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              boxShadow: '0 0 10px rgba(0, 242, 254, 0.1)',
              transition: 'var(--transition-smooth)'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'var(--accent-cyan)';
              e.target.style.color = 'var(--bg-primary)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'var(--bg-tertiary)';
              e.target.style.color = 'var(--accent-cyan)';
            }}
          >
            <RefreshCw size={12} className={isLoading ? 'pulse-dot-active' : ''} />
            SCAN
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', height: '300px' }}>
        {/* Terminal HBase */}
        <div 
          className="terminal-font"
          style={{
            background: 'black',
            borderRadius: 10,
            padding: '0.75rem',
            overflowY: 'auto',
            color: 'var(--text-primary)',
            border: '1px solid rgba(255,255,255,0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
            lineHeight: 1.4
          }}
        >
          <div style={{ color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.25rem' }}>
            <Terminal size={14} />
            HBase Shell v2.4 (Active Session)
          </div>
          {consoleLog.map((log, index) => (
            <div key={index} style={{ color: getLogColor(log.type) }}>
              {log.type === 'command' ? '' : '[system] '} {log.text}
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--accent-cyan)' }}>
            <span>hbase&gt;</span>
            <span style={{ width: 6, height: 12, backgroundColor: 'var(--accent-cyan)', display: 'inline-block', animation: 'pulse-dot 1s infinite' }}></span>
          </div>
        </div>

        {/* Visor de Celdas/Registros de HBase */}
        <div
          style={{
            background: 'rgba(5, 4, 15, 0.6)',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.05)',
            padding: '0.75rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}
        >
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Registros Persistidos en Serving Layer (HBase Columns)
          </div>

          {hbaseRecords.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Sin registros en HBase para mostrar.
            </div>
          ) : (
            hbaseRecords.map((rec) => (
              <div 
                key={rec.row_key}
                className="terminal-font"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.04)',
                  borderRadius: 6,
                  padding: '0.5rem',
                  fontSize: '0.75rem'
                }}
              >
                <div style={{ color: 'var(--accent-purple)', fontWeight: 'bold', borderBottom: '1px dashed rgba(255,255,255,0.04)', paddingBottom: '0.15rem', marginBottom: '0.25rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  RowKey: {rec.row_key}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.15rem 0.5rem', color: 'var(--text-secondary)' }}>
                  <div>cf_stats:avg_val =&gt; <span style={{ color: 'white' }}>{rec.avg_value}</span></div>
                  <div>cf_stats:min_val =&gt; <span style={{ color: 'white' }}>{rec.min_value}</span></div>
                  <div>cf_stats:max_val =&gt; <span style={{ color: 'white' }}>{rec.max_value}</span></div>
                  <div>cf_stats:count =&gt; <span style={{ color: 'white' }}>{rec.event_count}</span></div>
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.25rem', textAlign: 'right' }}>
                  Updated: {new Date(rec.last_updated).toLocaleTimeString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
