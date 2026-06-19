import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, Sliders, Activity, Database, AlertCircle, 
  HelpCircle, RefreshCw, Layers, Server, Wifi, WifiOff 
} from 'lucide-react';
import ArchitectureMap from './components/ArchitectureMap';
import RealtimeChart from './components/RealtimeChart';
import AlertPanel from './components/AlertPanel';
import QueryConsole from './components/QueryConsole';

const SENSOR_CATALOG = [
  {"id": "sensor-temp-01", "type": "temperature", "unit": "°C", "base": 65.0, "variance": 5.0, "threshold": 80.0},
  {"id": "sensor-vib-02", "type": "vibration", "unit": "mm/s", "base": 2.5, "variance": 0.8, "threshold": 5.5},
  {"id": "sensor-press-03", "type": "pressure", "unit": "bar", "base": 3.2, "variance": 0.4, "threshold": 4.2},
  {"id": "sensor-hum-04", "type": "humidity", "unit": "%", "base": 45.0, "variance": 3.0, "threshold": 60.0}
];

export default function App() {
  const [infraStatus, setInfraStatus] = useState({
    zookeeper: 'OFFLINE',
    kafka: 'OFFLINE',
    spark: 'OFFLINE',
    hbase: 'OFFLINE'
  });
  const [config, setConfig] = useState({
    mode: 'SIMULATED',
    anomaly_rate: 0.05,
    producer_active: true,
    simulation_speed: 1.0
  });

  const [dataHistory, setDataHistory] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [hbaseRecords, setHbaseRecords] = useState([]);
  const [selectedSensor, setSelectedSensor] = useState('sensor-temp-01');
  
  const [wsConnected, setWsConnected] = useState(false);
  const [isLoadingHBase, setIsLoadingHBase] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard | docs
  
  const socketRef = useRef(null);

  // 1. Obtener Estado del Backend e Infraestructura
  const fetchSystemStatus = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/status');
      if (res.ok) {
        const data = await res.json();
        setInfraStatus(data.infrastructure);
        setConfig(data.config);
      }
    } catch (err) {
      console.log('Backend not reachable yet. Operating in local demo mode.');
    }
  };

  // 2. Obtener Historial de HBase (Serving Layer)
  const fetchHbaseRecords = async (sensorId = null) => {
    setIsLoadingHBase(true);
    try {
      let url = 'http://localhost:8000/api/hbase/records';
      if (sensorId) url += `?sensor_id=${sensorId}`;
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setHbaseRecords(data);
      }
    } catch (err) {
      console.log('Error fetching HBase records:', err);
    } finally {
      setIsLoadingHBase(false);
    }
  };

  // 3. Modificar configuraciones del pipeline desde el frontend
  const updatePipelineConfig = async (updatedConfig) => {
    try {
      const res = await fetch('http://localhost:8000/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anomaly_rate: updatedConfig.anomaly_rate ?? config.anomaly_rate,
          producer_active: updatedConfig.producer_active ?? config.producer_active,
          simulation_speed: updatedConfig.simulation_speed ?? config.simulation_speed
        })
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
      }
    } catch (err) {
      // Si el backend no está, actualizamos estado local
      setConfig(prev => ({ ...prev, ...updatedConfig }));
    }
  };

  // 4. Conectar WebSocket para recibir flujo en tiempo real
  useEffect(() => {
    const connectWebSocket = () => {
      const wsUrl = 'ws://localhost:8000/ws/telemetry';
      console.log(`Connecting to WebSocket: ${wsUrl}`);
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        setWsConnected(true);
        console.log('WebSocket connected successfully.');
      };

      ws.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        
        if (payload.type === 'init') {
          // Cargar historial inicial de alertas
          setAlerts(payload.alerts);
          setConfig(prev => ({ ...prev, mode: payload.mode }));
        } else if (payload.type === 'telemetry') {
          // Agregar nueva lectura de sensor al historial
          const newReading = payload.data;
          setDataHistory(prev => [...prev, newReading].slice(-100)); // Mantener últimas 100 lecturas globales
          
          // Si hay alerta nueva, agregarla al panel
          if (payload.alert) {
            setAlerts(prev => [payload.alert, ...prev].slice(0, 50));
          }
          
          // Actualizar registros del serving layer HBase simulados locales
          if (payload.aggregation) {
            setHbaseRecords(prev => {
              const filtered = prev.filter(r => r.row_key !== payload.aggregation.row_key);
              return [payload.aggregation, ...filtered].slice(0, 50);
            });
          }
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        console.log('WebSocket disconnected. Reconnecting in 5s...');
        setTimeout(connectWebSocket, 5000);
      };

      ws.onerror = (err) => {
        console.log('WebSocket connection error:', err);
        ws.close();
      };

      socketRef.current = ws;
    };

    connectWebSocket();
    fetchSystemStatus();
    fetchHbaseRecords();

    // Intervalo para actualizar el estado de infraestructura
    const interval = setInterval(() => {
      fetchSystemStatus();
    }, 10000);

    return () => {
      clearInterval(interval);
      if (socketRef.current) socketRef.current.close();
    };
  }, []);

  const handleClearAlerts = async () => {
    try {
      await fetch('http://localhost:8000/api/alerts/clear', { method: 'POST' });
      setAlerts([]);
    } catch (err) {
      setAlerts([]);
    }
  };

  const currentSensorReading = dataHistory.length > 0 
    ? dataHistory.filter(d => d.sensor_id === selectedSensor).slice(-1)[0] 
    : null;

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '1.5rem 1.5rem 3rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* HEADER DE PORTAFOLIO PREMIUM */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <Layers size={28} className="text-glow-cyan" style={{ color: 'var(--accent-cyan)' }} />
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, background: 'linear-gradient(135deg, #white 0%, #a5b4fc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'inline' }}>
              IoT Telemetry Lambda Pipeline
            </h1>
            <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: 20, background: 'rgba(79, 172, 254, 0.1)', border: '1px solid rgba(79, 172, 254, 0.25)', color: 'var(--accent-blue)', fontWeight: 600 }}>
              Big Data Architecture
            </span>
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Pipeline end-to-end de ingesta con <strong style={{ color: 'white' }}>Apache Kafka</strong>, procesamiento rápido con <strong style={{ color: 'white' }}>Spark Streaming</strong>, yServing Layer con <strong style={{ color: 'white' }}>HBase</strong>.
          </p>
        </div>

        {/* Tabs de Navegación */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            onClick={() => setActiveTab('dashboard')}
            style={{
              background: activeTab === 'dashboard' ? 'var(--bg-tertiary)' : 'transparent',
              color: activeTab === 'dashboard' ? 'white' : 'var(--text-secondary)',
              border: activeTab === 'dashboard' ? '1px solid var(--accent-cyan)' : '1px solid transparent',
              padding: '0.5rem 1rem',
              borderRadius: 8,
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'var(--transition-smooth)'
            }}
          >
            Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('docs')}
            style={{
              background: activeTab === 'docs' ? 'var(--bg-tertiary)' : 'transparent',
              color: activeTab === 'docs' ? 'white' : 'var(--text-secondary)',
              border: activeTab === 'docs' ? '1px solid var(--accent-purple)' : '1px solid transparent',
              padding: '0.5rem 1rem',
              borderRadius: 8,
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'var(--transition-smooth)'
            }}
          >
            Guía & Documentación
          </button>
        </div>
      </header>

      {activeTab === 'dashboard' ? (
        <>
          {/* SECCIÓN 1: ESTADO DE INFRAESTRUCTURA */}
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {/* WebSocket connection status card */}
            <div className="glass-card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderColor: wsConnected ? 'rgba(0,230,118,0.2)' : 'rgba(255,23,68,0.2)' }}>
              <div style={{ background: wsConnected ? 'rgba(0,230,118,0.1)' : 'rgba(255,23,68,0.1)', padding: '0.5rem', borderRadius: 10 }}>
                {wsConnected ? <Wifi size={20} style={{ color: 'var(--status-ok)' }} /> : <WifiOff size={20} style={{ color: 'var(--status-danger)' }} />}
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>API Backend Live</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'white' }}>
                  {wsConnected ? 'CONECTADO (WS)' : 'DESCONECTADO'}
                </div>
              </div>
            </div>

            {/* Docker Cluster Component Cards */}
            {Object.entries(infraStatus).map(([name, status]) => {
              const isActive = status === 'ACTIVE';
              return (
                <div key={name} className="glass-card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderColor: isActive ? 'rgba(0,230,118,0.2)' : 'rgba(255,255,255,0.05)' }}>
                  <div style={{ background: isActive ? 'rgba(0,230,118,0.05)' : 'rgba(255,255,255,0.02)', padding: '0.5rem', borderRadius: 10 }}>
                    <Server size={20} style={{ color: isActive ? 'var(--status-ok)' : 'var(--text-muted)' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{name} Component</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: isActive ? 'white' : 'var(--text-muted)' }}>
                      {isActive ? 'ONLINE (DOCKER)' : 'OFFLINE (MOCK)'}
                    </div>
                  </div>
                </div>
              );
            })}
          </section>

          {/* SECCIÓN 2: CONTROL DE SIMULACIÓN Y ARQUITECTURA */}
          <section style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '1.5rem', alignItems: 'stretch' }}>
            
            {/* Panel de Control */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sliders size={18} className="text-glow-cyan" style={{ color: 'var(--accent-cyan)' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white' }}>Panel de Control del Pipeline</h3>
              </div>

              {/* Botón de encendido / apagado del flujo */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Ingesta de Telemetría (Kafka Producer)</label>
                <button
                  onClick={() => updatePipelineConfig({ producer_active: !config.producer_active })}
                  style={{
                    background: config.producer_active ? 'var(--status-danger)' : 'var(--status-ok)',
                    color: 'var(--bg-primary)',
                    border: 'none',
                    borderRadius: 10,
                    padding: '0.65rem 1rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    boxShadow: config.producer_active ? '0 0 15px rgba(255,23,68,0.2)' : '0 0 15px rgba(0,230,118,0.2)',
                    transition: 'var(--transition-smooth)'
                  }}
                >
                  {config.producer_active ? (
                    <>
                      <Pause size={16} fill="var(--bg-primary)" />
                      PAUSAR STREAMING
                    </>
                  ) : (
                    <>
                      <Play size={16} fill="var(--bg-primary)" />
                      REANUDAR STREAMING
                    </>
                  )}
                </button>
              </div>

              {/* Slider de Anomalía */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Tasa de Inyección de Anomalías</span>
                  <span style={{ color: 'var(--accent-pink)', fontWeight: 'bold' }}>{(config.anomaly_rate * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="0.5"
                  step="0.01"
                  value={config.anomaly_rate}
                  onChange={(e) => updatePipelineConfig({ anomaly_rate: parseFloat(e.target.value) })}
                  style={{
                    width: '100%',
                    accentColor: 'var(--accent-pink)',
                    background: 'var(--bg-secondary)',
                    height: 6,
                    borderRadius: 3,
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                />
              </div>

              {/* Slider de Frecuencia de Ingesta */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Velocidad de Ingesta</span>
                  <span style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>{config.simulation_speed} seg/msg</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="3.0"
                  step="0.1"
                  value={config.simulation_speed}
                  onChange={(e) => updatePipelineConfig({ simulation_speed: parseFloat(e.target.value) })}
                  style={{
                    width: '100%',
                    accentColor: 'var(--accent-cyan)',
                    background: 'var(--bg-secondary)',
                    height: 6,
                    borderRadius: 3,
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                />
              </div>

              <div style={{ marginTop: 'auto', padding: '0.75rem', background: 'rgba(255,255,255,0.01)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-secondary)' }}>
                  <AlertCircle size={14} style={{ color: 'var(--accent-purple)' }} />
                  <span>Modo del Sistema:</span>
                  <strong style={{ color: 'white', letterSpacing: 0.5 }}>{config.mode}</strong>
                </div>
              </div>
            </div>

            {/* Mapa de Arquitectura */}
            <ArchitectureMap infraStatus={infraStatus} activeSensor={currentSensorReading} mode={config.mode} />
          </section>

          {/* SECCIÓN 3: REAL-TIME CHARTS & ALERTS */}
          <section style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr', gap: '1.5rem', alignItems: 'stretch' }}>
            
            {/* Gráfico SVG */}
            <RealtimeChart 
              dataHistory={dataHistory} 
              selectedSensor={selectedSensor} 
              onSelectSensor={setSelectedSensor} 
              sensorCatalog={SENSOR_CATALOG} 
            />

            {/* Consola de Alertas */}
            <AlertPanel alerts={alerts} onClearAlerts={handleClearAlerts} />
          </section>

          {/* SECCIÓN 4: HBASE SERVING LAYER CONSOLE */}
          <section style={{ width: '100%' }}>
            <QueryConsole 
              selectedSensor={selectedSensor} 
              hbaseRecords={hbaseRecords} 
              onRefresh={fetchHbaseRecords}
              isLoading={isLoadingHBase}
            />
          </section>
        </>
      ) : (
        /* VISTA DE DOCUMENTACIÓN DEL PROYECTO */
        <section className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '2rem', lineHeight: 1.6 }}>
          <h2 style={{ fontSize: '1.5rem', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem' }}>
            <HelpCircle size={22} style={{ color: 'var(--accent-purple)' }} />
            Guía de Configuración e Implementación Big Data
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p>
              Este proyecto demuestra una implementación clásica de la <strong>capa de velocidad (Speed Layer)</strong> y la <strong>capa de servicio (Serving Layer)</strong> de una arquitectura Lambda para telemetría industrial IoT.
            </p>

            <h3 style={{ color: 'var(--accent-cyan)', fontSize: '1.1rem', marginTop: '1rem' }}>1. Inicialización en Modo Simulación (Quickstart)</h3>
            <p style={{ color: 'var(--text-secondary)' }}>
              El panel frontend y la API backend tienen un motor incorporado que simula la ingesta de Kafka, el procesamiento de ventanas de Spark y el almacenamiento columnar de HBase. Esto permite inspeccionar la interfaz visual y el comportamiento de la red de inmediato.
            </p>
            <pre style={{ background: 'black', padding: '1rem', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--accent-cyan)', border: '1px solid rgba(255,255,255,0.05)', overflowX: 'auto' }}>
              # 1. Instalar dependencias de Node e iniciar Frontend React<br />
              npm install<br />
              npm run dev<br /><br />
              # 2. En una nueva terminal, instalar librerías de Python e iniciar backend<br />
              cd backend<br />
              pip install -r requirements.txt<br />
              python main.py
            </pre>

            <h3 style={{ color: 'var(--accent-purple)', fontSize: '1.1rem', marginTop: '1rem' }}>2. Inicialización en Modo Producción (Docker)</h3>
            <p style={{ color: 'var(--text-secondary)' }}>
              Para ejecutar la infraestructura distribuida real, inicia el clúster de Docker Compose y arranca los scripts de ingesta y procesamiento de Spark.
            </p>
            <pre style={{ background: 'black', padding: '1rem', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--accent-purple)', border: '1px solid rgba(255,255,255,0.05)', overflowX: 'auto' }}>
              # 1. Levantar contenedores (Zookeeper, Kafka, Spark Master/Worker, HBase Standalone)<br />
              docker-compose up -d<br /><br />
              # 2. Inicializar esquemas y tablas de HBase<br />
              cd pipeline<br />
              pip install -r requirements.txt<br />
              python hbase_setup.py<br /><br />
              # 3. Arrancar el productor de sensores IoT a Kafka<br />
              python producer.py --broker localhost:9092 --interval 1.0<br /><br />
              # 4. Enviar el Job de PySpark Streaming (Speed Layer)<br />
              spark-submit --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.3.2 spark_processor.py
            </pre>

            <h3 style={{ color: 'var(--accent-pink)', fontSize: '1.1rem', marginTop: '1rem' }}>3. Diseño Físico del RowKey en HBase</h3>
            <p style={{ color: 'var(--text-secondary)' }}>
              HBase al ser una base de datos columnar NoSQL requiere un diseño de clave único y óptimo para evitar "hotspotting". En este pipeline, el row-key se diseña como:
            </p>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: '0.85rem', borderLeft: '3px solid var(--accent-pink)', color: 'white' }}>
              RowKey = [sensor_id] + "#" + [window_start_timestamp]
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              <strong>Beneficio:</strong> Este diseño permite realizar escaneos por rangos extremadamente rápidos (Prefix Scans) para obtener las agregaciones históricas de un sensor determinado a lo largo del tiempo, ordenadas lexicográficamente por su fecha.
            </p>
          </div>
        </section>
      )}
      
      {/* FOOTER DEL PORTAFOLIO */}
      <footer style={{ marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        <div>Diseñado por el Desarrollador | Portafolio Big Data & Fullstack</div>
        <div>Tecnologías: Kafka, Spark Streaming, HBase, FastAPI, React, SVGs</div>
      </footer>

    </div>
  );
}
