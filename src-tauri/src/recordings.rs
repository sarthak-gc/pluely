// Session audio recordings on disk.
//
// The webview cannot write files (no fs plugin) and cannot load file:// URLs
// from its http origin, so audio crosses the boundary as base64 in both
// directions. Recordings are a few MB each, which is fine for that.
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize)]
pub struct RecordingInfo {
    file_name: String,
    size_bytes: u64,
    modified_ms: u64,
}

fn recordings_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("No app data dir: {}", e))?
        .join("recordings");
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create recordings dir: {}", e))?;
    Ok(dir)
}

// Rejects anything with a path separator or traversal component, so a
// frontend-supplied name can never escape the recordings directory.
fn safe_join(dir: &PathBuf, file_name: &str) -> Result<PathBuf, String> {
    let trimmed = file_name.trim();
    if trimmed.is_empty()
        || trimmed.contains('/')
        || trimmed.contains('\\')
        || trimmed.contains("..")
    {
        return Err(format!("Invalid recording name: {}", file_name));
    }
    Ok(dir.join(trimmed))
}

#[tauri::command]
pub async fn save_recording(
    app: AppHandle,
    file_name: String,
    audio_base64: String,
) -> Result<String, String> {
    let dir = recordings_dir(&app)?;
    let path = safe_join(&dir, &file_name)?;

    // Strip a data: URL prefix if the caller passed one straight from a
    // FileReader result.
    let payload = audio_base64
        .split_once("base64,")
        .map(|(_, b)| b)
        .unwrap_or(&audio_base64);

    let bytes = STANDARD
        .decode(payload.trim())
        .map_err(|e| format!("Invalid base64 audio: {}", e))?;

    if bytes.is_empty() {
        return Err("Recording is empty".to_string());
    }

    fs::write(&path, &bytes).map_err(|e| format!("Failed to write recording: {}", e))?;
    Ok(file_name)
}

#[tauri::command]
pub async fn list_recordings(app: AppHandle) -> Result<Vec<RecordingInfo>, String> {
    let dir = recordings_dir(&app)?;
    let entries =
        fs::read_dir(&dir).map_err(|e| format!("Failed to read recordings dir: {}", e))?;

    let mut out: Vec<RecordingInfo> = Vec::new();
    for entry in entries.flatten() {
        let meta = match entry.metadata() {
            Ok(m) if m.is_file() => m,
            _ => continue,
        };
        let file_name = entry.file_name().to_string_lossy().to_string();
        if file_name.starts_with('.') {
            continue;
        }
        let modified_ms = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        out.push(RecordingInfo {
            file_name,
            size_bytes: meta.len(),
            modified_ms,
        });
    }

    out.sort_by(|a, b| b.modified_ms.cmp(&a.modified_ms));
    Ok(out)
}

#[tauri::command]
pub async fn read_recording(app: AppHandle, file_name: String) -> Result<String, String> {
    let dir = recordings_dir(&app)?;
    let path = safe_join(&dir, &file_name)?;
    let bytes = fs::read(&path).map_err(|e| format!("Failed to read recording: {}", e))?;
    Ok(STANDARD.encode(bytes))
}

#[tauri::command]
pub async fn delete_recording(app: AppHandle, file_name: String) -> Result<(), String> {
    let dir = recordings_dir(&app)?;
    let path = safe_join(&dir, &file_name)?;
    fs::remove_file(&path).map_err(|e| format!("Failed to delete recording: {}", e))?;
    Ok(())
}
