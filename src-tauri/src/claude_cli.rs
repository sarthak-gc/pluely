// Runs the local `claude` CLI in non-interactive mode as an LLM backend.
//
// Intended for local development and personal use on your own Claude seat.
// Do not ship a build that routes other people's requests through it — that
// turns one subscription into a shared service.
use std::path::PathBuf;
use tokio::process::Command;

// A GUI app launched from Finder gets a minimal PATH that omits ~/.local/bin
// and Homebrew, so `claude` must be resolved by absolute path.
fn resolve_claude_binary() -> Result<PathBuf, String> {
    if let Ok(explicit) = std::env::var("CLAUDE_CLI_PATH") {
        let p = PathBuf::from(explicit);
        if p.is_file() {
            return Ok(p);
        }
    }

    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Some(home) = std::env::var_os("HOME") {
        let home = PathBuf::from(home);
        candidates.push(home.join(".local/bin/claude"));
        candidates.push(home.join(".claude/local/claude"));
        candidates.push(home.join(".bun/bin/claude"));
    }
    candidates.push(PathBuf::from("/opt/homebrew/bin/claude"));
    candidates.push(PathBuf::from("/usr/local/bin/claude"));

    candidates
        .into_iter()
        .find(|p| p.is_file())
        .ok_or_else(|| {
            "claude CLI not found. Set CLAUDE_CLI_PATH to its absolute path.".to_string()
        })
}

#[tauri::command]
pub async fn ask_claude_cli(prompt: String, system: Option<String>) -> Result<String, String> {
    if prompt.trim().is_empty() {
        return Err("Prompt is empty".to_string());
    }

    let binary = resolve_claude_binary()?;

    let mut cmd = Command::new(&binary);
    cmd.arg("-p").arg(&prompt);
    if let Some(system) = system.as_deref().filter(|s| !s.trim().is_empty()) {
        cmd.arg("--append-system-prompt").arg(system);
    }
    // The CLI writes its own config under HOME; without it, auth lookup fails.
    if let Some(home) = std::env::var_os("HOME") {
        cmd.env("HOME", home);
    }

    let output = cmd
        .output()
        .await
        .map_err(|e| format!("Failed to run claude CLI: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            format!("claude CLI exited with {}", output.status)
        } else {
            stderr
        });
    }

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if stdout.is_empty() {
        return Err("claude CLI returned no output".to_string());
    }

    Ok(stdout)
}
