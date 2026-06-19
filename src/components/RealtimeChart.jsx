import React, { useMemo } from 'react';
import { Activity } from 'lucide-react';

export default function RealtimeChart({ dataHistory, selectedSensor, onSelectSensor, sensorCatalog }) {
  // Filtrar lecturas del sensor seleccionado
  const sensorData = useMemo(() => {
    return dataHistory
      .filter((d) => d.sensor_id === selectedSensor)
      .slice(-20); // Mostrar últimas 20 lecturas en el gráfico
  }, [dataHistory, selectedSensor]);

  const currentSensorInfo = useMemo(() => {
    return sensorCatalog.find((s) => s.id === selectedSensor) || sensorCatalog[0];
  }, [selectedSensor, sensorCatalog]);

  // Dimensiones del SVG
  const width = 600;
  const height = 240;
  const padding = 40;

  // Encontrar valores Min y Max para auto-escalar el eje Y
  const yBounds = useMemo(() => {
    if (sensorData.length === 0) {
      return { min: currentSensorInfo.base - currentSensorInfo.variance * 2, max: currentSensorInfo.base + currentSensorInfo.variance * 2 };
    }
    const values = sensorData.map((d) => d.value);
    let minVal = Math.min(...values);
    let maxVal = Math.max(...values);
    
    // Dar un margen del 10%
    const margin = (maxVal - minVal) * 0.1 || 1.0;
    return {
      min: Math.max(0, minVal - margin),
      max: maxVal + margin
    };
  }, [sensorData, currentSensorInfo]);

  // Transformar coordenadas de datos a coordenadas SVG
  const points = useMemo(() => {
    if (sensorData.length === 0) return [];
    
    const xStep = (width - padding * 2) / Math.max(1, sensorData.length - 1);
    const yRange = yBounds.max - yBounds.min || 1.0;

    return sensorData.map((d, index) => {
      const x = padding + index * xStep;
      // Invertir Y porque en SVG 0 es arriba
      const y = height - padding - ((d.value - yBounds.min) / yRange) * (height - padding * 2);
      return { x, y, value: d.value, timestamp: d.timestamp, status: d.status };
    });
  }, [sensorData, yBounds, width, height]);

  // Armar path del SVG
  const pathD = useMemo(() => {
    if (points.length === 0) return '';
    return points.reduce((path, pt, index) => {
      return index === 0 ? `M ${pt.x} ${pt.y}` : `${path} L ${pt.x} ${pt.y}`;
    }, '');
  }, [points]);

  // Armar path relleno con degradado para debajo de la línea
  const areaD = useMemo(() => {
    if (points.length === 0) return '';
    const first = points[0];
    const last = points[points.length - 1];
    return `${pathD} L ${last.x} ${height - padding} L ${first.x} ${height - padding} Z`;
  }, [points, pathD, height]);

  // Generar etiquetas Y
  const yGridLines = useMemo(() => {
    const lines = [];
    const count = 4;
    const step = (yBounds.max - yBounds.min) / count;
    for (let i = 0; i <= count; i++) {
      const val = yBounds.min + i * step;
      const y = height - padding - (i / count) * (height - padding * 2);
      lines.push({ val: val.toFixed(1), y });
    }
    return lines;
  }, [yBounds, height]);

  const lastValue = sensorData[sensorData.length - 1];

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Activity size={18} className="pulse-dot-active" style={{ color: 'var(--accent-cyan)' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white' }}>Telemetría en Tiempo Real</h3>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Monitoreo en streaming y Speed Layer de los sensores de planta.
          </p>
        </div>

        {/* Botones de Selección de Sensores */}
        <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(255,255,255,0.02)', padding: '0.25rem', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
          {sensorCatalog.map((sensor) => (
            <button
              key={sensor.id}
              onClick={() => onSelectSensor(sensor.id)}
              style={{
                background: selectedSensor === sensor.id ? 'var(--bg-tertiary)' : 'transparent',
                color: selectedSensor === sensor.id ? 'white' : 'var(--text-secondary)',
                border: 'none',
                padding: '0.35rem 0.65rem',
                borderRadius: 6,
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'var(--transition-smooth)',
                boxShadow: selectedSensor === sensor.id ? 'inset 0 1px 0 rgba(255,255,255,0.1)' : 'none'
              }}
            >
              {sensor.id.replace('sensor-', '').toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Grid del sensor activo */}
      {lastValue && (
        <div style={{ display: 'flex', gap: '1.5rem', background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.05)', borderRadius: 8, padding: '0.75rem' }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Valor Actual</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: lastValue.status === 'ANOMALY' ? 'var(--status-danger)' : 'var(--accent-cyan)' }}>
              {lastValue.value} <span style={{ fontSize: '0.9rem', fontWeight: 400 }}>{lastValue.unit}</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Estado de Umbral</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.25rem', color: lastValue.status === 'ANOMALY' ? 'var(--status-danger)' : 'var(--status-ok)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: lastValue.status === 'ANOMALY' ? 'var(--status-danger)' : 'var(--status-ok)' }}></span>
              {lastValue.status}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Límite Crítico</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, marginTop: '0.35rem', color: 'var(--text-muted)' }}>
              {currentSensorInfo.threshold} {currentSensorInfo.unit}
            </div>
          </div>
        </div>
      )}

      {/* Gráfico SVG */}
      <div style={{ flex: 1, position: 'relative', minHeight: '200px' }}>
        {points.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Esperando flujo de datos desde Kafka...
          </div>
        ) : (
          <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
            <defs>
              {/* Degradado para el relleno de área */}
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0.00" />
              </linearGradient>
              {/* Filtro de sombra de neón */}
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Líneas de Grilla Horizontales */}
            {yGridLines.map((line, index) => (
              <g key={index}>
                <line
                  x1={padding}
                  y1={line.y}
                  x2={width - padding}
                  y2={line.y}
                  stroke="rgba(255,255,255,0.04)"
                  strokeWidth="1"
                />
                <text
                  x={padding - 8}
                  y={line.y + 4}
                  textAnchor="end"
                  fill="var(--text-muted)"
                  fontSize="9"
                  fontFamily="var(--font-mono)"
                >
                  {line.val}
                </text>
              </g>
            ))}

            {/* Eje X y Y bases */}
            <line
              x1={padding}
              y1={height - padding}
              x2={width - padding}
              y2={height - padding}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="1.5"
            />

            {/* Relleno de Área Degradada */}
            {areaD && <path d={areaD} fill="url(#chartGradient)" />}

            {/* Línea de Datos Genuina */}
            {pathD && (
              <path
                d={pathD}
                fill="none"
                stroke="var(--accent-cyan)"
                strokeWidth="2.5"
                filter="url(#glow)"
              />
            )}

            {/* Puntos Interactivos */}
            {points.map((pt, index) => {
              const isAnomaly = pt.status === 'ANOMALY';
              return (
                <g key={index}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isAnomaly ? 5 : 3.5}
                    fill={isAnomaly ? 'var(--status-danger)' : 'var(--bg-primary)'}
                    stroke={isAnomaly ? 'var(--status-danger)' : 'var(--accent-cyan)'}
                    strokeWidth="2"
                    style={{ transition: 'all 0.15s ease' }}
                  />
                  {/* Animación pulsante para anomalías */}
                  {isAnomaly && (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="10"
                      fill="none"
                      stroke="var(--status-danger)"
                      strokeWidth="1.5"
                      opacity="0.6"
                      className="pulse-dot-active"
                      style={{ transformOrigin: `${pt.x}px ${pt.y}px` }}
                    />
                  )}
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}
