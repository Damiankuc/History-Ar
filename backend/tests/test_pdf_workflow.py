import sys
import os

# Agregar backend/app al path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../app')))

from fastapi.testclient import TestClient
from main import app
from database import engine, create_db_and_tables
from sqlmodel import SQLModel, Session, select
from models import Paciente, Consulta, Configuracion

client = TestClient(app)

def run_pdf_workflow_test():
    print("==================================================")
    print("  INICIANDO TEST DE FLUJO COMPLETO HISTORY-AR")
    print("==================================================")

    # 1. Verificar estado de Autenticación
    auth_res = client.get("/api/auth/estado")
    assert auth_res.status_code == 200, f"Error en auth estado: {auth_res.text}"
    auth_data = auth_res.json()
    print(f"1. Estado Auth: {auth_data}")

    if not auth_data.get("primer_inicio_completado"):
        print("   - Ejecutando login de primera activación con 'HistoryAR2826'...")
        login_res = client.post("/api/auth/login", json={"password": "HistoryAR2826"})
        assert login_res.status_code == 200, f"Login falló: {login_res.text}"
        print("   - Activación completada con éxito.")

    # 2. Crear nuevo Paciente (usar DNI único para el test)
    import time
    dni_test = f"2489{int(time.time()) % 10000:04d}"
    nuevo_paciente_data = {
        "nombre": "Mariana Lucía",
        "apellido": "Gómez",
        "dni": dni_test,
        "fecha_nacimiento": "1978-05-10",
        "telefono": "0379-442-8900",
        "email": "mariana.gomez@example.com",
        "direccion": "Av. Italia 1420",
        "obra_social": "OSDE 210",
        "numero_afiliado": "11-24891302-01",
        "notas_generales": "Paciente en control anual."
    }

    create_pac_res = client.post("/api/pacientes", json=nuevo_paciente_data)
    assert create_pac_res.status_code == 201, f"Error al crear paciente: {create_pac_res.text}"
    paciente_creado = create_pac_res.json()
    paciente_id = paciente_creado["id"]
    print(f"2. Paciente creado correctamente: ID={paciente_id}, {paciente_creado['apellido']}, {paciente_creado['nombre']} (DNI: {paciente_creado['dni']})")

    # 3. Tomar PDF del escritorio y extraer texto mediante /api/pdf/extraer-texto
    pdf_path = r"C:\Users\Usuario\Desktop\receta_medica.pdf"
    assert os.path.exists(pdf_path), f"No se encontró el archivo en {pdf_path}"
    
    with open(pdf_path, "rb") as pdf_file:
        pdf_res = client.post(
            "/api/pdf/extraer-texto",
            files={"file": ("receta_medica.pdf", pdf_file, "application/pdf")}
        )
    
    assert pdf_res.status_code == 200, f"Error al extraer texto del PDF: {pdf_res.text}"
    pdf_data = pdf_res.json()
    texto_extraido = pdf_data["texto"]
    print(f"3. PDF extraído exitosamente ({pdf_data['paginas']} página(s), {len(texto_extraido)} caracteres).")

    # 4. Modificar el texto agregando el padecimiento de diabetes
    padecimiento_adicional = "\n\nPADECIMIENTO ADICIONAL REGISTRADO:\n- Diagnóstico de Diabetes Tipo 2 (Monitoreo glucémico diario)."
    diagnostico_actualizado = texto_extraido + padecimiento_adicional
    print("4. Padecimiento 'Diabetes Tipo 2' incorporado al diagnóstico extraído.")

    # 5. Registrar la consulta médica con la historia clínica actualizada
    nueva_consulta_payload = {
        "paciente_id": paciente_id,
        "motivo": "Actualización de Historia Clínica desde Receta PDF + Diabetes",
        "diagnostico": diagnostico_actualizado,
        "tratamiento": "Enalapril 10mg c/12hs, Atorvastatina 20mg/noche. Metformina 850mg c/12hs para Diabetes.",
        "notas": "Documentación médica importada desde receta_medica.pdf el " + paciente_creado["fecha_creacion"][:10]
    }

    create_cons_res = client.post("/api/consultas", json=nueva_consulta_payload)
    assert create_cons_res.status_code == 201, f"Error al crear consulta: {create_cons_res.text}"
    consulta_creada = create_cons_res.json()
    print(f"5. Consulta guardada exitosamente: Consulta ID={consulta_creada['id']} asociada al paciente {paciente_id}.")

    # 6. Verificar que la historia clínica del paciente contiene la consulta completa guardada
    get_pac_res = client.get(f"/api/pacientes/{paciente_id}")
    assert get_pac_res.status_code == 200, f"Error al obtener historia clínica: {get_pac_res.text}"
    paciente_completo = get_pac_res.json()
    
    assert len(paciente_completo["consultas"]) >= 1, "No se encontraron consultas asociadas."
    consulta_guardada = paciente_completo["consultas"][0]
    assert "Diabetes Tipo 2" in consulta_guardada["diagnostico"], "El padecimiento de diabetes no se guardó en el diagnóstico."
    assert "Enalapril" in consulta_guardada["diagnostico"], "El contenido del PDF no está en el diagnóstico."

    print("==================================================")
    print("  VERIFICACIÓN EXITOSA:")
    print(f"  - Paciente: {paciente_completo['apellido']}, {paciente_completo['nombre']}")
    print(f"  - Consultas registradas: {len(paciente_completo['consultas'])}")
    print(f"  - Contenido confirmado: PDF procesado + Padecimiento Diabetes guardado correctamente.")
    print("==================================================")

if __name__ == "__main__":
    run_pdf_workflow_test()
