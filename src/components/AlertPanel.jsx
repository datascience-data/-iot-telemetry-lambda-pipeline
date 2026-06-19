import React from 'react';
import { AlertTriangle, Trash2, ShieldAlert } from 'lucide-react';

export default function AlertPanel({ alerts, onClearAlerts }) {
  const getSeverityStyles = (severity) => {
    if (severity === 'CRITICAL') {
      return {
        bg: 'rgba(255, 23, 68, 0.08)',
        border: '1px solid rgba(255, 23, 68, 0.25)',
        badge: 'var(--status-danger)',
        glow: 'text-glow-pink'
      };
    }
    return {
      bg: 'rgba(255, 179, 0, 0.08)',
      border: '1px solid rgba(255, 179, 0, 0.25)',
      badge: 'var(--status-warning)',
      glow: 'text-glow-purple'
    };
  };

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldAlert size={18} className="text-glow-pink" style={{ color: 'var(--accent-pink)' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white' }}>Detección de Anomalías (Speed Layer)</h3>
        </div>
        {alerts.length > 0 && (
          <button
            onClick={onClearAlerts}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontSize: '0.75rem',
              transition: 'var(--transition-smooth)'
            }}
            onMouseEnter={(e) => e.target.style.color = 'var(--status-danger)'}
            onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
          >
            <Trash2 size={14} />
            Limpiar
          </button>
        )}
      </div>

      {/* Lista de Alertas */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '310px', paddingRight: '4px' }}>
        {alerts.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '180px', color: 'var(--text-muted)', gap: '0.5rem' }}>
            <div style={{ border: '1.5px dashed var(--text-muted)', padding: '0.5rem', borderRadius: 8 }}>
              <AlertTriangle size={24} strokeWidth={1.5} />
            </div>
            <p style={{ fontSize: '0.8rem' }}>Sin anomalías detectadas en el flujo.</p>
          </div>
        ) : (
          alerts.map((alert) => {
            const styles = getSeverityStyles(alert.severity);
            const timeStr = new Date(alert.timestamp).toLocaleTimeString();
            return (
              <div
                key={alert.id}
                style={{
                  background: styles.bg,
                  border: styles.border,
                  borderRadius: 10,
                  padding: '0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                  position: 'relative',
                  animation: 'slideIn 0.3s ease-out'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span
                      style={{
                        padding: '0.1rem 0.4rem',
                        borderRadius: 4,
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        backgroundColor: styles.badge,
                        color: 'var(--bg-primary)'
                      }}
                    >
                      {alert.severity}
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'white', fontFamily: 'var(--font-mono)' }}>
                      {alert.sensor_id.toUpperCase()}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {timeStr}
                  </span>
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                  {alert.message}
                </div>

                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  <div>Lectura: <span style={{ fontWeight: 650, color: 'white' }}>{alert.value}</span></div>
                  <div>Límite: <span style={{ color: 'var(--status-danger)' }}>{alert.threshold}</span></div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
