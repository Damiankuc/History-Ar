import { test, expect } from '@playwright/test';

test.describe('Be-Pacient Frontend', () => {
  test.beforeEach(async ({ page }) => {
    // Ir a la URL raíz (http://localhost:1420 definido en playwright.config.ts)
    await page.goto('/');
  });

  test('debe cargar la aplicación con el sidebar y el listado de pacientes', async ({ page }) => {
    // Verificar que el nombre del software está en el sidebar
    const logoText = page.locator('.logo-text');
    await expect(logoText).toHaveText('Be-Pacient');

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
});
