// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri_plugin_shell::ShellExt;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // El sidecar backend de FastAPI solo se ejecuta en compilación de producción.
            // Para desarrollo, iniciamos FastAPI independientemente para facilitar el hot-reload.
            #[cfg(not(debug_assertions))]
            {
                let shell = app.shell();
                let sidecar = shell.sidecar("backend").map_err(|e| {
                    eprintln!("Error al obtener configuración de sidecar backend: {:?}", e);
                    e
                })?;
                
                let (mut _rx, _tx) = sidecar.spawn().map_err(|e| {
                    eprintln!("Error al iniciar el sidecar backend: {:?}", e);
                    e
                })?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
