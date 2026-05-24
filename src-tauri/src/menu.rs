use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Manager};

/// Native File / Edit menu bar; forwards clicks to the webview as `menu-action` events.
pub fn install(handle: &AppHandle) -> tauri::Result<()> {
    let file_new = MenuItemBuilder::with_id("file_new", "New")
        .accelerator("CmdOrCtrl+N")
        .build(handle)?;
    let file_open = MenuItemBuilder::with_id("file_open", "Open...")
        .accelerator("CmdOrCtrl+O")
        .build(handle)?;
    let file_save = MenuItemBuilder::with_id("file_save", "Save")
        .accelerator("CmdOrCtrl+S")
        .build(handle)?;
    let file_save_as = MenuItemBuilder::with_id("file_save_as", "Save As...")
        .accelerator("CmdOrCtrl+Shift+S")
        .build(handle)?;
    let file_exit = MenuItemBuilder::with_id("file_exit", "Exit")
        .build(handle)?;
    #[cfg(target_os = "macos")]
    let file_quit = MenuItemBuilder::with_id("file_exit", "Quit")
        .accelerator("CmdOrCtrl+Q")
        .build(handle)?;

    #[cfg(target_os = "macos")]
    let file_menu = SubmenuBuilder::new(handle, "File")
        .item(&file_new)
        .item(&file_open)
        .item(&file_save)
        .item(&file_save_as)
        .build()?;
    #[cfg(not(target_os = "macos"))]
    let file_menu = SubmenuBuilder::new(handle, "File")
        .item(&file_new)
        .item(&file_open)
        .item(&file_save)
        .item(&file_save_as)
        .separator()
        .item(&file_exit)
        .build()?;

    let edit_undo = MenuItemBuilder::with_id("edit_undo", "Undo")
        .accelerator("CmdOrCtrl+Z")
        .build(handle)?;
    let edit_redo = MenuItemBuilder::with_id("edit_redo", "Redo")
        .accelerator("CmdOrCtrl+Y")
        .build(handle)?;

    let edit_menu = SubmenuBuilder::new(handle, "Edit")
        .item(&edit_undo)
        .item(&edit_redo)
        .build()?;

    let menu = {
        #[cfg(target_os = "macos")]
        {
            let app_menu = SubmenuBuilder::new(handle, "HaulCalc")
                .about(None)
                .separator()
                .item(&file_quit)
                .build()?;
            MenuBuilder::new(handle)
                .item(&app_menu)
                .item(&file_menu)
                .item(&edit_menu)
                .build()?
        }
        #[cfg(not(target_os = "macos"))]
        {
            MenuBuilder::new(handle)
                .item(&file_menu)
                .item(&edit_menu)
                .build()?
        }
    };

    handle.set_menu(menu)?;

    let app_handle = handle.clone();
    handle.on_menu_event(move |_window, event| {
        let id = event.id().as_ref();
        if let Some(win) = app_handle.get_webview_window("main") {
            let _ = win.emit("menu-action", id);
        }
    });

    Ok(())
}
