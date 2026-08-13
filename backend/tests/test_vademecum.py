import sys
import os
import pytest
from fastapi.testclient import TestClient

# Añadir app al sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app")))

from main import app

client = TestClient(app)

def test_buscar_medicamentos_base():
    response = client.get("/api/medicamentos/buscar?q=amox")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    # Verificar que contiene Amoxicilina o Amoxidal
    nombres = [m["nombre_comercial"].lower() for m in data]
    assert any("amox" in n for n in nombres)

def test_crear_medicamento_custom():
    payload = {
        "nombre_comercial": "Fórmula Magistral Test X",
        "monodroga": "Ácido Salicílico 5%",
        "presentacion": "Crema 50g",
        "dosis_sugerida": "Aplicar 1 vez por noche"
    }
    response = client.post("/api/medicamentos/custom", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["nombre_comercial"] == "Fórmula Magistral Test X"
    assert data["es_custom"] is True

    # Buscar el recién creado
    res_search = client.get("/api/medicamentos/buscar?q=Magistral")
    assert res_search.status_code == 200
    search_data = res_search.json()
    assert any(m["nombre_comercial"] == "Fórmula Magistral Test X" for m in search_data)
