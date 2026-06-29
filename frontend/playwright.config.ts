import { defineConfig, devices } from '@playwright/test';

/**
 * Ver documentación de Playwright para más detalles:
 * https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests-e2e',
  // Ejecutar pruebas en paralelo para agilizar
  fullyParallel: true,
  // Forzar fallos si se deja test.only en CI
  forbidOnly: !!process.env.CI,
  // Reintentos en CI
  retries: process.env.CI ? 2 : 0,
  // Límite de workers
  workers: process.env.CI ? 1 : undefined,
  // Reporte en formato HTML
  reporter: 'html',
  
  use: {
    // Dirección URL base donde corre Vite por defecto para Tauri
    baseURL: 'http://localhost:1420',
    // Capturar trazas al reintentar un test fallido
    trace: 'on-first-retry',
  },

  // Proyectos para diferentes navegadores (probamos con Chromium por defecto)
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Iniciar automáticamente el servidor web de desarrollo antes de las pruebas
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:1420',
    reuseExistingServer: !process.env.CI,
    timeout: 10 * 1000,
  },
});
