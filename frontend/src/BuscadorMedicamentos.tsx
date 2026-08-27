import React, { useState, useEffect, useRef } from "react";

export interface Medicamento {
  id?: number;
  nombre_comercial: string;
  monodroga?: string;
  presentacion?: string;
  dosis_sugerida?: string;
  es_custom?: boolean;
}

interface BuscadorMedicamentosProps {
  apiBaseUrl: string;
  onInsertarMedicamento: (textoFormateado: string) => void;
  targetNombre?: string; // ej: "Receta" o "Historia Clínica"
}

export const BuscadorMedicamentos: React.FC<BuscadorMedicamentosProps> = ({
  apiBaseUrl,
  onInsertarMedicamento,
  targetNombre = "Documento"
}) => {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<Medicamento[]>([]);
  const [loading, setLoading] = useState(false);
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [selectedMed, setSelectedMed] = useState<Medicamento | null>(null);

  // Campos de posología asistida
  const [posologiaCustom, setPosologiaCustom] = useState("");
  const [guardarCustom, setGuardarCustom] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);

  // Cerrar desplegable si se hace click afuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setMostrarResultados(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Búsqueda de medicamentos con Debounce
  useEffect(() => {
    if (!query || query.trim().length < 1) {
      setResultados([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${apiBaseUrl}/medicamentos/buscar?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setResultados(data);
        }
      } catch (err) {
        console.error("Error al buscar medicamentos:", err);
      } finally {
        setLoading(false);
        setMostrarResultados(true);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, apiBaseUrl]);

  const handleSeleccionar = (med: Medicamento) => {
    setSelectedMed(med);
    setPosologiaCustom(med.dosis_sugerida || "1 comprimido cada 8hs por 7 días");
    setMostrarResultados(false);
  };

  const handleSeleccionarPersonalizado = () => {
    const medCustom: Medicamento = {
      nombre_comercial: query.trim(),
      monodroga: "Personalizado / Fórmula",
      presentacion: "",
      dosis_sugerida: "1 comp cada 12hs",
      es_custom: true
    };
    setSelectedMed(medCustom);
    setPosologiaCustom("1 comprimido cada 12hs por 7 días");
    setMostrarResultados(false);
  };

  const handleConfirmarInsercion = async () => {
    if (!selectedMed) return;

    // Si marcó guardar en Vademécum Personal
    if (guardarCustom && selectedMed.es_custom) {
      try {
        await fetch(`${apiBaseUrl}/medicamentos/custom`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre_comercial: selectedMed.nombre_comercial,
            monodroga: selectedMed.monodroga !== "Personalizado / Fórmula" ? selectedMed.monodroga : "",
            presentacion: selectedMed.presentacion || "",
            dosis_sugerida: posologiaCustom
          })
        });
      } catch (e) {
        console.error("No se pudo guardar en vademécum personal:", e);
      }
    }

    // Formatear texto final
    let lineaText = `- ${selectedMed.nombre_comercial}`;
    if (selectedMed.monodroga && selectedMed.monodroga !== "Personalizado / Fórmula") {
      lineaText += ` (${selectedMed.monodroga})`;
    }
    if (selectedMed.presentacion) {
      lineaText += ` [${selectedMed.presentacion}]`;
    }
    lineaText += `: ${posologiaCustom.trim() || selectedMed.dosis_sugerida || "Según indicación médica"}`;

    onInsertarMedicamento(lineaText);

    // Resetear formulario
    setSelectedMed(null);
    setQuery("");
    setPosologiaCustom("");
    setGuardarCustom(false);
  };

  return (
    <div style={{
      background: "var(--card-bg, #ffffff)",
      border: "1px solid var(--border-color, #e2e8f0)",
      borderRadius: "10px",
      padding: "1rem",
      marginBottom: "1rem",
      boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <span style={{ fontSize: "1.2rem" }}>💊</span>
        <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600, color: "var(--primary, #0284c7)" }}>
          Buscador de Medicamentos / Vademécum
        </h4>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted, #64748b)", marginLeft: "auto" }}>
          Buscar por Marca o Monodroga
        </span>
      </div>

      <div ref={wrapperRef} style={{ position: "relative" }}>
        <input
          type="text"
          className="form-input"
          style={{ width: "100%", paddingRight: "2rem" }}
          placeholder="Ej: Amoxidal, Tafirol, Ibuprofeno, Omeprazol..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!mostrarResultados) setMostrarResultados(true);
          }}
          onFocus={() => {
            if (query.trim().length > 0) setMostrarResultados(true);
          }}
        />
        {loading && (
          <span style={{
            position: "absolute",
            right: "0.75rem",
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: "0.85rem",
            color: "var(--primary)"
          }}>
            ⏳
          </span>
        )}

        {/* Desplegable de Resultados */}
        {mostrarResultados && query.trim().length > 0 && (
          <div style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            backgroundColor: "#ffffff",
            border: "1px solid var(--border-color, #cbd5e1)",
            borderRadius: "0 0 8px 8px",
            boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
            maxHeight: "260px",
            overflowY: "auto",
            zIndex: 100,
            marginTop: "2px"
          }}>
            {resultados.length > 0 ? (
              resultados.map((med, index) => (
                <div
                  key={med.id || index}
                  style={{
                    padding: "0.6rem 0.85rem",
                    borderBottom: "1px solid #f1f5f9",
                    cursor: "pointer",
                    transition: "background-color 0.15s ease",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f0f9ff")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#ffffff")}
                  onClick={() => handleSeleccionar(med)}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#0f172a" }}>
                      {med.nombre_comercial}
                      {med.es_custom && (
                        <span style={{
                          fontSize: "0.7rem",
                          backgroundColor: "#fef3c7",
                          color: "#92400e",
                          padding: "0.1rem 0.4rem",
                          borderRadius: "4px",
                          marginLeft: "0.5rem"
                        }}>
                          Mi Vademécum
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                      {med.monodroga && <span>Monodroga: {med.monodroga}</span>}
                      {med.presentacion && <span> • {med.presentacion}</span>}
                    </div>
                  </div>
                  <span style={{ fontSize: "0.8rem", color: "var(--primary, #0284c7)", fontWeight: 600 }}>
                    Seleccionar ➔
                  </span>
                </div>
              ))
            ) : null}

            {/* Opción fallback: Insertar fármaco personalizado */}
            <div
              style={{
                padding: "0.75rem 0.85rem",
                backgroundColor: "#f8fafc",
                borderTop: resultados.length > 0 ? "1px solid #e2e8f0" : "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                color: "#2563eb",
                fontWeight: 600,
                fontSize: "0.85rem"
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#eff6ff")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
              onClick={handleSeleccionarPersonalizado}
            >
              <span>➕</span>
              <span>Usar fármaco no listado: <strong>"{query.trim()}"</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* Panel de Asistente de Dosis y Posología al Seleccionar */}
      {selectedMed && (
        <div style={{
          marginTop: "0.85rem",
          padding: "0.85rem",
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: "8px",
          display: "flex",
          flexDirection: "column",
          gap: "0.6rem"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong style={{ color: "#166534", fontSize: "0.9rem" }}>
              ✓ Seleccionado: {selectedMed.nombre_comercial} {selectedMed.presentacion ? `(${selectedMed.presentacion})` : ""}
            </strong>
            <button
              type="button"
              onClick={() => setSelectedMed(null)}
              style={{
                border: "none",
                background: "transparent",
                color: "#ef4444",
                cursor: "pointer",
                fontSize: "0.8rem",
                fontWeight: 600
              }}
            >
              ✕ Cambiar
            </button>
          </div>

          {/* Plantillas Rápidas */}
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#15803d" }}>Posología sugerida:</span>
            {[
              "1 comp c/8hs por 7 días",
              "1 comp c/12hs por 7 días",
              "1 comp diario en ayunas",
              "1 cápsula c/8hs con comidas",
              "2 disparos c/8hs",
              "1 comp por la noche"
            ].map((preset, idx) => (
              <button
                key={idx}
                type="button"
                style={{
                  fontSize: "0.75rem",
                  padding: "0.2rem 0.5rem",
                  borderRadius: "4px",
                  border: "1px solid #86efac",
                  backgroundColor: "#ffffff",
                  color: "#166534",
                  cursor: "pointer"
                }}
                onClick={() => setPosologiaCustom(preset)}
              >
                {preset}
              </button>
            ))}
          </div>

          {/* Campo de Texto Posología editable */}
          <div>
            <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#166534", marginBottom: "0.25rem" }}>
              Posología / Indicación de uso:
            </label>
            <input
              type="text"
              className="form-input"
              style={{ width: "100%", fontSize: "0.85rem" }}
              value={posologiaCustom}
              onChange={(e) => setPosologiaCustom(e.target.value)}
              placeholder="Ej: 1 comprimido cada 8 horas por 7 días..."
            />
          </div>

          {/* Checkbox para guardar como custom */}
          {selectedMed.es_custom && (
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", color: "#15803d", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={guardarCustom}
                onChange={(e) => setGuardarCustom(e.target.checked)}
              />
              💾 Guardar este fármaco en mi Vademécum Personal para futuras búsquedas
            </label>
          )}

          {/* Botón Inserción */}
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleConfirmarInsercion}
            style={{
              width: "100%",
              padding: "0.45rem",
              fontSize: "0.85rem",
              backgroundColor: "#16a34a",
              borderColor: "#16a34a",
              fontWeight: 600
            }}
          >
            ➕ Insertar en {targetNombre}
          </button>
        </div>
      )}
    </div>
  );
};
