
import { createClient } from "@libsql/client";

const client = createClient({
  url: "file:sqlite.db",
});

async function main() {
  try {
    const result = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'");
    console.log("Tables found:", result.rows);
    
    if (result.rows.length > 0) {
        const result2 = await client.execute("PRAGMA table_info(sessions)");
        console.log("Sessions structure:", result2.rows);
        
        const sessions = await client.execute("SELECT * FROM sessions LIMIT 1");
        console.log("Session select:", sessions.rows);
    } else {
        console.log("Sessions table NOT found");
    }
  } catch (e) {
    console.error("Error:", e);
  }
}

main();
