import "dotenv/config";
import { migrate } from "drizzle-orm/planetscale-serverless/migrator";
import { db } from "./index.js";

// this will automatically run needed migrations on the database
migrate(db, { migrationsFolder: "./migrations" })
    .then(() => {
        console.log("\nMigrations complete!");
        process.exit(0);
    })
    .catch((err) => {
        console.error("\nMigrations failed!\n", err);
        process.exit(1);
    });
