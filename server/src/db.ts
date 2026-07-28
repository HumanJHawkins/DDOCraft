import path from "path";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const pool = mysql.createPool({
  host: requireEnv("DDOCRAFT_DB_HOST"),
  port: Number(process.env.DDOCRAFT_DB_PORT ?? 3306),
  database: requireEnv("DDOCRAFT_DB_NAME"),
  user: requireEnv("DDOCRAFT_WEB_USER"),
  password: requireEnv("DDOCRAFT_WEB_PASSWORD"),
  waitForConnections: true,
  connectionLimit: 10,
});
