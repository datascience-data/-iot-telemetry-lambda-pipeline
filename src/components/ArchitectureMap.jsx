import React from 'react';
import { Cpu, Server, Zap, Database, Globe, BarChart2 } from 'lucide-react';

export default function ArchitectureMap({ infraStatus, activeSensor, mode }) {
  const isHBaseActive = infraStatus?.hbase === 'ACTIVE';
  const isKafkaActive = infraStatus?.kafka === 'ACTIVE';
  const isSparkActive = infraStatus?.spark === 'ACTIVE';
  const isZookeeperActive = infraStatus?.zookeeper === 'ACTIVE';
  
  // Posiciones de los nodos en nuestro mapa SVG (ancho 800, alto 220)
  const nodes = {
    sensors: { x: 80, y: 110, label: 'Sensores IoT', desc: 'Producción / Simulado', active: true, icon: Cpu, color: 'var(--accent-cyan)' },
    kafka: { x: 220, y: 110, label: 'Apache Kafka', desc: 'Topic: telemetry-raw', active: isKafkaActive || mode === 'SIMULATED', icon: Zap, color: 'var(--accent-pink)' },
    spark: { x: 370, y: 110, label: 'Spark Streaming', desc: 'Speed Layer (Aggs)', active: isSparkActive || mode === 'SIMULATED', icon: BarChart2, color: 'var(--accent-purple)' },
    hbase: { x: 520, y: 110, label: 'Apache HBase', desc: 'NoSQL Serving Layer', active: isHBaseActive || mode === 'SIMULATED', icon: Database, color: 'var(--status-ok)' },
    api: { x: 670, y: 110, label: 'FastAPI Serving', desc: 'REST & WebSockets', active: true, icon: Server, color: 'var(--accent-blue)' }
  };

  const getStatusColor = (active) => active ? 'var(--status-ok)' : 'var(--status-danger)';

  return (
    <div className="glass-card" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Globe size={18} className="text-glow-cyan" style={{ color: 'var(--accent-cyan)' }} />
          Mapa de Arquitectura Lambda en Tiempo Real
        </h3>
        <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--status-ok)', display: 'inline-block' }}></span>
            Activo
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--status-danger)', display: 'inline-block' }}></span>
            Inactivo
          </span>
          <span style={{ padding: '0.1rem 0.4rem', borderRadius: 4, background: 'var(--bg-tertiary)', color: 'var(--accent-cyan)', fontWeight: 600 }}>
            Modo: {mode}
          </span>
        </div>
      </div>

      <div style={{ position: 'relative', width: '100%', overflowX: 'auto', backgroundColor: 'rgba(5, 4, 15, 0.4)', borderRadius: 12, padding: '10px 0' }}>
        <svg width="760" height="200" viewBox="0 0 760 200" style={{ display: 'block', margin: '0 auto' }}>
          <defs>
            <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glow-pink" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glow-purple" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glow-ok" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Líneas de conexión de tuberías de datos (con animaciones de flujo) */}
          <path d="M 120 110 L 180 110" stroke={nodes.kafka.active ? "var(--accent-blue)" : "var(--text-muted)"} strokeWidth="3" fill="none" />
          {nodes.kafka.active && (
            <path d="M 120 110 L 180 110" stroke="var(--accent-cyan)" strokeWidth="3" fill="none" className="animate-flow" />
          )}

          <path d="M 260 110 L 330 110" stroke={nodes.spark.active ? "var(--accent-purple)" : "var(--text-muted)"} strokeWidth="3" fill="none" />
          {nodes.spark.active && (
            <path d="M 260 110 L 330 110" stroke="var(--accent-pink)" strokeWidth="3" fill="none" className="animate-flow" />
          )}

          <path d="M 410 110 L 480 110" stroke={nodes.hbase.active ? "var(--status-ok)" : "var(--text-muted)"} strokeWidth="3" fill="none" />
          {nodes.hbase.active && (
            <path d="M 410 110 L 480 110" stroke="var(--accent-purple)" strokeWidth="3" fill="none" className="animate-flow" />
          )}

          <path d="M 560 110 L 630 110" stroke={nodes.api.active ? "var(--accent-cyan)" : "var(--text-muted)"} strokeWidth="3" fill="none" />
          {nodes.api.active && (
            <path d="M 560 110 L 630 110" stroke="var(--status-ok)" strokeWidth="3" fill="none" className="animate-flow" />
          )}

          {/* Dibujo de los Nodos */}
          {Object.entries(nodes).map(([key, node]) => {
            const Icon = node.icon;
            const glowFilter = node.color === 'var(--accent-cyan)' ? 'url(#glow-cyan)' :
                               node.color === 'var(--accent-pink)' ? 'url(#glow-pink)' :
                               node.color === 'var(--accent-purple)' ? 'url(#glow-purple)' : 'url(#glow-ok)';
            return (
              <g key={key} transform={`translate(${node.x}, ${node.y})`}>
                {/* Halo de luz neon pulsante si está activo */}
                {node.active && (
                  <circle cx="0" cy="0" r="34" fill="none" stroke={node.color} strokeWidth="2" opacity="0.4" style={{ filter: glowFilter }} />
                )}
                
                {/* Círculo base del nodo */}
                <circle cx="0" cy="0" r="28" fill="var(--bg-secondary)" stroke={node.active ? node.color : "var(--text-muted)"} strokeWidth="2" />
                
                {/* Círculo indicador de estado */}
                <circle cx="20" cy="-20" r="6" fill={getStatusColor(node.active)} stroke="var(--bg-primary)" strokeWidth="1.5" />
                {node.active && (
                  <circle cx="20" cy="-20" r="6" fill={getStatusColor(node.active)} className="pulse-dot-active" style={{ transformOrigin: '20px -20px' }} />
                )}

                {/* Texto del Nodo */}
                <text x="0" y="48" textAnchor="middle" fill="white" fontSize="12" fontWeight="600">{node.label}</text>
                <text x="0" y="62" textAnchor="middle" fill="var(--text-secondary)" fontSize="9">{node.desc}</text>
              </g>
            );
          })}
        </svg>

        {/* Renderizado de iconos HTML flotando sobre el SVG en las coordenadas de los nodos */}
        {Object.entries(nodes).map(([key, node]) => {
          const Icon = node.icon;
          return (
            <div 
              key={key} 
              style={{
                position: 'absolute',
                left: `calc(50% - 380px + ${node.x}px - 14px)`,
                top: `${node.y - 4}px`,
                color: node.active ? node.color : 'var(--text-muted)',
                pointerEvents: 'none',
                transition: 'color 0.3s ease'
              }}
            >
              <Icon size={26} />
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', fontSize: '0.85rem' }}>
        <div style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>Capas del Pipeline:</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Speed Layer (Spark windowed streaming) ingestada en HBase en tiempo real.</div>
        </div>
        <div style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ fontWeight: 600, color: 'var(--accent-pink)' }}>Sensor activo actual:</div>
          <div style={{ color: 'white', fontSize: '0.8rem', textTransform: 'capitalize', fontWeight: 'bold' }}>
            {activeSensor ? `${activeSensor.sensor_id} (${activeSensor.value} ${activeSensor.unit})` : 'Ninguno'}
          </div>
        </div>
      </div>
    </div>
  );
}
