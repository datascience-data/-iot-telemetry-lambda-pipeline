import happybase
import time
import sys

HBASE_HOST = "localhost"
HBASE_PORT = 9090
TABLE_NAME = "telemetry_metrics"

def initialize_hbase():
    print(f"[*] Iniciando conexión con HBase Thrift en {HBASE_HOST}:{HBASE_PORT}...")
    
    # Reintentar conexión en caso de que HBase esté arrancando
    connection = None
    retries = 12
    for i in range(retries):
        try:
            connection = happybase.Connection(host=HBASE_HOST, port=HBASE_PORT)
            # Intentar listar tablas para validar conexión real
            connection.tables()
            print("[+] Conectado a HBase Thrift exitosamente.")
            break
        except Exception as e:
            print(f"[!] HBase no disponible ({e}). Reintentando en 5 segundos... ({i+1}/{retries})")
            time.sleep(5)

    if not connection:
        print("[-] Error crítico: No se pudo conectar a HBase Thrift. Asegúrate de que el contenedor HBase esté corriendo con Thrift activo.")
        sys.exit(1)

    try:
        existing_tables = [t.decode("utf-8") for t in connection.tables()]
        print(f"[*] Tablas existentes: {existing_tables}")
        
        if TABLE_NAME in existing_tables:
            print(f"[*] La tabla '{TABLE_NAME}' ya existe. ¿Deseas recrearla? (Para portafolio la dejamos intacta)")
            # No sobreescribir por defecto para evitar pérdidas si ya hay datos,
            # pero podemos borrarla si es un script de limpieza
        else:
            print(f"[*] Creando tabla '{TABLE_NAME}'...")
            # cf_raw: almacena las lecturas individuales y crudas
            # cf_stats: almacena métricas calculadas en la capa rápida (Speed Layer)
            connection.create_table(
                TABLE_NAME,
                {
                    "cf_raw": dict(max_versions=3),
                    "cf_stats": dict(max_versions=5)
                }
            )
            print(f"[+] Tabla '{TABLE_NAME}' creada con éxito.")
            
    except Exception as e:
        print(f"[-] Error al configurar la tabla HBase: {e}")
    finally:
        connection.close()
        print("[*] Conexión HBase Thrift cerrada.")

if __name__ == "__main__":
    initialize_hbase()
