import os
from pyspark.sql import SparkSession
from pyspark.sql.functions import col, from_json, window, avg, min, max, count, current_timestamp
from pyspark.sql.types import StructType, StructField, StringType, DoubleType

# Configuración de variables
KAFKA_BROKER = os.getenv("KAFKA_BROKER", "localhost:9092")
KAFKA_TOPIC = "telemetry-raw"
HBASE_HOST = os.getenv("HBASE_HOST", "localhost")
HBASE_PORT = int(os.getenv("HBASE_PORT", 9090))
HBASE_TABLE = "telemetry_metrics"

# Definición del esquema JSON de entrada
telemetry_schema = StructType([
    StructField("sensor_id", StringType(), True),
    StructField("metric_type", StringType(), True),
    StructField("value", DoubleType(), True),
    StructField("unit", StringType(), True),
    StructField("timestamp", StringType(), True),
    StructField("status", StringType(), True),
    StructField("plant_section", StringType(), True)
])

def write_to_hbase(batch_df, batch_id):
    """
    Función foreachBatch para escribir agregaciones Spark en HBase usando happybase (Thrift).
    Para ejecutar esto en producción se requiere la librería happybase instalada en los nodos de Spark.
    """
    try:
        import happybase
        
        # Recolectar datos en el driver (apropiado para pequeños volúmenes agregados como resúmenes de sensores)
        # O en Spark real, abrir la conexión dentro de df.foreachPartition para paralelizar en los executors
        rows = batch_df.collect()
        if not rows:
            return
            
        print(f"[*] Escribiendo lote {batch_id} a HBase ({len(rows)} registros)...")
        connection = happybase.Connection(host=HBASE_HOST, port=HBASE_PORT)
        table = connection.table(HBASE_TABLE)
        
        with table.batch() as b:
            for r in rows:
                # Armar Row Key: sensor_id#window_start
                # Esto permite consultas por rango eficientes en HBase para un sensor específico
                sensor_id = r["sensor_id"]
                window_start = r["window"]["start"].isoformat()
                row_key = f"{sensor_id}#{window_start}".encode("utf-8")
                
                # Cargar columnas en la familia cf_stats
                data = {
                    b"cf_stats:avg_val": str(round(r["avg_value"], 2)).encode("utf-8"),
                    b"cf_stats:min_val": str(round(r["min_value"], 2)).encode("utf-8"),
                    b"cf_stats:max_val": str(round(r["max_value"], 2)).encode("utf-8"),
                    b"cf_stats:count": str(r["event_count"]).encode("utf-8"),
                    b"cf_stats:last_updated": str(r["last_updated"]).encode("utf-8")
                }
                b.put(row_key, data)
                
        connection.close()
        print(f"[+] Lote {batch_id} escrito en HBase.")
    except ImportError:
        print("[-] happybase no está instalado. Escribiendo logs simulados en consola...")
        batch_df.show(truncate=False)
    except Exception as e:
        print(f"[-] Error en foreachBatch al escribir a HBase: {e}")

def main():
    print("[*] Inicializando aplicación Spark Streaming...")
    
    # Iniciar Spark Session cargando dependencias de Kafka
    spark = SparkSession.builder \
        .appName("TelemetryStreamingSpeedLayer") \
        .config("spark.sql.streaming.forceDeleteTempCheckpointLocation", "true") \
        .config("spark.jars.packages", "org.apache.spark:spark-sql-kafka-0-10_2.12:3.3.2") \
        .getOrCreate()

    spark.sparkContext.setLogLevel("WARN")
    print(f"[+] Spark Session creada. Consumiendo de Kafka en: {KAFKA_BROKER}")

    # 1. Leer flujo de eventos desde Kafka
    kafka_stream_df = spark.readStream \
        .format("kafka") \
        .option("kafka.bootstrap.servers", KAFKA_BROKER) \
        .option("subscribe", KAFKA_TOPIC) \
        .option("startingOffsets", "latest") \
        .load()

    # 2. Deserializar el JSON y tipar las columnas
    parsed_stream_df = kafka_stream_df \
        .selectExpr("CAST(value AS STRING) as json_payload") \
        .select(from_json(col("json_payload"), telemetry_schema).alias("data")) \
        .select("data.*") \
        .withColumn("event_time", col("timestamp").cast("timestamp")) # Convertir timestamp de string a tipo Timestamp

    # 3. Procesar agregaciones con Ventanas de Tiempo Deslizantes (Sliding Windows)
    # Ventana de 1 minuto que se desplaza cada 10 segundos
    windowed_aggregations_df = parsed_stream_df \
        .withWatermark("event_time", "2 minutes") \
        .groupBy(
            col("sensor_id"),
            window(col("event_time"), "1 minute", "10 seconds")
        ) \
        .agg(
            avg("value").alias("avg_value"),
            min("value").alias("min_value"),
            max("value").alias("max_value"),
            count("value").alias("event_count")
        ) \
        .withColumn("last_updated", current_timestamp())

    # 4. Escribir resultados usando el motor foreachBatch
    # Esto escribe directamente a HBase a través de happybase
    query = windowed_aggregations_df.writeStream \
        .foreachBatch(write_to_hbase) \
        .outputMode("update") \
        .option("checkpointLocation", "/tmp/spark-kafka-checkpoint") \
        .start()

    # 5. Adicionalmente, imprimir en consola para validar en tiempo real durante desarrollo
    console_query = windowed_aggregations_df.writeStream \
        .format("console") \
        .outputMode("update") \
        .option("truncate", "false") \
        .start()

    print("[+] Pipeline de streaming en ejecución. Esperando datos...")
    query.awaitTermination()
    console_query.awaitTermination()

if __name__ == "__main__":
    main()
