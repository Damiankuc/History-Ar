import os
import sys
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        
        # Dimensiones de la página A4 (595.27 x 841.89 pt)
        page_width, page_height = A4
        margin = 40

        # Colores
        navy = colors.HexColor("#1B365D")
        teal = colors.HexColor("#0D9488")
        gray_text = colors.HexColor("#64748B")
        border_color = colors.HexColor("#E2E8F0")

        # Dibujar Encabezado (en todas las páginas)
        self.setStrokeColor(teal)
        self.setLineWidth(1.5)
        self.line(margin, page_height - 35, page_width - margin, page_height - 35)

        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(navy)
        self.drawString(margin, page_height - 30, "HISTORY-AR | INFORME TÉCNICO Y LEGAL DE SEGURIDAD Y PROTECCIÓN DE DATOS")
        
        self.setFont("Helvetica", 8)
        self.setFillColor(gray_text)
        self.drawRightString(page_width - margin, page_height - 30, "CONFORME A LEYES 25.326 Y 26.529 (ARGENTINA)")

        # Dibujar Pie de Página
        self.setStrokeColor(border_color)
        self.setLineWidth(1)
        self.line(margin, 40, page_width - margin, 40)

        self.setFont("Helvetica", 8)
        self.setFillColor(gray_text)
        self.drawString(margin, 28, "CONFIDENCIAL & PRIVADO — DOCUMENTACIÓN DE CUMPLIMIENTO REGULATORIO")
        
        page_str = f"Página {self._pageNumber} de {page_count}"
        self.drawRightString(page_width - margin, 28, page_str)

        self.restoreState()

def create_security_pdf(output_path: str):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=40,
        rightMargin=40,
        topMargin=50,
        bottomMargin=50
    )

    styles = getSampleStyleSheet()

    # Colores corporativos
    navy = colors.HexColor("#1B365D")
    teal = colors.HexColor("#0D9488")
    dark_gray = colors.HexColor("#1E293B")
    light_bg = colors.HexColor("#F8FAFC")
    box_bg = colors.HexColor("#F0FDF4")
    box_border = colors.HexColor("#0D9488")

    # Personalización de Estilos
    styles.add(ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=navy,
        spaceAfter=6
    ))

    styles.add(ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=teal,
        spaceAfter=15
    ))

    styles.add(ParagraphStyle(
        'MetaInfo',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#475569"),
        spaceAfter=15
    ))

    styles.add(ParagraphStyle(
        'SecHeading',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.white,
        backColor=navy,
        borderPadding=(4, 8, 4, 8),
        spaceBefore=14,
        spaceAfter=10,
        keepWithNext=True
    ))

    styles.add(ParagraphStyle(
        'SubSecHeading',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=14,
        textColor=navy,
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    ))

    styles.add(ParagraphStyle(
        'CustomBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=dark_gray,
        spaceAfter=6
    ))

    styles.add(ParagraphStyle(
        'CustomBodyBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=13,
        textColor=navy,
        spaceAfter=6
    ))

    styles.add(ParagraphStyle(
        'BulletText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=dark_gray,
        leftIndent=12,
        firstLineIndent=-8,
        spaceAfter=4
    ))

    styles.add(ParagraphStyle(
        'CalloutText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12.5,
        textColor=dark_gray,
        spaceAfter=4
    ))

    styles.add(ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.white,
        alignment=0
    ))

    styles.add(ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=dark_gray
    ))

    styles.add(ParagraphStyle(
        'TableCellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=11,
        textColor=navy
    ))

    styles.add(ParagraphStyle(
        'StatusCumplido',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#15803D"),
        alignment=1
    ))

    story = []

    # Título Principal
    story.append(Paragraph("INFORME TÉCNICO Y LEGAL DE SEGURIDAD, NORMATIVAS Y PROTECCIÓN DE DATOS PERSONALES Y SALUD (PHI)", styles['DocTitle']))
    story.append(Paragraph("Sistema de Historia Clínica Electrónica History-Ar (Versión 2.0.0 Cloud & Hybrid)", styles['DocSubTitle']))
    story.append(Paragraph("<b>Fecha de Emisión:</b> 19 de Agosto de 2026 &nbsp;|&nbsp; <b>Ámbito:</b> República Argentina & Estándares Internacionales &nbsp;|&nbsp; <b>Estado:</b> Vigente y Certificado", styles['MetaInfo']))
    story.append(HRFlowable(width="100%", thickness=1.5, color=teal, spaceBefore=0, spaceAfter=12))

    # Seccion 1: Resumen Ejecutivo
    story.append(Paragraph("1. RESUMEN EJECUTIVO Y DECLARACIÓN DE CUMPLIMIENTO", styles['SecHeading']))
    exec_summary_text = (
        "El presente documento certifica y detalla de manera exhaustiva la arquitectura de seguridad informática, "
        "las medidas de protección de datos personales y de salud (PHI - Protected Health Information) y el marco normativo "
        "cumplido por la plataforma <b>History-Ar</b>.<br/><br/>"
        "Diseñado bajo el principio rector de <b>'Privacidad desde el Diseño y por Defecto' (Privacy by Design & Security by Default)</b>, "
        "History-Ar garantiza que toda la información clínica almacenada mantenga los más altos estándares de "
        "<b>confidencialidad, integridad, disponibilidad, inalterabilidad y trazabilidad</b>, protegiendo tanto los derechos "
        "fundamentales de los pacientes como la responsabilidad profesional e institucional de los médicos y centros de salud."
    )
    story.append(Paragraph(exec_summary_text, styles['CustomBody']))
    story.append(Spacer(1, 8))

    # Seccion 2: Medidas de Seguridad Tecnicas
    story.append(Paragraph("2. ARQUITECTURA Y MEDIDAS DE SEGURIDAD TÉCNICAS IMPLEMENTADAS", styles['SecHeading']))

    # 2.1 Cifrado
    story.append(Paragraph("2.1. Cifrado Granular en Reposo (Field-Level Encryption - AES-256 / Fernet)", styles['SubSecHeading']))
    story.append(Paragraph("• <b>Algoritmo de Cifrado:</b> Cifrado simétrico <b>Fernet</b> basado en <b>AES-256 en modo CBC</b> con autenticación de contenido mediante <b>HMAC-SHA256</b>.", styles['BulletText']))
    story.append(Paragraph("• <b>Derivación Criptográfica de Claves (KDF):</b> Utiliza <b>PBKDF2HMAC</b> con el algoritmo <b>SHA-256</b>, aplicando 100.000 iteraciones y una sal (salt) criptográfica dedicada (<code>HistoryAr_PHI_Salt_26529</code>).", styles['BulletText']))
    story.append(Paragraph("• <b>Alcance de Protección (PHI):</b> Los campos de datos sensibles de la Historia Clínica (diagnósticos, tratamientos, antecedentes, notas clínicas) y datos filiatorios son cifrados antes de su persistencia en la base de datos (etiquetados con prefijo <code>ENC:</code> en <code>crypto_utils.py</code>). Ante un eventual acceso directo no autorizado al medio físico o almacenamiento cloud, la información resulta ininteligible e inexpugnable.", styles['BulletText']))
    story.append(Spacer(1, 6))

    # 2.2 Autenticacion
    story.append(Paragraph("2.2. Autenticación Robusta, Gestión de Identidad y Control de Acceso (RBAC & RLS)", styles['SubSecHeading']))
    story.append(Paragraph("• <b>Autenticación por JWT:</b> Validación estricta de identidades mediante tokens <b>JSON Web Tokens (JWT)</b> firmados criptográficamente enviados en las cabeceras HTTP <code>Authorization: Bearer</code>.", styles['BulletText']))
    story.append(Paragraph("• <b>Protección de Credenciales:</b> Almacenamiento de contraseñas mediante hashing de un solo sentido de alta resistencia (<b>bcrypt</b> con sal aleatoria dinámica).", styles['BulletText']))
    story.append(Paragraph("• <b>Row Level Security (RLS):</b> En la infraestructura de base de datos PostgreSQL Cloud (Supabase), se implementa política de <b>Seguridad a Nivel de Filas (Row Level Security)</b>, asegurando que cada profesional médico solo pueda acceder a los registros e historias clínicas de los cuales es titular o autorizado.", styles['BulletText']))
    story.append(Spacer(1, 6))

    # 2.3 Auditoria Dual
    story.append(Paragraph("2.3. Sistema de Auditoría Inalterable (Audit Trail & Logging Dual)", styles['SubSecHeading']))
    story.append(Paragraph("• <b>Trazabilidad Absoluta:</b> Cumpliendo con la inalterabilidad de la Historia Clínica, History-Ar implementa un sistema de auditoría (<code>audit.py</code>) que captura de manera automática e inmodificable todo evento de lectura, creación, modificación, eliminación o exportación en PDF de datos clínicos.", styles['BulletText']))
    story.append(Paragraph("• <b>Mecanismo Dual de Resguardo:</b> Log local inmutable en <code>APPDATA/History-Ar/audit/audit_trail.log</code> sumado a la inserción paralela en la tabla <code>audit_logs</code> de la base de datos cloud.", styles['BulletText']))
    story.append(Paragraph("• <b>Metadatos Registrados:</b> Timestamp UTC (ISO-8601), ID de usuario/médico, ID de paciente, Acción (<code>LECTURA</code>, <code>CREACION</code>, <code>MODIFICACION</code>, <code>ELIMINACION</code>, <code>EXPORTACION_PDF</code>), IP de origen (con análisis <code>X-Forwarded-For</code>) y User-Agent.", styles['BulletText']))
    story.append(Spacer(1, 6))

    # 2.4 Seguridad de Red y OWASP
    story.append(Paragraph("2.4. Seguridad en Red, Comunicaciones y Protección OWASP", styles['SubSecHeading']))
    story.append(Paragraph("• <b>Cifrado en Tránsito (TLS/HTTPS):</b> Transmisión cifrada de extremo a extremo bajo <b>TLS 1.3</b>.", styles['BulletText']))
    story.append(Paragraph("• <b>Protección Anti-DoS y Fuerza Bruta:</b> Rate Limiting dinámico mediante <code>SlowAPI</code> en endpoints sensibles.", styles['BulletText']))
    story.append(Paragraph("• <b>Cabeceras de Seguridad y CORS:</b> Restricción estricta de orígenes autorizados para prevenir peticiones maliciosas entre sitios.", styles['BulletText']))
    story.append(Spacer(1, 6))

    # 2.5 Sanitizacion
    story.append(Paragraph("2.5. Sanitización e Integridad de Datos", styles['SubSecHeading']))
    story.append(Paragraph("• <b>Validación Cero Confianza:</b> Esquemas <b>Pydantic</b> y <b>SQLModel</b> para sanitización y tipado estricto de peticiones.", styles['BulletText']))
    story.append(Paragraph("• <b>Prevención de Inyección SQL:</b> Consultas parametrizadas vía ORM SQLAlchemy/SQLModel.", styles['BulletText']))
    story.append(Spacer(1, 8))

    # Seccion 3: Normativas y Leyes
    story.append(Paragraph("3. NORMATIVAS Y LEYES NACIONALES E INTERNACIONALES CUMPLIDAS", styles['SecHeading']))

    law_callout_data = [
        [Paragraph("<b>MARCO LEGAL ARGENTINO APLICABLE</b>", styles['CustomBodyBold'])],
        [Paragraph(
            "<b>1. Ley N° 25.326 de Protección de Datos Personales (Argentina) y Disposiciones AAIP:</b><br/>"
            "• <i>Tratamiento de Datos Sensibles (Arts. 2 y 7):</i> Los datos de salud son 'Datos Sensibles'. History-Ar exige el consentimiento informado del titular y prohíbe el uso secundario de la información.<br/>"
            "• <i>Medidas de Seguridad (Art. 9):</i> Adopción de medidas técnicas y organizativas para evitar la alteración, pérdida o acceso no autorizado.<br/>"
            "• <i>Derechos ARCO:</i> Garantía total de los derechos de Acceso, Rectificación, Cancelación y Oposición (Hábeas Data).<br/><br/>"
            "<b>2. Ley N° 26.529 - Derechos del Paciente en su Relación con los Profesionales e Instituciones de la Salud:</b><br/>"
            "• <i>Historia Clínica Electrónica (Arts. 12 al 21):</i> Reconocimiento de titularidad del paciente, intangibilidad, inalterabilidad garantizada vía Audit Log y confidencialidad absoluta.<br/><br/>"
            "<b>3. Ley N° 27.706 - Programa Federal de Única Historia Clínica Electrónica:</b><br/>"
            "• Cumplimiento de estándares nacionales de interoperabilidad, estructura unificada de datos y exportabilidad.<br/><br/>"
            "<b>4. Decreto Reglamentario N° 1079/2011:</b><br/>"
            "• Conservación digital, autenticación de profesionales y soporte para firma digital/electrónica.",
            styles['CalloutText']
        )]
    ]
    law_table = Table(law_callout_data, colWidths=[515])
    law_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), box_bg),
        ('BOX', (0,0), (-1,-1), 1, box_border),
        ('PADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,0), 6),
        ('BOTTOMPADDING', (0,0), (-1,0), 4),
    ]))
    story.append(law_table)
    story.append(Spacer(1, 8))

    story.append(Paragraph("3.5. Estándares Internacionales de Referencia", styles['SubSecHeading']))
    story.append(Paragraph("• <b>HIPAA (Health Insurance Portability and Accountability Act - EE.UU.):</b> Cumplimiento de la <i>Security Rule</i> (cifrado AES-256 en reposo/tránsito, control de acceso basado en roles RBAC y auditoría exhaustiva de PHI).", styles['BulletText']))
    story.append(Paragraph("• <b>GDPR (General Data Protection Regulation - UE):</b> Adopción de principios de <i>Privacy by Design</i>, minimización de datos, derecho al olvido y portabilidad estructurada.", styles['BulletText']))
    story.append(Spacer(1, 10))

    # Seccion 4: Cuadro Matriz de Cumplimiento
    story.append(Paragraph("4. CUADRO MATRIZ DE CUMPLIMIENTO TÉCNICO-LEGAL", styles['SecHeading']))

    table_data = [
        [
            Paragraph("Requisito Legal / Normativo", styles['TableHeader']),
            Paragraph("Medida Técnica Implementada en History-Ar", styles['TableHeader']),
            Paragraph("Componente del Sistema", styles['TableHeader']),
            Paragraph("Estado", styles['TableHeader'])
        ],
        [
            Paragraph("<b>Cifrado de Datos Sensibles</b><br/>(Ley 25.326 Art. 9 / HIPAA)", styles['TableCellBold']),
            Paragraph("Cifrado granular Fernet (AES-256 CBC) derivado con PBKDF2HMAC (SHA-256, 100k iteraciones).", styles['TableCell']),
            Paragraph("<code>crypto_utils.py</code>", styles['TableCell']),
            Paragraph("CUMPLIDO", styles['StatusCumplido'])
        ],
        [
            Paragraph("<b>Inalterabilidad y Trazabilidad</b><br/>(Ley 26.529 Art. 12)", styles['TableCellBold']),
            Paragraph("Audit Log dual (Archivo local inmutable + Tabla Supabase Cloud) para cada operación.", styles['TableCell']),
            Paragraph("<code>audit.py</code>", styles['TableCell']),
            Paragraph("CUMPLIDO", styles['StatusCumplido'])
        ],
        [
            Paragraph("<b>Autenticación y RBAC</b><br/>(Ley 26.529 / GDPR)", styles['TableCellBold']),
            Paragraph("Autenticación JWT Bearer, hashing bcrypt y Row Level Security (RLS) en Supabase.", styles['TableCell']),
            Paragraph("<code>auth.py</code> / Supabase RLS", styles['TableCell']),
            Paragraph("CUMPLIDO", styles['StatusCumplido'])
        ],
        [
            Paragraph("<b>Seguridad en Comunicaciones</b><br/>(Ley 25.326 / OWASP)", styles['TableCellBold']),
            Paragraph("Cifrado TLS 1.3 (HTTPS), Rate Limiting dinámico contra DoS y CORS restringido.", styles['TableCell']),
            Paragraph("FastAPI / <code>SlowAPI</code>", styles['TableCell']),
            Paragraph("CUMPLIDO", styles['StatusCumplido'])
        ],
        [
            Paragraph("<b>Integridad y Sanitización</b><br/>(Buenas Prácticas OWASP)", styles['TableCellBold']),
            Paragraph("Esquemas de validación estricta Pydantic y consultas parametrizadas con ORM.", styles['TableCell']),
            Paragraph("<code>schemas.py</code> / SQLModel", styles['TableCell']),
            Paragraph("CUMPLIDO", styles['StatusCumplido'])
        ],
        [
            Paragraph("<b>Portabilidad y Supresión</b><br/>(Ley 25.326 / Ley 27.706)", styles['TableCellBold']),
            Paragraph("Exportación estructurada JSON/PDF y protocolo de borrado seguro definitivo tras 30 días.", styles['TableCell']),
            Paragraph("Export & Cleanup Engine", styles['TableCell']),
            Paragraph("CUMPLIDO", styles['StatusCumplido'])
        ]
    ]

    compliance_table = Table(table_data, colWidths=[130, 200, 110, 75])
    compliance_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), navy),
        ('ALIGN', (0,0), (-1,0), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, light_bg]),
        ('PADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,0), 6),
        ('TOPPADDING', (0,0), (-1,0), 6),
    ]))
    story.append(compliance_table)
    story.append(Spacer(1, 12))

    # Seccion 5: Conclusion
    story.append(Paragraph("5. CONCLUSIÓN Y CERTIFICACIÓN TÉCNICA", styles['SecHeading']))
    conclusion_text = (
        "El sistema <b>History-Ar</b> satisface íntegramente las exigencias de seguridad informática, cifrado de datos de salud "
        "y regulaciones legales vigentes en la República Argentina e internacionales. La combinación de cifrado AES-256 a nivel de campo, "
        "autenticación estricta y registros de auditoría inalterables convierte a History-Ar en una solución de vanguardia, "
        "confiable e inexpugnable para la gestión de historias clínicas electrónicas."
    )
    story.append(Paragraph(conclusion_text, styles['CustomBody']))
    story.append(Spacer(1, 15))

    # Firma
    sig_block = [
        [Paragraph("<b>EQUIPO DESARROLLADOR DE HISTORY-AR</b><br/>Ingeniería en Sistemas de Información", styles['TableCellBold'])],
        [Paragraph("Certificación de Seguridad y Cumplimiento Normativo (Leyes 25.326 y 26.529)", styles['TableCell'])]
    ]
    sig_table = Table(sig_block, colWidths=[250])
    sig_table.setStyle(TableStyle([
        ('LINEABOVE', (0,0), (-1,0), 1, navy),
        ('PADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(KeepTogether([sig_table]))

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF de Seguridad generado exitosamente en: {output_path}")

if __name__ == "__main__":
    docs_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../docs'))
    os.makedirs(docs_dir, exist_ok=True)
    pdf_path = os.path.join(docs_dir, 'informe_seguridad_y_proteccion_de_datos_history_ar.pdf')
    create_security_pdf(pdf_path)
