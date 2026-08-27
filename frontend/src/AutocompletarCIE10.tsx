import React, { useState, useRef, useEffect } from "react";
import { DiagnosticoCIE10, buscarDiagnosticosCIE10, CIE10_DATA } from "./data/cie10Data";

interface AutocompletarCIE10Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const AutocompletarCIE10: React.FC<AutocompletarCIE10Props> = ({
  value,
  onChange,
  placeholder = "Descripción del diagnóstico o escriba para buscar CIE-10 (ej. faringitis, HTA, J02)..."
}) => {
  const [sugerencias, setSugerencias] = useState<DiagnosticoCIE10[]>([]);
  const [mostrarDropdown, setMostrarDropdown] = useState(false);
  const [indiceSeleccionado, setIndiceSeleccionado] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sugerencias frecuentes destacadas
  const frecuentes: DiagnosticoCIE10[] = [
    CIE10_DATA.find((c) => c.codigo === "J02.9")!,
    CIE10_DATA.find((c) => c.codigo === "I10")!,
    CIE10_DATA.find((c) => c.codigo === "E11")!,
    CIE10_DATA.find((c) => c.codigo === "M54.5")!,
    CIE10_DATA.find((c) => c.codigo === "J00")!,
    CIE10_DATA.find((c) => c.codigo === "A09")!,
    CIE10_DATA.find((c) => c.codigo === "N39.0")!
  ].filter(Boolean);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setMostrarDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    onChange(text);

    // Obtener la última línea o palabra ingresada para la búsqueda
    const lineas = text.split("\n");
    const ultimaLinea = lineas[lineas.length - 1];

    if (ultimaLinea.trim().length >= 2) {
      const resultados = buscarDiagnosticosCIE10(ultimaLinea);
      setSugerencias(resultados);
      setMostrarDropdown(resultados.length > 0);
      setIndiceSeleccionado(-1);
    } else {
      setMostrarDropdown(false);
    }
  };

  const seleccionarDiagnostico = (diag: DiagnosticoCIE10) => {
    const textoFormateado = `${diag.codigo} - ${diag.nombre}`;
    
    // Si ya hay texto, reemplazar la última línea incompleta o concatenar
    const lineas = value.split("\n");
    if (lineas.length > 0 && lineas[lineas.length - 1].trim().length >= 2) {
      lineas[lineas.length - 1] = textoFormateado;
      onChange(lineas.join("\n"));
    } else {
      onChange(value ? `${value}\n${textoFormateado}` : textoFormateado);
    }

    setMostrarDropdown(false);
    setIndiceSeleccionado(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!mostrarDropdown || sugerencias.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndiceSeleccionado((prev) => (prev < sugerencias.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndiceSeleccionado((prev) => (prev > 0 ? prev - 1 : sugerencias.length - 1));
    } else if (e.key === "Enter" && indiceSeleccionado >= 0) {
      e.preventDefault();
      seleccionarDiagnostico(sugerencias[indiceSeleccionado]);
    } else if (e.key === "Escape") {
      setMostrarDropdown(false);
    }
  };

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      {/* Chips Rápidos de Diagnósticos CIE-10 Frecuentes */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap", marginBottom: "0.4rem" }}>
        <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: "bold" }}>CIE-10 Frecuentes:</span>
        {frecuentes.map((f) => (
          <button
            key={f.codigo}
            type="button"
            onClick={() => seleccionarDiagnostico(f)}
            style={{
              fontSize: "0.75rem",
              padding: "0.15rem 0.45rem",
              borderRadius: "4px",
              border: "1px dashed var(--primary)",
              background: "rgba(37, 99, 235, 0.05)",
              color: "var(--primary)",
              cursor: "pointer"
            }}
            title={f.nombre}
          >
            {f.codigo} {f.nombre.split(" ")[0]}
          </button>
        ))}
      </div>

      <textarea
        className="form-input"
        rows={3}
        placeholder={placeholder}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          const lineas = value.split("\n");
          const ultimaLinea = lineas[lineas.length - 1];
          if (ultimaLinea && ultimaLinea.trim().length >= 2) {
            const resultados = buscarDiagnosticosCIE10(ultimaLinea);
            setSugerencias(resultados);
            setMostrarDropdown(resultados.length > 0);
          }
        }}
        style={{ resize: "vertical" }}
        required
      />

      {/* DROPDOWN DE SUGERENCIAS CIE-10 */}
      {mostrarDropdown && sugerencias.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 1000,
            background: "var(--bg-card, #ffffff)",
            border: "1px solid var(--primary)",
            borderRadius: "6px",
            boxShadow: "0 8px 16px rgba(0,0,0,0.15)",
            maxHeight: "220px",
            overflowY: "auto",
            marginTop: "2px"
          }}
        >
          <div style={{ padding: "0.4rem 0.6rem", background: "var(--primary)", color: "#fff", fontSize: "0.75rem", fontWeight: "bold", display: "flex", justifyContent: "space-between" }}>
            <span>🔍 SUGERENCIAS CIE-10</span>
            <span>Usa ↑↓ y Enter para seleccionar</span>
          </div>
          {sugerencias.map((item, index) => (
            <div
              key={`${item.codigo}-${index}`}
              onClick={() => seleccionarDiagnostico(item)}
              style={{
                padding: "0.5rem 0.75rem",
                cursor: "pointer",
                background: index === indiceSeleccionado ? "rgba(37, 99, 235, 0.15)" : "transparent",
                borderBottom: "1px solid var(--border-color, #eee)",
                fontSize: "0.85rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}
            >
              <div>
                <strong style={{ color: "var(--primary)", marginRight: "0.5rem" }}>{item.codigo}</strong>
                <span>{item.nombre}</span>
              </div>
              <span style={{ fontSize: "0.72rem", background: "var(--bg-subtle, #eee)", padding: "0.15rem 0.4rem", borderRadius: "3px", color: "var(--text-muted)" }}>
                {item.categoria}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
