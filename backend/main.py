import asyncio
import json
import time
import random
import threading
from datetime import datetime
from typing import Dict, List, Set
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Big Data Ingestion & Serving API", version="1.0.0")

# Permitir CORS para desarrollo local fácil
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Estructuras de almacenamiento en memoria para el modo SIMULADO
mock_raw_telemetry: List[Dict] = []
mock_hbase_store: Dict[str, Dict] = {}
mock_alerts: List[Dict] = []

# Configuración y estado global
system_config = {
    "mode": "SIMULATED",       # SIMULATED o DOCKER
    "anomaly_rate": 0.05,      # Probabilidad de anomalía (0.0 a 1.0)
    "producer_active": True,
    "simulation_speed": 1.0,   # Segundos entre lecturas
}

# Catálogo de sensores
SENSORS = [
    {"id": "sensor-temp-01", "type": "temperature", "unit": "°C", "base": 65.0, "variance": 5.0, "threshold": 80.0},
    {"id": "sensor-vib-02", "type": "vibration", "unit": "mm/s", "base": 2.5, "variance": 0.8, "threshold": 5.5},
    {"id": "sensor-press-03", "type": "pressure", "unit": "bar", "base": 3.2, "variance": 0.4, "threshold": 4.2},
    {"id": "sensor-hum-04", "type": "humidity", "unit": "%", "base": 45.0, "variance": 3.0, "threshold": 60.0}
]

# Set de conexiones WebSocket activas
active_connections: Set[WebSocket] = set()

class ConfigUpdate(BaseModel):
    anomaly_rate: float
    producer_active: bool
    simulation_speed: float

def check_docker_services() -> Dict[str, str]:
    """Valida si los servicios de Docker (Kafka y HBase) están disponibles."""
    status = {
        "zookeeper": "OFFLINE",
        "kafka": "OFFLINE",
        "spark": "OFFLINE",
        "hbase": "OFFLINE"
    }
    
    # 1. Probar conexión HBase (Thrift en 9090)
    try:
        import happybase
        conn = happybase.Connection(host="localhost", port=9090, timeout=1000)
        conn.tables()
        status["hbase"] = "ACTIVE"
        status["zookeeper"] = "ACTIVE" # Si HBase responde, Zookeeper y HBase están arriba
        conn.close()
    except Exception:
        pass

    # 2. Probar conexión Kafka (9092)
    try:
        from kafka import KafkaConsumer
        consumer = KafkaConsumer(bootstrap_servers="localhost:9092", request_timeout_ms=1000)
        status["kafka"] = "ACTIVE"
        consumer.close()
    except Exception:
        pass
        
    # Si todo está activo, sugerimos que el modo es DOCKER, de lo contrario SIMULATED
    if status["kafka"] == "ACTIVE" and status["hbase"] == "ACTIVE":
        system_config["mode"] = "DOCKER"
    else:
        system_config["mode"] = "SIMULATED"
        
    # Spark se asume activo si Docker corre, pero no tenemos conexión directa de ping simple
    status["spark"] = "ACTIVE" if status["kafka"] == "ACTIVE" else "OFFLINE"
    
    return status

def generate_sensor_data(sensor, inject_anomaly=False):
    """Generador idéntico al del productor de producción."""
    value = sensor["base"] + random.uniform(-sensor["variance"], sensor["variance"])
    if inject_anomaly:
        if sensor["type"] == "temperature":
            value += random.uniform(20.0, 35.0)
        elif sensor["type"] == "vibration":
            value *= random.uniform(2.5, 4.0)
        elif sensor["type"] == "pressure":
            value -= random.uniform(1.8, 2.5)
        elif sensor["type"] == "humidity":
            value += random.uniform(20.0, 30.0)

    is_anomaly = inject_anomaly or value > sensor["threshold"] or (sensor["type"] == "pressure" and value < 1.0)
    
    return {
        "sensor_id": sensor["id"],
        "metric_type": sensor["type"],
        "value": round(value, 2),
        "unit": sensor["unit"],
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "status": "ANOMALY" if is_anomaly else "OK",
        "plant_section": "Assembly-Line-A"
    }

def update_mock_hbase(event):
    """Simula el procesamiento y escritura del Speed Layer (Spark -> HBase)."""
    sensor_id = event["sensor_id"]
    timestamp = event["timestamp"]
    
    # 1. Guardar lectura cruda en 'cf_raw' (simulado)
    raw_key = f"{sensor_id}#{timestamp}"
    mock_raw_telemetry.append(event)
    if len(mock_raw_telemetry) > 200:
        mock_raw_telemetry.pop(0)

    # 2. Calcular agregaciones en ventana de tiempo en memoria (Speed Layer)
    # Filtramos últimos 60 segundos de lecturas para este sensor
    now_epoch = time.time()
    recent_values = []
    
    for r in mock_raw_telemetry:
        if r["sensor_id"] == sensor_id:
            try:
                # Truncar la Z al final para formatear
                ts_str = r["timestamp"].replace("Z", "")
                r_epoch = datetime.fromisoformat(ts_str).timestamp()
                if now_epoch - r_epoch < 60:
                    recent_values.append(r["value"])
            except Exception:
                pass
                
    if not recent_values:
        recent_values = [event["value"]]

    avg_val = sum(recent_values) / len(recent_values)
    min_val = min(recent_values)
    max_val = max(recent_values)
    
    # Clave de HBase para agregaciones de ventana
    window_start = datetime.utcnow().replace(second=0, microsecond=0).isoformat()
    window_key = f"{sensor_id}#{window_start}"
    
    # Guardar en HBase simulado
    mock_hbase_store[window_key] = {
        "row_key": window_key,
        "sensor_id": sensor_id,
        "window_start": window_start,
        "avg_value": round(avg_val, 2),
        "min_value": round(min_val, 2),
        "max_value": round(max_val, 2),
        "event_count": len(recent_values),
        "last_updated": datetime.utcnow().isoformat() + "Z"
    }
    
    # Limitar tamaño de hbase simulado
    if len(mock_hbase_store) > 100:
        # Remover las más viejas
        oldest_key = list(mock_hbase_store.keys())[0]
        del mock_hbase_store[oldest_key]
        
    return mock_hbase_store[window_key]

# Hilo de simulación en segundo plano
def run_simulation():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    async def simulation_loop():
        print("[*] Hilo de simulación iniciado.")
        while True:
            if system_config["producer_active"]:
                # Generar evento
                sensor = random.choice(SENSORS)
                inject = random.random() < system_config["anomaly_rate"]
                event = generate_sensor_data(sensor, inject)
                
                # Procesar en Spark Streaming simulado y guardar en HBase simulado
                agg_data = update_mock_hbase(event)
                
                # Detección de anomalías en Spark simulado
                if event["status"] == "ANOMALY":
                    alert = {
                        "id": f"alert-{int(time.time()*1000)}",
                        "sensor_id": event["sensor_id"],
                        "metric_type": event["metric_type"],
                        "value": event["value"],
                        "threshold": sensor["threshold"],
                        "timestamp": event["timestamp"],
                        "severity": "CRITICAL" if random.random() > 0.3 else "WARNING",
                        "message": f"Lectura de {event['metric_type']} fuera de límites: {event['value']}{event['unit']}"
                    }
                    mock_alerts.insert(0, alert)
                    if len(mock_alerts) > 50:
                        mock_alerts.pop()
                else:
                    alert = None

                # Crear payload de streaming integrado
                payload = {
                    "type": "telemetry",
                    "data": event,
                    "aggregation": agg_data,
                    "alert": alert
                }
                
                # Emitir a todos los websockets activos
                if active_connections:
                    message_str = json.dumps(payload)
                    # Convertir corrutina sincrónica a asincrónica en el event loop
                    for ws in list(active_connections):
                        try:
                            asyncio.run_coroutine_threadsafe(ws.send_text(message_str), loop)
                        except Exception:
                            pass

            await asyncio.sleep(system_config["simulation_speed"])

    loop.run_until_complete(simulation_loop())

# Iniciar hilo secundario al importar
simulation_thread = threading.Thread(target=run_simulation, daemon=True)
simulation_thread.start()

# --- ENDPOINTS REST ---

@app.get("/api/status")
def get_status():
    """Retorna el estado de la infraestructura y configuración del sistema."""
    docker_status = check_docker_services()
    return {
        "status": "ONLINE",
        "system_time": datetime.utcnow().isoformat() + "Z",
        "config": system_config,
        "infrastructure": docker_status
    }

@app.post("/api/config")
def update_config(config: ConfigUpdate):
    """Permite ajustar parámetros de simulación en tiempo real."""
    system_config["anomaly_rate"] = config.anomaly_rate
    system_config["producer_active"] = config.producer_active
    system_config["simulation_speed"] = config.simulation_speed
    return {"message": "Configuración actualizada", "config": system_config}

@app.get("/api/hbase/records")
def get_hbase_records(sensor_id: str = None):
    """
    Capa de consulta (Serving Layer). 
    Si está en DOCKER, consulta HBase Thrift. Si está en SIMULATED, consulta el in-memory dict.
    """
    if system_config["mode"] == "DOCKER":
        try:
            import happybase
            conn = happybase.Connection(host="localhost", port=9090)
            table = conn.table(HBASE_TABLE)
            records = []
            
            # Si se pasa un sensor, escaneamos por prefijo de rowkey (HBase row prefix)
            if sensor_id:
                scan = table.scan(row_prefix=sensor_id.encode("utf-8"), limit=50)
            else:
                scan = table.scan(limit=50)
                
            for key, data in scan:
                # Decodificar el row_key (ej: sensor-temp-01#2026-06-19T10:00:00)
                rk = key.decode("utf-8")
                parts = rk.split("#")
                s_id = parts[0]
                window_start = parts[1] if len(parts) > 1 else ""
                
                records.append({
                    "row_key": rk,
                    "sensor_id": s_id,
                    "window_start": window_start,
                    "avg_value": float(data.get(b"cf_stats:avg_val", b"0").decode("utf-8")),
                    "min_value": float(data.get(b"cf_stats:min_val", b"0").decode("utf-8")),
                    "max_value": float(data.get(b"cf_stats:max_val", b"0").decode("utf-8")),
                    "event_count": int(data.get(b"cf_stats:count", b"0").decode("utf-8")),
                    "last_updated": data.get(b"cf_stats:last_updated", b"").decode("utf-8")
                })
            conn.close()
            return records
        except Exception as e:
            # Fallback inmediato a simulación si falla Thrift
            print(f"[!] Fallo en lectura HBase Docker: {e}. Activando fallback a simulación.")
            system_config["mode"] = "SIMULATED"
            
    # Lógica del modo SIMULADO
    records = list(mock_hbase_store.values())
    if sensor_id:
        records = [r for r in records if r["sensor_id"] == sensor_id]
    
    # Ordenar por fecha descendente
    records.sort(key=lambda x: x["last_updated"], reverse=True)
    return records[:50]

@app.get("/api/alerts")
def get_alerts():
    """Retorna las alertas de anomalías del búfer."""
    return mock_alerts[:20]

@app.post("/api/alerts/clear")
def clear_alerts():
    """Limpia el búfer de alertas."""
    mock_alerts.clear()
    return {"message": "Alertas limpiadas."}

# --- WEBSOCKET FOR REALTIME STREAMING ---

@app.websocket("/ws/telemetry")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.add(websocket)
    print(f"[+] WebSocket conectado: {websocket.client}")
    try:
        # Enviar historial inicial de alertas al conectar
        await websocket.send_text(json.dumps({
            "type": "init",
            "alerts": mock_alerts[:15],
            "mode": system_config["mode"]
        }))
        
        while True:
            # Mantener conexión activa y recibir configuraciones del frontend
            data = await websocket.receive_text()
            message = json.loads(data)
            if message.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
            elif message.get("type") == "toggle_producer":
                system_config["producer_active"] = message.get("active", True)
                
    except WebSocketDisconnect:
        active_connections.remove(websocket)
        print(f"[-] WebSocket desconectado: {websocket.client}")
    except Exception as e:
        if websocket in active_connections:
            active_connections.remove(websocket)
        print(f"[-] Error en WebSocket: {e}")
