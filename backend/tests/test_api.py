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
