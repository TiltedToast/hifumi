import "dotenv/config";
import { migrate } from "drizzle-orm/planetscale-serverless/migrator.js";
import { client, db } from "../app.js";

// this will automatically run needed migrations on the database
migrate(db, { migrationsFolder: "./migrations" })
    .then(() => {
        console.log("\nMigrations complete!");
        client.destroy();
        process.exit(0);
    })
    .catch((err) => {
        console.error("\nMigrations failed!\n", err);
        client.destroy();
        process.exit(1);
    });
