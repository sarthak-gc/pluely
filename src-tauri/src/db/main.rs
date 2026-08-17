use tauri_plugin_sql::{Migration, MigrationKind};

/// Returns all database migrations
pub fn migrations() -> Vec<Migration> {
    vec![
        // Migration 1: Create system_prompts table with indexes and triggers
        Migration {
            version: 1,
            description: "create_system_prompts_table",
            sql: include_str!("migrations/system-prompts.sql"),
            kind: MigrationKind::Up,
        },
        // Migration 2: Create chat history tables (conversations and messages)
        Migration {
            version: 2,
            description: "create_chat_history_tables",
            sql: include_str!("migrations/chat-history.sql"),
            kind: MigrationKind::Up,
        },
        // Migration 3: Call checklists and per-session recordings
        Migration {
            version: 3,
            description: "create_checklists_and_call_sessions",
            sql: include_str!("migrations/checklists.sql"),
            kind: MigrationKind::Up,
        },
        // Migration 4: Keep the full transcript alongside the per-item verdicts
        Migration {
            version: 4,
            description: "add_call_session_transcript",
            sql: include_str!("migrations/call-transcript.sql"),
            kind: MigrationKind::Up,
        },
    ]
}
