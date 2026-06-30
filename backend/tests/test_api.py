import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine
from sqlmodel.pool import StaticPool

from app.main import app
from app.database import get_session

# Configuración de base de datos en memoria para pruebas aisladas
@pytest.fixture(name="session")
def session_fixture():
    # Usamos sqlite:// sin ruta para base de datos en memoria
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,  # Necesario para que un único hilo mantenga la base de datos viva
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session

@pytest.fixture(name="client")
def client_fixture(session: Session):
    def get_session_override():
        return session
    # Sobrescribimos la dependencia del get_session de la API
    app.dependency_overrides[get_session] = get_session_override
    client = TestClient(app)
    yield client
    # Limpiamos las modificaciones de dependencias
    app.dependency_overrides.clear()

# --- Casos de Prueba ---

def test_health_check(client: TestClient):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "app": "Be-Pacient Backend"}

def test_create_paciente(client: TestClient):
    paciente_data = {
        "nombre": "Juan",
        "apellido": "Pérez",
        "dni": "12345678",
        "fecha_nacimiento": "1980-05-15",
        "telefono": "11-2233-4455",
        "email": "juanperez@example.com",
        "direccion": "Calle Falsa 123",
        "notas_generales": "Hipertenso leve"
    }
    response = client.post("/api/pacientes", json=paciente_data)
    assert response.status_code == 201
    
    data = response.json()
    assert data["nombre"] == "Juan"
    assert data["dni"] == "12345678"
    assert "id" in data
    assert "fecha_creacion" in data

def test_create_paciente_dni_duplicado(client: TestClient):
    paciente_data = {
        "nombre": "Juan",
        "apellido": "Pérez",
        "dni": "12345678",
        "fecha_nacimiento": "1980-05-15"
    }
    # Primer registro exitoso
    response1 = client.post("/api/pacientes", json=paciente_data)
    assert response1.status_code == 201
    
    # Segundo registro con el mismo DNI debe fallar
    response2 = client.post("/api/pacientes", json=paciente_data)
    assert response2.status_code == 400
    assert "ya se encuentra registrado" in response2.json()["detail"]

def test_get_pacientes(client: TestClient):
    # Registrar dos pacientes
    client.post("/api/pacientes", json={"nombre": "Juan", "apellido": "Pérez", "dni": "1", "fecha_nacimiento": "1980-05-15"})
    client.post("/api/pacientes", json={"nombre": "María", "apellido": "Gómez", "dni": "2", "fecha_nacimiento": "1992-10-20"})
    
    # Obtener listado completo
    response = client.get("/api/pacientes")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    
    # Probar búsqueda por query
    response_search = client.get("/api/pacientes?q=Gómez")
    assert response_search.status_code == 200
    data_search = response_search.json()
    assert len(data_search) == 1
    assert data_search[0]["nombre"] == "María"

def test_create_consulta_and_get_history(client: TestClient):
    # Registrar paciente
    res_paciente = client.post("/api/pacientes", json={"nombre": "Juan", "apellido": "Pérez", "dni": "1234", "fecha_nacimiento": "1980-05-15"})
    paciente_id = res_paciente.json()["id"]
    
    # Registrar consulta
    consulta_data = {
        "motivo": "Dolor de cabeza",
        "diagnostico": "Migraña común",
        "tratamiento": "Ibuprofeno 600mg cada 8 horas por 3 días",
        "notas": "Reposo por 24 horas",
        "paciente_id": paciente_id
    }
    res_consulta = client.post("/api/consultas", json=consulta_data)
    assert res_consulta.status_code == 201
    assert res_consulta.json()["motivo"] == "Dolor de cabeza"
    assert "fecha" in res_consulta.json()
    
    # Obtener paciente con consultas
    res_history = client.get(f"/api/pacientes/{paciente_id}")
    assert res_history.status_code == 200
    history_data = res_history.json()
    assert len(history_data["consultas"]) == 1
    assert history_data["consultas"][0]["diagnostico"] == "Migraña común"

def test_upload_and_delete_documento(client: TestClient):
    # 1. Registrar paciente
    res_paciente = client.post("/api/pacientes", json={"nombre": "Juan", "apellido": "Pérez", "dni": "999", "fecha_nacimiento": "1980-05-15"})
    paciente_id = res_paciente.json()["id"]

    # 2. Subir un archivo de prueba
    file_data = {"file": ("historia.pdf", b"mock pdf content bytes", "application/pdf")}
    res_upload = client.post(f"/api/pacientes/{paciente_id}/documentos/subir", files=file_data)
    assert res_upload.status_code == 201
    
    doc_data = res_upload.json()
    assert doc_data["nombre"] == "historia.pdf"
    assert doc_data["tipo_mimetype"] == "application/pdf"
    assert "ruta_archivo" in doc_data
    doc_id = doc_data["id"]

    # 3. Verificar que aparece en la historia del paciente
    res_history = client.get(f"/api/pacientes/{paciente_id}")
    history_data = res_history.json()
    assert len(history_data["documentos"]) == 1
    assert history_data["documentos"][0]["nombre"] == "historia.pdf"

    # 4. Eliminar el documento
    res_delete = client.delete(f"/api/documentos/{doc_id}")
    assert res_delete.status_code == 200
    assert res_delete.json() == {"message": "Documento eliminado con éxito"}

    # 5. Verificar que se eliminó de la historia del paciente
    res_history2 = client.get(f"/api/pacientes/{paciente_id}")
    assert len(res_history2.json()["documentos"]) == 0

def test_configuracion_medica(client: TestClient):
    # 1. Obtener config por defecto
    res = client.get("/api/configuracion")
    assert res.status_code == 200
    assert res.json()["doctor_nombre"] == ""
    
    # 2. Actualizar config
    update_data = {
        "doctor_nombre": "Dra. Laura Gómez",
        "doctor_especialidad": "Pediatría",
        "doctor_matricula": "M.N. 98765"
    }
    res_update = client.post("/api/configuracion", json=update_data)
    assert res_update.status_code == 200
    assert res_update.json()["doctor_nombre"] == "Dra. Laura Gómez"
    assert res_update.json()["doctor_especialidad"] == "Pediatría"

def test_recetas_medicas(client: TestClient):
    # 1. Registrar paciente
    res_paciente = client.post("/api/pacientes", json={"nombre": "Laura", "apellido": "Sosa", "dni": "777", "fecha_nacimiento": "1990-12-05"})
    paciente_id = res_paciente.json()["id"]

    # 2. Crear receta
    receta_data = {
        "medicamentos": "Amoxicilina 500mg cada 8 horas",
        "indicaciones": "Tomar con las comidas",
        "paciente_id": paciente_id
    }
    res_create = client.post("/api/recetas", json=receta_data)
    assert res_create.status_code == 201
    assert res_create.json()["medicamentos"] == "Amoxicilina 500mg cada 8 horas"
    receta_id = res_create.json()["id"]

    # 3. Listar recetas del paciente
    res_list = client.get(f"/api/pacientes/{paciente_id}/recetas")
    assert res_list.status_code == 200
    assert len(res_list.json()) == 1
    assert res_list.json()[0]["medicamentos"] == "Amoxicilina 500mg cada 8 horas"

    # 4. Eliminar receta
    res_delete = client.delete(f"/api/recetas/{receta_id}")
    assert res_delete.status_code == 200
    assert res_delete.json() == {"message": "Receta eliminada con éxito"}

def test_agenda_citas(client: TestClient):
    # 1. Registrar paciente
    res_paciente = client.post("/api/pacientes", json={"nombre": "Pedro", "apellido": "Alba", "dni": "666", "fecha_nacimiento": "1975-03-22"})
    paciente_id = res_paciente.json()["id"]

    # 2. Registrar cita
    cita_data = {
        "fecha_hora": "2026-07-15T10:30:00Z",
        "duracion_minutos": 45,
        "motivo": "Dolor abdominal",
        "paciente_id": paciente_id
    }
    res_create = client.post("/api/citas", json=cita_data)
    assert res_create.status_code == 201
    assert res_create.json()["motivo"] == "Dolor abdominal"
    cita_id = res_create.json()["id"]

    # 3. Listar citas
    res_list = client.get("/api/citas")
    assert res_list.status_code == 200
    assert len(res_list.json()) == 1
    assert res_list.json()[0]["paciente"]["nombre"] == "Pedro"

    # 4. Actualizar estado
    res_update = client.put(f"/api/citas/{cita_id}?estado=completada")
    assert res_update.status_code == 200
    assert res_update.json()["estado"] == "completada"

    # 5. Eliminar cita
    res_delete = client.delete(f"/api/citas/{cita_id}")
    assert res_delete.status_code == 200
    assert res_delete.json() == {"message": "Cita eliminada con éxito"}


