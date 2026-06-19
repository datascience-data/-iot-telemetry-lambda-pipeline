import json
import time
import random
import argparse
from datetime import datetime
from kafka import KafkaProducer
from kafka.errors import NoBrokersAvailable

# Configuración por defecto
KAFKA_BROKER = "localhost:9092"
TOPIC_NAME = "telemetry-raw"

# Catálogo de sensores industriales simulados
SENSORS = [
    {"id": "sensor-temp-01", "type": "temperature", "unit": "°C", "base": 65.0, "variance": 5.0},
    {"id": "sensor-vib-02", "type": "vibration", "unit": "mm/s", "base": 2.5, "variance": 0.8},
    {"id": "sensor-press-03", "type": "pressure", "unit": "bar", "base": 3.2, "variance": 0.4},
    {"id": "sensor-hum-04", "type": "humidity", "unit": "%", "base": 45.0, "variance": 3.0}
]

def generate_metric(sensor, inject_anomaly=False):
    """Genera una lectura de sensor con opción de inyectar una anomalía."""
    value = sensor["base"] + random.uniform(-sensor["variance"], sensor["variance"])
    
    # Inyección de anomalía si se solicita
    if inject_anomaly:
        if sensor["type"] == "temperature":
            value += random.uniform(25.0, 40.0) # Sobrecalentamiento
        elif sensor["type"] == "vibration":
            value *= random.uniform(3.0, 5.0)   # Falla mecánica / desbalance
        elif sensor["type"] == "pressure":
            value -= random.uniform(2.0, 3.0)   # Despresurización / fuga
        elif sensor["type"] == "humidity":
            value += random.uniform(30.0, 45.0) # Humedad crítica

    return {
        "sensor_id": sensor["id"],
        "metric_type": sensor["type"],
        "value": round(value, 2),
        "unit": sensor["unit"],
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "status": "ANOMALY" if inject_anomaly else "OK",
        "plant_section": "Assembly-Line-A"
    }

def main():
    parser = argparse.ArgumentParser(description="Simulador de Sensores IoT para Kafka")
    parser.add_argument("--broker", default=KAFKA_BROKER, help="Dirección del broker de Kafka")
    parser.add_argument("--topic", default=TOPIC_NAME, help="Nombre del topic")
    parser.add_argument("--interval", type=float, default=1.0, help="Intervalo de envío en segundos")
    parser.add_argument("--anomaly-rate", type=float, default=0.05, help="Probabilidad de inyectar anomalías (0.0 a 1.0)")
    args = parser.parse_args()

    print(f"[*] Iniciando productor de telemetría...")
    print(f"[*] Conectando a Kafka en {args.broker}...")
    
    # Reintento de conexión a Kafka para entornos Docker
    producer = None
    retries = 10
    for i in range(retries):
        try:
            producer = KafkaProducer(
                bootstrap_servers=args.broker,
                value_serializer=lambda v: json.dumps(v).encode("utf-8")
            )
            print("[+] Conectado a Kafka exitosamente.")
            break
        except NoBrokersAvailable:
            print(f"[!] Broker no disponible. Reintentando en 5 segundos... ({i+1}/{retries})")
            time.sleep(5)
            
    if not producer:
        print("[-] Error crítico: No se pudo conectar a Kafka. Terminando.")
        return

    try:
        print(f"[+] Enviando datos al topic '{args.topic}'. Presiona Ctrl+C para detener.")
        while True:
            # Seleccionar un sensor aleatorio
            sensor = random.choice(SENSORS)
            
            # Decidir si inyectar anomalía
            inject_anomaly = random.random() < args.anomaly_rate
            
            # Generar payload
            payload = generate_metric(sensor, inject_anomaly)
            
            # Enviar mensaje
            producer.send(args.topic, value=payload)
            producer.flush()
            
            status_symbol = "⚠️" if payload["status"] == "ANOMALY" else "➡️"
            print(f"{status_symbol} [{payload['timestamp']}] {payload['sensor_id']}: {payload['value']} {payload['unit']} ({payload['status']})")
            
            time.sleep(args.interval)
            
    except KeyboardInterrupt:
        print("\n[*] Deteniendo productor por solicitud del usuario.")
    finally:
        producer.close()
        print("[*] Conexión con Kafka cerrada.")

if __name__ == "__main__":
    main()
