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

interface Receta {
  id: number;
  medicamentos: string;
  indicaciones?: string;
  fecha: string;
  paciente_id: number;
  consulta_id?: number;
}

interface Cita {
  id: number;
  fecha_hora: string;
  duracion_minutos: number;
  motivo: string;
  estado: string; // "programado", "completado", "cancelado"
  paciente_id: number;
  paciente?: {
    id: number;
    nombre: string;
    apellido: string;
    dni: string;
  };
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
  obra_social?: string;
  numero_afiliado?: string;
  notas_generales?: string;
  fecha_creacion: string;
  consultas?: Consulta[];
  documentos?: Documento[];
  recetas?: Receta[];
  citas?: Cita[];
}

function App() {
  // Estado de navegación principal
  const [activeTab, setActiveTab] = useState<"pacientes" | "nuevo-paciente" | "agenda" | "configuracion">("pacientes");
  
  // Estado de sub-tab en ficha de paciente
  const [patientSubTab, setPatientSubTab] = useState<"consultas" | "documentos" | "recetas" | "imprimir">("consultas");
  
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
  
  // Estados para impresión temporal
  const [printData, setPrintData] = useState<{
    paciente: Paciente;
    consultas: Consulta[];
  } | null>(null);

  const [printRecipeData, setPrintRecipeData] = useState<{
    paciente: Paciente;
    receta: Receta;
  } | null>(null);

  // Estados Fase 2
  const [citas, setCitas] = useState<Cita[]>([]);
  const [configuracion, setConfiguracion] = useState({
    doctor_nombre: "",
    doctor_especialidad: "",
    doctor_matricula: "",
    firma_ruta: "",
    pedir_password_al_iniciar: true
  });

  // Estados formularios Fase 2
  const [newCita, setNewCita] = useState({
    paciente_id: "",
    fecha: "",
    hora: "",
    duracion_minutos: 30,
    motivo: ""
  });

  const [newReceta, setNewReceta] = useState({
    medicamentos: "",
    indicaciones: ""
  });

  const [doctorForm, setDoctorForm] = useState({
    doctor_nombre: "",
    doctor_especialidad: "",
    doctor_matricula: ""
  });

  const [restoring, setRestoring] = useState(false);

  // --- Estados de Autenticación en la Nube (Supabase) ---
  const [appState, setAppState] = useState<"checking" | "login" | "ready">("checking");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [currentUsuario, setCurrentUsuario] = useState<{ id: number; nombre: string; especialidad: string; matricula: string; firma_ruta?: string } | null>(null);

  // Campos Login
  const [loginNombre, setLoginNombre] = useState("");
  const [loginMatricula, setLoginMatricula] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Campos Registro
  const [registerNombre, setRegisterNombre] = useState("");
  const [registerEspecialidad, setRegisterEspecialidad] = useState("");
  const [registerMatricula, setRegisterMatricula] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");

  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // --- Estados de Notificaciones (WhatsApp & Gmail) ---
  const [smtpForm, setSmtpForm] = useState({
    smtp_email: localStorage.getItem("history_ar_smtp_email") || "",
    smtp_password: localStorage.getItem("history_ar_smtp_pass") || ""
  });
  const [notificationModal, setNotificationModal] = useState<{
    cita: any;
    paciente?: any;
  } | null>(null);
  const [sendingEmailState, setSendingEmailState] = useState(false);
  const [emailStatusMsg, setEmailStatusMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Formateador universal de números para WhatsApp
  const formatWhatsAppNumber = (phone?: string) => {
    if (!phone) return "";
    let cleaned = phone.replace(/\D/g, "");
    if (!cleaned) return "";
    if (cleaned.startsWith("0")) cleaned = cleaned.substring(1);
    if (cleaned.startsWith("15")) cleaned = cleaned.substring(2);
    if (!cleaned.startsWith("54")) {
      if (!cleaned.startsWith("9") && cleaned.length >= 10) {
        cleaned = "549" + cleaned;
      } else {
        cleaned = "54" + cleaned;
      }
    }
    return cleaned;
  };

  const getWhatsAppLink = (cita: any, pacienteObj?: any) => {
    const target = pacienteObj || cita.paciente;
    const phone = formatWhatsAppNumber(target?.telefono);
    if (!phone) return "";
    const dt = new Date(cita.fecha_hora);
    const fechaStr = dt.toLocaleDateString("es-AR");
    const horaStr = dt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    const docName = configuracion.doctor_nombre || currentUsuario?.nombre || "médico";
    const msg = `Hola ${target?.nombre || ""}! Te confirmamos tu turno médico para el día ${fechaStr} a las ${horaStr} hs con el/la ${docName}. Motivo: ${cita.motivo}.`;
    return `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`;
  };

  const handleSendEmailNotification = async (citaId: number, targetEmail?: string) => {
    if (!smtpForm.smtp_email || !smtpForm.smtp_password) {
      setEmailStatusMsg({ type: "err", text: "Por favor ingresá tu e-mail emisor y contraseña de aplicación de Gmail en Configuración." });
      return;
    }
    try {
      setSendingEmailState(true);
      setEmailStatusMsg(null);
      const res = await fetch(`${API_BASE_URL}/citas/${citaId}/enviar-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smtp_email: smtpForm.smtp_email,
          smtp_password: smtpForm.smtp_password,
          email_destino: targetEmail
        })
      });
      if (res.ok) {
        setEmailStatusMsg({ type: "ok", text: "✓ Correo enviado exitosamente a la casilla del paciente." });
      } else {
        const errData = await res.json().catch(() => ({}));
        setEmailStatusMsg({ type: "err", text: errData.detail || "No se pudo enviar el e-mail." });
      }
    } catch {
      setEmailStatusMsg({ type: "err", text: "Error de conexión con el servidor de correo." });
    } finally {
      setSendingEmailState(false);
    }
  };

  const handleSaveSmtp = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("history_ar_smtp_email", smtpForm.smtp_email);
    localStorage.setItem("history_ar_smtp_pass", smtpForm.smtp_password);
    alert("Configuración de correo (Gmail SMTP) guardada con éxito.");
  };

  // --- Estados y lógica para Compartir Historia Médica con Profesional ---
  const [compartirModalOpen, setCompartirModalOpen] = useState(false);
  const [compartirForm, setCompartirForm] = useState({
    email_profesional: "",
    nombre_profesional: "",
    mensaje_medico: "",
    incluir_historia_clinica: true,
    receta_ids: [] as number[],
    documento_ids: [] as number[]
  });
  const [isSendingCompartir, setIsSendingCompartir] = useState(false);
  const [compartirStatusMsg, setCompartirStatusMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const handleOpenCompartirModal = () => {
    if (!selectedPaciente) return;
    const defaultRecetas = (selectedPaciente.recetas || []).map(r => r.id);
    const defaultDocs = (selectedPaciente.documentos || []).map(d => d.id);
    setCompartirForm({
      email_profesional: "",
      nombre_profesional: "",
      mensaje_medico: "",
      incluir_historia_clinica: true,
      receta_ids: defaultRecetas,
      documento_ids: defaultDocs
    });
    setCompartirStatusMsg(null);
    setCompartirModalOpen(true);
  };

  const handleSendCompartirEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPaciente) return;
    if (!smtpForm.smtp_email || !smtpForm.smtp_password) {
      setCompartirStatusMsg({
        type: "err",
        text: "Por favor configurá tu email emisor y contraseña de aplicación de Gmail en la pestaña Configuración antes de enviar."
      });
      return;
    }
    if (!compartirForm.email_profesional.trim()) {
      setCompartirStatusMsg({
        type: "err",
        text: "Ingresá el correo electrónico del profesional receptor."
      });
      return;
    }

    try {
      setIsSendingCompartir(true);
      setCompartirStatusMsg(null);
      const res = await fetch(`${API_BASE_URL}/pacientes/${selectedPaciente.id}/compartir-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...compartirForm,
          smtp_email: smtpForm.smtp_email,
          smtp_password: smtpForm.smtp_password
        })
      });

      if (res.ok) {
        const data = await res.json();
        setCompartirStatusMsg({ type: "ok", text: data.message || "✓ Historia clínica enviada con éxito al profesional." });
      } else {
        const errData = await res.json().catch(() => ({}));
        setCompartirStatusMsg({ type: "err", text: errData.detail || "Error al enviar la historia clínica por correo." });
      }
    } catch {
      setCompartirStatusMsg({ type: "err", text: "Error de conexión al servidor al enviar el correo." });
    } finally {
      setIsSendingCompartir(false);
    }
  };

  // --- Estados del formulario de cambio de contraseña (en Configuración) ---
  const [passwordForm, setPasswordForm] = useState({
    password_actual: "",
    password_nueva: "",
    password_confirm: ""
  });
  const [passwordMsg, setPasswordMsg] = useState<{type: "ok" | "err"; text: string} | null>(null);
  const [showPasswordFields, setShowPasswordFields] = useState(false);

  // --- Estados de Auto-Registro Público por Código QR ---
  const isVercelDeployment = typeof window !== "undefined" && window.location.hostname.includes("vercel.app");
  const isPublicRegisterMode = isVercelDeployment || new URLSearchParams(window.location.search).get("modo") === "autoregistro" || window.location.hash === "#registro";

  const [publicPaciente, setPublicPaciente] = useState({
    nombre: "",
    apellido: "",
    dni: "",
    fecha_nacimiento: "",
    telefono: "",
    email: "",
    direccion: "",
    obra_social: "",
    numero_afiliado: "",
    notas_generales: ""
  });
  const [publicSubmitting, setPublicSubmitting] = useState(false);
  const [publicSuccess, setPublicSuccess] = useState(false);
  const [publicError, setPublicError] = useState("");

  // --- Estados de Código QR para Puerta de Consultorio ---
  const [qrBaseUrl, setQrBaseUrl] = useState(() => {
    return localStorage.getItem("history_ar_qr_url") || `${window.location.origin}/?modo=autoregistro`;
  });
  const [, setIsPrintingQrPoster] = useState(false);

  const handleSaveQrUrl = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("history_ar_qr_url", qrBaseUrl);
    alert("URL del Código QR actualizada correctamente.");
  };

  const handlePublicRegisterPaciente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicPaciente.nombre || !publicPaciente.apellido || !publicPaciente.dni || !publicPaciente.fecha_nacimiento) {
      setPublicError("Por favor completa los campos requeridos (*).");
      return;
    }
    try {
      setPublicSubmitting(true);
      setPublicError("");

      // Intentar primero vía backend API local
      let res = await fetch(`${API_BASE_URL}/pacientes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(publicPaciente)
      }).catch(() => null);

      // Si la API local no respondió (ej. en Vercel), enviar directamente a Supabase Cloud
      if (!res || !res.ok) {
        const SUPABASE_URL = "https://qvutqqfsypzcfjhhzqsk.supabase.co";
        const SUPABASE_KEY = "sb_publishable_KT61xj__yMLdxD37Wc5Teg_RFfQz6Rm";
        res = await fetch(`${SUPABASE_URL}/rest/v1/pacientes`, {
          method: "POST",
          headers: {
            "apikey": SUPABASE_KEY,
            "Authorization": `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
            "Prefer": "return=representation"
          },
          body: JSON.stringify(publicPaciente)
        });
      }

      if (res.ok) {
        setPublicSuccess(true);
      } else {
        const errData = await res.json().catch(() => ({}));
        if (errData.code === "23505" || (errData.message && errData.message.includes("unique constraint"))) {
          setPublicError(`Ya existe un paciente registrado con el DNI '${publicPaciente.dni}'.`);
        } else {
          setPublicError(errData.detail || errData.message || "No se pudo registrar. Verificá si el DNI ya existe.");
        }
      }
    } catch {
      setPublicError("Error de conexión con el servidor.");
    } finally {
      setPublicSubmitting(false);
    }
  };

  const handleTriggerPrintQrPoster = () => {
    setIsPrintingQrPoster(true);
    document.body.classList.add("printing-qr-poster");

    const cleanup = () => {
      document.body.classList.remove("printing-qr-poster");
      setIsPrintingQrPoster(false);
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);

    setTimeout(() => {
      window.print();
    }, 200);
  };

  // --- Estados de importación de PDF ---
  const [importingPdf, setImportingPdf] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<{
    texto: string;
    paginas: number;
    estructurado?: {
      motivo?: string;
      diagnostico?: string;
      tratamiento?: string;
      observaciones?: string;
    };
    modoVista?: "estructurado" | "raw";
  } | null>(null);

  // --- Estado de Firma (Caché invalidation) ---
  const [signatureKey, setSignatureKey] = useState(Date.now());

  // Estados de formularios originales
  const [newPaciente, setNewPaciente] = useState({
    nombre: "",
    apellido: "",
    dni: "",
    fecha_nacimiento: "",
    telefono: "",
    email: "",
    direccion: "",
    obra_social: "",
    numero_afiliado: "",
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

  // Al arrancar: verificar el estado de autenticación del backend
  useEffect(() => {
    initApp();
  }, []);

  // Latido continuo de conexión (heartbeat) para mantener el backend activo
  useEffect(() => {
    const hbInterval = setInterval(() => {
      fetch(`${API_BASE_URL}/heartbeat`, { method: "POST" }).catch(() => {});
    }, 2500);
    return () => clearInterval(hbInterval);
  }, []);

  // Cuando ya está listo, recargar pacientes al cambiar búsqueda
  useEffect(() => {
    if (appState === "ready") {
      checkApiAndLoad();
    }
  }, [searchTerm, appState]);

  const initApp = async () => {
    try {
      const storedUser = localStorage.getItem("history_ar_user");
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          setCurrentUsuario(parsed);
          setConfiguracion(prev => ({
            ...prev,
            doctor_nombre: parsed.nombre || "",
            doctor_especialidad: parsed.especialidad || "",
            doctor_matricula: parsed.matricula || ""
          }));
          setAppState("ready");
          setApiOnline(true);
          return;
        } catch {
          localStorage.removeItem("history_ar_user");
        }
      }

      const healthRes = await fetch(`${API_BASE_URL}/health`);
      if (!healthRes.ok) {
        setAppState("ready");
        setApiOnline(false);
        return;
      }
      setApiOnline(true);

      const authRes = await fetch(`${API_BASE_URL}/auth/estado`);
      if (authRes.ok) {
        const authData = await authRes.json();
        if (!authData.primer_inicio_completado) {
          setAuthMode("register");
        } else {
          setAuthMode("login");
        }
        setAppState("login");
      } else {
        setAppState("login");
      }
    } catch {
      setApiOnline(false);
      setAppState("ready");
    }
  };

  // Handler de Login por Nombre y Número de Matrícula
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginNombre.trim() || !loginMatricula.trim()) {
      setLoginError("Por favor ingresá tu nombre y número de matrícula.");
      return;
    }
    try {
      setLoginLoading(true);
      setLoginError("");
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: loginNombre.trim(),
          matricula: loginMatricula.trim(),
          password: loginPassword || undefined
        })
      });

      if (res.ok) {
        const data = await res.json();
        const user = data.usuario;
        setCurrentUsuario(user);
        localStorage.setItem("history_ar_user", JSON.stringify(user));
        setConfiguracion(prev => ({
          ...prev,
          doctor_nombre: user.nombre || "",
          doctor_especialidad: user.especialidad || "",
          doctor_matricula: user.matricula || ""
        }));
        setLoginPassword("");
        setAppState("ready");
      } else {
        const errData = await res.json().catch(() => ({}));
        setLoginError(errData.detail || "Datos incorrectos. Verificá tu Nombre y Matrícula.");
      }
    } catch {
      setLoginError("Error de conexión con la nube Supabase.");
    } finally {
      setLoginLoading(false);
    }
  };

  // Handler de Registro de Usuario Médico
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerNombre.trim() || !registerMatricula.trim()) {
      setLoginError("Por favor ingresá tu nombre completo y número de matrícula.");
      return;
    }
    try {
      setLoginLoading(true);
      setLoginError("");
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: registerNombre.trim(),
          especialidad: registerEspecialidad.trim(),
          matricula: registerMatricula.trim(),
          password: registerPassword || undefined
        })
      });

      if (res.ok) {
        const user = await res.json();
        setCurrentUsuario(user);
        localStorage.setItem("history_ar_user", JSON.stringify(user));
        setConfiguracion(prev => ({
          ...prev,
          doctor_nombre: user.nombre || "",
          doctor_especialidad: user.especialidad || "",
          doctor_matricula: user.matricula || ""
        }));
        setAppState("ready");
      } else {
        const errData = await res.json().catch(() => ({}));
        setLoginError(errData.detail || "Error al registrar el usuario.");
      }
    } catch {
      setLoginError("Error de conexión al guardar el usuario en Supabase.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("history_ar_user");
    setCurrentUsuario(null);
    setAppState("login");
  };

  // Handler de Cambio de Contraseña (desde Configuración)
  const handleCambiarPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);
    if (!passwordForm.password_actual || !passwordForm.password_nueva) {
      setPasswordMsg({ type: "err", text: "Completá todos los campos." }); return;
    }
    if (passwordForm.password_nueva !== passwordForm.password_confirm) {
      setPasswordMsg({ type: "err", text: "La nueva contraseña y su confirmación no coinciden." }); return;
    }
    if (passwordForm.password_nueva.length < 6) {
      setPasswordMsg({ type: "err", text: "La nueva contraseña debe tener al menos 6 caracteres." }); return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/auth/cambiar-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password_actual: passwordForm.password_actual,
          password_nueva: passwordForm.password_nueva
        })
      });
      if (res.ok) {
        setPasswordMsg({ type: "ok", text: "✓ Contraseña actualizada con éxito." });
        setPasswordForm({ password_actual: "", password_nueva: "", password_confirm: "" });
        setShowPasswordFields(false);
      } else {
        setPasswordMsg({ type: "err", text: "La contraseña actual es incorrecta." });
      }
    } catch {
      setPasswordMsg({ type: "err", text: "Error de conexión." });
    }
  };

  // Handler de Toggle "Pedir contraseña al iniciar"
  const handleTogglePasswordLogin = async (nuevoValor: boolean) => {
    try {
      const res = await fetch(`${API_BASE_URL}/configuracion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedir_password_al_iniciar: nuevoValor })
      });
      if (res.ok) {
        setConfiguracion(prev => ({ ...prev, pedir_password_al_iniciar: nuevoValor }));
      }
    } catch { /* silencioso */ }
  };

  // Handler de Importar PDF como Consulta
  const handleImportarPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedPaciente || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);
    try {
      setImportingPdf(true);
      const res = await fetch(`${API_BASE_URL}/pdf/extraer-texto`, {
        method: "POST",
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        setPdfPreview({
          texto: data.texto,
          paginas: data.paginas,
          estructurado: data.estructurado || {
            motivo: "",
            diagnostico: data.texto,
            tratamiento: "",
            observaciones: ""
          },
          modoVista: "estructurado"
        });
      } else {
        const err = await res.json();
        alert(`Error al procesar el PDF: ${err.detail || "Inténtalo de nuevo."}`);
      }
    } catch {
      alert("Error de conexión al procesar el PDF.");
    } finally {
      setImportingPdf(false);
      e.target.value = "";
    }
  };

  // Confirmar importación de PDF → cargar en formulario de nueva consulta
  const handleConfirmarPdfImport = () => {
    if (!pdfPreview) return;
    const est = pdfPreview.estructurado;
    setNewConsulta({
      motivo: est?.motivo?.trim() || "Historia clínica importada de PDF",
      diagnostico: est?.diagnostico?.trim() || pdfPreview.texto,
      tratamiento: est?.tratamiento?.trim() || "",
      notas: est?.observaciones?.trim() || ""
    });
    setPdfPreview(null);
    // Navegar a la pestaña de consultas para que el médico revise y guarde
    setPatientSubTab("consultas");
  };

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
        // Cargar citas y configuración
        loadCitas();
        loadConfiguracion();
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

  // Cargar Citas
  const loadCitas = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/citas`);
      if (res.ok) {
        const data = await res.json();
        setCitas(data);
      }
    } catch (err) {
      console.error("Error al cargar citas", err);
    }
  };

  // Cargar Configuración
  const loadConfiguracion = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/configuracion`);
      if (res.ok) {
        const data = await res.json();
        setConfiguracion(data);
        setDoctorForm({
          doctor_nombre: data.doctor_nombre || "",
          doctor_especialidad: data.doctor_especialidad || "",
          doctor_matricula: data.doctor_matricula || ""
        });
      }
    } catch (err) {
      console.error("Error al cargar configuracion", err);
    }
  };

  // Cargar detalles de un paciente específico (con consultas, documentos, recetas)
  const handleSelectPaciente = async (id: number) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/pacientes/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedPaciente(data);
      } else {
        alert("No se pudo cargar la información del paciente seleccionada.");
      }
    } catch (err) {
      console.error("Error al cargar detalles del paciente", err);
      alert("Error de conexión al cargar el paciente. Verifica que el servidor esté activo.");
    } finally {
      setLoading(false);
    }
  };

  // Guardar configuración de datos del doctor
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/configuracion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(doctorForm)
      });
      if (res.ok) {
        alert("Configuración del médico guardada con éxito");
        loadConfiguracion();
      } else {
        alert("Error al guardar la configuración");
      }
    } catch (err) {
      alert("Error de conexión");
    }
  };

  // Subir la firma escaneada del médico
  const handleUploadSignature = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE_URL}/configuracion/firma`, {
        method: "POST",
        body: formData
      });
      if (res.ok) {
        alert("Firma/Sello cargado con éxito");
        setSignatureKey(Date.now());
        loadConfiguracion();
      } else {
        alert("Error al subir la firma");
      }
    } catch (err) {
      alert("Error de conexión");
    } finally {
      e.target.value = "";
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
          obra_social: "",
          numero_afiliado: "",
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
        handleSelectPaciente(selectedPaciente.id);
      } else {
        alert("Error al guardar la consulta");
      }
    } catch (err) {
      alert("Error de conexión al guardar la consulta");
    }
  };

  // Crear Receta
  const handleCreateReceta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPaciente) return;
    if (!newReceta.medicamentos) {
      alert("Por favor detalla al menos un medicamento.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/recetas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newReceta,
          paciente_id: selectedPaciente.id
        })
      });
      if (res.ok) {
        alert("Receta médica registrada en la ficha");
        setNewReceta({ medicamentos: "", indicaciones: "" });
        handleSelectPaciente(selectedPaciente.id);
      } else {
        alert("Error al guardar la receta");
      }
    } catch (err) {
      alert("Error de conexión al registrar la receta");
    }
  };

  // Eliminar Receta
  const handleDeleteReceta = async (id: number) => {
    if (!selectedPaciente) return;
    if (!confirm("¿Deseas eliminar permanentemente esta receta?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/recetas/${id}`, { method: "DELETE" });
      if (res.ok) {
        alert("Receta eliminada");
        handleSelectPaciente(selectedPaciente.id);
      } else {
        alert("Error al eliminar");
      }
    } catch (err) {
      alert("Error de conexión");
    }
  };

  // Imprimir Receta (Formato receta médica)
  const handlePrintReceta = (receta: Receta) => {
    if (!selectedPaciente) return;
    setPrintRecipeData({
      paciente: selectedPaciente,
      receta: receta
    });
    document.body.classList.add("printing-recipe");

    const cleanup = () => {
      document.body.classList.remove("printing-recipe");
      setPrintRecipeData(null);
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);

    setTimeout(() => {
      window.print();
    }, 200);
  };

  // Subir Archivo Adjunto
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
        handleSelectPaciente(selectedPaciente.id);
      } else {
        const errorData = await res.json();
        alert(`Error al subir: ${errorData.detail || "Inténtalo de nuevo"}`);
      }
    } catch (err) {
      alert("Error de conexión al intentar subir el archivo");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  // Digitalizar documento con escáner
  const handleScanDocument = async () => {
    if (!selectedPaciente) return;
    try {
      setScanning(true);
      const res = await fetch(`${API_BASE_URL}/pacientes/${selectedPaciente.id}/documentos/escanear`, {
        method: "POST"
      });
      if (res.ok) {
        alert("Documento digitalizado y guardado");
        handleSelectPaciente(selectedPaciente.id);
      } else {
        const errorData = await res.json();
        alert(`Error al escanear: ${errorData.detail || "Asegúrate de tener un escáner encendido"}`);
      }
    } catch (err) {
      alert("Error de conexión con el escáner");
    } finally {
      setScanning(false);
    }
  };

  // Eliminar Documento
  const handleDeleteDocument = async (docId: number) => {
    if (!selectedPaciente) return;
    if (!confirm("¿Deseas eliminar este documento?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/documentos/${docId}`, { method: "DELETE" });
      if (res.ok) {
        alert("Documento eliminado");
        handleSelectPaciente(selectedPaciente.id);
      } else {
        alert("Error al eliminar");
      }
    } catch (err) {
      alert("Error de conexión");
    }
  };

  // Crear Cita / Turno
  const handleCreateCita = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCita.paciente_id || !newCita.fecha || !newCita.hora || !newCita.motivo) {
      alert("Por favor completa todos los campos requeridos para el turno.");
      return;
    }

    // Combinar fecha y hora
    const combinedDateTime = new Date(`${newCita.fecha}T${newCita.hora}`).toISOString();

    try {
      const res = await fetch(`${API_BASE_URL}/citas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paciente_id: parseInt(newCita.paciente_id),
          fecha_hora: combinedDateTime,
          duracion_minutos: newCita.duracion_minutos,
          motivo: newCita.motivo,
          estado: "programado"
        })
      });

      if (res.ok) {
        const citaData = await res.json();
        const pacienteTarget = pacientes.find(p => p.id === parseInt(newCita.paciente_id));
        setNewCita({ paciente_id: "", fecha: "", hora: "", duracion_minutos: 30, motivo: "" });
        loadCitas();
        setEmailStatusMsg(null);
        setNotificationModal({ cita: citaData, paciente: pacienteTarget });
      } else {
        alert("Error al programar el turno");
      }
    } catch (err) {
      alert("Error de conexión");
    }
  };

  // Actualizar Estado de Cita (Atender o Cancelar)
  const handleUpdateCitaEstado = async (id: number, estado: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/citas/${id}?estado=${estado}`, {
        method: "PUT"
      });
      if (res.ok) {
        loadCitas();
      }
    } catch (err) {
      console.error("Error al actualizar turno", err);
    }
  };

  // Atender Turno (Flujo automático)
  const handleAttendCita = async (cita: Cita) => {
    // 1. Marcar cita como completada
    await handleUpdateCitaEstado(cita.id, "completada");
    
    // 2. Pre-llenar el motivo en el formulario de nueva consulta
    setNewConsulta({
      motivo: cita.motivo,
      diagnostico: "",
      tratamiento: "",
      notas: ""
    });

    // 3. Seleccionar paciente y navegar a consultas clínicas
    await handleSelectPaciente(cita.paciente_id);
    setPatientSubTab("consultas");
    setActiveTab("pacientes");
  };

  // Eliminar Cita de la agenda
  const handleDeleteCita = async (id: number) => {
    if (!confirm("¿Deseas eliminar permanentemente esta cita de la agenda?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/citas/${id}`, { method: "DELETE" });
      if (res.ok) {
        alert("Cita eliminada");
        loadCitas();
      }
    } catch (err) {
      alert("Error al eliminar cita");
    }
  };

  // Eliminar Paciente completo
  const handleDeletePaciente = async (id: number) => {
    if (!confirm("¿Deseas eliminar permanentemente a este paciente y todo su historial clínico (consultas, recetas y documentos adjuntos)? Esta acción es irreversible.")) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/pacientes/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        alert("Paciente eliminado correctamente.");
        setSelectedPaciente(null);
        checkApiAndLoad();
      } else {
        alert("Error al eliminar al paciente.");
      }
    } catch (err) {
      alert("Error de conexión");
    }
  };

  // Descargar Backup (.zip)
  const handleDownloadBackup = () => {
    window.open(`${API_BASE_URL.replace("/api", "")}/api/backup`);
  };

  // Restaurar Backup (.zip)
  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    if (!confirm("¡ATENCIÓN! La restauración de copia reemplazará TODA la base de datos actual y los archivos subidos. La aplicación se recargará automáticamente al finalizar. ¿Deseas proceder?")) {
      e.target.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setRestoring(true);
      const res = await fetch(`${API_BASE_URL}/restore`, {
        method: "POST",
        body: formData
      });
      if (res.ok) {
        alert("Copia de seguridad restaurada correctamente. Recargando la aplicación...");
        window.location.reload();
      } else {
        const errorData = await res.json();
        alert(`Error al restaurar: ${errorData.detail || "Verifica que el archivo zip sea válido"}`);
      }
    } catch (err) {
      alert("Error de conexión al restaurar el respaldo");
    } finally {
      setRestoring(false);
      e.target.value = "";
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

  useEffect(() => {
    if (patientSubTab === "imprimir") {
      applyDateFilter();
    }
  }, [printStartDate, printEndDate]);

  const togglePrintConsultation = (id: number) => {
    const next = new Set(selectedPrintConsultations);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedPrintConsultations(next);
  };

  const selectAllConsultations = () => {
    if (!selectedPaciente?.consultas) return;
    setSelectedPrintConsultations(new Set(selectedPaciente.consultas.map(c => c.id)));
  };

  const deselectAllConsultations = () => {
    setSelectedPrintConsultations(new Set());
  };

  // Lanzar el cuadro de impresión de historia clínica
  const handleTriggerPrint = () => {
    if (!selectedPaciente) return;
    const selectedList = (selectedPaciente.consultas || []).filter(c => 
      selectedPrintConsultations.has(c.id)
    );

    if (selectedList.length === 0) {
      alert("Por favor, selecciona al menos una consulta médica para realizar la impresión.");
      return;
    }

    const sortedList = [...selectedList].sort(
      (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
    );

    setPrintData({
      paciente: selectedPaciente,
      consultas: sortedList
    });

    document.body.classList.add("printing-history");

    const cleanup = () => {
      document.body.classList.remove("printing-history");
      setPrintData(null);
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);

    setTimeout(() => {
      window.print();
    }, 200);
  };

  // --- Vista Pública de Auto-Registro en Celulares por Código QR ---
  if (isPublicRegisterMode) {
    return (
      <div className="public-register-bg" style={{ minHeight: "100vh", background: "linear-gradient(135deg, #eef2f7 0%, #e0f2fe 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.5rem 1rem", fontFamily: "'Inter', system-ui, -apple-system, sans-serif", boxSizing: "content-box" }}>
        <div className="public-register-card" style={{ background: "#ffffff", borderRadius: "20px", boxShadow: "0 12px 35px rgba(0, 0, 0, 0.08)", padding: "2.25rem 2rem", width: "95%", maxWidth: "540px", border: "1px solid rgba(226, 232, 240, 0.8)", boxSizing: "content-box", margin: "0 auto", overflow: "hidden" }}>
          <div className="public-register-header" style={{ textAlign: "center", marginBottom: "1.75rem" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.4rem" }}>🏥</div>
            <h1 style={{ fontSize: "1.45rem", color: "#0f172a", marginBottom: "0.35rem", fontWeight: 700 }}>{configuracion.doctor_nombre || currentUsuario?.nombre || "Consultorio Médico"}</h1>
            <p style={{ fontSize: "0.88rem", color: "#64748b", lineHeight: 1.4 }}>Registro de Pacientes para Ingreso a Sala de Espera</p>
          </div>

          {publicSuccess ? (
            <div className="public-success-card" style={{ textAlign: "center", padding: "1rem 0" }}>
              <div className="public-success-icon" style={{ width: "72px", height: "72px", background: "#dcfce7", color: "#16a34a", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.5rem", margin: "0 auto 1.25rem auto" }}>✓</div>
              <h2 style={{ fontSize: "1.25rem", color: "#15803d", marginBottom: "0.5rem", fontWeight: 700 }}>¡Registro Completado con Éxito!</h2>
              <p style={{ fontSize: "0.9rem", color: "#475569", lineHeight: 1.5, marginBottom: "1.5rem" }}>
                Tus datos fueron registrados correctamente en el sistema del consultorio. Por favor tomá asiento en la sala de espera, el profesional te llamará a la brevedad.
              </p>
              <button 
                className="btn btn-secondary" 
                style={{ width: "100%", padding: "0.8rem", borderRadius: "10px", border: "1px solid #cbd5e1", background: "#f8fafc", color: "#334155", fontWeight: 600, cursor: "pointer" }}
                onClick={() => {
                  setPublicPaciente({
                    nombre: "", apellido: "", dni: "", fecha_nacimiento: "",
                    telefono: "", email: "", direccion: "", obra_social: "",
                    numero_afiliado: "", notas_generales: ""
                  });
                  setPublicSuccess(false);
                  setPublicError("");
                }}
              >
                + Registrar a otro paciente / familiar
              </button>
            </div>
          ) : (
            <form onSubmit={handlePublicRegisterPaciente}>
              {publicError && (
                <div style={{ padding: "0.75rem", borderRadius: "8px", background: "rgba(239, 68, 68, 0.1)", color: "rgb(239, 68, 68)", border: "1px solid rgba(239, 68, 68, 0.3)", fontSize: "0.85rem", marginBottom: "1rem" }}>
                  ⚠️ {publicError}
                </div>
              )}

              {/* Fila 1: Nombre | Apellido */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem", width: "100%", marginBottom: "0.85rem", boxSizing: "border-box" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", width: "100%", minWidth: 0, overflow: "hidden", boxSizing: "border-box" }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#64748b" }}>Nombre *</label>
                  <input
                    type="text"
                    style={{ width: "100%", minWidth: 0, maxWidth: "100%", boxSizing: "border-box", background: "#0e1726", color: "#ffffff", border: "none", borderRadius: "10px", padding: "0.75rem 0.9rem", fontSize: "0.9rem", outline: "none" }}
                    placeholder="Ej. María"
                    value={publicPaciente.nombre}
                    onChange={(e) => setPublicPaciente({ ...publicPaciente, nombre: e.target.value })}
                    required
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", width: "100%", minWidth: 0, overflow: "hidden", boxSizing: "border-box" }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#64748b" }}>Apellido *</label>
                  <input
                    type="text"
                    style={{ width: "100%", minWidth: 0, maxWidth: "100%", boxSizing: "border-box", background: "#0e1726", color: "#ffffff", border: "none", borderRadius: "10px", padding: "0.75rem 0.9rem", fontSize: "0.9rem", outline: "none" }}
                    placeholder="Ej. Gómez"
                    value={publicPaciente.apellido}
                    onChange={(e) => setPublicPaciente({ ...publicPaciente, apellido: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Fila 2: DNI | Fecha Nacimiento */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem", width: "100%", marginBottom: "0.85rem", boxSizing: "border-box" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", width: "100%", minWidth: 0, overflow: "hidden", boxSizing: "border-box" }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#64748b" }}>DNI / Documento *</label>
                  <input
                    type="text"
                    style={{ width: "100%", minWidth: 0, maxWidth: "100%", boxSizing: "border-box", background: "#0e1726", color: "#ffffff", border: "none", borderRadius: "10px", padding: "0.75rem 0.9rem", fontSize: "0.9rem", outline: "none" }}
                    placeholder="Sin puntos"
                    value={publicPaciente.dni}
                    onChange={(e) => setPublicPaciente({ ...publicPaciente, dni: e.target.value })}
                    required
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", width: "100%", minWidth: 0, overflow: "hidden", boxSizing: "border-box" }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#64748b" }}>Fecha Nac. *</label>
                  <input
                    type="date"
                    style={{ width: "100%", minWidth: 0, maxWidth: "100%", boxSizing: "border-box", background: "#0e1726", color: "#ffffff", border: "none", borderRadius: "10px", padding: "0.75rem 0.9rem", fontSize: "0.9rem", outline: "none", colorScheme: "dark" }}
                    value={publicPaciente.fecha_nacimiento}
                    onChange={(e) => setPublicPaciente({ ...publicPaciente, fecha_nacimiento: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Fila 3: Teléfono | Email */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem", width: "100%", marginBottom: "0.85rem", boxSizing: "border-box" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", width: "100%", minWidth: 0, overflow: "hidden", boxSizing: "border-box" }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#64748b" }}>Teléfono / WhatsApp</label>
                  <input
                    type="text"
                    style={{ width: "100%", minWidth: 0, maxWidth: "100%", boxSizing: "border-box", background: "#0e1726", color: "#ffffff", border: "none", borderRadius: "10px", padding: "0.75rem 0.9rem", fontSize: "0.9rem", outline: "none" }}
                    placeholder="Ej. 1123456789"
                    value={publicPaciente.telefono}
                    onChange={(e) => setPublicPaciente({ ...publicPaciente, telefono: e.target.value })}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", width: "100%", minWidth: 0, overflow: "hidden", boxSizing: "border-box" }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#64748b" }}>Email</label>
                  <input
                    type="email"
                    style={{ width: "100%", minWidth: 0, maxWidth: "100%", boxSizing: "border-box", background: "#0e1726", color: "#ffffff", border: "none", borderRadius: "10px", padding: "0.75rem 0.9rem", fontSize: "0.9rem", outline: "none" }}
                    placeholder="tu@email.com"
                    value={publicPaciente.email}
                    onChange={(e) => setPublicPaciente({ ...publicPaciente, email: e.target.value })}
                  />
                </div>
              </div>

              {/* Fila 4: Obra Social | N° Afiliado */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem", width: "100%", marginBottom: "0.85rem", boxSizing: "border-box" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", width: "100%", minWidth: 0, overflow: "hidden", boxSizing: "border-box" }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#64748b" }}>Obra Social / Cobertura</label>
                  <input
                    type="text"
                    style={{ width: "100%", minWidth: 0, maxWidth: "100%", boxSizing: "border-box", background: "#0e1726", color: "#ffffff", border: "none", borderRadius: "10px", padding: "0.75rem 0.9rem", fontSize: "0.9rem", outline: "none" }}
                    placeholder="Ej. OSDE, Particular"
                    value={publicPaciente.obra_social}
                    onChange={(e) => setPublicPaciente({ ...publicPaciente, obra_social: e.target.value })}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", width: "100%", minWidth: 0, overflow: "hidden", boxSizing: "border-box" }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#64748b" }}>N° Afiliado</label>
                  <input
                    type="text"
                    style={{ width: "100%", minWidth: 0, maxWidth: "100%", boxSizing: "border-box", background: "#0e1726", color: "#ffffff", border: "none", borderRadius: "10px", padding: "0.75rem 0.9rem", fontSize: "0.9rem", outline: "none" }}
                    placeholder="Opcional"
                    value={publicPaciente.numero_afiliado}
                    onChange={(e) => setPublicPaciente({ ...publicPaciente, numero_afiliado: e.target.value })}
                  />
                </div>
              </div>

              {/* Fila 5: Motivo de consulta (Full Width) */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", width: "100%", marginBottom: "1.25rem", boxSizing: "border-box" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#64748b" }}>Motivo de Consulta / Antecedentes</label>
                <textarea
                  rows={3}
                  style={{ width: "100%", minWidth: 0, maxWidth: "100%", boxSizing: "border-box", background: "#0e1726", color: "#ffffff", border: "none", borderRadius: "10px", padding: "0.75rem 0.9rem", fontSize: "0.9rem", outline: "none", resize: "none" }}
                  placeholder="Ej. Chequeo anual, dolor de garganta..."
                  value={publicPaciente.notas_generales}
                  onChange={(e) => setPublicPaciente({ ...publicPaciente, notas_generales: e.target.value })}
                />
              </div>

              {/* Fila 6: Botón Cyan Confirmar Registro */}
              <button 
                type="submit" 
                style={{ width: "100%", background: "#00b8d4", color: "#ffffff", fontWeight: 700, fontSize: "1rem", borderRadius: "10px", padding: "0.85rem 1.5rem", border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(0, 184, 212, 0.3)", marginTop: "0.25rem", transition: "all 0.2s ease" }} 
                disabled={publicSubmitting}
              >
                {publicSubmitting ? "Registrando..." : "✅ Confirmar Registro"}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // --- Pantalla de verificación / login ---
  if (appState === "checking") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", fontFamily: "'Inter', sans-serif" }}>
        <div style={{ textAlign: "center", color: "#64748b" }}>
          <p style={{ fontSize: "0.95rem", fontWeight: 500 }}>Iniciando History-Ar...</p>
        </div>
      </div>
    );
  }

  if (appState === "login") {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8fafc",
        fontFamily: "'Inter', sans-serif",
        padding: "1rem"
      }}>
        <div style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "16px",
          padding: "2.5rem 2rem",
          width: "100%",
          maxWidth: "420px",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)"
        }}>
          {/* Logo y Encabezado */}
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            <div style={{
              width: "56px",
              height: "56px",
              borderRadius: "14px",
              background: "var(--primary, #008080)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.75rem",
              fontWeight: "bold",
              margin: "0 auto 1rem",
              boxShadow: "0 4px 12px rgba(0, 128, 128, 0.25)"
            }}>H</div>
            <h1 style={{ color: "#0f172a", fontSize: "1.4rem", fontWeight: 700, margin: 0 }}>History-Ar Cloud</h1>
            <p style={{ color: "#64748b", fontSize: "0.85rem", marginTop: "0.25rem" }}>Base de datos en la nube (Supabase)</p>

            {/* Selector de Pestañas Login / Registro */}
            <div style={{
              display: "flex",
              gap: "8px",
              marginTop: "1.25rem",
              background: "#f1f5f9",
              padding: "4px",
              borderRadius: "8px"
            }}>
              <button
                type="button"
                onClick={() => { setAuthMode("login"); setLoginError(""); }}
                style={{
                  flex: 1,
                  padding: "6px 12px",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  background: authMode === "login" ? "#ffffff" : "transparent",
                  color: authMode === "login" ? "var(--primary, #008080)" : "#64748b",
                  boxShadow: authMode === "login" ? "0 1px 3px rgba(0,0,0,0.1)" : "none"
                }}
              >
                Iniciar Sesión
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode("register"); setLoginError(""); }}
                style={{
                  flex: 1,
                  padding: "6px 12px",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  background: authMode === "register" ? "#ffffff" : "transparent",
                  color: authMode === "register" ? "var(--primary, #008080)" : "#64748b",
                  boxShadow: authMode === "register" ? "0 1px 3px rgba(0,0,0,0.1)" : "none"
                }}
              >
                Registrar Usuario
              </button>
            </div>
          </div>

          {/* Formulario de Login */}
          {authMode === "login" ? (
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", color: "#334155", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                  Nombre del Médico / Usuario
                </label>
                <input
                  type="text"
                  value={loginNombre}
                  onChange={(e) => setLoginNombre(e.target.value)}
                  placeholder="ej. Dr. Juan Pérez"
                  autoFocus
                  style={{
                    width: "100%",
                    padding: "0.75rem 0.85rem",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    fontSize: "0.95rem",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", color: "#334155", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                  Número de Matrícula
                </label>
                <input
                  type="text"
                  value={loginMatricula}
                  onChange={(e) => setLoginMatricula(e.target.value)}
                  placeholder="ej. MP 12345"
                  style={{
                    width: "100%",
                    padding: "0.75rem 0.85rem",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    fontSize: "0.95rem",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ display: "block", color: "#334155", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                  Contraseña (opcional)
                </label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Contraseña (si registraste una)"
                  style={{
                    width: "100%",
                    padding: "0.75rem 0.85rem",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    fontSize: "0.95rem",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              {loginError && (
                <div style={{
                  color: "#b91c1c",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "6px",
                  padding: "0.5rem 0.75rem",
                  fontSize: "0.825rem",
                  marginBottom: "1rem"
                }}>
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  background: loginLoading ? "#94a3b8" : "var(--primary, #008080)",
                  border: "none",
                  borderRadius: "8px",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: "0.95rem",
                  cursor: loginLoading ? "not-allowed" : "pointer"
                }}
              >
                {loginLoading ? "Verificando en Supabase..." : "Iniciar Sesión"}
              </button>
            </form>
          ) : (
            /* Formulario de Registro */
            <form onSubmit={handleRegister}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", color: "#334155", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  value={registerNombre}
                  onChange={(e) => setRegisterNombre(e.target.value)}
                  placeholder="ej. Dr. Carlos Rossi"
                  required
                  style={{
                    width: "100%",
                    padding: "0.75rem 0.85rem",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    fontSize: "0.95rem",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", color: "#334155", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                  Especialidad Médica
                </label>
                <input
                  type="text"
                  value={registerEspecialidad}
                  onChange={(e) => setRegisterEspecialidad(e.target.value)}
                  placeholder="ej. Medicina General, Pediatría"
                  style={{
                    width: "100%",
                    padding: "0.75rem 0.85rem",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    fontSize: "0.95rem",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", color: "#334155", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                  Número de Matrícula *
                </label>
                <input
                  type="text"
                  value={registerMatricula}
                  onChange={(e) => setRegisterMatricula(e.target.value)}
                  placeholder="ej. MP 98765"
                  required
                  style={{
                    width: "100%",
                    padding: "0.75rem 0.85rem",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    fontSize: "0.95rem",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ display: "block", color: "#334155", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                  Contraseña de Seguridad (opcional)
                </label>
                <input
                  type="password"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  placeholder="Contraseña para proteger la cuenta"
                  style={{
                    width: "100%",
                    padding: "0.75rem 0.85rem",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    fontSize: "0.95rem",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              {loginError && (
                <div style={{
                  color: "#b91c1c",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "6px",
                  padding: "0.5rem 0.75rem",
                  fontSize: "0.825rem",
                  marginBottom: "1rem"
                }}>
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  background: loginLoading ? "#94a3b8" : "var(--primary, #008080)",
                  border: "none",
                  borderRadius: "8px",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: "0.95rem",
                  cursor: loginLoading ? "not-allowed" : "pointer"
                }}
              >
                {loginLoading ? "Guardando en Supabase..." : "Crear Cuenta y Conectar"}
              </button>
            </form>
          )}

          <p style={{ textAlign: "center", color: "#94a3b8", fontSize: "0.78rem", marginTop: "1.5rem", marginBottom: 0 }}>
            History-Ar Cloud — Sincronizado con Supabase PostgreSQL
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Sidebar de Navegación */}
      <aside className="sidebar">
        <div className="logo-container">
          <div className="logo-icon">H</div>
          <span className="logo-text">History-Ar</span>
        </div>

        {/* Card de Usuario en Sesión */}
        {currentUsuario && (
          <div style={{
            margin: "0 0 1.25rem 0",
            padding: "0.9rem 1rem",
            background: "linear-gradient(135deg, #f0fdfa 0%, #e0f2fe 100%)",
            border: "1px solid #ccfbf1",
            borderRadius: "12px",
            boxShadow: "0 4px 12px rgba(13, 148, 136, 0.08)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <div style={{
                width: "24px",
                height: "24px",
                borderRadius: "6px",
                background: "#dc2626",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "900",
                fontSize: "1.05rem",
                boxShadow: "0 2px 6px rgba(220, 38, 38, 0.3)"
              }}>✚</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "#0f172a", lineHeight: "1.2" }}>
                  {currentUsuario.nombre}
                </div>
                {currentUsuario.especialidad ? (
                  <div style={{ fontSize: "0.75rem", color: "#0f766e", fontWeight: 500 }}>
                    {currentUsuario.especialidad}
                  </div>
                ) : (
                  <div style={{ fontSize: "0.75rem", color: "#0f766e", fontWeight: 500 }}>
                    Médico Conectado
                  </div>
                )}
              </div>
            </div>

            <div style={{
              marginTop: "8px",
              padding: "4px 8px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              fontSize: "0.78rem",
              color: "#334155",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <span>Matrícula:</span>
              <strong style={{ color: "#0f172a", fontFamily: "monospace", fontSize: "0.82rem" }}>
                {currentUsuario.matricula}
              </strong>
            </div>

            <button
              onClick={handleLogout}
              style={{
                marginTop: "10px",
                width: "100%",
                padding: "6px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "6px",
                color: "#dc2626",
                fontSize: "0.78rem",
                cursor: "pointer",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                transition: "all 0.2s"
              }}
            >
              🚪 Cerrar Sesión
            </button>
          </div>
        )}
        
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
            <li>
              <button 
                className={`nav-item ${activeTab === "agenda" ? "active" : ""}`}
                onClick={() => setActiveTab("agenda")}
              >
                📅 Agenda y Turnos
              </button>
            </li>
            <li>
              <button 
                className={`nav-item ${activeTab === "configuracion" ? "active" : ""}`}
                onClick={() => setActiveTab("configuracion")}
              >
                ⚙️ Configuración
              </button>
            </li>
          </ul>
        </nav>

        {/* Indicador de estado de API */}
        <div style={{ marginTop: "auto", padding: "10px", borderRadius: "8px", backgroundColor: apiOnline ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)", border: "1px solid", borderColor: apiOnline ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 600, color: apiOnline ? "rgb(16, 185, 129)" : "rgb(239, 68, 68)" }}>
            ● Supabase Cloud: {apiOnline ? "Conectada" : "Desconectada"}
          </span>
        </div>
      </aside>
      
      {/* Panel Principal */}
      <main className="main-panel fade-in">
        {apiOnline === false && (
          <div style={{ backgroundColor: "rgba(245, 158, 11, 0.15)", border: "1px solid rgb(245, 158, 11)", borderRadius: "10px", padding: "15px", marginBottom: "20px", color: "rgb(180, 83, 9)" }}>
            ⚠️ <strong>Servidor de API local no detectado.</strong> Arranca la aplicación en desarrollo usando el script de automatización <code>dev.bat</code> para permitir el guardado de datos.
          </div>
        )}

        {restoring && (
          <div style={{ backgroundColor: "var(--primary-light)", border: "1px solid var(--primary)", borderRadius: "10px", padding: "20px", marginBottom: "20px", color: "var(--primary)", textAlign: "center" }}>
            ⏳ <strong>Restaurando copia de seguridad...</strong> Por favor espera un momento mientras se restablecen las bases de datos locales y archivos.
          </div>
        )}

        {activeTab === "pacientes" && (
          <div>
            {!selectedPaciente ? (
              <div>
                <h2 style={{ marginBottom: "1.5rem" }}>Directorio de Historias Clínicas</h2>
                
                {/* Caja de Búsqueda */}
                <div className="search-bar-header" style={{ display: "flex", gap: "1rem", marginBottom: "2rem" }}>
                  <input
                    type="text"
                    className="form-input"
                    style={{ flex: 1, fontSize: "1.05rem" }}
                    placeholder="Buscar paciente por nombre, apellido o DNI..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <button className="btn btn-secondary" onClick={handleTriggerPrintQrPoster} style={{ borderColor: "rgba(16, 185, 129, 0.4)", color: "#10b981" }}>
                    📱 Cartel QR Puerta
                  </button>
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
                        <p><strong>Obra Social:</strong> {selectedPaciente.obra_social || "Particular"}</p>
                        {selectedPaciente.numero_afiliado && <p><strong>N° Afiliado:</strong> {selectedPaciente.numero_afiliado}</p>}
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
                        <button 
                          className="btn btn-secondary" 
                          style={{ marginTop: "1.5rem", width: "100%", color: "rgb(239, 68, 68)", borderColor: "rgba(239, 68, 68, 0.3)" }}
                          onClick={() => handleDeletePaciente(selectedPaciente.id)}
                        >
                          🗑️ Eliminar Paciente
                        </button>
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
                        className={`btn ${patientSubTab === "recetas" ? "btn-primary" : "btn-secondary"}`}
                        onClick={() => setPatientSubTab("recetas")}
                        style={{ padding: "0.5rem 1.25rem", borderRadius: "8px", fontSize: "0.95rem" }}
                      >
                        📄 Recetas Médicas ({selectedPaciente.recetas?.length || 0})
                      </button>
                      <button 
                        className={`btn ${patientSubTab === "imprimir" ? "btn-primary" : "btn-secondary"}`}
                        onClick={() => setPatientSubTab("imprimir")}
                        style={{ padding: "0.5rem 1.25rem", borderRadius: "8px", fontSize: "0.95rem" }}
                      >
                        🖨️ Imprimir Historia
                      </button>
                      <button 
                        className="btn"
                        onClick={handleOpenCompartirModal}
                        style={{ padding: "0.5rem 1.25rem", borderRadius: "8px", fontSize: "0.95rem", backgroundColor: "#0f766e", color: "#ffffff", border: "none", fontWeight: 600, marginLeft: "auto" }}
                      >
                        ✉️ Compartir con Colega
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
                              disabled={uploading || scanning || importingPdf}
                            >
                              📁 {uploading ? "Subiendo archivo..." : "Cargar Archivo (PDF/Imagen)"}
                            </button>

                            <button 
                              className="btn btn-primary" 
                              onClick={handleScanDocument}
                              disabled={uploading || scanning || importingPdf}
                            >
                              📸 {scanning ? "Iniciando escáner..." : "Escanear Documento Físico"}
                            </button>

                            {/* Botón Importar PDF como consulta */}
                            <input
                              type="file"
                              id="pdf-import-upload"
                              onChange={handleImportarPdf}
                              style={{ display: "none" }}
                              accept=".pdf"
                            />
                            <button
                              id="btn-importar-pdf-consulta"
                              className="btn btn-secondary"
                              onClick={() => document.getElementById("pdf-import-upload")?.click()}
                              disabled={uploading || scanning || importingPdf}
                              style={{ borderColor: "rgba(139,92,246,0.4)", color: "#8b5cf6" }}
                            >
                              📄 {importingPdf ? "Leyendo PDF..." : "Importar PDF como Consulta"}
                            </button>
                          </div>

                          {scanning && (
                            <div style={{ marginTop: "1.5rem", padding: "12px", backgroundColor: "var(--primary-light)", borderRadius: "8px", border: "1px solid var(--primary)", color: "var(--primary)", fontSize: "0.95rem" }}>
                              ⏳ <strong>Conectando con el digitalizador de Windows (WIA)...</strong><br />
                              Por favor selecciona tu escáner y presiona "Escanear" en el diálogo emergente del sistema.
                            </div>
                          )}

                          {/* Modal / preview del PDF importado con Secciones Inteligentes */}
                          {pdfPreview && (
                            <div style={{
                              marginTop: "1.5rem",
                              padding: "1.25rem",
                              background: "rgba(139,92,246,0.07)",
                              border: "1px solid rgba(139,92,246,0.3)",
                              borderRadius: "10px"
                            }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
                                <strong style={{ color: "#8b5cf6", fontSize: "0.95rem" }}>
                                  🧠 Anotador y Parser Inteligente de PDF ({pdfPreview.paginas} {pdfPreview.paginas === 1 ? "página" : "páginas"})
                                </strong>

                                <div style={{ display: "flex", gap: "0.4rem" }}>
                                  <button
                                    className={`btn ${pdfPreview.modoVista !== "raw" ? "btn-primary" : "btn-secondary"}`}
                                    style={{ padding: "0.25rem 0.6rem", fontSize: "0.78rem" }}
                                    onClick={() => setPdfPreview({ ...pdfPreview, modoVista: "estructurado" })}
                                  >
                                    🧩 Secciones divididas
                                  </button>
                                  <button
                                    className={`btn ${pdfPreview.modoVista === "raw" ? "btn-primary" : "btn-secondary"}`}
                                    style={{ padding: "0.25rem 0.6rem", fontSize: "0.78rem" }}
                                    onClick={() => setPdfPreview({ ...pdfPreview, modoVista: "raw" })}
                                  >
                                    📄 Texto completo (Raw)
                                  </button>
                                  <button className="btn btn-secondary" style={{ padding: "0.25rem 0.6rem", fontSize: "0.78rem", color: "#ef4444" }} onClick={() => setPdfPreview(null)}>
                                    ✕ Descartar
                                  </button>
                                </div>
                              </div>

                              {pdfPreview.modoVista === "raw" ? (
                                <div>
                                  <textarea
                                    className="form-input"
                                    rows={8}
                                    style={{ resize: "vertical", fontSize: "0.85rem", fontFamily: "monospace", whiteSpace: "pre-wrap", width: "100%" }}
                                    value={pdfPreview.texto}
                                    onChange={(e) => setPdfPreview({ ...pdfPreview, texto: e.target.value })}
                                  />
                                </div>
                              ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                                  <div>
                                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#4c1d95", marginBottom: "0.2rem" }}>
                                      📋 Motivo de Consulta / Síntomas:
                                    </label>
                                    <input
                                      type="text"
                                      className="form-input"
                                      style={{ width: "100%", fontSize: "0.85rem" }}
                                      value={pdfPreview.estructurado?.motivo || ""}
                                      placeholder="Sin motivo detectado..."
                                      onChange={(e) => setPdfPreview({
                                        ...pdfPreview,
                                        estructurado: { ...pdfPreview.estructurado, motivo: e.target.value }
                                      })}
                                    />
                                  </div>

                                  <div>
                                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#4c1d95", marginBottom: "0.2rem" }}>
                                      🩺 Diagnóstico:
                                    </label>
                                    <textarea
                                      rows={2}
                                      className="form-input"
                                      style={{ width: "100%", fontSize: "0.85rem", resize: "vertical" }}
                                      value={pdfPreview.estructurado?.diagnostico || ""}
                                      placeholder="Sin diagnóstico detectado..."
                                      onChange={(e) => setPdfPreview({
                                        ...pdfPreview,
                                        estructurado: { ...pdfPreview.estructurado, diagnostico: e.target.value }
                                      })}
                                    />
                                  </div>

                                  <div>
                                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#4c1d95", marginBottom: "0.2rem" }}>
                                      💊 Tratamiento / Medicación:
                                    </label>
                                    <textarea
                                      rows={2}
                                      className="form-input"
                                      style={{ width: "100%", fontSize: "0.85rem", resize: "vertical" }}
                                      value={pdfPreview.estructurado?.tratamiento || ""}
                                      placeholder="Sin tratamiento detectado..."
                                      onChange={(e) => setPdfPreview({
                                        ...pdfPreview,
                                        estructurado: { ...pdfPreview.estructurado, tratamiento: e.target.value }
                                      })}
                                    />
                                  </div>

                                  <div>
                                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#4c1d95", marginBottom: "0.2rem" }}>
                                      📝 Observaciones / Evolución:
                                    </label>
                                    <textarea
                                      rows={2}
                                      className="form-input"
                                      style={{ width: "100%", fontSize: "0.85rem", resize: "vertical" }}
                                      value={pdfPreview.estructurado?.observaciones || ""}
                                      placeholder="Sin observaciones detectadas..."
                                      onChange={(e) => setPdfPreview({
                                        ...pdfPreview,
                                        estructurado: { ...pdfPreview.estructurado, observaciones: e.target.value }
                                      })}
                                    />
                                  </div>
                                </div>
                              )}

                              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.75rem", marginBottom: "1rem" }}>
                                💡 Podés revisar y editar los campos divididos. Al confirmar, se cargarán directamente en el formulario de la consulta.
                              </p>
                              <button
                                id="btn-confirmar-pdf-import"
                                className="btn btn-primary"
                                onClick={handleConfirmarPdfImport}
                                style={{ width: "100%" }}
                              >
                                ✅ Cargar Secciones en Nueva Consulta
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Listado de Documentos */}
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
                                      <a href={fileUrl} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ flex: 1, fontSize: "0.85rem", padding: "0.5rem", textAlign: "center" }}>
                                        👁️ Abrir
                                      </a>
                                      <button onClick={() => handleDeleteDocument(doc.id)} className="btn btn-secondary" style={{ flex: 1, fontSize: "0.85rem", padding: "0.5rem", color: "rgb(239, 68, 68)", borderColor: "rgba(239, 68, 68, 0.3)" }}>
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

                    {/* Contenido Pestaña 3: Recetas Médicas (Fase 2) */}
                    {patientSubTab === "recetas" && (
                      <div style={{ marginTop: "1rem" }} className="agenda-grid">
                        {/* Redactar Receta */}
                        <div className="card">
                          <h3 style={{ marginBottom: "1.25rem", color: "var(--primary)" }}>Emitir Nueva Receta</h3>
                          <form onSubmit={handleCreateReceta}>
                            <div className="form-group">
                              <label className="form-label">Medicamentos y Posología *</label>
                              <textarea
                                className="form-input"
                                rows={6}
                                placeholder="Ej.&#10;- Amoxicilina 500mg: 1 comprimido cada 8hs por 7 días.&#10;- Paracetamol 1g: 1 comprimido cada 8hs en caso de fiebre."
                                value={newReceta.medicamentos}
                                onChange={(e) => setNewReceta({ ...newReceta, medicamentos: e.target.value })}
                                required
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Indicaciones Adicionales / Dieta / Reposo</label>
                              <textarea
                                className="form-input"
                                rows={3}
                                placeholder="Ej. Tomar abundante agua, reposo físico por 48 horas."
                                value={newReceta.indicaciones}
                                onChange={(e) => setNewReceta({ ...newReceta, indicaciones: e.target.value })}
                              />
                            </div>
                            <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>
                              Guardar Receta
                            </button>
                          </form>
                        </div>

                        {/* Listado de Recetas */}
                        <div>
                          <h3 style={{ marginBottom: "1.25rem" }}>Recetas Emitidas ({selectedPaciente.recetas?.length || 0})</h3>
                          {(!selectedPaciente.recetas || selectedPaciente.recetas.length === 0) ? (
                            <p style={{ color: "var(--text-muted)" }}>No hay recetas registradas para este paciente.</p>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                              {selectedPaciente.recetas.map((receta) => (
                                <div key={receta.id} className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "0.5rem" }}>
                                    <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>
                                      📅 {new Date(receta.fecha).toLocaleDateString()}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: "0.95rem", whiteSpace: "pre-line" }}>
                                    <strong>Prescripción:</strong><br />
                                    {receta.medicamentos}
                                  </div>
                                  {receta.indicaciones && (
                                    <div style={{ fontSize: "0.9rem", color: "var(--text-muted)", whiteSpace: "pre-line" }}>
                                      <strong>Indicaciones:</strong> {receta.indicaciones}
                                    </div>
                                  )}
                                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", borderTop: "1px solid var(--border-color)", paddingTop: "0.5rem" }}>
                                    <button className="btn btn-secondary" onClick={() => handlePrintReceta(receta)} style={{ flex: 1, padding: "0.4rem", fontSize: "0.85rem" }}>
                                      🖨️ Imprimir
                                    </button>
                                    <button className="btn btn-secondary" onClick={() => handleDeleteReceta(receta.id)} style={{ flex: 1, padding: "0.4rem", fontSize: "0.85rem", color: "rgb(239, 68, 68)", borderColor: "rgba(239, 68, 68, 0.3)" }}>
                                      🗑️ Borrar
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Contenido Pestaña 4: Impresión de Historia Clínica */}
                    {patientSubTab === "imprimir" && (
                      <div style={{ marginTop: "1rem" }} className="fade-in">
                        <div className="card" style={{ marginBottom: "2rem" }}>
                          <h3 style={{ marginBottom: "1rem", color: "var(--primary)" }}>Configurar Documento de Impresión</h3>
                          <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: "1.5rem" }}>
                            Selecciona las consultas que deseas imprimir. Puedes filtrar por fecha para marcar las consultas automáticamente.
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

                          <button 
                            className="btn btn-primary" 
                            style={{ width: "100%", padding: "0.85rem", fontSize: "1.05rem" }}
                            onClick={handleTriggerPrint}
                          >
                            🖨️ Generar y Abrir Panel de Impresión ({selectedPrintConsultations.size})
                          </button>
                        </div>

                        {/* Listado de Consultas */}
                        <div>
                          <h3 style={{ marginBottom: "1.25rem" }}>Seleccionar Consultas del Historial</h3>
                          {(!selectedPaciente.consultas || selectedPaciente.consultas.length === 0) ? (
                            <p style={{ color: "var(--text-muted)" }}>No hay consultas clínicas registradas.</p>
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
                                      onChange={() => {}}
                                      style={{ width: "18px", height: "18px", marginTop: "0.2rem", cursor: "pointer" }}
                                    />
                                    <div style={{ flex: 1 }}>
                                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                                        <strong style={{ color: "var(--primary)", fontSize: "1rem" }}>{consulta.motivo}</strong>
                                        <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                                          {new Date(consulta.fecha).toLocaleDateString()}
                                        </span>
                                      </div>
                                      <p style={{ fontSize: "0.9rem", color: "var(--text-main)", margin: 0 }}>
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

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div className="form-group">
                    <label className="form-label">Obra Social / Cobertura</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ej. OSDE, PAMI, Swiss Medical..."
                      value={newPaciente.obra_social}
                      onChange={(e) => setNewPaciente({ ...newPaciente, obra_social: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Número de Afiliado</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ej. 11-24891302-01"
                      value={newPaciente.numero_afiliado}
                      onChange={(e) => setNewPaciente({ ...newPaciente, numero_afiliado: e.target.value })}
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

        {/* Pantalla 3: Agenda y Calendario de Turnos (Fase 2) */}
        {activeTab === "agenda" && (
          <div className="fade-in">
            <h2 style={{ marginBottom: "1.5rem" }}>📅 Agenda de Turnos Médicos</h2>
            <div className="agenda-grid">
              {/* Listado de Turnos */}
              <div>
                <h3 style={{ marginBottom: "1.25rem" }}>Turnos Agendados</h3>
                {citas.length === 0 ? (
                  <p style={{ color: "var(--text-muted)" }}>No hay citas médicas programadas actualmente.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {citas.map((cita) => {
                      const fechaCita = new Date(cita.fecha_hora);
                      return (
                        <div key={cita.id} className={`card cita-card ${cita.estado}`}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                            <div>
                              <strong style={{ fontSize: "1.1rem", color: "var(--primary)" }}>
                                {cita.paciente?.apellido}, {cita.paciente?.nombre}
                              </strong>
                              <p style={{ margin: "0.2rem 0", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                                DNI: {cita.paciente?.dni}
                              </p>
                            </div>
                            <span className={`status-badge ${cita.estado}`}>
                              {cita.estado.toUpperCase()}
                            </span>
                          </div>
                          
                          <div style={{ fontSize: "0.95rem", marginBottom: "0.75rem" }}>
                            <strong>Horario:</strong> {fechaCita.toLocaleDateString()} a las {fechaCita.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({cita.duracion_minutos} min)
                            <br />
                            <strong>Motivo:</strong> {cita.motivo}
                          </div>

                          <div style={{ display: "flex", gap: "0.5rem", borderTop: "1px solid var(--border-color)", paddingTop: "0.75rem" }}>
                            {cita.estado === "programado" && (
                              <>
                                <button className="btn btn-primary" style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }} onClick={() => handleAttendCita(cita)}>
                                  Atender
                                </button>
                                <button className="btn btn-secondary" style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem", color: "rgb(239, 68, 68)", borderColor: "rgba(239, 68, 68, 0.2)" }} onClick={() => handleUpdateCitaEstado(cita.id, "cancelada")}>
                                  Cancelar Cita
                                </button>
                              </>
                            )}
                            <button className="btn btn-secondary" style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem", color: "#0f766e", borderColor: "rgba(15,118,110,0.3)" }} onClick={() => { setEmailStatusMsg(null); setNotificationModal({ cita }); }}>
                              📲 Notificar
                            </button>
                            <button className="btn btn-secondary" style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem", marginLeft: "auto" }} onClick={() => handleDeleteCita(cita.id)}>
                              🗑️ Eliminar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Programar Turno */}
              <div className="card" style={{ height: "fit-content", position: "sticky", top: "20px" }}>
                <h3 style={{ marginBottom: "1.25rem", color: "var(--primary)" }}>Programar Nuevo Turno</h3>
                <form onSubmit={handleCreateCita}>
                  <div className="form-group">
                    <label className="form-label">Paciente *</label>
                    <select 
                      className="form-input" 
                      value={newCita.paciente_id}
                      onChange={(e) => setNewCita({ ...newCita, paciente_id: e.target.value })}
                      required
                    >
                      <option value="">-- Seleccionar Paciente --</option>
                      {pacientes.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.apellido}, {p.nombre} (DNI {p.dni})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div className="form-group">
                      <label className="form-label">Fecha *</label>
                      <input 
                        type="date" 
                        className="form-input" 
                        value={newCita.fecha}
                        onChange={(e) => setNewCita({ ...newCita, fecha: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Hora *</label>
                      <input 
                        type="time" 
                        className="form-input" 
                        value={newCita.hora}
                        onChange={(e) => setNewCita({ ...newCita, hora: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Duración (Minutos)</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={newCita.duracion_minutos}
                      onChange={(e) => setNewCita({ ...newCita, duracion_minutos: parseInt(e.target.value) || 30 })}
                      min="5"
                      max="240"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Motivo del Turno *</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Ej. Chequeo mensual, dolor agudo..."
                      value={newCita.motivo}
                      onChange={(e) => setNewCita({ ...newCita, motivo: e.target.value })}
                      required
                    />
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "0.5rem" }}>
                    🗓️ Confirmar Turno
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Pantalla 4: Configuración Médica y Backup (Fase 2) */}
        {activeTab === "configuracion" && (
          <div className="fade-in" style={{ maxWidth: "860px", margin: "0 auto" }}>
            <h2 style={{ marginBottom: "1.5rem" }}>⚙️ Configuración del Consultorio</h2>
            
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "2rem" }}>
              {/* Datos Profesionales */}
              <div className="card">
                <h3 style={{ marginBottom: "1.25rem", color: "var(--primary)" }}>Firma y Datos del Profesional</h3>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "1.25rem" }}>
                  Esta información y tu firma cargada se estamparán de manera automática al final de todas tus recetas médicas e historias clínicas impresas.
                </p>
                <form onSubmit={handleSaveConfig}>
                  <div className="form-group">
                    <label className="form-label">Nombre del Médico (con título)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Ej. Dr. Juan Pérez"
                      value={doctorForm.doctor_nombre}
                      onChange={(e) => setDoctorForm({ ...doctorForm, doctor_nombre: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Especialidad Clínica</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Ej. Cardiología y Medicina General"
                      value={doctorForm.doctor_especialidad}
                      onChange={(e) => setDoctorForm({ ...doctorForm, doctor_especialidad: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Matrícula / Registro Profesional</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Ej. M.N. 123456 / M.P. 789"
                      value={doctorForm.doctor_matricula}
                      onChange={(e) => setDoctorForm({ ...doctorForm, doctor_matricula: e.target.value })}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>
                    Guardar Datos
                  </button>
                </form>

                {/* Sello / Firma */}
                <div style={{ marginTop: "2rem", borderTop: "1px solid var(--border-color)", paddingTop: "1.5rem" }}>
                  <label className="form-label">Cargar Firma Digitalizada (PNG con fondo blanco o transparente)</label>
                  <input 
                    type="file" 
                    id="signature-upload"
                    accept="image/*"
                    onChange={handleUploadSignature}
                    style={{ display: "none" }}
                  />
                  <button className="btn btn-secondary" style={{ width: "100%", marginTop: "0.5rem" }} onClick={() => document.getElementById("signature-upload")?.click()}>
                    🖋️ Subir Imagen de Firma
                  </button>

                  {configuracion.firma_ruta && (
                    <div className="signature-preview-container">
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                        Firma Activa Previsualizada:
                      </span>
                      <img 
                        src={`${FILE_BASE_URL}${configuracion.firma_ruta}?t=${signatureKey}`} 
                        alt="Firma del doctor" 
                        className="signature-preview" 
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Columna derecha: Seguridad + Backup */}
              <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>

                {/* 🔐 Seguridad de Acceso */}
                <div className="card">
                  <h3 style={{ marginBottom: "1rem", color: "var(--primary)" }}>🔐 Seguridad de Acceso</h3>

                  {/* Toggle: Pedir contraseña al iniciar */}
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.85rem 1rem",
                    background: "rgba(99,102,241,0.07)",
                    borderRadius: "10px",
                    border: "1px solid rgba(99,102,241,0.2)",
                    marginBottom: "1.25rem"
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text-main)" }}>Pedir contraseña al iniciar</div>
                      <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                        Si está activo, se solicita la contraseña al abrir la app.
                      </div>
                    </div>
                    <button
                      id="toggle-password-login"
                      type="button"
                      onClick={() => handleTogglePasswordLogin(!configuracion.pedir_password_al_iniciar)}
                      style={{
                        width: "48px",
                        height: "26px",
                        borderRadius: "13px",
                        border: "none",
                        cursor: "pointer",
                        background: configuracion.pedir_password_al_iniciar
                          ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                          : "rgba(100,116,139,0.3)",
                        position: "relative",
                        transition: "background 0.3s",
                        flexShrink: 0
                      }}
                    >
                      <span style={{
                        position: "absolute",
                        top: "3px",
                        left: configuracion.pedir_password_al_iniciar ? "25px" : "3px",
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        background: "white",
                        transition: "left 0.3s",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.3)"
                      }} />
                    </button>
                  </div>

                  {/* Cambio de contraseña */}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ width: "100%", fontSize: "0.9rem" }}
                    onClick={() => { setShowPasswordFields(v => !v); setPasswordMsg(null); }}
                  >
                    🔑 {showPasswordFields ? "Cancelar cambio" : "Cambiar Contraseña"}
                  </button>

                  {showPasswordFields && (
                    <form onSubmit={handleCambiarPassword} style={{ marginTop: "1rem" }}>
                      <div className="form-group">
                        <label className="form-label">Contraseña Actual</label>
                        <input
                          type="password"
                          className="form-input"
                          placeholder="Contraseña actual..."
                          value={passwordForm.password_actual}
                          onChange={(e) => setPasswordForm({ ...passwordForm, password_actual: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Nueva Contraseña</label>
                        <input
                          type="password"
                          className="form-input"
                          placeholder="Mínimo 6 caracteres..."
                          value={passwordForm.password_nueva}
                          onChange={(e) => setPasswordForm({ ...passwordForm, password_nueva: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Confirmar Nueva Contraseña</label>
                        <input
                          type="password"
                          className="form-input"
                          placeholder="Repetí la nueva contraseña..."
                          value={passwordForm.password_confirm}
                          onChange={(e) => setPasswordForm({ ...passwordForm, password_confirm: e.target.value })}
                        />
                      </div>
                      {passwordMsg && (
                        <p style={{
                          padding: "0.6rem 0.9rem",
                          borderRadius: "8px",
                          fontSize: "0.85rem",
                          marginBottom: "0.75rem",
                          background: passwordMsg.type === "ok" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                          color: passwordMsg.type === "ok" ? "rgb(16,185,129)" : "rgb(239,68,68)",
                          border: `1px solid ${passwordMsg.type === "ok" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`
                        }}>
                          {passwordMsg.text}
                        </p>
                      )}
                      <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>
                        Actualizar Contraseña
                      </button>
                    </form>
                  )}
                </div>

                {/* Copias de Seguridad */}
                <div className="card">
                  <h3 style={{ marginBottom: "1.25rem", color: "var(--primary)" }}>Resguardo de Información</h3>
                  <p style={{ fontSize: "0.9rem", color: "var(--text-main)", marginBottom: "1.5rem", lineHeight: 1.4 }}>
                    Mantén a salvo el historial de tus pacientes. Exporta copias de seguridad de forma periódica. El respaldo contiene todas las fichas de pacientes, el historial de consultas, turnos de agenda y los documentos escaneados o adjuntos.
                  </p>
                  
                  <button 
                    className="btn btn-primary" 
                    style={{ width: "100%", marginBottom: "1rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
                    onClick={handleDownloadBackup}
                    disabled={restoring}
                  >
                    📥 Descargar Copia (.zip)
                  </button>

                  <div style={{ borderTop: "1px solid var(--border-color)", marginTop: "1.5rem", paddingTop: "1.5rem" }}>
                    <label className="form-label" style={{ display: "block", marginBottom: "0.5rem" }}>
                      Restaurar un Respaldo Anterior
                    </label>
                    <input 
                      type="file" 
                      id="restore-upload"
                      accept=".zip"
                      onChange={handleRestoreBackup}
                      style={{ display: "none" }}
                      disabled={restoring}
                    />
                    <button 
                      className="btn btn-secondary" 
                      style={{ width: "100%", borderColor: "rgba(239, 68, 68, 0.3)", color: "rgb(239, 68, 68)" }}
                      onClick={() => document.getElementById("restore-upload")?.click()}
                      disabled={restoring}
                    >
                      📤 Cargar y Restaurar Copia
                    </button>
                  </div>
                </div>

                {/* 📧 Configuración de Gmail para Confirmación de Turnos */}
                <div className="card">
                  <h3 style={{ marginBottom: "1rem", color: "var(--primary)" }}>📧 Notificaciones por Gmail (SMTP)</h3>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
                    Configurá tu casilla de Gmail y tu contraseña de aplicación para enviar e-mails de confirmación de turnos a los pacientes.
                  </p>
                  <form onSubmit={handleSaveSmtp}>
                    <div className="form-group">
                      <label className="form-label">Tu e-mail de Gmail</label>
                      <input
                        type="email"
                        className="form-input"
                        placeholder="ej. consultorio.medico@gmail.com"
                        value={smtpForm.smtp_email}
                        onChange={(e) => setSmtpForm({ ...smtpForm, smtp_email: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Contraseña de Aplicación de Gmail</label>
                      <input
                        type="password"
                        className="form-input"
                        placeholder="Contraseña de 16 caracteres de Google"
                        value={smtpForm.smtp_password}
                        onChange={(e) => setSmtpForm({ ...smtpForm, smtp_password: e.target.value })}
                      />
                      <small style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginTop: "4px" }}>
                        💡 Generala en: Cuenta de Google &gt; Seguridad &gt; Verificación en 2 pasos &gt; Contraseñas de aplicaciones.
                      </small>
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>
                      💾 Guardar Configuración de Gmail
                    </button>
                  </form>
                </div>

                {/* 📱 Código QR para la Puerta del Consultorio */}
                <div className="card">
                  <h3 style={{ marginBottom: "1rem", color: "var(--primary)" }}>📱 Código QR para Puerta de Consultorio</h3>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "1.25rem", lineHeight: 1.4 }}>
                    Imprimí este código QR y colócalo en la puerta o recepción del consultorio. Los pacientes podrán escanearlo con su celular para registrarse automáticamente antes de ingresar a la sala de espera.
                  </p>

                  <div style={{ textAlign: "center", marginBottom: "1.25rem", background: "#f8fafc", padding: "1.25rem", borderRadius: "12px", border: "1px dashed var(--border-color)" }}>
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrBaseUrl)}`}
                      alt="Código QR de Registro"
                      style={{ width: "180px", height: "180px", borderRadius: "8px", border: "4px solid #ffffff", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}
                    />
                    <div style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "var(--text-muted)", wordBreak: "break-all" }}>
                      URL del QR: <code>{qrBaseUrl}</code>
                    </div>
                  </div>

                  <form onSubmit={handleSaveQrUrl} style={{ marginBottom: "1rem" }}>
                    <div className="form-group">
                      <label className="form-label">URL del Formulario de Registro</label>
                      <input
                        type="text"
                        className="form-input"
                        value={qrBaseUrl}
                        onChange={(e) => setQrBaseUrl(e.target.value)}
                        placeholder="http://tu-dominio.com/?modo=autoregistro"
                      />
                    </div>
                    <button type="submit" className="btn btn-secondary" style={{ width: "100%", marginBottom: "0.75rem" }}>
                      💾 Guardar Nueva URL
                    </button>
                  </form>

                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    style={{ width: "100%", background: "linear-gradient(135deg, #10b981, #059669)", borderColor: "#059669" }}
                    onClick={handleTriggerPrintQrPoster}
                  >
                    🖨️ Imprimir Cartel A4 para la Puerta
                  </button>
                </div>

              </div>{/* fin columna derecha */}
            </div>
          </div>
        )}
      </main>

      {/* --- Modal Flotante de Notificación de Turnos (WhatsApp / Gmail / Ambos) --- */}
      {notificationModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "1rem"
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: "16px",
            padding: "2rem",
            maxWidth: "460px",
            width: "100%",
            boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
            animation: "fadeIn 0.2s ease-out"
          }}>
            <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.3rem" }}>📅</div>
              <h2 style={{ fontSize: "1.25rem", color: "#0f172a", margin: 0, fontWeight: 700 }}>¡Turno Confirmado!</h2>
              <p style={{ fontSize: "0.88rem", color: "#64748b", marginTop: "0.3rem" }}>
                ¿A dónde deseas enviar la confirmación del turno?
              </p>
            </div>

            <div style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              padding: "1rem",
              marginBottom: "1.5rem",
              fontSize: "0.85rem",
              color: "#334155"
            }}>
              <div>👤 <strong>Paciente:</strong> {notificationModal.paciente?.nombre || notificationModal.cita.paciente?.nombre} {notificationModal.paciente?.apellido || notificationModal.cita.paciente?.apellido}</div>
              <div style={{ marginTop: "4px" }}>📱 <strong>Teléfono:</strong> {notificationModal.paciente?.telefono || notificationModal.cita.paciente?.telefono || "No registrado"}</div>
              <div style={{ marginTop: "4px" }}>📧 <strong>Email:</strong> {notificationModal.paciente?.email || notificationModal.cita.paciente?.email || "No registrado"}</div>
              <div style={{ marginTop: "4px" }}>📆 <strong>Fecha:</strong> {new Date(notificationModal.cita.fecha_hora).toLocaleDateString()} {new Date(notificationModal.cita.fecha_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} hs</div>
            </div>

            {emailStatusMsg && (
              <div style={{
                padding: "0.75rem",
                borderRadius: "8px",
                fontSize: "0.85rem",
                marginBottom: "1rem",
                background: emailStatusMsg.type === "ok" ? "#f0fdf4" : "#fef2f2",
                color: emailStatusMsg.type === "ok" ? "#15803d" : "#b91c1c",
                border: `1px solid ${emailStatusMsg.type === "ok" ? "#bbf7d0" : "#fecaca"}`
              }}>
                {emailStatusMsg.text}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {/* Opción WhatsApp */}
              {getWhatsAppLink(notificationModal.cita, notificationModal.paciente) ? (
                <a
                  href={getWhatsAppLink(notificationModal.cita, notificationModal.paciente)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn"
                  style={{
                    background: "#25d366",
                    color: "#ffffff",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    textDecoration: "none",
                    padding: "0.75rem",
                    borderRadius: "8px"
                  }}
                >
                  💬 Enviar por WhatsApp
                </a>
              ) : (
                <div style={{ fontSize: "0.78rem", color: "#94a3b8", textAlign: "center", fontStyle: "italic" }}>
                  (El paciente no tiene teléfono registrado para WhatsApp)
                </div>
              )}

              {/* Opción Gmail */}
              <button
                type="button"
                disabled={sendingEmailState}
                onClick={() => handleSendEmailNotification(notificationModal.cita.id, notificationModal.paciente?.email || notificationModal.cita.paciente?.email)}
                className="btn"
                style={{
                  background: "#2563eb",
                  color: "#ffffff",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  padding: "0.75rem",
                  border: "none",
                  borderRadius: "8px",
                  cursor: sendingEmailState ? "wait" : "pointer"
                }}
              >
                📧 {sendingEmailState ? "Enviando por Gmail..." : "Enviar por Gmail"}
              </button>

              {/* Opción Ambos */}
              {getWhatsAppLink(notificationModal.cita, notificationModal.paciente) && (
                <button
                  type="button"
                  disabled={sendingEmailState}
                  onClick={() => {
                    handleSendEmailNotification(notificationModal.cita.id, notificationModal.paciente?.email || notificationModal.cita.paciente?.email);
                    window.open(getWhatsAppLink(notificationModal.cita, notificationModal.paciente), "_blank");
                  }}
                  className="btn"
                  style={{
                    background: "linear-gradient(135deg, #25d366 0%, #2563eb 100%)",
                    color: "#ffffff",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    padding: "0.75rem",
                    border: "none",
                    borderRadius: "8px",
                    cursor: sendingEmailState ? "wait" : "pointer"
                  }}
                >
                  📩 Enviar por Ambos (WhatsApp + Gmail)
                </button>
              )}

              <button
                type="button"
                onClick={() => setNotificationModal(null)}
                className="btn btn-secondary"
                style={{ marginTop: "0.5rem", padding: "0.6rem" }}
              >
                ✕ Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Modal para Compartir Historia Clínica entre Profesionales --- */}
      {compartirModalOpen && selectedPaciente && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(15, 23, 42, 0.65)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "1rem"
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: "16px",
            maxWidth: "600px",
            width: "100%",
            maxHeight: "90vh",
            overflowY: "auto",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            padding: "2rem",
            position: "relative"
          }}>
            <button
              onClick={() => setCompartirModalOpen(false)}
              style={{
                position: "absolute",
                top: "1.25rem",
                right: "1.25rem",
                background: "none",
                border: "none",
                fontSize: "1.5rem",
                cursor: "pointer",
                color: "#64748b"
              }}
            >
              ✕
            </button>

            <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>✉️</div>
              <h3 style={{ fontSize: "1.35rem", color: "#0f766e", margin: 0, fontWeight: 700 }}>
                Compartir Historia Clínica con Profesional
              </h3>
              <p style={{ fontSize: "0.9rem", color: "#64748b", marginTop: "0.25rem" }}>
                Paciente: <strong>{selectedPaciente.nombre} {selectedPaciente.apellido}</strong> (DNI: {selectedPaciente.dni})
              </p>
            </div>

            <form onSubmit={handleSendCompartirEmail} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              
              {/* Datos del profesional destinatario */}
              <div style={{ background: "#f0fdfa", border: "1px solid #ccfbf1", borderRadius: "10px", padding: "1rem" }}>
                <h4 style={{ color: "#0f766e", margin: "0 0 0.75rem 0", fontSize: "0.95rem" }}>👨‍⚕️ Datos del Profesional Destinatario</h4>
                
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: "0.25rem" }}>
                      Correo Electrónico del Colega *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="doctor.colega@clinica.com"
                      value={compartirForm.email_profesional}
                      onChange={(e) => setCompartirForm({ ...compartirForm, email_profesional: e.target.value })}
                      style={{ width: "100%", padding: "0.6rem 0.8rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: "0.25rem" }}>
                      Nombre del Profesional (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Dr. Juan Pérez"
                      value={compartirForm.nombre_profesional}
                      onChange={(e) => setCompartirForm({ ...compartirForm, nombre_profesional: e.target.value })}
                      style={{ width: "100%", padding: "0.6rem 0.8rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: "0.25rem" }}>
                      Mensaje / Observaciones para el Colega (Opcional)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Estimado colega, adjunto resumen de historia clínica para interconsulta..."
                      value={compartirForm.mensaje_medico}
                      onChange={(e) => setCompartirForm({ ...compartirForm, mensaje_medico: e.target.value })}
                      style={{ width: "100%", padding: "0.6rem 0.8rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem", resize: "vertical" }}
                    />
                  </div>
                </div>
              </div>

              {/* Selección de Contenidos a Enviar */}
              <div>
                <h4 style={{ color: "#334155", margin: "0 0 0.5rem 0", fontSize: "0.95rem" }}>📦 Selección de Contenido a Enviar</h4>
                
                {/* Checkbox Resumen de Historia Clínica */}
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0", cursor: "pointer", marginBottom: "0.75rem", fontSize: "0.9rem" }}>
                  <input
                    type="checkbox"
                    checked={compartirForm.incluir_historia_clinica}
                    onChange={(e) => setCompartirForm({ ...compartirForm, incluir_historia_clinica: e.target.checked })}
                    style={{ width: "18px", height: "18px", accentColor: "#0f766e" }}
                  />
                  <span>📋 <strong>Incluir Resumen de Consultas y Diagnósticos</strong> ({selectedPaciente.consultas?.length || 0} registros)</span>
                </label>

                {/* Selección de Recetas Médicas */}
                {selectedPaciente.recetas && selectedPaciente.recetas.length > 0 && (
                  <div style={{ marginBottom: "0.75rem", background: "#f8fafc", padding: "0.75rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#166534", marginBottom: "0.5rem" }}>
                      📄 Recetas Médicas a Incluir ({compartirForm.receta_ids.length} de {selectedPaciente.recetas.length}):
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: "120px", overflowY: "auto" }}>
                      {selectedPaciente.recetas.map((r) => {
                        const isChecked = compartirForm.receta_ids.includes(r.id);
                        return (
                          <label key={r.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const newIds = e.target.checked
                                  ? [...compartirForm.receta_ids, r.id]
                                  : compartirForm.receta_ids.filter((id) => id !== r.id);
                                setCompartirForm({ ...compartirForm, receta_ids: newIds });
                              }}
                              style={{ accentColor: "#166534" }}
                            />
                            <span>{r.fecha ? r.fecha.substring(0, 10) : "Receta"} - {r.medicamentos.substring(0, 45)}...</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Selección de Ficheros y Escaneos */}
                {selectedPaciente.documentos && selectedPaciente.documentos.length > 0 && (
                  <div style={{ background: "#f8fafc", padding: "0.75rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#0369a1", marginBottom: "0.5rem" }}>
                      📁 Archivos y Escaneos Adjuntos ({compartirForm.documento_ids.length} de {selectedPaciente.documentos.length}):
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: "120px", overflowY: "auto" }}>
                      {selectedPaciente.documentos.map((doc) => {
                        const isChecked = compartirForm.documento_ids.includes(doc.id);
                        return (
                          <label key={doc.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const newIds = e.target.checked
                                  ? [...compartirForm.documento_ids, doc.id]
                                  : compartirForm.documento_ids.filter((id) => id !== doc.id);
                                setCompartirForm({ ...compartirForm, documento_ids: newIds });
                              }}
                              style={{ accentColor: "#0369a1" }}
                            />
                            <span>📎 {doc.nombre}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Status feedback */}
              {compartirStatusMsg && (
                <div style={{
                  padding: "0.75rem",
                  borderRadius: "8px",
                  fontSize: "0.85rem",
                  background: compartirStatusMsg.type === "ok" ? "#f0fdf4" : "#fef2f2",
                  color: compartirStatusMsg.type === "ok" ? "#15803d" : "#b91c1c",
                  border: `1px solid ${compartirStatusMsg.type === "ok" ? "#bbf7d0" : "#fecaca"}`
                }}>
                  {compartirStatusMsg.text}
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCompartirModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSendingCompartir}
                  className="btn"
                  style={{
                    background: "#0f766e",
                    color: "#ffffff",
                    fontWeight: 600,
                    padding: "0.6rem 1.25rem",
                    borderRadius: "8px",
                    border: "none",
                    cursor: isSendingCompartir ? "wait" : "pointer"
                  }}
                >
                  {isSendingCompartir ? "Enviando correo..." : "✉️ Enviar por Correo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Plantilla HTML de Impresión de Historia Clínica (Visible en Impresora) --- */}
      {printData && (
        <div className="print-history-only">
          <div className="print-header">
            <div>
              <h1 className="print-title">Registro de Historia Clínica</h1>
              <p style={{ margin: 0, fontSize: "10pt" }}>History-Ar - Sistema Médico Local</p>
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
              <div><strong>Obra Social:</strong> {printData.paciente.obra_social || "Particular"}</div>
              <div><strong>N° Afiliado:</strong> {printData.paciente.numero_afiliado || "S/D"}</div>
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
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "220px" }}>
              {configuracion.firma_ruta ? (
                <img 
                  src={`${FILE_BASE_URL}${configuracion.firma_ruta}?t=${signatureKey}`} 
                  alt="Sello/Firma del doctor" 
                  style={{ maxHeight: "80px", maxWidth: "160px", mixBlendMode: "multiply", marginBottom: "0.2rem" }} 
                />
              ) : (
                <div style={{ height: "60px" }}></div>
              )}
              <div className="signature-box" style={{ width: "100%" }}>
                {configuracion.doctor_nombre ? (
                  <>
                    <strong>{configuracion.doctor_nombre}</strong><br />
                    <span>{configuracion.doctor_especialidad}</span><br />
                    <span>{configuracion.doctor_matricula}</span>
                  </>
                ) : (
                  <span>Firma y Sello del Profesional</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- Plantilla HTML de Impresión de Receta Médica (Visible en Impresora) --- */}
      {printRecipeData && (
        <div className="print-recipe-only">
          <div className="recipe-print-header">
            <h1 className="recipe-doctor-name">
              {configuracion.doctor_nombre || "Profesional de la Salud"}
            </h1>
            <p className="recipe-doctor-spec">
              {configuracion.doctor_especialidad || "Medicina General"}
              {configuracion.doctor_matricula && ` | ${configuracion.doctor_matricula}`}
            </p>
            <p style={{ margin: "0.2rem 0 0 0", fontSize: "9pt", color: "#555" }}>
              History-Ar - Recetario Médico Local
            </p>
          </div>

          <div className="recipe-patient-info">
            <div><strong>Paciente:</strong> {printRecipeData.paciente.apellido}, {printRecipeData.paciente.nombre}</div>
            <div><strong>DNI:</strong> {printRecipeData.paciente.dni}</div>
            <div><strong>Obra Social:</strong> {printRecipeData.paciente.obra_social || "Particular"}</div>
            <div><strong>N° Afiliado:</strong> {printRecipeData.paciente.numero_afiliado || "S/D"}</div>
            <div><strong>Fecha Nacimiento:</strong> {printRecipeData.paciente.fecha_nacimiento}</div>
            <div><strong>Fecha Emisión:</strong> {new Date(printRecipeData.receta.fecha).toLocaleDateString()}</div>
          </div>

          <div className="recipe-body">
            <h3 className="recipe-section-title" style={{ marginTop: 0 }}>RP / Prescripción Médica:</h3>
            <div style={{ whiteSpace: "pre-line", paddingLeft: "0.5rem" }}>
              {printRecipeData.receta.medicamentos}
            </div>

            {printRecipeData.receta.indicaciones && (
              <>
                <h3 className="recipe-section-title">Indicaciones del Paciente:</h3>
                <div style={{ whiteSpace: "pre-line", paddingLeft: "0.5rem" }}>
                  {printRecipeData.receta.indicaciones}
                </div>
              </>
            )}
          </div>

          <div className="recipe-print-footer">
            <span>Fecha: {new Date(printRecipeData.receta.fecha).toLocaleDateString()}</span>
            
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "220px" }}>
              {configuracion.firma_ruta ? (
                <img 
                  src={`${FILE_BASE_URL}${configuracion.firma_ruta}?t=${signatureKey}`} 
                  alt="Sello/Firma del doctor" 
                  style={{ maxHeight: "80px", maxWidth: "160px", mixBlendMode: "multiply", marginBottom: "0.2rem" }} 
                />
              ) : (
                <div style={{ height: "50px" }}></div>
              )}
              <div style={{ borderTop: "1px solid #000000", width: "100%", textAlign: "center", paddingTop: "0.4rem" }}>
                {configuracion.doctor_nombre ? (
                  <>
                    <strong>{configuracion.doctor_nombre}</strong><br />
                    <span style={{ fontSize: "8pt" }}>{configuracion.doctor_matricula}</span>
                  </>
                ) : (
                  <span>Firma y Sello del Médico</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- Cartel A4 Imprimible con Código QR para la Puerta del Consultorio --- */}
      <div className="print-qr-poster-only">
        <div className="qr-poster-box">
          <div className="qr-poster-header-title">{configuracion.doctor_nombre || currentUsuario?.nombre || "Consultorio Médico"}</div>
          {configuracion.doctor_especialidad && <div className="qr-poster-header-sub">{configuracion.doctor_especialidad}</div>}
          {configuracion.doctor_matricula && <div className="qr-poster-header-mat">Matrícula Profesional: {configuracion.doctor_matricula}</div>}

          <div className="qr-poster-badge">📱 AUTO-REGISTRO DE PACIENTES</div>

          <div className="qr-poster-instruction">
            Escaneá este código QR con la cámara de tu celular para registrarte e ingresar a la sala de espera.
          </div>

          <img 
            src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrBaseUrl)}`}
            alt="Código QR de Registro" 
            className="qr-poster-img"
          />

          <div className="qr-poster-steps">
            <div className="qr-poster-step-item">1. Abrí la cámara del celular</div>
            <div className="qr-poster-step-item">2. Apuntá a este código QR</div>
            <div className="qr-poster-step-item">3. Completá tu ficha médica</div>
          </div>
        </div>
        <div className="qr-poster-footer-text">
          History-Ar • Sistema de Gestión de Historias Clínicas y Turnos
        </div>
      </div>
    </div>
  );
}

export default App;
