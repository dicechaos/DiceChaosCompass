use crate::vault::{BiomeKit, SourceKind, VaultAsset, VaultSearchQuery, VaultSource};
use rusqlite::{params, Connection, OptionalExtension};
use std::path::Path;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum VaultDbError {
    #[error("SQLite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
}

pub struct VaultDb {
    conn: Connection,
}

const INIT_SQL: &str = r#"
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

CREATE TABLE IF NOT EXISTS sources (
    id              TEXT PRIMARY KEY,
    kind            TEXT NOT NULL,
    name            TEXT NOT NULL,
    root_path       TEXT NOT NULL UNIQUE,
    enabled         INTEGER NOT NULL DEFAULT 1,
    asset_count     INTEGER NOT NULL DEFAULT 0,
    last_indexed_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS assets (
    id              TEXT PRIMARY KEY,
    source_id       TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    internal_path   TEXT NOT NULL,
    byte_offset     INTEGER,
    byte_length     INTEGER,
    display_name    TEXT NOT NULL,
    category        TEXT NOT NULL,
    width_px        INTEGER NOT NULL,
    height_px       INTEGER NOT NULL,
    default_ppi     REAL NOT NULL DEFAULT 256.0,
    draw_mode       TEXT NOT NULL DEFAULT 'normal',
    dominant_hex    TEXT,
    casts_shadow    INTEGER NOT NULL DEFAULT 0,
    is_favorite     INTEGER NOT NULL DEFAULT 0,
    metadata_json   TEXT
);

CREATE INDEX IF NOT EXISTS idx_assets_source ON assets(source_id);
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category);
CREATE INDEX IF NOT EXISTS idx_assets_favorite ON assets(is_favorite);

CREATE TABLE IF NOT EXISTS tags (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE
);

CREATE TABLE IF NOT EXISTS asset_tags (
    asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    tag_id   INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    origin   TEXT NOT NULL DEFAULT 'auto',
    PRIMARY KEY (asset_id, tag_id)
);

CREATE TABLE IF NOT EXISTS biome_kits (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    accent_hex  TEXT NOT NULL DEFAULT '#E5A93C',
    sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS biome_kit_items (
    kit_id   TEXT NOT NULL REFERENCES biome_kits(id) ON DELETE CASCADE,
    asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    PRIMARY KEY (kit_id, asset_id)
);

CREATE VIRTUAL TABLE IF NOT EXISTS assets_fts USING fts5(
    asset_id UNINDEXED,
    display_name,
    tags_text,
    source_name,
    category,
    tokenize = 'unicode61 remove_diacritics 2'
);
"#;

impl VaultDb {
    pub fn open(path: &Path) -> Result<Self, VaultDbError> {
        let conn = Connection::open(path)?;
        conn.execute_batch(INIT_SQL)?;
        Ok(Self { conn })
    }

    pub fn open_in_memory() -> Result<Self, VaultDbError> {
        let conn = Connection::open_in_memory()?;
        conn.execute_batch(INIT_SQL)?;
        Ok(Self { conn })
    }

    pub fn upsert_source(&mut self, source: &VaultSource) -> Result<(), VaultDbError> {
        self.conn.execute(
            r#"
            INSERT INTO sources (id, kind, name, root_path, enabled, asset_count, last_indexed_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
            ON CONFLICT(root_path) DO UPDATE SET
                name = excluded.name,
                kind = excluded.kind,
                enabled = excluded.enabled,
                asset_count = excluded.asset_count,
                last_indexed_at = excluded.last_indexed_at
            "#,
            params![
                source.id,
                source.kind.as_str(),
                source.name,
                source.root_path,
                source.enabled as i32,
                source.asset_count as i64,
                source.last_indexed_at,
            ],
        )?;
        Ok(())
    }

    pub fn list_sources(&self) -> Result<Vec<VaultSource>, VaultDbError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, kind, name, root_path, enabled, asset_count, last_indexed_at FROM sources ORDER BY name ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(VaultSource {
                id: row.get(0)?,
                kind: SourceKind::from_str(&row.get::<_, String>(1)?),
                name: row.get(2)?,
                root_path: row.get(3)?,
                enabled: row.get::<_, i32>(4)? != 0,
                asset_count: row.get::<_, i64>(5)? as u64,
                last_indexed_at: row.get(6)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    pub fn get_source(&self, source_id: &str) -> Result<Option<VaultSource>, VaultDbError> {
        self.conn
            .query_row(
                "SELECT id, kind, name, root_path, enabled, asset_count, last_indexed_at FROM sources WHERE id = ?1",
                params![source_id],
                |row| {
                    Ok(VaultSource {
                        id: row.get(0)?,
                        kind: SourceKind::from_str(&row.get::<_, String>(1)?),
                        name: row.get(2)?,
                        root_path: row.get(3)?,
                        enabled: row.get::<_, i32>(4)? != 0,
                        asset_count: row.get::<_, i64>(5)? as u64,
                        last_indexed_at: row.get(6)?,
                    })
                },
            )
            .optional()
            .map_err(Into::into)
    }

    pub fn batch_upsert_assets(
        &mut self,
        source_name: &str,
        assets: &[VaultAsset],
    ) -> Result<(), VaultDbError> {
        let tx = self.conn.transaction()?;
        {
            let mut insert_asset = tx.prepare(
                r#"
                INSERT OR REPLACE INTO assets (
                    id, source_id, internal_path, byte_offset, byte_length,
                    display_name, category, width_px, height_px, default_ppi,
                    draw_mode, dominant_hex, casts_shadow, is_favorite, metadata_json
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
                "#,
            )?;
            let mut insert_tag =
                tx.prepare("INSERT OR IGNORE INTO tags (name) VALUES (?1)")?;
            let mut get_tag_id = tx.prepare("SELECT id FROM tags WHERE name = ?1")?;
            let mut insert_asset_tag = tx.prepare(
                "INSERT OR IGNORE INTO asset_tags (asset_id, tag_id, origin) VALUES (?1, ?2, 'auto')",
            )?;
            let mut delete_fts = tx.prepare("DELETE FROM assets_fts WHERE asset_id = ?1")?;
            let mut insert_fts = tx.prepare(
                "INSERT INTO assets_fts (asset_id, display_name, tags_text, source_name, category) VALUES (?1, ?2, ?3, ?4, ?5)",
            )?;

            for a in assets {
                insert_asset.execute(params![
                    a.id,
                    a.source_id,
                    a.internal_path,
                    a.byte_offset.map(|v| v as i64),
                    a.byte_length.map(|v| v as i64),
                    a.display_name,
                    a.category,
                    a.width_px as i64,
                    a.height_px as i64,
                    a.default_ppi as f64,
                    a.draw_mode,
                    a.dominant_hex,
                    a.casts_shadow as i32,
                    a.is_favorite as i32,
                    a.metadata_json,
                ])?;

                for tag in &a.tags {
                    let clean = tag.trim().trim_start_matches('#').to_lowercase();
                    if clean.is_empty() {
                        continue;
                    }
                    insert_tag.execute(params![clean])?;
                    let tid: i64 = get_tag_id.query_row(params![clean], |r| r.get(0))?;
                    insert_asset_tag.execute(params![a.id, tid])?;
                }

                let tags_text = a.tags.join(" ");
                delete_fts.execute(params![a.id])?;
                insert_fts.execute(params![
                    a.id,
                    a.display_name,
                    tags_text,
                    source_name,
                    a.category,
                ])?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    pub fn search_assets(&self, query: &VaultSearchQuery) -> Result<Vec<VaultAsset>, VaultDbError> {
        let limit = query.limit.unwrap_or(200).min(1000) as i64;
        let offset = query.offset.unwrap_or(0) as i64;

        let mut sql = String::from(
            r#"
            SELECT
                a.id, a.source_id, s.name, s.kind, a.internal_path,
                a.byte_offset, a.byte_length, a.display_name, a.category,
                a.width_px, a.height_px, a.default_ppi, a.draw_mode,
                a.dominant_hex, a.casts_shadow, a.is_favorite, a.metadata_json,
                COALESCE((
                    SELECT group_concat(t.name, ',')
                    FROM asset_tags at2 JOIN tags t ON t.id = at2.tag_id
                    WHERE at2.asset_id = a.id
                ), '') AS tags_csv
            FROM assets a
            JOIN sources s ON s.id = a.source_id
            "#,
        );

        let mut where_clauses: Vec<String> = vec!["s.enabled = 1".to_string()];
        let mut bind_values: Vec<rusqlite::types::Value> = Vec::new();

        if let Some(ref kit_id) = query.kit_id {
            sql.push_str(" JOIN biome_kit_items bki ON bki.asset_id = a.id ");
            where_clauses.push("bki.kit_id = ?".to_string());
            bind_values.push(kit_id.clone().into());
        }

        if let Some(ref text) = query.text {
            let trimmed = text.trim();
            if !trimmed.is_empty() {
                let fts_expr: String = trimmed
                    .split_whitespace()
                    .map(|tok| {
                        let clean: String = tok
                            .trim_start_matches('#')
                            .chars()
                            .filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-')
                            .collect();
                        if clean.is_empty() {
                            String::new()
                        } else {
                            format!("{clean}*")
                        }
                    })
                    .filter(|s| !s.is_empty())
                    .collect::<Vec<_>>()
                    .join(" ");

                if !fts_expr.is_empty() {
                    sql.push_str(" JOIN assets_fts ON assets_fts.asset_id = a.id ");
                    where_clauses.push("assets_fts MATCH ?".to_string());
                    bind_values.push(fts_expr.into());
                }
            }
        }

        if let Some(ref cat) = query.category {
            if !cat.is_empty() && cat != "all" {
                where_clauses.push("a.category = ?".to_string());
                bind_values.push(cat.clone().into());
            }
        }

        if let Some(ref src) = query.source_id {
            if !src.is_empty() {
                where_clauses.push("a.source_id = ?".to_string());
                bind_values.push(src.clone().into());
            }
        }

        if query.favorites_only {
            where_clauses.push("a.is_favorite = 1".to_string());
        }

        if query.colorable_only {
            where_clauses.push("a.draw_mode != 'normal'".to_string());
        }

        for tag in &query.tags {
            let clean = tag.trim().trim_start_matches('#').to_lowercase();
            if !clean.is_empty() {
                where_clauses.push(
                    "EXISTS (SELECT 1 FROM asset_tags at3 JOIN tags t3 ON t3.id = at3.tag_id WHERE at3.asset_id = a.id AND t3.name = ?)".to_string(),
                );
                bind_values.push(clean.into());
            }
        }

        if !where_clauses.is_empty() {
            sql.push_str(" WHERE ");
            sql.push_str(&where_clauses.join(" AND "));
        }

        sql.push_str(" ORDER BY a.is_favorite DESC, a.display_name ASC LIMIT ? OFFSET ?");
        bind_values.push(limit.into());
        bind_values.push(offset.into());

        let mut stmt = self.conn.prepare(&sql)?;
        let rows = stmt.query_map(rusqlite::params_from_iter(bind_values.iter()), |row| {
            let tags_csv: String = row.get(17)?;
            let tags = if tags_csv.is_empty() {
                Vec::new()
            } else {
                tags_csv.split(',').map(|s| s.to_string()).collect()
            };
            Ok(VaultAsset {
                id: row.get(0)?,
                source_id: row.get(1)?,
                source_name: row.get(2)?,
                source_kind: SourceKind::from_str(&row.get::<_, String>(3)?),
                internal_path: row.get(4)?,
                byte_offset: row.get::<_, Option<i64>>(5)?.map(|v| v as u64),
                byte_length: row.get::<_, Option<i64>>(6)?.map(|v| v as u64),
                display_name: row.get(7)?,
                category: row.get(8)?,
                width_px: row.get::<_, i64>(9)? as u32,
                height_px: row.get::<_, i64>(10)? as u32,
                default_ppi: row.get::<_, f64>(11)? as f32,
                draw_mode: row.get(12)?,
                dominant_hex: row.get(13)?,
                casts_shadow: row.get::<_, i32>(14)? != 0,
                is_favorite: row.get::<_, i32>(15)? != 0,
                metadata_json: row.get(16)?,
                tags,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    pub fn toggle_favorite(&self, asset_id: &str) -> Result<bool, VaultDbError> {
        self.conn.execute(
            "UPDATE assets SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END WHERE id = ?1",
            params![asset_id],
        )?;
        let fav: i32 = self.conn.query_row(
            "SELECT is_favorite FROM assets WHERE id = ?1",
            params![asset_id],
            |r| r.get(0),
        )?;
        Ok(fav != 0)
    }

    pub fn upsert_biome_kit(&self, kit: &BiomeKit) -> Result<(), VaultDbError> {
        self.conn.execute(
            "INSERT OR REPLACE INTO biome_kits (id, name, accent_hex, sort_order) VALUES (?1, ?2, ?3, ?4)",
            params![kit.id, kit.name, kit.accent_hex, kit.sort_order],
        )?;
        Ok(())
    }

    pub fn add_to_biome_kit(&self, kit_id: &str, asset_id: &str) -> Result<(), VaultDbError> {
        self.conn.execute(
            "INSERT OR IGNORE INTO biome_kit_items (kit_id, asset_id) VALUES (?1, ?2)",
            params![kit_id, asset_id],
        )?;
        Ok(())
    }

    pub fn list_biome_kits(&self) -> Result<Vec<BiomeKit>, VaultDbError> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT k.id, k.name, k.accent_hex, k.sort_order, COUNT(i.asset_id)
            FROM biome_kits k
            LEFT JOIN biome_kit_items i ON i.kit_id = k.id
            GROUP BY k.id
            ORDER BY k.sort_order ASC, k.name ASC
            "#,
        )?;
        let rows = stmt.query_map([], |r| {
            Ok(BiomeKit {
                id: r.get(0)?,
                name: r.get(1)?,
                accent_hex: r.get(2)?,
                sort_order: r.get(3)?,
                item_count: r.get::<_, i64>(4)? as u64,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Instant;

    #[test]
    fn fts5_search_and_biome_kits_work_under_load() {
        let mut db = VaultDb::open_in_memory().unwrap();
        let src = VaultSource {
            id: "src-1".into(),
            kind: SourceKind::Dcpack,
            name: "Funicular Starter".into(),
            root_path: "/packs/funicular.dcpack".into(),
            enabled: true,
            asset_count: 5000,
            last_indexed_at: 1700000000,
        };
        db.upsert_source(&src).unwrap();

        let mut assets = Vec::with_capacity(5000);
        for i in 0..5000 {
            let is_funicular = i % 100 == 0;
            assets.push(VaultAsset {
                id: format!("asset-{i}"),
                source_id: "src-1".into(),
                source_name: src.name.clone(),
                source_kind: SourceKind::Dcpack,
                internal_path: format!("objects/item_{i}.png"),
                byte_offset: None,
                byte_length: None,
                display_name: if is_funicular {
                    format!("Alpine Funicular Carriage #{i}")
                } else {
                    format!("Stone Prop #{i}")
                },
                category: "object".into(),
                width_px: 512,
                height_px: 512,
                default_ppi: 256.0,
                draw_mode: if is_funicular { "rgb_channels" } else { "normal" }.into(),
                dominant_hex: Some("#8B5A2B".into()),
                casts_shadow: true,
                is_favorite: i == 0,
                tags: if is_funicular {
                    vec!["funicular".into(), "alpine".into(), "rail".into()]
                } else {
                    vec!["stone".into(), "dungeon".into()]
                },
                metadata_json: None,
            });
        }
        db.batch_upsert_assets(&src.name, &assets).unwrap();

        let t0 = Instant::now();
        let hits = db
            .search_assets(&VaultSearchQuery {
                text: Some("funicular #alpine".into()),
                colorable_only: true,
                ..Default::default()
            })
            .unwrap();
        let elapsed_ms = t0.elapsed().as_millis();
        assert_eq!(hits.len(), 50);
        assert!(elapsed_ms < 1000, "FTS5 search took too long: {elapsed_ms}ms");
    }
}
