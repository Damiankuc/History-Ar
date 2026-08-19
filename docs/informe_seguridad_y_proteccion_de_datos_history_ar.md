# INFORME TÉCNICO Y LEGAL DE SEGURIDAD, NORMATIVAS Y PROTECCIÓN DE DATOS PERSONALES Y SALUD (PHI)

**Sistema de Historia Clínica Electrónica History-Ar**  
*Fecha de Emisión: 19 de Agosto de 2026*  
*Versión del Sistema: 2.0.0 Cloud & Hybrid*  

---

## 1. RESUMEN EJECUTIVO Y DECLARACIÓN DE CUMPLIMIENTO

El presente documento certifica y detalla de manera exhaustiva la arquitectura de seguridad informática, las medidas de protección de datos personales y de salud (PHI - Protected Health Information) y el marco normativo cumplido por la plataforma **History-Ar**.

Designed bajo el principio de **"Privacidad desde el Diseño y por Defecto" (Privacy by Design & Security by Default)**, History-Ar garantiza que toda la información clínica almacenada mantenga los más altos estándares de **confidencialidad, integridad, disponibilidad, inalterabilidad y trazabilidad**, protegiendo tanto los derechos de los pacientes como la responsabilidad profesional e institucional de los médicos y centros de salud.

---

## 2. ARQUITECTURA Y MEDIDAS DE SEGURIDAD TÉCNICAS IMPLEMENTADAS

History-Ar integra múltiples capas de seguridad técnica a nivel de aplicación, base de datos, red y almacenamiento local/cloud:

### 2.1. Cifrado Granular en Reposo (Field-Level Encryption - AES-256 / Fernet)
* **Algoritmo de Cifrado**: Cifrado simétrico **Fernet** basado en **AES-256 en modo CBC** con autenticación de contenido **HMAC-SHA256**.
* **Derivación de Claves (KDF)**: Utiliza **PBKDF2HMAC** con el algoritmo **SHA-256**, aplicando 100.000 iteraciones y una sal (salt) criptográfica dedicada (`HistoryAr_PHI_Salt_26529`).
* **Alcance de Protección**: Los campos de datos sensibles de la Historia Clínica (diagnósticos, tratamientos, antecedentes, notas clínicas) y datos filiatorios sensibles son cifrados antes de su persistencia en la base de datos (etiquetados con prefijo `ENC:`). De este modo, ante un eventual acceso directo no autorizado a la base de datos física o cloud, la información resulta completamente incomprensible e inexpugnable.

### 2.2. Autenticación Robusta, Gestión de Identidad y Control de Acceso (RBAC & RLS)
* **Autenticación por JWT**: Validación de identidades mediante tokens **JSON Web Tokens (JWT)** firmados criptográficamente enviados en las cabeceras HTTP `Authorization: Bearer`.
* **Protección de Credenciales**: Las contraseñas de los usuarios se almacenan utilizando algoritmos de hashing de un solo sentido de alta resistencia (**bcrypt** con sal aleatoria dinámica).
* **Row Level Security (RLS)**: En la infraestructura de base de datos PostgreSQL Cloud (Supabase), se implementa política de **Seguridad a Nivel de Filas (Row Level Security)**, asegurando que cada profesional médico solo pueda acceder a los registros e historias clínicas de los cuales es titular o autorizado.

### 2.3. Sistema de Auditoría Inalterable (Audit Trail & Logging Dual)
* **Trazabilidad Absoluta**: Cumpliendo con las exigencias legales de inalterabilidad de la Historia Clínica, History-Ar implementa un sistema de registro de auditoría (`audit.py`) que captura de manera automática e inmodificable todo evento de lectura, creación, modificación, eliminación o exportación en PDF de datos clínicos.
* **Mecanismo Dual de Resguardo**:
  1. **Log Local Inmutable**: Almacenamiento continuo en archivos locales con restricción de sobreescritura (`APPDATA/History-Ar/audit/audit_trail.log`).
  2. **Audit Logs Cloud**: Inserción paralela en la tabla `audit_logs` de la base de datos cloud.
* **Metadatos Registrados**:
  * Marca temporal de precisión UTC (Formato ISO-8601).
  * Identificador único del usuario / médico actuante.
  * Identificador del paciente accedido o modificado.
  * Tipo de operación (`LECTURA`, `CREACION`, `MODIFICACION`, `ELIMINACION`, `EXPORTACION_PDF`).
  * Dirección IP de origen (con análisis de cabeceras `X-Forwarded-For`).
  * Agente de usuario (User-Agent) del dispositivo o navegador.

### 2.4. Seguridad en Red, Comunicaciones y Protección OWASP
* **Cifrado en Tránsito (TLS/HTTPS)**: Todas las solicitudes entre la interfaz de cliente y los servicios API se realizan mediante conexiones HTTPS cifradas bajo **TLS 1.3**.
* **Protección contra Fuerza Bruta y DoS**: Implementación de **Rate Limiting** dinámico (`SlowAPI`) en los endpoints sensibles para prevenir ataques de denegación de servicio y adivinación de credenciales.
* **Cabeceras de Seguridad y CORS**: Configuración estricta de Cross-Origin Resource Sharing (CORS) restringida exclusivamente a dominios y puertos autorizados.

### 2.5. Sanitización e Integridad de Datos
* **Validación Cero Confianza (Zero-Trust Data Parsing)**: Uso de esquemas **Pydantic** y **SQLModel** para la sanitización, validación tipada y filtrado de todas las peticiones entrantes.
* **Prevención de Inyección SQL**: Acceso a la base de datos gestionado mediante mapeo objeto-relacional (ORM) y consultas parametrizadas, eliminando por completo el riesgo de inyección de código SQL.

### 2.6. Resguardo, Portabilidad y Supresión Definitiva
* **Backups y Sincronización Híbrida**: Redundancia de datos entre base de datos SQLite local cifrada y réplica en la nube Supabase PostgreSQL.
* **Portabilidad y Exportación**: Mecanismo de exportación integral de historias clínicas en formato estructurado (JSON) e impresiones oficiales en PDF firmadas electrónicamente.
* **Derecho al Olvido / Supresión Segura**: Proceso de borrado lógico y posterior supresión física definitiva de datos tras la finalización de los plazos legales de conservación.

---

## 3. NORMATIVAS Y LEYES NACIONALES E INTERNACIONALES CUMPLIDAS

History-Ar ha sido diseñado en estricto apego al marco regulatorio de la República Argentina y estándares internacionales de salud digital:

### 3.1. Ley N° 25.326 - Protección de Datos Personales (Argentina) y Disposiciones AAIP
* **Tratamiento de Datos Sensibles (Art. 2 y Art. 7)**: La ley clasifica expresamente a los datos relativos a la salud como "Datos Sensibles". History-Ar prohíbe el uso de estos datos para fines ajenos a la atención médica y exige el consentimiento informado del titular.
* **Medidas de Seguridad (Art. 9)**: El sistema adopta las medidas técnicas y organizativas necesarias para garantizar la seguridad y confidencialidad de los datos, evitando su alteración, pérdida, tratamiento o acceso no autorizado.
* **Derechos ARCO (Acceso, Rectificación, Cancelación y Oposición)**: Garantía total para que los pacientes ejerzan el derecho de Hábeas Data sobre su información personal y clínica.

### 3.2. Ley N° 26.529 - Derechos del Paciente en su Relación con los Profesionales e Instituciones de la Salud (Argentina)
* **Historia Clínica Electrónica (HCE) (Arts. 12 al 21)**: History-Ar cumple minuciosamente con las reglas de la HCE:
  * **Titularidad**: Reconocimiento de que la Historia Clínica es propiedad del paciente.
  * **Inviolabilidad e Inalterabilidad**: Modificaciones registradas mediante adición de evoluciones sin alterar o borrar asientos previos, respaldadas por el registro de auditoría inalterable.
  * **Confidencialidad**: Acceso restringido exclusivamente al equipo médico tratante.

### 3.3. Ley N° 27.706 - Programa Federal de Única Historia Clínica Electrónica (Argentina)
* Estructura de datos interoperable que facilita el intercambio seguro de registros médicos bajo estándares nacionales de interoperabilidad clínica.

### 3.4. Decreto Reglamentario N° 1079/2011 (Argentina)
* Establece las pautas de conservación digital, mecanismos de autenticación y firma digital/electrónica para la validez legal de las recetas y fichas clínicas electrónicas.

### 3.5. Estándares Internacionales de Referencia
* **HIPAA (Health Insurance Portability and Accountability Act - EE.UU.)**:
  * Cumplimiento de la *Security Rule* mediante cifrado AES-256 en reposo y tránsito, control de acceso basado en roles y trazabilidad completa de PHI.
* **GDPR (General Data Protection Regulation - Unión Europea)**:
  * Adopción de los principios de *Privacy by Design*, minimización de datos y mecanismos de portabilidad de información de salud.

---

## 4. CUADRO MATRIZ DE CUMPLIMIENTO TÉCNICO-LEGAL

| Requisito Legal / Normativo | Medida Técnica Implementada en History-Ar | Componente del Sistema | Estado |
| :--- | :--- | :--- | :---: |
| **Cifrado de Datos Sensibles (Ley 25.326 Art. 9 / HIPAA)** | Cifrado granular AES-256 / Fernet derivado con PBKDF2HMAC (SHA-256). | `crypto_utils.py` | **CUMPLIDO** |
| **Inalterabilidad y Trazabilidad (Ley 26.529 Art. 12)** | Audit Log dual (Local Immutable File + Supabase Cloud Table) para cada operación. | `audit.py` | **CUMPLIDO** |
| **Autenticación y Control de Acceso (Ley 26.529 / GDPR)** | Autenticación JWT, contraseñas hashed con bcrypt y Row Level Security (RLS). | `auth.py` / PostgreSQL RLS | **CUMPLIDO** |
| **Seguridad de Comunicaciones (Ley 25.326 / OWASP)** | Protocolo TLS 1.3 (HTTPS), Rate Limiting anti-DoS y cabeceras de seguridad. | FastAPI / SlowAPI | **CUMPLIDO** |
| **Integridad y Sanitización de Datos (OWASP)** | Esquemas de validación estricta Pydantic y consultas ORM parametrizadas. | `schemas.py` / SQLModel | **CUMPLIDO** |
| **Portabilidad y Supresión (Ley 25.326 / Ley 27.706)** | Exportación estructurada JSON/PDF y borrado seguro garantizado tras 30 días. | Módulo Export / Cleanup | **CUMPLIDO** |

---

## 5. CONCLUSIÓN Y CERTIFICACIÓN

El sistema **History-Ar** satisface íntegramente las exigencias de seguridad informática, cifrado de datos de salud y regulaciones legales vigentes en la República Argentina e internacionales. La combinación de cifrado AES-256 a nivel de campo, autenticación estricta y registros de auditoría inalterables convierte a History-Ar en una solución de vanguardia, confiable e inexpugnable para la gestión de historias clínicas electrónicas.

---
*Documento emitido para fines de certificación técnica y legal de la plataforma History-Ar.*
