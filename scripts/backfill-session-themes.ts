import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { db } from "@/lib/db";
import { parsePlaylistDescription } from "@/lib/parse-playlist";

async function main() {
  const rows = await db.select().from(schema.sessions);
  let updated = 0;
  for (const s of rows) {
    const name = `Warwick Massive Tunage ${s.sessionNumber}`;
    const { theme } = parsePlaylistDescription(
      name,
      s.description ?? undefined,
    );
    if (theme && theme !== s.theme) {
      await db
        .update(schema.sessions)
        .set({ theme })
        .where(eq(schema.sessions.id, s.id));
      console.log(`S${s.sessionNumber}: ${theme}`);
      updated++;
    }
  }
  console.log(`backfill complete — ${updated} sessions updated`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
