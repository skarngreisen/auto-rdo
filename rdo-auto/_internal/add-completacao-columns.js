const { Client } = require("pg");
const client = new Client({
  host: "db.fecskilrtsaeavoznwgi.supabase.co", port: 6543,
  user: "postgres", password: "TornepCardwell1307", database: "postgres",
  ssl: { rejectUnauthorized: false },
});
(async () => {
  await client.connect();
  await client.query("ALTER TABLE rdos ADD COLUMN IF NOT EXISTS pre_filtro_mudou BOOLEAN DEFAULT false");
  await client.query("ALTER TABLE rdos ADD COLUMN IF NOT EXISTS pre_filtro JSONB");
  await client.query("ALTER TABLE rdos ADD COLUMN IF NOT EXISTS desenvolvimento_mudou BOOLEAN DEFAULT false");
  await client.query("ALTER TABLE rdos ADD COLUMN IF NOT EXISTS desenvolvimento JSONB");
  await client.query("ALTER TABLE rdos ADD COLUMN IF NOT EXISTS jateamento_mudou BOOLEAN DEFAULT false");
  await client.query("ALTER TABLE rdos ADD COLUMN IF NOT EXISTS jateamento JSONB");
  console.log("Columns added");
  await client.end();
})().catch(e => { console.error(e.message); process.exit(1); });
