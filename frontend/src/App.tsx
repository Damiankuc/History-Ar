import { useState, useEffect } from "react";
import "./App.css";

interface Consulta {
  id: number;
  motivo: string;
  diagnostico: string;
  tratamiento: string;
  notas?: string;
  fecha: string;
  paciente_id: number;
}

interface Paciente {
  id: number;
  nombre: string;
  apellido: string;
  dni: string;
  fecha_nacimiento: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  notas_generales?: string;
  fecha_creacion: string;
  consultas?: Consulta[];
}

function App() {
  // Estado de navegación
  const [activeTab, setActiveTab] = useState<"pacientes" | "nuevo-paciente">("pacientes");
  
  // Estado de API
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPaciente, setSelectedPaciente] = useState<Paciente | null>(null);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  // Estados de formularios
  const [newPaciente, setNewPaciente] = useState({
    nombre: "",
    apellido: "",
    dni: "",
    fecha_nacimiento: "",
    telefono: "",
    email: "",
    direccion: "",
    notas_generales: ""
  });

  const [newConsulta, setNewConsulta] = useState({
    motivo: "",
    diagnostico: "",
    tratamiento: "",
    notas: ""
  });

  const API_BASE_URL = "http://localhost:8000/api";

  // Verificar estado del Backend y cargar pacientes
  useEffect(() => {
    checkApiAndLoad();
  }, [searchTerm]);

  const checkApiAndLoad = async () => {
    try {
      setLoading(true);
      const healthRes = await fetch(`${API_BASE_URL}/health`);
      if (healthRes.ok) {
        setApiOnline(true);
        // Cargar pacientes
        const queryParam = searchTerm ? `?q=${encodeURIComponent(searchTerm)}` : "";
        const patientsRes = await fetch(`${API_BASE_URL}/pacientes${queryParam}`);
        if (patientsRes.ok) {
          const data = await patientsRes.json();
          setPacientes(data);
        }
      } else {
        setApiOnline(false);
      }
    } catch (err) {
      console.error("Backend offline", err);
      setApiOnline(false);
    } finally {
      setLoading(false);
    }
  };

  // Cargar detalles de un paciente específico (con sus consultas)
  const handleSelectPaciente = async (id: number) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/pacientes/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedPaciente(data);
      }
    } catch (err) {
      console.error("Error al cargar consultas", err);
    } finally {
      setLoading(false);
    }
  };

  // Crear Paciente
  const handleCreatePaciente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPaciente.nombre || !newPaciente.apellido || !newPaciente.dni || !newPaciente.fecha_nacimiento) {
      alert("Por favor completa los campos requeridos (Nombre, Apellido, DNI, Fecha Nac.)");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/pacientes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPaciente)
      });

      if (res.ok) {
        alert("Paciente registrado con éxito");
        setNewPaciente({
          nombre: "",
          apellido: "",
          dni: "",
          fecha_nacimiento: "",
          telefono: "",
          email: "",
          direccion: "",
          notas_generales: ""
        });
        setActiveTab("pacientes");
        checkApiAndLoad();
      } else {
        const errorData = await res.json();
        alert(`Error: ${errorData.detail || "No se pudo crear el paciente"}`);
      }
    } catch (err) {
      alert("Error de conexión al guardar el paciente");
    }
  };

  // Crear Consulta
  const handleCreateConsulta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPaciente) return;
    if (!newConsulta.motivo || !newConsulta.diagnostico || !newConsulta.tratamiento) {
      alert("Por favor completa el motivo, diagnóstico y tratamiento de la consulta.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/consultas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newConsulta,
          paciente_id: selectedPaciente.id
        })
      });

      if (res.ok) {
        alert("Consulta guardada en la historia clínica");
        setNewConsulta({ motivo: "", diagnostico: "", tratamiento: "", notas: "" });
        // Recargar el paciente seleccionado para ver su nueva consulta
        handleSelectPaciente(selectedPaciente.id);
      } else {
        alert("Error al guardar la consulta");
      }
    } catch (err) {
      alert("Error de conexión al guardar la consulta");
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar de Navegación */}
      <aside className="sidebar">
        <div className="logo-container">
          <div className="logo-icon">P</div>
          <span className="logo-text">Be-Pacient</span>
        </div>
        
        <nav>
          <ul className="nav-menu">
            <li>
              <button 
                className={`nav-item ${activeTab === "pacientes" ? "active" : ""}`}
                onClick={() => { setActiveTab("pacientes"); setSelectedPaciente(null); }}
              >
                📁 Pacientes e Historias
              </button>
            </li>
            <li>
              <button 
                className={`nav-item ${activeTab === "nuevo-paciente" ? "active" : ""}`}
                onClick={() => setActiveTab("nuevo-paciente")}
              >
                👤 Registrar Paciente
              </button>
            </li>
          </ul>
        </nav>

        {/* Indicador de estado del Servidor Local */}
        <div style={{ marginTop: "auto", padding: "10px", borderRadius: "8px", backgroundColor: apiOnline ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)", border: "1px solid", borderColor: apiOnline ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 600, color: apiOnline ? "rgb(16, 185, 129)" : "rgb(239, 68, 68)" }}>
            ● API Local: {apiOnline ? "Conectada" : "Desconectada"}
          </span>
        </div>
      </aside>

      {/* Panel Principal */}
      <main className="main-panel fade-in">
        {apiOnline === false && (
          <div style={{ backgroundColor: "rgba(245, 158, 11, 0.15)", border: "1px solid rgb(245, 158, 11)", borderRadius: "10px", padding: "15px", marginBottom: "20px", color: "rgb(180, 83, 9)" }}>
            ⚠️ <strong>Servidor de API local no detectado.</strong> Por favor ejecuta el backend o arranca la aplicación en desarrollo usando el script de automatización <code>dev.bat</code> para permitir el guardado de datos.
          </div>
        )}

        {activeTab === "pacientes" && (
          <div>
            {!selectedPaciente ? (
              <div>
                <h2 style={{ marginBottom: "1.5rem" }}>Directorio de Historias Clínicas</h2>
                
                {/* Caja de Búsqueda y Filtro */}
                <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem" }}>
                  <input
                    type="text"
                    className="form-input"
                    style={{ flex: 1, fontSize: "1.05rem" }}
                    placeholder="Buscar paciente por nombre, apellido o DNI..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <button className="btn btn-primary" onClick={() => setActiveTab("nuevo-paciente")}>
                    + Nuevo Paciente
                  </button>
                </div>

                {/* Listado de Pacientes */}
                {loading ? (
                  <p style={{ color: "var(--text-muted)" }}>Cargando directorio...</p>
                ) : pacientes.length === 0 ? (
                  <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
                    <p style={{ color: "var(--text-muted)", fontSize: "1.1rem" }}>
                      No se encontraron pacientes registrados.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
                    {pacientes.map((paciente) => (
                      <div key={paciente.id} className="card" style={{ cursor: "pointer" }} onClick={() => handleSelectPaciente(paciente.id)}>
                        <h3 style={{ color: "var(--primary)", marginBottom: "0.5rem" }}>
                          {paciente.apellido}, {paciente.nombre}
                        </h3>
                        <p style={{ fontSize: "0.95rem", color: varName => "var(--text-main)", marginBottom: "0.25rem" }}>
                          <strong>DNI:</strong> {paciente.dni}
                        </p>
                        <p style={{ fontSize: "0.95rem", color: varName => "var(--text-muted)" }}>
                          <strong>Nacimiento:</strong> {paciente.fecha_nacimiento}
                        </p>
                        <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end" }}>
                          <span style={{ fontSize: "0.85rem", color: "var(--primary)", fontWeight: 600 }}>
                            Ver Historia Clínica →
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              // Vista Detallada de la Historia Clínica del Paciente
              <div>
                <button className="btn btn-secondary" style={{ marginBottom: "1.5rem" }} onClick={() => setSelectedPaciente(null)}>
                  ← Volver al Listado
                </button>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "2rem" }}>
                  {/* Ficha del Paciente */}
                  <div>
                    <div className="card" style={{ position: "sticky", top: "20px" }}>
                      <h2 style={{ color: "var(--primary)", marginBottom: "1rem" }}>
                        {selectedPaciente.nombre} {selectedPaciente.apellido}
                      </h2>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.95rem" }}>
                        <p><strong>DNI:</strong> {selectedPaciente.dni}</p>
                        <p><strong>Fecha de Nacimiento:</strong> {selectedPaciente.fecha_nacimiento}</p>
                        <p><strong>Teléfono:</strong> {selectedPaciente.telefono || "No registrado"}</p>
                        <p><strong>Email:</strong> {selectedPaciente.email || "No registrado"}</p>
                        <p><strong>Dirección:</strong> {selectedPaciente.direccion || "No registrado"}</p>
                        {selectedPaciente.notas_generales && (
                          <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--border-color)" }}>
                            <strong>Antecedentes / Notas:</strong>
                            <p style={{ color: "var(--text-muted)", marginTop: "0.5rem", whiteSpace: "pre-line" }}>
                              {selectedPaciente.notas_generales}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Historial Clínico y Registro */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
                    {/* Formulario Nueva Consulta */}
                    <div className="card">
                      <h3 style={{ marginBottom: "1.25rem", color: "var(--primary)" }}>Registrar Nueva Consulta</h3>
                      <form onSubmit={handleCreateConsulta}>
                        <div className="form-group">
                          <label className="form-label">Motivo de Consulta *</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Ej. Control anual, dolor lumbar..."
                            value={newConsulta.motivo}
                            onChange={(e) => setNewConsulta({ ...newConsulta, motivo: e.target.value })}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Diagnóstico / Evaluación *</label>
                          <textarea
                            className="form-input"
                            rows={3}
                            placeholder="Descripción de los síntomas y diagnóstico..."
                            value={newConsulta.diagnostico}
                            onChange={(e) => setNewConsulta({ ...newConsulta, diagnostico: e.target.value })}
                            style={{ resize: "vertical" }}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Tratamiento / Receta *</label>
                          <textarea
                            className="form-input"
                            rows={3}
                            placeholder="Medicamentos indicados, reposo, estudios solicitados..."
                            value={newConsulta.tratamiento}
                            onChange={(e) => setNewConsulta({ ...newConsulta, tratamiento: e.target.value })}
                            style={{ resize: "vertical" }}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Notas Adicionales</label>
                          <textarea
                            className="form-input"
                            rows={2}
                            placeholder="Comentarios extras confidenciales..."
                            value={newConsulta.notas}
                            onChange={(e) => setNewConsulta({ ...newConsulta, notas: e.target.value })}
                            style={{ resize: "vertical" }}
                          />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "0.5rem" }}>
                          Guardar Registro de Consulta
                        </button>
                      </form>
                    </div>

                    {/* Línea de tiempo de Consultas anteriores */}
                    <div>
                      <h3 style={{ marginBottom: "1.25rem" }}>Historial Clínico ({selectedPaciente.consultas?.length || 0})</h3>
                      {(!selectedPaciente.consultas || selectedPaciente.consultas.length === 0) ? (
                        <p style={{ color: "var(--text-muted)" }}>No hay consultas previas registradas para este paciente.</p>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                          {selectedPaciente.consultas.map((consulta) => (
                            <div key={consulta.id} className="card">
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "0.5rem" }}>
                                <strong style={{ color: "var(--primary)" }}>{consulta.motivo}</strong>
                                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                                  {new Date(consulta.fecha).toLocaleDateString()} {new Date(consulta.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.95rem" }}>
                                <p><strong>Diagnóstico:</strong> {consulta.diagnostico}</p>
                                <p><strong>Tratamiento:</strong> {consulta.tratamiento}</p>
                                {consulta.notas && <p><strong>Notas:</strong> <span style={{ color: "var(--text-muted)" }}>{consulta.notas}</span></p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "nuevo-paciente" && (
          <div style={{ maxWidth: "700px", margin: "0 auto" }}>
            <h2 style={{ marginBottom: "1.5rem" }}>Registrar Ficha de Paciente</h2>
            <div className="card">
              <form onSubmit={handleCreatePaciente}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div className="form-group">
                    <label className="form-label">Nombre *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={newPaciente.nombre}
                      onChange={(e) => setNewPaciente({ ...newPaciente, nombre: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Apellido *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={newPaciente.apellido}
                      onChange={(e) => setNewPaciente({ ...newPaciente, apellido: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div className="form-group">
                    <label className="form-label">DNI (Identificación Única) *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Sin puntos ni espacios"
                      value={newPaciente.dni}
                      onChange={(e) => setNewPaciente({ ...newPaciente, dni: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Fecha de Nacimiento *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={newPaciente.fecha_nacimiento}
                      onChange={(e) => setNewPaciente({ ...newPaciente, fecha_nacimiento: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div className="form-group">
                    <label className="form-label">Teléfono</label>
                    <input
                      type="text"
                      className="form-input"
                      value={newPaciente.telefono}
                      onChange={(e) => setNewPaciente({ ...newPaciente, telefono: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-input"
                      value={newPaciente.email}
                      onChange={(e) => setNewPaciente({ ...newPaciente, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Dirección</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newPaciente.direccion}
                    onChange={(e) => setNewPaciente({ ...newPaciente, direccion: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Antecedentes Médicos Relevantes / Notas Generales</label>
                  <textarea
                    className="form-input"
                    rows={4}
                    placeholder="Hipertensión, alergia a penicilina, antecedentes familiares..."
                    value={newPaciente.notas_generales}
                    onChange={(e) => setNewPaciente({ ...newPaciente, notas_generales: e.target.value })}
                    style={{ resize: "vertical" }}
                  />
                </div>

                <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem" }}>
                  <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setActiveTab("pacientes")}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>
                    Guardar Ficha del Paciente
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
