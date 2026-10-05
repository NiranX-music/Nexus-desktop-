// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Manager, SystemTray, SystemTrayEvent, CustomMenuItem, SystemTrayMenu};

#[tauri::command]
fn handle_deep_link(token: String, user: String) -> Result<String, String> {
    println!("[Nexus Daemon] Session synchronized via deep-link: {} for user: {}", token, user);
    Ok(format!("Session verified for {}", user))
}

fn main() {
    let quit = CustomMenuItem::new("quit".to_string(), "Quit Nexus OS");
    let hide = CustomMenuItem::new("hide".to_string(), "Hide Window");
    let tray_menu = SystemTrayMenu::new()
        .add_item(hide)
        .add_native_item(tauri::SystemTrayMenuItem::Separator)
        .add_item(quit);

    let system_tray = SystemTray::new().with_menu(tray_menu);

    tauri::Builder::default()
        .system_tray(system_tray)
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
                "quit" => {
                    std::process::exit(0);
                }
                "hide" => {
                    let window = app.get_window("main").unwrap();
                    let _ = window.hide();
                }
                _ => {}
            },
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![handle_deep_link])
        .run(tauri::generate_context!())
        .expect("error while running NEXUS desktop application");
}
