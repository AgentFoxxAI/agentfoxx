/**
 * One-time script: Generate embeddings for all event_collateral rows that don't have one.
 * Run with: npx tsx scripts/embed-collateral.ts
 *
 * Uses OpenAI text-embedding-3-small (1536 dims, ~$0.02/1M tokens).
 */
import "dotenv/config";
import OpenAI from "openai";
import pg from "pg";

const { Pool } = pg;

if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function embedText(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    encoding_format: "float",
  });
  return response.data[0].embedding;
}

async function main() {
  console.log("Fetching collateral rows without embeddings...");

  const { rows } = await pool.query<{ id: number; name: string; description: string | null }>(
    `SELECT id, name, description FROM event_collateral WHERE embedding IS NULL ORDER BY id`,
  );

  if (rows.length === 0) {
    console.log("All collateral already has embeddings. Nothing to do.");
    await pool.end();
    return;
  }

  console.log(`Embedding ${rows.length} collateral item(s)...`);

  for (const row of rows) {
    // Combine name + description for a richer semantic signal
    const text = row.description ? `${row.name}. ${row.description}` : row.name;
    console.log(`  [${row.id}] ${row.name}`);

    const embedding = await embedText(text);

    // pgvector expects the embedding as a string like "[0.1,0.2,...]"
    const embeddingLiteral = `[${embedding.join(",")}]`;

    await pool.query(`UPDATE event_collateral SET embedding = $1::vector WHERE id = $2`, [
      embeddingLiteral,
      row.id,
    ]);
  }

  console.log(`Done. Embedded ${rows.length} collateral items.`);
  await pool.end();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
