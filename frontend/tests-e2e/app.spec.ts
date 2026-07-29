import { test, expect } from '@playwright/test';

test.describe('History-Ar Frontend', () => {
  test.beforeEach(async ({ page }) => {
    // Ir a la URL raíz (http://localhost:1420 definido en playwright.config.ts)
    await page.goto('/');
  });

  test('debe cargar la aplicación con el sidebar y el listado de pacientes', async ({ page }) => {
    // Verificar que el nombre del software está en el sidebar
    const logoText = page.locator('.logo-text');
    await expect(logoText).toHaveText('History-Ar');

    // Verificar que el directorio se muestra correctamente
    const headerTitle = page.locator('h2');
    await expect(headerTitle).toContainText('Directorio de Historias Clínicas');
    
    // El input de búsqueda debe estar visible
    const searchInput = page.locator('input[placeholder*="Buscar paciente"]');
    await expect(searchInput).toBeVisible();
  });

  test('debe permitir navegar a la pantalla de registro de nuevo paciente', async ({ page }) => {
    // Hacer clic en el botón de registro del sidebar
    const btnRegisterSidebar = page.locator('text=Registrar Paciente');
    await expect(btnRegisterSidebar).toBeVisible();
    await btnRegisterSidebar.click();

    // Comprobar que el título cambió a la ficha de registro
    const headerTitle = page.locator('h2');
    await expect(headerTitle).toContainText('Registrar Ficha de Paciente');

    // Comprobar que los campos requeridos (como Nombre, Apellido, DNI) están presentes
    await expect(page.locator('label:has-text("Nombre *")')).toBeVisible();
    await expect(page.locator('label:has-text("Apellido *")')).toBeVisible();
    await expect(page.locator('label:has-text("DNI (Identificación Única) *")')).toBeVisible();
  });

  test('debe permitir ver las opciones de impresión para un paciente registrado', async ({ page }) => {
    // Lista reactiva mockeada para pacientes
    let pacientesMock = [];

    // Interceptar llamadas de salud de la API
    await page.route('**/api/health', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: "ok" }) });
    });

    // Interceptar llamadas GET y POST de pacientes
    await page.route('**/api/pacientes', async route => {
      if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}');
        const newPaciente = { 
          id: 1, 
          nombre: body.nombre, 
          apellido: body.apellido, 
          dni: body.dni, 
          fecha_nacimiento: body.fecha_nacimiento,
          fecha_creacion: new Date().toISOString(), 
          consultas: [], 
          documentos: [] 
        };
        pacientesMock.push(newPaciente);
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(newPaciente) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pacientesMock) });
      }
    });

    // Interceptar llamada de detalles del paciente
    await page.route('**/api/pacientes/1', async route => {
      const pacienteDetalle = {
        id: 1,
        nombre: 'Carlos',
        apellido: 'Sánchez',
        dni: '8888',
        fecha_nacimiento: '1985-04-12',
        fecha_creacion: new Date().toISOString(),
        consultas: [
          {
            id: 101,
            motivo: 'Chequeo General',
            diagnostico: 'Paciente saludable',
            tratamiento: 'Continuar dieta balanceada',
            fecha: new Date().toISOString(),
            paciente_id: 1
          }
        ],
        documentos: []
      };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pacienteDetalle) });
    });

    // 1. Ir a registrar
    await page.locator('text=Registrar Paciente').click();
    
    // 2. Llenar datos
    await page.locator('input').nth(0).fill('Carlos');
    await page.locator('input').nth(1).fill('Sánchez');
    await page.locator('input').nth(2).fill('8888');
    await page.locator('input').nth(3).fill('1985-04-12');
    
    // 3. Enviar (Playwright maneja la alerta nativa y la acepta por defecto)
    await page.locator('button:has-text("Guardar Ficha del Paciente")').click();
    
    // 4. Seleccionar el paciente Carlos de la lista
    const pacienteCard = page.locator('text=Sánchez, Carlos');
    await expect(pacienteCard).toBeVisible();
    await pacienteCard.click();
    
    // 5. Hacer clic en la pestaña de impresión
    const printTab = page.locator('button:has-text("Imprimir Historia")');
    await expect(printTab).toBeVisible();
    await printTab.click();
    
    // 6. Verificar que los controles de impresión están cargados
    await expect(page.locator('text=Configurar Documento de Impresión')).toBeVisible();
    await expect(page.locator('label:has-text("Desde la Fecha")')).toBeVisible();
    await expect(page.locator('label:has-text("Hasta la Fecha")')).toBeVisible();
    await expect(page.locator('button:has-text("Generar y Abrir Panel de Impresión")')).toBeVisible();
  });

  test('debe permitir navegar a las nuevas secciones: Agenda y Configuración', async ({ page }) => {
    // Interceptar llamadas para evitar fallos de red
    await page.route('**/api/health', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: "ok" }) });
    });
    await page.route('**/api/citas', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/api/configuracion', async route => {
      await route.fulfill({ 
        status: 200, 
        contentType: 'application/json', 
        body: JSON.stringify({ doctor_nombre: 'Dr. House', doctor_especialidad: 'Diagnóstico', doctor_matricula: '123' }) 
      });
    });

    // 1. Ir a Agenda
    await page.locator('text=Agenda y Turnos').click();
    await expect(page.locator('h2')).toContainText('Agenda de Turnos Médicos');
    await expect(page.locator('text=Programar Nuevo Turno')).toBeVisible();

    // 2. Ir a Configuración
    await page.locator('text=Configuración').click();
    await expect(page.locator('h2')).toContainText('Configuración del Consultorio');
    await expect(page.locator('text=Firma y Datos del Profesional')).toBeVisible();
    await expect(page.locator('text=Resguardo de Información')).toBeVisible();
  });
});
