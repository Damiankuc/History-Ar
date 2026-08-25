export interface PlantillaConsulta {
  id: string;
  nombre: string;
  icono: string;
  categoria?: string;
  motivo: string;
  diagnostico: string;
  tratamiento: string;
  notas?: string;
  esCustom?: boolean;
}

export const PLANTILLAS_ESTANDAR: PlantillaConsulta[] = [
  {
    id: "chequeo-general",
    nombre: "Chequeo de Rutina",
    icono: "🩺",
    categoria: "General",
    motivo: "Control de salud periódico / Chequeo de rutina.",
    diagnostico: "Z00.0 - Examen médico general (Sin hallazgos patológicos al momento del examen).",
    tratamiento: "1. Mantener dieta equilibrada e hidratación (2L agua/día).\n2. Realizar actividad física aeróbica 150 min/semana.\n3. Solicitud de rutina de laboratorio (Hemograma, Perfil lipídico, Glucemia, Uremia, Creatinina, Hepatograma).",
    notas: "Paciente afebril, normotenso. Se agendan estudios de control."
  },
  {
    id: "faringitis-aguda",
    nombre: "Faringitis Aguda",
    icono: "🗣️",
    categoria: "Respiratorio",
    motivo: "Odinafagia (dolor de garganta), febrícula y malestar general de 48hs de evolución.",
    diagnostico: "J02.9 - Faringitis aguda, no especificada.",
    tratamiento: "1. Paracetamol 500mg / 1g: 1 comprimido cada 8 horas según dolor o fiebre.\n2. Ibuprofeno 600mg: 1 comprimido cada 8 horas con alimentos si persiste inflamación.\n3. Abundante ingesta de líquidos templados y reposo relativo por 48-72hs.\n4. Si presenta fiebre alta continua (>38.5°C) o placas purulentas, reconsultar.",
    notas: "Eritema faríngeo sin exudado purulento franco. Ganglios submandibulares palpables no dolorosos."
  },
  {
    id: "hipertension-control",
    nombre: "Control de Hipertensión",
    icono: "❤️",
    categoria: "Cardiovascular",
    motivo: "Control periódico de Hipertensión Arterial (HTA).",
    diagnostico: "I10 - Hipertensión esencial (primaria).",
    tratamiento: "1. Continuar con plan farmacológico habitual.\n2. Dieta hiposódica estricta (reducir sal de mesa y ultraprocesados).\n3. Registro diario de Tensión Arterial (mañana y noche) por 7 días.\n4. Control en 30 días con mapa de registros de TA.",
    notas: "TA en consultorio adecuada. Tolerancia al tratamiento confirmada sin efectos adversos."
  },
  {
    id: "gripe-resfrio",
    nombre: "Gripe / Cuadro Viral",
    icono: "🤧",
    categoria: "Respiratorio",
    motivo: "Congestión nasal, estornudos, cefalea leve y mialgias.",
    diagnostico: "J00 - Nasofaringitis aguda [resfriado común] / J11 - Influenza con virus no identificado.",
    tratamiento: "1. Ibupirac / Ibuprofeno 400mg: 1 comprimido cada 8 horas.\n2. Solución salina nasal o Spray fisiológico: 2 disparos por narina cada 6-8hs.\n3. Reposo relativo, ingesta de líquidos abundantes y vitamina C.\n4. Pautas de alarma: dificultad respiratoria o tos persistente.",
    notas: "Auscultación pulmonar limpia. Murmullo vesicular conservado sin ruidos agregados."
  },
  {
    id: "lumbalgia",
    nombre: "Lumbalgia Aguda",
    icono: "🦴",
    categoria: "Traumatología / Reumatología",
    motivo: "Lumbago mecánico tras esfuerzo físico. Dolor punzante en zona lumbar baja.",
    diagnostico: "M54.5 - Lumbalgia no especificada.",
    tratamiento: "1. Diclofenac 75mg + Pridinol (o Voltaren Flex): 1 comprimido cada 12 horas por 5 días con alimentos.\n2. Calor local seco 20 minutos 3 veces al día.\n3. Reposo en posición fowler / evitar esfuerzos físicos y cargar peso.\n4. Si no cede en 5-7 días, realizar radiografía lumbosacra.",
    notas: "Puño percusión lumbar negativa. Lasègue negativo. Dolor a la palpación de paravertebrales lumbares."
  },
  {
    id: "gastroenteritis",
    nombre: "Gastroenteritis Aguda",
    icono: "🤢",
    categoria: "Gastrointestinal",
    motivo: "Nausea, vómitos aislados, deposiciones líquidas (3-4 episodios en 24hs) y dolor abdominal cólico.",
    diagnostico: "A09 - Gastroenteritis y colitis de origen infeccioso y no especificado.",
    tratamiento: "1. Dieta blanda astringente (arroz blanco, queso magro, pollo hervido, manzana rallada, tostadas).\n2. Sales de rehidratación oral o solución hidratante (ingesta fraccionada).\n3. Sertal Compuesto: 1 comprimido cada 8hs solo en caso de dolor cólico intenso.\n4. Probióticos (Saccharomyces boulardii 200mg): 1 cápsula cada 12hs por 5 días.",
    notas: "Abdomen blando, depresible, doloroso difuso a la palpación. Ruidos hidroaéreos aumentados."
  },
  {
    id: "uti-cistitis",
    nombre: "Infección Urinaria (Cistitis)",
    icono: "💧",
    categoria: "Urología / Ginecología",
    motivo: "Disuria (ardor al orinar), polaquiuria (micción frecuente) y tenesmo vesical.",
    diagnostico: "N39.0 - Infección de vías urinarias, sitio no especificado / N30.0 Cistitis aguda.",
    tratamiento: "1. Solicitud de Urocultivo con Antibiograma.\n2. Nitrofurantoína 100mg cada 6hs por 7 días O Ciprofloxacina 500mg cada 12hs por 5 días.\n3. Ingesta hídrica abundante (mínimo 2.5 a 3 litros de agua diarios).\n4. Analgésico urinario (Fenazopiridina) si presenta disuria severa por 48hs.",
    notas: "Puño percusión renal (Giordano) bilateral negativa. Sin fiebre ni lumbalgia alta."
  },
  {
    id: "diabetes-t2-control",
    nombre: "Control Diabetes Tipo 2",
    icono: "🩸",
    categoria: "Endocrinología",
    motivo: "Control de laboratorio y seguimiento de Diabetes Mellitus Tipo 2.",
    diagnostico: "E11 - Diabetes mellitus no insulinodependiente (Tipo 2).",
    tratamiento: "1. Continuar con Metformina 850mg (o 1000mg AP) con las comidas principales.\n2. Mantener plan alimentario bajo en hidratos de carbono refinados y azúcares simples.\n3. Solicitud de Hemoglobina Glicosilada (HbA1c), Microalbuminuria y Perfil Lipídico.\n4. Interconsulta anual con Oftalmología (Fondo de ojo) y evaluación de pie diabético.",
    notas: "Glucemias capilares en ayunas dentro de objetivos. Sin signos de neuropatía periférica."
  }
];

const LOCAL_STORAGE_KEY = "history_ar_custom_plantillas_v1";

export function obtenerTodasLasPlantillas(): PlantillaConsulta[] {
  try {
    const customData = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!customData) return PLANTILLAS_ESTANDAR;
    const customPlantillas: PlantillaConsulta[] = JSON.parse(customData);
    return [...PLANTILLAS_ESTANDAR, ...customPlantillas];
  } catch (error) {
    console.error("Error al leer plantillas personalizadas de localStorage:", error);
    return PLANTILLAS_ESTANDAR;
  }
}

export function guardarPlantillaPersonalizada(plantilla: Omit<PlantillaConsulta, "id" | "esCustom">): PlantillaConsulta {
  const todas = obtenerTodasLasPlantillas();
  const customExistentes = todas.filter((p) => p.esCustom);

  const nuevaPlantilla: PlantillaConsulta = {
    ...plantilla,
    id: `custom-${Date.now()}`,
    esCustom: true,
    icono: plantilla.icono || "📝",
  };

  const actualizadas = [...customExistentes, nuevaPlantilla];
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(actualizadas));
  return nuevaPlantilla;
}

export function eliminarPlantillaPersonalizada(id: string): void {
  const todas = obtenerTodasLasPlantillas();
  const filtradas = todas.filter((p) => p.esCustom && p.id !== id);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtradas));
}
