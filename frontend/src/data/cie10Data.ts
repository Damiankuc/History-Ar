export interface DiagnosticoCIE10 {
  codigo: string;
  nombre: string;
  categoria: string;
  sinonimos?: string[];
}

export const CIE10_DATA: DiagnosticoCIE10[] = [
  // --- INFECCIOSAS Y RESPIRATORIAS ---
  { codigo: "J00", nombre: "Nasofaringitis aguda [resfriado común]", categoria: "Respiratorio", sinonimos: ["resfrio", "congestion", "gripe leve"] },
  { codigo: "J01.9", nombre: "Sinusitis aguda, no especificada", categoria: "Respiratorio", sinonimos: ["sinusitis", "dolor facial"] },
  { codigo: "J02.9", nombre: "Faringitis aguda, no especificada", categoria: "Respiratorio", sinonimos: ["dolor de garganta", "angina", "faringitis"] },
  { codigo: "J03.9", nombre: "Amigdalitis aguda, no especificada", categoria: "Respiratorio", sinonimos: ["placas", "amígdalas", "anginas purulentas"] },
  { codigo: "J04.0", nombre: "Laringitis aguda", categoria: "Respiratorio", sinonimos: ["disfonía", "ronquera", "laringitis"] },
  { codigo: "J11.1", nombre: "Influenza con manifestaciones respiratorias", categoria: "Respiratorio", sinonimos: ["gripe", "influenza", "cuadro viral"] },
  { codigo: "J18.9", nombre: "Neumonía, no especificada", categoria: "Respiratorio", sinonimos: ["neumonia", "pulmonia", "infeccion pulmonar"] },
  { codigo: "J20.9", nombre: "Bronquitis aguda, no especificada", categoria: "Respiratorio", sinonimos: ["bronquitis", "tos convulsa", "pecho tomado"] },
  { codigo: "J44.9", nombre: "Enfermedad pulmonar obstructiva crónica (EPOC)", categoria: "Respiratorio", sinonimos: ["epoc", "enfisema", "bronquitis cronica"] },
  { codigo: "J45.9", nombre: "Asma, no especificado", categoria: "Respiratorio", sinonimos: ["asma", "broncoespasmo", "sibilancias"] },
  { codigo: "J30.4", nombre: "Rinitis alérgica, no especificada", categoria: "Respiratorio", sinonimos: ["alergia", "rinitis", "estornudos"] },

  // --- CARDIOVASCULAR ---
  { codigo: "I10", nombre: "Hipertensión esencial (primaria)", categoria: "Cardiovascular", sinonimos: ["hta", "presion alta", "hipertension"] },
  { codigo: "I11.9", nombre: "Enfermedad cardíaca hipertensiva sin insuficiencia cardíaca", categoria: "Cardiovascular", sinonimos: ["hipertension cardiaca"] },
  { codigo: "I20.9", nombre: "Angina de pecho, no especificada", categoria: "Cardiovascular", sinonimos: ["angina", "precordialgia", "dolor de pecho"] },
  { codigo: "I25.1", nombre: "Enfermedad aterosclerótica del corazón", categoria: "Cardiovascular", sinonimos: ["coronariopatia", "arteriosclerosis"] },
  { codigo: "I48.9", nombre: "Fibrilación y aleteo auricular", categoria: "Cardiovascular", sinonimos: ["arritmia", "fa", "fibrilacion auricular"] },
  { codigo: "I50.9", nombre: "Insuficiencia cardíaca, no especificada", categoria: "Cardiovascular", sinonimos: ["insuficiencia cardiaca", "edema de pulmon"] },
  { codigo: "I83.9", nombre: "Venas varicosas de miembros inferiores sin úlcera ni inflamación", categoria: "Cardiovascular", sinonimos: ["varices", "insuficiencia venosa"] },

  // --- DIGESTIVO Y GASTROENTEROLOGÍA ---
  { codigo: "A09", nombre: "Gastroenteritis y colitis de origen infeccioso y no especificado", categoria: "Digestivo", sinonimos: ["diarrea", "gastroenteritis", "vomitos"] },
  { codigo: "K21.9", nombre: "Enfermedad por reflujo gastroesofágico sin esofagitis (ERGE)", categoria: "Digestivo", sinonimos: ["reflujo", "acidez", "erge", "pirosis"] },
  { codigo: "K29.7", nombre: "Gastritis, no especificada", categoria: "Digestivo", sinonimos: ["gastritis", "dolor de estomago", "dispepsia"] },
  { codigo: "K30", nombre: "Dispepsia funcional", categoria: "Digestivo", sinonimos: ["mala digestion", "empacho", "pesadez"] },
  { codigo: "K58.9", nombre: "Síndrome del colon irritable sin diarrea", categoria: "Digestivo", sinonimos: ["colon irritable", "intestino irritable", "hinchazón"] },
  { codigo: "K80.2", nombre: "Cálculo de la vesícula biliar sin colecistitis", categoria: "Digestivo", sinonimos: ["litiasis vesicular", "calculos vesicula", "colico biliar"] },
  { codigo: "K59.0", nombre: "Constipación / Estreñimiento", categoria: "Digestivo", sinonimos: ["constipacion", "estreneimiento"] },

  // --- METABÓLICO Y ENDOCRINO ---
  { codigo: "E11", nombre: "Diabetes mellitus no insulinodependiente (Tipo 2)", categoria: "Endocrinología", sinonimos: ["diabetes", "dm2", "azucar en sangre"] },
  { codigo: "E10", nombre: "Diabetes mellitus insulinodependiente (Tipo 1)", categoria: "Endocrinología", sinonimos: ["diabetes 1", "dm1"] },
  { codigo: "E03.9", nombre: "Hipotiroidismo, no especificado", categoria: "Endocrinología", sinonimos: ["hipotiroidismo", "tiroides baja"] },
  { codigo: "E05.9", nombre: "Tirotoxicosis / Hipertiroidismo", categoria: "Endocrinología", sinonimos: ["hipertiroidismo"] },
  { codigo: "E66.9", nombre: "Obesidad, no especificada", categoria: "Endocrinología", sinonimos: ["obesidad", "sobrepeso", "imc alto"] },
  { codigo: "E78.5", nombre: "Hiperlipidemia, no especificada (Dislipidemia)", categoria: "Endocrinología", sinonimos: ["colesterol alto", "trigliceridos", "dislipidemia"] },
  { codigo: "E79.0", nombre: "Hiperuricemia sin signos de artritis inflamatoria (Gota)", categoria: "Endocrinología", sinonimos: ["acido urico", "gota"] },

  // --- OSTEOMUSCULAR Y TRAUMATOLOGÍA ---
  { codigo: "M54.5", nombre: "Lumbalgia no especificada / Lumbago", categoria: "Traumatología", sinonimos: ["lumbalgia", "dolor de cintura", "lumbago"] },
  { codigo: "M54.2", nombre: "Cervicalgia", categoria: "Traumatología", sinonimos: ["dolor de cuello", "cervicalgia", "torticolis"] },
  { codigo: "M54.4", nombre: "Lumbago con ciática / Lumbociatalgia", categoria: "Traumatología", sinonimos: ["ciatica", "lumbociatalgia"] },
  { codigo: "M17.9", nombre: "Gonartrosis, no especificada (Artrosis de rodilla)", categoria: "Traumatología", sinonimos: ["artrosis rodilla", "gonartrosis"] },
  { codigo: "M19.9", nombre: "Artrosis, no especificada", categoria: "Traumatología", sinonimos: ["artrosis", "desgaste articular"] },
  { codigo: "M75.1", nombre: "Síndrome del manguito rotador", categoria: "Traumatología", sinonimos: ["hombro doloroso", "manguito rotador"] },
  { codigo: "M77.1", nombre: "Epicondilitis lateral (Codo de tenista)", categoria: "Traumatología", sinonimos: ["epicondilitis", "codo tenista"] },
  { codigo: "M79.7", nombre: "Fibromialgia", categoria: "Reumatología", sinonimos: ["fibromialgia", "dolor muscular difuso"] },

  // --- NEUROLOGÍA Y PSIQUIATRÍA ---
  { codigo: "G43.9", nombre: "Migraña, no especificada", categoria: "Neurología", sinonimos: ["migraña", "jaqueca", "dolor de cabeza"] },
  { codigo: "G44.2", nombre: "Cefalea tensional episódica", categoria: "Neurología", sinonimos: ["cefalea", "dolor de cabeza tensional"] },
  { codigo: "G47.0", nombre: "Trastornos del inicio y del mantenimiento del sueño (Insomnio)", categoria: "Neurología", sinonimos: ["insomnio", "falta de sueno"] },
  { codigo: "F41.1", nombre: "Trastorno de ansiedad generalizada", categoria: "Psiquiatría", sinonimos: ["ansiedad", "nerviosismo", "tag"] },
  { codigo: "F41.0", nombre: "Trastorno de pánico [ansiedad paroxística episódica]", categoria: "Psiquiatría", sinonimos: ["ataque de panico", "crisis de angustia"] },
  { codigo: "F32.9", nombre: "Episodio depresivo, no especificado", categoria: "Psiquiatría", sinonimos: ["depresion", "angustia", "desanimo"] },

  // --- GENITOURINARIO Y DERMATOLOGÍA ---
  { codigo: "N39.0", nombre: "Infección de vías urinarias, sitio no especificado", categoria: "Urología", sinonimos: ["itu", "infeccion urinaria", "cistitis", "mal de orina"] },
  { codigo: "N20.1", nombre: "Cálculo del uréter / Litiasis renal", categoria: "Urología", sinonimos: ["colico renal", "calculo renal", "piedra riñon"] },
  { codigo: "N40", nombre: "Hiperplasia de la próstata (HPB)", categoria: "Urología", sinonimos: ["prostata", "hpb", "hipertrofia prostatica"] },
  { codigo: "L20.9", nombre: "Dermatitis atópica, no especificada", categoria: "Dermatología", sinonimos: ["eczema", "dermatitis", "alergia piel"] },
  { codigo: "L70.0", nombre: "Acné vulgar", categoria: "Dermatología", sinonimos: ["acne", "barritos", "espinillas"] },
  { codigo: "B35.9", nombre: "Dermatofitosis / Micosis cutánea", categoria: "Dermatología", sinonimos: ["hongo", "micosis", "pie de atleta"] },
  { codigo: "L50.9", nombre: "Urticaria, no especificada", categoria: "Dermatología", sinonimos: ["urticaria", "brote en piel", "ronchas"] },

  // --- EXÁMENES Y CONTROLES Z ---
  { codigo: "Z00.0", nombre: "Examen médico general / Chequeo preventivo", categoria: "Preventivo", sinonimos: ["chequeo", "control", "apto fisico"] },
  { codigo: "Z01.4", nombre: "Examen ginecológico de rutina (Papanicolau / Mamografía)", categoria: "Ginecología", sinonimos: ["pap", "colpo", "mamografia", "ginecologico"] },
  { codigo: "Z34.9", nombre: "Supervisión de embarazo normal no especificado", categoria: "Obstetricia", sinonimos: ["embarazo", "control prenatal"] }
];

export function buscarDiagnosticosCIE10(query: string, maxResultados: number = 10): DiagnosticoCIE10[] {
  if (!query || query.trim().length < 2) return [];

  const q = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  return CIE10_DATA.filter((item) => {
    const cod = item.codigo.toLowerCase();
    const nom = item.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const cat = item.categoria.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const sin = item.sinonimos?.some((s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q));

    return cod.includes(q) || nom.includes(q) || cat.includes(q) || sin;
  }).slice(0, maxResultados);
}
