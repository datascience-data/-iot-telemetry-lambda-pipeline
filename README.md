# Pipeline de Ingesta y Streaming Big Data - Arquitectura Lambda

Este repositorio contiene una implementación end-to-end de una **Arquitectura Lambda** diseñada para la ingesta, procesamiento analítico en tiempo real y persistencia a baja latencia de telemetría proveniente de sensores IoT industriales. 

El proyecto cuenta con un **Dashboard interactivo moderno** que permite visualizar el flujo de datos y el estado de la infraestructura en tiempo real.

---

## 🚀 Características Clave

* **Capa de Ingesta (Broker)**: Apache Kafka gestiona streams masivos de telemetría de sensores de planta.
* **Capa de Velocidad (Speed Layer)**: PySpark Structured Streaming realiza agregaciones de ventana deslizante de 1 minuto y detección de anomalías al vuelo.
* **Capa de Consulta (Serving Layer)**: Apache HBase (NoSQL) proporciona persistencia y lecturas/escrituras distribuidas aleatorias rápidas.
* **API de Presentación**: FastAPI (Python) proporciona comunicación en tiempo real a través de **WebSockets** y consultas históricas REST.
* **Dashboard de Visualización**: Construido con React y Vite, con diseño premium *Glassmorphic Dark Mode*, mapas de infraestructura interactivos y gráficos SVG dinámicos auto-escalables con efectos neón.
* **Motor de Simulación Integrado (Modo Dual)**: Si no se dispone de un clúster Docker con Kafka/HBase activo, el servidor FastAPI activa automáticamente una simulación en memoria que emula todo el comportamiento de Kafka y Spark, facilitando la visualización inmediata del proyecto.

---

## 🛠️ Stack Tecnológico

* **Mensajería**: Apache Kafka & Zookeeper
* **Procesamiento de Flujo**: Apache Spark (Structured Streaming / PySpark)
* **Base de Datos NoSQL**: Apache HBase (con servidor Thrift)
* **Servidor API**: FastAPI & Uvicorn (Python)
* **Despliegue Local**: Docker & Docker Compose
* **Frontend Web**: React, Vite, CSS Vanilla, Lucide Icons

---

## 📐 Diagrama de Arquitectura

```mermaid
graph TD
    subgraph IoT_Sensors [Fuentes de Datos IoT]
        S1["Sensor Temperatura"]
        S2["Sensor Vibración"]
        S3["Sensor Presión"]
    end

    subgraph Ingestion_Layer [Broker de Mensajería]
        Kafka["Apache Kafka <br> (Topic: telemetry-raw)"]
    end

    S1 -->|JSON Payload| Kafka
    S2 -->|JSON Payload| Kafka
    S3 -->|JSON Payload| Kafka

    subgraph Speed_Layer [Capa Rápida - Tiempo Real]
        Spark["PySpark Structured Streaming <br> (Windowed Aggregations)"]
    end
    Kafka -->|Streaming Consumidor| Spark

    subgraph Serving_Layer [Capa de Consulta - NoSQL]
        HBase["Apache HBase <br> (Table: telemetry_metrics)"]
    end
    Spark -->|Escritura rápida (Thrift)| HBase

    subgraph Presentation [Servidor & Visualización]
        Backend["FastAPI API Server <br> (WebSockets & REST)"]
        Dashboard["React Frontend Dashboard <br> (Vite, Glassmorphic CSS)"]
    end

    HBase -->|Queries de estado| Backend
    Backend -->|WebSockets (Live Stream)| Dashboard
    Backend -->|REST API (Historical Data)| Dashboard
```

---

## 📂 Estructura del Proyecto

* **`docker-compose.yml`**: Define los contenedores oficiales de Zookeeper, Kafka, Spark Master/Worker y HBase (con Thrift activo).
* **`pipeline/`**:
  * **`producer.py`**: Simulador de sensores que inyecta telemetría a Kafka.
  * **`spark_processor.py`**: Aplicación Spark Streaming que procesa ventanas temporales y detecta anomalías.
  * **`hbase_setup.py`**: Inicializador del esquema de HBase (`telemetry_metrics` table con familias `cf_raw` y `cf_stats`).
* **`backend/`**:
  * **`main.py`**: Servidor FastAPI de doble comportamiento (Docker vs Simulado) y emisor WebSocket.
* **`src/`**:
  * Código fuente del Dashboard React (Vistas, gráficos SVG dinámicos y mapa de arquitectura).

---

## ⚡ Guía de Instalación y Ejecución

### Opción A: Modo Simulado (Rápido / Sin Docker)
Ideal para revisar el funcionamiento de la interfaz y la integración de red rápidamente en computadoras con pocos recursos.

1. **Clonar e iniciar el Frontend**:
   ```bash
   npm install
   npm run dev
   ```

2. **Instalar dependencias del Backend e iniciar servidor**:
   ```bash
   cd backend
   pip install -r requirements.txt
   python main.py
   ```
   *El frontend estará disponible en `http://localhost:5173` y el backend en `http://localhost:8000`.*

---

### Opción B: Modo Clúster (Docker Completo)
Para correr la infraestructura real distribuida:

1. **Levantar el clúster Big Data**:
   ```bash
   docker-compose up -d
   ```

2. **Configurar HBase e iniciar Ingesta**:
   ```bash
   cd pipeline
   pip install -r requirements.txt
   
   # Crear las tablas en HBase
   python hbase_setup.py
   
   # Iniciar el envío de telemetría a Kafka
   python producer.py --broker localhost:9092
   ```

3. **Enviar la tarea PySpark Streaming**:
   ```bash
   spark-submit --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.3.2 spark_processor.py
   ```

4. **Correr el Backend y Frontend** (como se describe en la Opción A). El Backend detectará que Kafka e HBase están corriendo y se conectará automáticamente.

---

## 💡 Diseño Físico del RowKey en HBase

En bases NoSQL como HBase, el diseño del RowKey es crucial para evitar el problema de cuello de botella (Hotspotting) y optimizar búsquedas. En este proyecto la RowKey se estructura de la siguiente manera:

`RowKey = [sensor_id] + "#" + [window_start_timestamp]`

**Ejemplo de fila**: `sensor-temp-01#2026-06-19T10:00:00`

### Ventajas de este diseño:
1. **Consultas por Rangos**: Permite a la Serving Layer recuperar las métricas agregadas históricas de un sensor específico con búsquedas de tipo prefijo (`PrefixScan`) extremadamente veloces.
2. **Escritura Eficiente**: Distribuye de forma homogénea los datos a lo largo de las regiones de HBase gracias al ID del sensor como prefijo.

<img width="986" height="1030" alt="image" src="https://github.com/user-attachments/assets/7ced47b1-ad6a-45e7-9820-9535fc535f0b" />
