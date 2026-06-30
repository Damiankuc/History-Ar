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

interface Documento {
  id: number;
  nombre: string;
  ruta_archivo: string;
  tipo_mimetype: string;
  fecha_subida: string;
  paciente_id: number;
  consulta_id?: number;
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
  documentos?: Documento[];
}

function App() {
  // Estado de navegación principal
  const [activeTab, setActiveTab] = useState<"pacientes" | "nuevo-paciente">("pacientes");
  
  // Estado de sub-tab en ficha de paciente
  const [patientSubTab, setPatientSubTab] = useState<"consultas" | "documentos" | "imprimir">("consultas");
  
  // Estado de API
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPaciente, setSelectedPaciente] = useState<Paciente | null>(null);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  // Estados de carga de archivos y escaneo
  const [uploading, setUploading] = useState(false);
  const [scanning, setScanning] = useState(false);

  // Estados de Impresión
  const [selectedPrintConsultations, setSelectedPrintConsultations] = useState<Set<number>>(new Set());
  const [printStartDate, setPrintStartDate] = useState("");
  const [printEndDate, setPrintEndDate] = useState("");
  const [printData, setPrintData] = useState<{
    paciente: Paciente;
    consultas: Consulta[];
  } | null>(null);

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
  const FILE_BASE_URL = "http://localhost:8000";

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

  // Cargar detalles de un paciente específico (con sus consultas y documentos)
  const handleSelectPaciente = async (id: number) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/pacientes/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedPaciente(data);
      }
    } catch (err) {
      console.error("Error al cargar detalles de paciente", err);
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

  // Subir Archivo desde Disco
  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedPaciente || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    const formData = new FormData();
    formData.append("file", file);

    try {
      setUploading(true);
      const res = await fetch(`${API_BASE_URL}/pacientes/${selectedPaciente.id}/documentos/subir`, {
        method: "POST",
        body: formData
      });

      if (res.ok) {
        alert("Archivo adjunto guardado correctamente");
        // Recargar ficha del paciente
        handleSelectPaciente(selectedPaciente.id);
      } else {
        const errorData = await res.json();
        alert(`Error al subir: ${errorData.detail || "Inténtalo de nuevo"}`);
      }
    } catch (err) {
      alert("Error de conexión al intentar subir el archivo");
    } finally {
      setUploading(false);
      e.target.value = ""; // Reiniciar input
    }
  };

  // Disparar Escaneo Físico
  const handleScanDocument = async () => {
    if (!selectedPaciente) return;
    
    try {
      setScanning(true);
      const res = await fetch(`${API_BASE_URL}/pacientes/${selectedPaciente.id}/documentos/escanear`, {
        method: "POST"
      });

      if (res.ok) {
        alert("Documento digitalizado y guardado en el historial clínico");
        // Recargar ficha del paciente
        handleSelectPaciente(selectedPaciente.id);
      } else {
        const errorData = await res.json();
        alert(`Error al escanear: ${errorData.detail || "Asegúrate de tener un escáner encendido"}`);
      }
    } catch (err) {
      alert("Error de conexión con el subsistema de escaneo");
    } finally {
      setScanning(false);
    }
  };

  // Eliminar Archivo Adjunto
  const handleDeleteDocument = async (docId: number) => {
    if (!selectedPaciente) return;
    if (!confirm("¿Estás seguro de que deseas eliminar permanentemente este documento del historial clínico?")) return;

    try {
      const res = await fetch(`${API_BASE_URL}/documentos/${docId}`, {
        method: "DELETE"
      });

      if (res.ok) {
        alert("Documento eliminado con éxito");
        // Recargar ficha del paciente
        handleSelectPaciente(selectedPaciente.id);
      } else {
        alert("Error al intentar eliminar el documento");
      }
    } catch (err) {
      alert("Error de conexión al intentar borrar el archivo");
    }
  };

  // Inicializar casillas marcadas con todas las consultas al abrir la pestaña de impresión
  useEffect(() => {
    if (patientSubTab === "imprimir" && selectedPaciente?.consultas) {
      const allIds = selectedPaciente.consultas.map(c => c.id);
      setSelectedPrintConsultations(new Set(allIds));
      setPrintStartDate("");
      setPrintEndDate("");
    }
  }, [patientSubTab, selectedPaciente?.id]);

  // Aplicar filtro de fecha sobre la selección de consultas
  const applyDateFilter = () => {
    if (!selectedPaciente || !selectedPaciente.consultas) return;
    const start = printStartDate ? new Date(printStartDate) : null;
    const end = printEndDate ? new Date(printEndDate) : null;
    
    if (start) start.setHours(0, 0, 0, 0);
    if (end) end.setHours(23, 59, 59, 999);

    const newSelection = new Set<number>();
    selectedPaciente.consultas.forEach(c => {
      const fecha = new Date(c.fecha);
      let match = true;
      if (start && fecha < start) match = false;
      if (end && fecha > end) match = false;
      if (match) {
        newSelection.add(c.id);
      }
    });
    setSelectedPrintConsultations(newSelection);
  };

  // Escuchar cambios en los inputs de fecha para aplicar el filtro de forma reactiva
  useEffect(() => {
    if (patientSubTab === "imprimir") {
      applyDateFilter();
    }
  }, [printStartDate, printEndDate]);

  // Marcar/Desmarcar una consulta individual
  const togglePrintConsultation = (id: number) => {
    const next = new Set(selectedPrintConsultations);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedPrintConsultations(next);
  };

  // Selección masiva
  const selectAllConsultations = () => {
    if (!selectedPaciente?.consultas) return;
    setSelectedPrintConsultations(new Set(selectedPaciente.consultas.map(c => c.id)));
  };

  const deselectAllConsultations = () => {
    setSelectedPrintConsultations(new Set());
  };

  // Lanzar el cuadro de impresión nativo del navegador
  const handleTriggerPrint = () => {
    if (!selectedPaciente) return;
    const selectedList = (selectedPaciente.consultas || []).filter(c => 
      selectedPrintConsultations.has(c.id)
    );

    if (selectedList.length === 0) {
      alert("Por favor, selecciona al menos una consulta médica para realizar la impresión.");
      return;
    }

    // Ordenar cronológicamente (más viejas a más nuevas) para lectura natural de historia clínica
    const sortedList = [...selectedList].sort(
      (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
    );

    // Cargar datos en la plantilla de impresión invisible
    setPrintData({
      paciente: selectedPaciente,
      consultas: sortedList
    });

    // Pequeño timeout para asegurar montaje en el DOM y disparar el diálogo de Edge/Windows
    setTimeout(() => {
      window.print();
      setPrintData(null);
    }, 150);
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
                      <div key={paciente.id} className="card" style={{ cursor: "pointer" }} onClick={() => { handleSelectPaciente(paciente.id); setPatientSubTab("consultas"); }}>
                        <h3 style={{ color: "var(--primary)", marginBottom: "0.5rem" }}>
                          {paciente.apellido}, {paciente.nombre}
                        </h3>
                        <p style={{ fontSize: "0.95rem", color: "var(--text-main)", marginBottom: "0.25rem" }}>
                          <strong>DNI:</strong> {paciente.dni}
                        </p>
                        <p style={{ fontSize: "0.95rem", color: "var(--text-muted)" }}>
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

                <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "2rem" }}>
                  {/* Ficha del Paciente (Sticky a la izquierda) */}
                  <div>
                    <div className="card" style={{ position: "sticky", top: "20px" }}>
                      <h2 style={{ color: "var(--primary)", marginBottom: "1rem", fontSize: "1.5rem" }}>
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

                  {/* Panel Clínico (Pestañas a la derecha) */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    
                    {/* Barra de Sub-Pestañas */}
                    <div className="tabs-container" style={{ display: "flex", gap: "0.5rem", borderBottom: "2px solid var(--border-color)", paddingBottom: "0.5rem", flexWrap: "wrap" }}>
                      <button 
                        className={`btn ${patientSubTab === "consultas" ? "btn-primary" : "btn-secondary"}`}
                        onClick={() => setPatientSubTab("consultas")}
                        style={{ padding: "0.5rem 1.25rem", borderRadius: "8px", fontSize: "0.95rem" }}
                      >
                        📋 Consultas Médicas
                      </button>
                      <button 
                        className={`btn ${patientSubTab === "documentos" ? "btn-primary" : "btn-secondary"}`}
                        onClick={() => setPatientSubTab("documentos")}
                        style={{ padding: "0.5rem 1.25rem", borderRadius: "8px", fontSize: "0.95rem" }}
                      >
                        📁 Ficheros y Escaneos ({selectedPaciente.documentos?.length || 0})
                      </button>
                      <button 
                        className={`btn ${patientSubTab === "imprimir" ? "btn-primary" : "btn-secondary"}`}
                        onClick={() => setPatientSubTab("imprimir")}
                        style={{ padding: "0.5rem 1.25rem", borderRadius: "8px", fontSize: "0.95rem" }}
                      >
                        🖨️ Imprimir Historia
                      </button>
                    </div>

                    {/* Contenido Pestaña 1: Consultas Clínicas */}
                    {patientSubTab === "consultas" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "2rem", marginTop: "1rem" }}>
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

                        {/* Historial Clínico de Consultas */}
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
                    )}

                    {/* Contenido Pestaña 2: Ficheros y Escaneos */}
                    {patientSubTab === "documentos" && (
                      <div style={{ marginTop: "1rem" }}>
                        
                        {/* Panel de Carga y Escaneo */}
                        <div className="card" style={{ marginBottom: "2rem" }}>
                          <h3 style={{ marginBottom: "1.25rem", color: "var(--primary)" }}>Agregar Documentos Adjuntos</h3>
                          <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: "1.5rem" }}>
                            Puedes subir estudios en formato PDF/Imagen o escanear una receta u hoja médica física directamente utilizando tu escáner o impresora multifunción conectada.
                          </p>

                          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                            <input
                              type="file"
                              id="file-upload"
                              onChange={handleUploadFile}
                              style={{ display: "none" }}
                              accept="image/*,.pdf"
                            />
                            
                            <button 
                              className="btn btn-secondary" 
                              onClick={() => document.getElementById("file-upload")?.click()}
                              disabled={uploading || scanning}
                              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
                            >
                              📁 {uploading ? "Subiendo archivo..." : "Cargar Archivo (PDF/Imagen)"}
                            </button>

                            <button 
                              className="btn btn-primary" 
                              onClick={handleScanDocument}
                              disabled={uploading || scanning}
                              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
                            >
                              📸 {scanning ? "Iniciando escáner..." : "Escanear Documento Físico"}
                            </button>
                          </div>

                          {scanning && (
                            <div style={{ marginTop: "1.5rem", padding: "12px", backgroundColor: "var(--primary-light)", borderRadius: "8px", border: "1px solid var(--primary)", color: "var(--primary)", fontSize: "0.95rem" }}>
                              ⏳ <strong>Conectando con el digitalizador de Windows (WIA)...</strong><br />
                              Por favor selecciona tu escáner y presiona "Escanear" en el diálogo emergente del sistema.
                            </div>
                          )}
                        </div>

                        {/* Listado de Documentos del Paciente */}
                        <div>
                          <h3 style={{ marginBottom: "1.25rem" }}>Documentos Adjuntos ({selectedPaciente.documentos?.length || 0})</h3>
                          {(!selectedPaciente.documentos || selectedPaciente.documentos.length === 0) ? (
                            <p style={{ color: "var(--text-muted)" }}>No hay archivos adjuntos guardados para este paciente.</p>
                          ) : (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
                              {selectedPaciente.documentos.map((doc) => {
                                const fileUrl = `${FILE_BASE_URL}${doc.ruta_archivo}`;
                                const isImage = doc.tipo_mimetype.startsWith("image/");
                                
                                return (
                                  <div key={doc.id} className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "1rem" }}>
                                    <div>
                                      {isImage ? (
                                        <div style={{ width: "100%", height: "130px", borderRadius: "6px", overflow: "hidden", backgroundColor: "rgba(0,0,0,0.03)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "0.75rem", border: "1px solid var(--border-color)" }}>
                                          <img 
                                            src={fileUrl} 
                                            alt={doc.nombre} 
                                            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} 
                                          />
                                        </div>
                                      ) : (
                                        <div style={{ width: "100%", height: "130px", borderRadius: "6px", backgroundColor: "var(--primary-light)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.5rem", marginBottom: "0.75rem", border: "1px dashed var(--primary)" }}>
                                          <span style={{ fontSize: "2.5rem" }}>📄</span>
                                          <span style={{ fontSize: "0.85rem", color: "var(--primary)", fontWeight: 600 }}>DOCUMENTO PDF</span>
                                        </div>
                                      )}

                                      <h4 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-main)", wordBreak: "break-all" }}>
                                        {doc.nombre}
                                      </h4>
                                      <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                                        Cargado el: {new Date(doc.fecha_subida).toLocaleDateString()}
                                      </p>
                                    </div>

                                    <div style={{ display: "flex", gap: "0.5rem", borderTop: "1px solid var(--border-color)", paddingTop: "0.75rem" }}>
                                      <a 
                                        href={fileUrl} 
                                        target="_blank" 
                                        rel="noreferrer" 
                                        className="btn btn-secondary" 
                                        style={{ flex: 1, fontSize: "0.85rem", padding: "0.5rem" }}
                                      >
                                        👁️ Abrir
                                      </a>
                                      <button 
                                        onClick={() => handleDeleteDocument(doc.id)} 
                                        className="btn btn-secondary" 
                                        style={{ flex: 1, fontSize: "0.85rem", padding: "0.5rem", color: "rgb(239, 68, 68)", borderColor: "rgba(239, 68, 68, 0.3)" }}
                                      >
                                        🗑️ Borrar
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Contenido Pestaña 3: Impresión Personalizada */}
                    {patientSubTab === "imprimir" && (
                      <div style={{ marginTop: "1rem" }} className="fade-in">
                        
                        <div className="card" style={{ marginBottom: "2rem" }}>
                          <h3 style={{ marginBottom: "1rem", color: "var(--primary)" }}>Configurar Documento de Impresión</h3>
                          <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: "1.5rem" }}>
                            Selecciona las consultas específicas que deseas imprimir. Puedes utilizar el filtro por fecha para marcar las consultas de un período determinado de forma automática.
                          </p>

                          {/* Filtros de Fecha */}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label">Desde la Fecha</label>
                              <input 
                                type="date" 
                                className="form-input" 
                                value={printStartDate}
                                onChange={(e) => setPrintStartDate(e.target.value)}
                              />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label">Hasta la Fecha</label>
                              <input 
                                type="date" 
                                className="form-input" 
                                value={printEndDate}
                                onChange={(e) => setPrintEndDate(e.target.value)}
                              />
                            </div>
                          </div>

                          {/* Acciones Rápidas */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", borderTop: "1px solid var(--border-color)", paddingTop: "1rem" }}>
                            <div style={{ display: "flex", gap: "1rem" }}>
                              <button className="btn btn-secondary" style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }} onClick={selectAllConsultations}>
                                ☑️ Seleccionar Todas
                              </button>
                              <button className="btn btn-secondary" style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }} onClick={deselectAllConsultations}>
                                ⬛ Desmarcar Todas
                              </button>
                            </div>
                            <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--primary)" }}>
                              Seleccionadas: {selectedPrintConsultations.size} de {selectedPaciente.consultas?.length || 0}
                            </span>
                          </div>

                          {/* Botón de Impresión Principal */}
                          <button 
                            className="btn btn-primary" 
                            style={{ width: "100%", padding: "0.85rem", fontSize: "1.05rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
                            onClick={handleTriggerPrint}
                          >
                            🖨️ Generar y Abrir Panel de Impresión ({selectedPrintConsultations.size})
                          </button>
                        </div>

                        {/* Listado de Consultas con Checkbox */}
                        <div>
                          <h3 style={{ marginBottom: "1.25rem" }}>Seleccionar Consultas del Historial</h3>
                          {(!selectedPaciente.consultas || selectedPaciente.consultas.length === 0) ? (
                            <p style={{ color: "var(--text-muted)" }}>No hay consultas clínicas registradas para este paciente.</p>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                              {selectedPaciente.consultas.map((consulta) => {
                                const isChecked = selectedPrintConsultations.has(consulta.id);
                                return (
                                  <div 
                                    key={consulta.id} 
                                    className="card" 
                                    style={{ 
                                      display: "flex", 
                                      gap: "1.25rem", 
                                      alignItems: "flex-start", 
                                      cursor: "pointer", 
                                      border: isChecked ? "1.5px solid var(--primary)" : "1px solid var(--border-color)",
                                      backgroundColor: isChecked ? "var(--primary-light)" : ""
                                    }}
                                    onClick={() => togglePrintConsultation(consulta.id)}
                                  >
                                    <input 
                                      type="checkbox" 
                                      checked={isChecked}
                                      onChange={() => {}} // Manejado por el click de la card
                                      style={{ width: "18px", height: "18px", marginTop: "0.2rem", cursor: "pointer" }}
                                    />
                                    <div style={{ flex: 1 }}>
                                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                                        <strong style={{ color: "var(--primary)", fontSize: "1rem" }}>{consulta.motivo}</strong>
                                        <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                                          {new Date(consulta.fecha).toLocaleDateString()}
                                        </span>
                                      </div>
                                      <p style={{ fontSize: "0.9rem", color: "var(--text-main)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                                        <strong>Evaluación:</strong> {consulta.diagnostico}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
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

      {/* --- Contenedor HTML Temporal de Impresión (Invisible en Pantalla, visible en Impresora) --- */}
      {printData && (
        <div className="print-only">
          <div className="print-header">
            <div>
              <h1 className="print-title">Registro de Historia Clínica</h1>
              <p style={{ margin: 0, fontSize: "10pt" }}>Be-Pacient - Sistema Médico Local</p>
            </div>
            <div className="print-meta">
              <p style={{ margin: 0 }}><strong>Fecha Emisión:</strong> {new Date().toLocaleDateString()}</p>
            </div>
          </div>

          <div className="print-patient-card">
            <h3 className="print-section-title" style={{ marginTop: 0, border: "none" }}>Ficha Personal del Paciente</h3>
            <div className="print-patient-grid">
              <div><strong>Nombre Completo:</strong> {printData.paciente.apellido}, {printData.paciente.nombre}</div>
              <div><strong>Documento (DNI):</strong> {printData.paciente.dni}</div>
              <div><strong>Fecha Nacimiento:</strong> {printData.paciente.fecha_nacimiento}</div>
              <div><strong>Teléfono:</strong> {printData.paciente.telefono || "No registrado"}</div>
              <div><strong>Email:</strong> {printData.paciente.email || "No registrado"}</div>
              <div><strong>Dirección:</strong> {printData.paciente.direccion || "No registrado"}</div>
            </div>
            {printData.paciente.notas_generales && (
              <div style={{ marginTop: "1rem", paddingTop: "0.5rem", borderTop: "1px dashed #000000", fontSize: "10pt" }}>
                <strong>Antecedentes y Alergias Relevantes:</strong>
                <p style={{ margin: "0.25rem 0 0 0", color: "#333", whiteSpace: "pre-line" }}>{printData.paciente.notas_generales}</p>
              </div>
            )}
          </div>

          <h3 className="print-section-title">Historial Clínico de Consultas Seleccionadas</h3>
          {printData.consultas.length === 0 ? (
            <p>No se seleccionaron consultas para imprimir.</p>
          ) : (
            <div>
              {printData.consultas.map((c, index) => (
                <div key={c.id} className="print-consultation-item">
                  <div className="print-consultation-header">
                    <strong>Consulta #{index + 1}: {c.motivo}</strong>
                    <span>{new Date(c.fecha).toLocaleDateString()} {new Date(c.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="print-consultation-body">
                    <div style={{ marginTop: "0.5rem" }}><strong>Evaluación Médica / Diagnóstico:</strong></div>
                    <div style={{ whiteSpace: "pre-line", marginBottom: "0.5rem", paddingLeft: "0.5rem" }}>{c.diagnostico}</div>
                    
                    <div><strong>Tratamiento / Indicaciones Recetadas:</strong></div>
                    <div style={{ whiteSpace: "pre-line", marginBottom: "0.5rem", paddingLeft: "0.5rem" }}>{c.tratamiento}</div>
                    
                    {c.notes && ( // Soporte retrocompatible
                      <>
                        <div><strong>Notas Adicionales:</strong></div>
                        <div style={{ whiteSpace: "pre-line", paddingLeft: "0.5rem" }}>{c.notes}</div>
                      </>
                    )}
                    {c.notas && (
                      <>
                        <div><strong>Notas Adicionales:</strong></div>
                        <div style={{ whiteSpace: "pre-line", paddingLeft: "0.5rem" }}>{c.notas}</div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="print-footer-signature">
            <div className="signature-box">
              Firma y Sello del Profesional
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
