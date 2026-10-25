import type { PluginDB } from "@qqbot/sdk";

export async function installMaintenance(db: PluginDB) {
    await db.exec("CREATE TABLE IF NOT EXISTS {maintenance}(job TEXT PRIMARY KEY, day TEXT NOT NULL, error TEXT) WITHOUT ROWID");
}
