import React, { useState, useEffect } from "react";
import {
  PlantillaConsulta,
  obtenerTodasLasPlantillas,
  guardarPlantillaPersonalizada,
  eliminarPlantillaPersonalizada
} from "./data/plantillasData";

interface SelectorPlantillasProps {
  onAplicarPlantilla: (plantilla: {
    motivo: string;
    diagnostico: string;
    tratamiento: string;
    notas?: string;
  }) => void;
  consultaActual: {
    motivo: string;
    diagnostico: string;
    tratamiento: string;
    notas?: string;
  };
}

export const SelectorPlantillas: React.FC<SelectorPlantillasProps> = ({
  onAplicarPlantilla,
  consultaActual
}) => {
  const [plantillas, setPlantillas] = useState<PlantillaConsulta[]>([]);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [mostrarModalNueva, setMostrarModalNueva] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  // Formulario para guardar nueva plantilla custom
  const [nombreCustom, setNombreCustom] = useState("");
  const [iconoCustom, setIconoCustom] = useState("📝");
  const [categoriaCustom, setCategoriaCustom] = useState("Mi Especialidad");

  useEffect(() => {
    cargarPlantillas();
  }, []);

  const cargarPlantillas = () => {
    setPlantillas(obtenerTodasLasPlantillas());
  };

  const handleSeleccionar = (p: PlantillaConsulta) => {
    onAplicarPlantilla({
      motivo: p.motivo,
      diagnostico: p.diagnostico,
      tratamiento: p.tratamiento,
      notas: p.notas || ""
    });
    setMostrarModal(false);
  };

  const handleGuardarCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreCustom.trim() || !consultaActual.motivo || !consultaActual.diagnostico) {
      alert("Por favor completa al menos el nombre de la plantilla, el motivo y el diagnóstico en el formulario antes de guardar.");
      return;
    }

    guardarPlantillaPersonalizada({
      nombre: nombreCustom.trim(),
      icono: iconoCustom || "📝",
      categoria: categoriaCustom || "Personalizadas",
      motivo: consultaActual.motivo,
      diagnostico: consultaActual.diagnostico,
      tratamiento: consultaActual.tratamiento,
      notas: consultaActual.notas
    });

    setNombreCustom("");
    setMostrarModalNueva(false);
    cargarPlantillas();
  };

  const handleEliminarCustom = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("¿Deseas eliminar esta plantilla personalizada?")) {
      eliminarPlantillaPersonalizada(id);
      cargarPlantillas();
    }
  };

  const plantillasFiltradas = plantillas.filter(
    (p) =>
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.motivo.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.diagnostico.toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.categoria && p.categoria.toLowerCase().includes(busqueda.toLowerCase()))
  );

  return (
    <div style={{ marginBottom: "1.25rem", background: "var(--bg-card-subtle, rgba(255, 255, 255, 0.03))", padding: "0.85rem", borderRadius: "10px", border: "1px solid var(--border-color, #e0e0e0)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "1.1rem" }}>⚡</span>
          <strong style={{ fontSize: "0.95rem", color: "var(--primary)" }}>Plantillas Rápidas de Consulta</strong>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: "0.8rem", padding: "0.25rem 0.6rem" }}
            onClick={() => setMostrarModal(true)}
          >
            📋 Ver Todas ({plantillas.length})
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: "0.8rem", padding: "0.25rem 0.6rem", color: "var(--primary)" }}
            onClick={() => {
              if (!consultaActual.motivo && !consultaActual.diagnostico) {
                alert("Completa primero los campos de la consulta para poder guardarlos como plantilla reutilizable.");
                return;
              }
              setMostrarModalNueva(true);
            }}
            title="Guardar el texto cargado en el formulario como nueva plantilla"
          >
            ⭐ Guardar Texto Actual
          </button>
        </div>
      </div>

      {/* Chips rápidos de acceso directo */}
      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
        {plantillas.slice(0, 6).map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => handleSeleccionar(p)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              fontSize: "0.82rem",
              padding: "0.3rem 0.65rem",
              borderRadius: "20px",
              border: p.esCustom ? "1px solid var(--primary)" : "1px solid var(--border-color, #ccc)",
              background: p.esCustom ? "rgba(37, 99, 235, 0.08)" : "var(--bg-button, rgba(0,0,0,0.03))",
              cursor: "pointer",
              transition: "all 0.15s ease",
              color: "inherit"
            }}
            title={`Motivo: ${p.motivo}\nDiagnóstico: ${p.diagnostico}`}
          >
            <span>{p.icono}</span>
            <span>{p.nombre}</span>
          </button>
        ))}
      </div>

      {/* MODAL VER TODAS LAS PLANTILLAS */}
      {mostrarModal && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1100, display: "flex", justifyContent: "center", alignItems: "center", padding: "1rem" }}>
          <div className="card" style={{ maxWidth: "700px", width: "100%", maxHeight: "85vh", overflowY: "auto", background: "var(--bg-card, #fff)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, color: "var(--primary)" }}>📋 Biblioteca de Plantillas Clínicas</h3>
              <button type="button" className="btn btn-secondary" style={{ padding: "0.2rem 0.5rem" }} onClick={() => setMostrarModal(false)}>✕</button>
            </div>

            <input
              type="text"
              className="form-input"
              placeholder="🔍 Buscar plantilla por nombre, especialidad o enfermedad..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{ marginBottom: "1rem" }}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {plantillasFiltradas.length === 0 ? (
                <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "1.5rem" }}>No se encontraron plantillas coincidentes.</p>
              ) : (
                plantillasFiltradas.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleSeleccionar(p)}
                    style={{
                      padding: "0.85rem",
                      borderRadius: "8px",
                      border: "1px solid var(--border-color, #e0e0e0)",
                      background: p.esCustom ? "rgba(37, 99, 235, 0.04)" : "var(--bg-subtle, #f9f9f9)",
                      cursor: "pointer",
                      transition: "border-color 0.2s ease",
                      position: "relative"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                      <span style={{ fontWeight: "bold", fontSize: "0.95rem", color: "var(--primary)" }}>
                        {p.icono} {p.nombre} {p.categoria && <small style={{ fontWeight: "normal", color: "var(--text-muted)", marginLeft: "0.4rem" }}>({p.categoria})</small>}
                      </span>
                      {p.esCustom && (
                        <button
                          type="button"
                          onClick={(e) => handleEliminarCustom(p.id, e)}
                          style={{ background: "none", border: "none", color: "#e53e3e", cursor: "pointer", fontSize: "0.85rem" }}
                          title="Eliminar plantilla"
                        >
                          🗑️ Eliminar
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "var(--text-color)" }}>
                      <strong>Motivo:</strong> {p.motivo}<br />
                      <strong>Diagnóstico:</strong> {p.diagnostico}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL GUARDAR PLANTILLA PERSONALIZADA */}
      {mostrarModalNueva && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1100, display: "flex", justifyContent: "center", alignItems: "center", padding: "1rem" }}>
          <div className="card" style={{ maxWidth: "500px", width: "100%", background: "var(--bg-card, #fff)" }}>
            <h3 style={{ marginBottom: "1rem", color: "var(--primary)" }}>⭐ Guardar Nueva Plantilla</h3>
            <form onSubmit={handleGuardarCustom}>
              <div className="form-group">
                <label className="form-label">Nombre de la Plantilla *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ej. Control Posoperatorio, Evaluación Dermatológica..."
                  value={nombreCustom}
                  onChange={(e) => setNombreCustom(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Ícono / Emoji</label>
                  <select
                    className="form-input"
                    value={iconoCustom}
                    onChange={(e) => setIconoCustom(e.target.value)}
                  >
                    <option value="📝">📝 Nota</option>
                    <option value="🩺">🩺 Estetoscopio</option>
                    <option value="❤️">❤️ Cardio</option>
                    <option value="🧠">🧠 Neuro</option>
                    <option value="🦴">🦴 Huesos</option>
                    <option value="🗣️">🗣️ Garganta</option>
                    <option value="👁️">👁️ Oftalmo</option>
                    <option value="👶">👶 Pedia</option>
                  </select>
                </div>
                <div style={{ flex: 2 }}>
                  <label className="form-label">Categoría / Especialidad</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ej. Cardiología, Control..."
                    value={categoriaCustom}
                    onChange={(e) => setCategoriaCustom(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ background: "var(--bg-subtle, #f5f5f5)", padding: "0.75rem", borderRadius: "6px", fontSize: "0.85rem", marginBottom: "1rem" }}>
                <p style={{ margin: 0, fontWeight: "bold", marginBottom: "0.3rem" }}>Contenido a guardar:</p>
                <div><strong>Motivo:</strong> {consultaActual.motivo || "(Vacío)"}</div>
                <div><strong>Diagnóstico:</strong> {consultaActual.diagnostico || "(Vacío)"}</div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setMostrarModalNueva(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Plantilla</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
