import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { ADMIN_DELETE_CONFIRMATION, validateDeleteRequest } from "../supabase/functions/moss-admin/contract.ts";

const read = (path: string) => readFileSync(path, "utf8");

test("routes only explicit web admin URLs to the desktop console", () => {
  const app = read("App.tsx");
  assert.match(app, /isAdminRoute/);
  assert.match(app, /searchParams\.get\("admin"\) === "1"/);
  assert.ok(app.includes('const pathname = url.pathname.replace(/\\/+$/, "") || "/"'));
  assert.ok(app.includes('return pathname === "/admin" || url.searchParams.get("admin") === "1"'));
  assert.match(app, /Platform\.OS === "web"/);
  assert.match(app, /<AdminApp/);
});

test("keeps privileged credentials out of the browser bundle", () => {
  const frontend = [read("App.tsx"), read("src/admin/AdminApp.tsx"), read("src/admin/adminApi.ts")].join("\n");
  assert.doesNotMatch(frontend, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(frontend, /MOSS_ADMIN_PASSWORD/);
  assert.doesNotMatch(frontend, /service_role/i);
  assert.match(frontend, /x-moss-admin-password/);
});

test("edge function owns password validation and bounded admin access", () => {
  const config = read("supabase/config.toml");
  const fn = read("supabase/functions/moss-admin/index.ts");

  assert.match(config, /\[functions\.moss-admin\][\s\S]*verify_jwt\s*=\s*false/);
  assert.match(fn, /Deno\.env\.get\("MOSS_ADMIN_PASSWORD"\)/);
  assert.match(fn, /Deno\.env\.get\("SUPABASE_SERVICE_ROLE_KEY"\)/);
  assert.match(fn, /Math\.min\(100,/);
  assert.match(fn, /request\.method !== "POST"/);
  assert.match(fn, /x-moss-admin-password/);
  assert.match(fn, /auth\.admin\.listUsers/);
  assert.match(fn, /\.from\("ledgers"\)/);
  assert.match(fn, /\.from\("ledger_members"\)/);
  assert.match(fn, /\.from\("ledger_records"\)/);
});

test("accepts deletion only for users or ledgers with a UUID and fixed confirmation", () => {
  const userId = "7cd982bd-43dc-4f63-8b64-359d6d10be31";
  assert.equal(ADMIN_DELETE_CONFIRMATION, "永久删除");
  assert.deepEqual(validateDeleteRequest({ action: "delete", resource: "users", targetId: userId, confirmation: "永久删除" }), {
    ok: true,
    resource: "users",
    targetId: userId,
  });
  assert.equal(validateDeleteRequest({ action: "delete", resource: "ledgers", targetId: userId, confirmation: "永久删除" }).ok, true);
  assert.deepEqual(validateDeleteRequest({ action: "delete", resource: "records", targetId: userId, confirmation: "永久删除" }), { ok: false, error: "invalid_delete_resource" });
  assert.deepEqual(validateDeleteRequest({ action: "delete", resource: "users", targetId: "not-a-uuid", confirmation: "永久删除" }), { ok: false, error: "invalid_target_id" });
  assert.deepEqual(validateDeleteRequest({ action: "delete", resource: "users", targetId: userId, confirmation: "DELETE" }), { ok: false, error: "invalid_confirmation" });
});

test("deletes through narrow server owners and reports missing targets", () => {
  const fn = read("supabase/functions/moss-admin/index.ts");
  const migration = read("supabase/migrations/202608240003_admin_delete.sql");
  assert.match(fn, /validateDeleteRequest/);
  assert.match(fn, /auth\.admin\.getUserById/);
  assert.match(fn, /auth\.admin\.deleteUser/);
  assert.match(fn, /rpc\("admin_delete_ledger"/);
  assert.match(fn, /target_not_found/);
  assert.match(fn, /response\(origin, 404,/);
  assert.doesNotMatch(fn, /resource === "records"[\s\S]{0,400}(?:deleteUser|admin_delete_ledger)/);
  assert.match(migration, /delete from public\.ledgers\s+where id = p_ledger_id/i);
  assert.match(migration, /revoke all on function public\.admin_delete_ledger\(uuid\) from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.admin_delete_ledger\(uuid\) to service_role/i);
});

test("desktop UI requires typed destructive confirmation and exposes cascade impact", () => {
  const ui = read("src/admin/AdminApp.tsx");
  const api = read("src/admin/adminApi.ts");
  assert.match(ui, /Trash2/);
  assert.match(ui, /完整 UUID/);
  assert.match(ui, /永久删除/);
  assert.match(ui, /级联/);
  assert.match(ui, /deleteAdminResource/);
  assert.match(api, /action: "delete"/);
  assert.match(api, /targetId/);
  assert.match(api, /confirmation/);
});
