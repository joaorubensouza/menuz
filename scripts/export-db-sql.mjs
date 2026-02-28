import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INPUT = path.join(ROOT, "data", "db.json");
const OUTPUT = path.join(ROOT, "cloudflare", "seed.sql");

function sqlText(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlNumber(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(fallback);
  return String(n);
}

function sqlBool(value) {
  return value ? "1" : "0";
}

function jsonText(value, fallback) {
  return sqlText(JSON.stringify(value ?? fallback));
}

function lineInsert(table, columns, values) {
  return `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${values.join(", ")});`;
}

async function main() {
  const raw = await fs.readFile(INPUT, "utf-8");
  const db = JSON.parse(raw);

  const lines = [];
  lines.push("PRAGMA foreign_keys = OFF;");
  lines.push("DELETE FROM sessions;");
  lines.push("DELETE FROM login_attempts;");
  lines.push("DELETE FROM model_jobs;");
  lines.push("DELETE FROM orders;");
  lines.push("DELETE FROM items;");
  lines.push("DELETE FROM users;");
  lines.push("DELETE FROM restaurants;");

  for (const restaurant of db.restaurants || []) {
    lines.push(
      lineInsert(
        "restaurants",
        ["id", "name", "slug", "description", "logo", "accent", "template", "hero_images_json"],
        [
          sqlText(restaurant.id),
          sqlText(restaurant.name || ""),
          sqlText(restaurant.slug || ""),
          sqlText(restaurant.description || ""),
          sqlText(restaurant.logo || ""),
          sqlText(restaurant.theme?.accent || "#D95F2B"),
          sqlText(restaurant.template || "default"),
          jsonText(restaurant.heroImages || [], [])
        ]
      )
    );
  }

  for (const user of db.users || []) {
    lines.push(
      lineInsert(
        "users",
        ["id", "email", "role", "restaurant_id", "password_hash", "password_plain"],
        [
          sqlText(user.id),
          sqlText((user.email || "").toLowerCase()),
          sqlText(user.role || "client"),
          user.restaurantId ? sqlText(user.restaurantId) : "NULL",
          user.passwordHash ? sqlText(user.passwordHash) : "NULL",
          sqlText(user.password || "")
        ]
      )
    );
  }

  for (const item of db.items || []) {
    lines.push(
      lineInsert(
        "items",
        [
          "id",
          "restaurant_id",
          "name",
          "description",
          "price",
          "image",
          "model_glb",
          "model_usdz",
          "category",
          "scans_json"
        ],
        [
          sqlText(item.id),
          sqlText(item.restaurantId),
          sqlText(item.name || ""),
          sqlText(item.description || ""),
          sqlNumber(item.price, 0),
          sqlText(item.image || ""),
          sqlText(item.modelGlb || ""),
          sqlText(item.modelUsdz || ""),
          sqlText(item.category || ""),
          jsonText(item.scans || [], [])
        ]
      )
    );
  }

  for (const order of db.orders || []) {
    lines.push(
      lineInsert(
        "orders",
        ["id", "restaurant_id", "table_label", "items_json", "total", "status", "created_at"],
        [
          sqlText(order.id),
          sqlText(order.restaurantId),
          sqlText(order.table || ""),
          jsonText(order.items || [], []),
          sqlNumber(order.total, 0),
          sqlText(order.status || "novo"),
          sqlText(order.createdAt || new Date().toISOString())
        ]
      )
    );
  }

  for (const job of db.modelJobs || []) {
    lines.push(
      lineInsert(
        "model_jobs",
        [
          "id",
          "restaurant_id",
          "item_id",
          "source_type",
          "provider",
          "ai_model",
          "auto_mode",
          "status",
          "notes",
          "model_glb",
          "model_usdz",
          "reference_images_json",
          "provider_task_id",
          "provider_task_endpoint",
          "provider_status",
          "created_at",
          "updated_at",
          "created_by"
        ],
        [
          sqlText(job.id),
          sqlText(job.restaurantId),
          sqlText(job.itemId),
          sqlText(job.sourceType || "upload"),
          sqlText(job.provider || "manual"),
          sqlText(job.aiModel || ""),
          sqlBool(Boolean(job.autoMode)),
          sqlText(job.status || "enviado"),
          sqlText(job.notes || ""),
          sqlText(job.modelGlb || ""),
          sqlText(job.modelUsdz || ""),
          jsonText(job.referenceImages || [], []),
          sqlText(job.providerTaskId || ""),
          sqlText(job.providerTaskEndpoint || ""),
          sqlText(job.providerStatus || ""),
          sqlText(job.createdAt || new Date().toISOString()),
          sqlText(job.updatedAt || new Date().toISOString()),
          sqlText(job.createdBy || "")
        ]
      )
    );
  }

  lines.push("PRAGMA foreign_keys = ON;");
  lines.push("");

  await fs.writeFile(OUTPUT, `${lines.join("\n")}\n`, "utf-8");
  console.log(`Seed SQL gerado em: ${OUTPUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
