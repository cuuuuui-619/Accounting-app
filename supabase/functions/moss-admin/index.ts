// @ts-nocheck -- This file runs in the Supabase Deno runtime, not the Expo TypeScript runtime.
import { createClient } from "npm:@supabase/supabase-js@2";

import { validateDeleteRequest } from "./contract.ts";

type Resource = "users" | "ledgers" | "records";

const allowedOrigins = new Set(["https://moss-ledger.expo.app"]);
const failures = new Map<string, { count: number; resetAt: number }>();
const encoder = new TextEncoder();

function isAllowedOrigin(origin: string | null) {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  try {
    const url = new URL(origin);
    return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  } catch {
    return false;
  }
}

function corsHeaders(origin: string | null) {
  return {
    "access-control-allow-origin": origin && isAllowedOrigin(origin) ? origin : "https://moss-ledger.expo.app",
    "access-control-allow-headers": "content-type, x-moss-admin-password",
    "access-control-allow-methods": "POST, OPTIONS",
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    "vary": "Origin",
  };
}

function response(origin: string | null, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(origin) });
}

function constantTimeEqual(left: string, right: string) {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let mismatch = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < length; index += 1) mismatch |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  return mismatch === 0;
}

function clientAddress(request: Request) {
  return request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown";
}

function isRateLimited(address: string) {
  const now = Date.now();
  const entry = failures.get(address);
  if (!entry || entry.resetAt <= now) {
    failures.delete(address);
    return false;
  }
  return entry.count >= 8;
}

function recordFailure(address: string) {
  const now = Date.now();
  const entry = failures.get(address);
  failures.set(address, !entry || entry.resetAt <= now ? { count: 1, resetAt: now + 5 * 60_000 } : { ...entry, count: entry.count + 1 });
}

function requireSuccess<T>(result: { data: T; error: unknown }, label: string): T {
  if (result.error) throw new Error(`${label}_query_failed`);
  return result.data;
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") {
    if (!isAllowedOrigin(origin)) return response(origin, 403, { error: "origin_not_allowed" });
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (request.method !== "POST") return response(origin, 405, { error: "method_not_allowed" });
  if (!isAllowedOrigin(origin)) return response(origin, 403, { error: "origin_not_allowed" });

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 4096) return response(origin, 413, { error: "request_too_large" });

  const address = clientAddress(request);
  if (isRateLimited(address)) return response(origin, 429, { error: "too_many_attempts" });

  const expectedPassword = Deno.env.get("MOSS_ADMIN_PASSWORD") ?? "";
  const suppliedPassword = request.headers.get("x-moss-admin-password") ?? "";
  if (expectedPassword.length < 16) return response(origin, 503, { error: "admin_not_configured" });
  if (!constantTimeEqual(suppliedPassword, expectedPassword)) {
    recordFailure(address);
    return response(origin, 401, { error: "invalid_credentials" });
  }
  failures.delete(address);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return response(origin, 400, { error: "invalid_json" });
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return response(origin, 503, { error: "admin_not_configured" });
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    if (body.action !== undefined) {
      const deletion = validateDeleteRequest(body);
      if (!deletion.ok) return response(origin, 400, { error: deletion.error });

      if (deletion.resource === "users") {
        const existing = await supabase.auth.admin.getUserById(deletion.targetId);
        if (existing.error?.status === 404) return response(origin, 404, { error: "target_not_found" });
        if (existing.error) throw new Error("user_lookup_failed");
        if (!existing.data.user) return response(origin, 404, { error: "target_not_found" });
        const deleted = await supabase.auth.admin.deleteUser(deletion.targetId, false);
        if (deleted.error?.status === 404) return response(origin, 404, { error: "target_not_found" });
        if (deleted.error) throw new Error("user_delete_failed");
        return response(origin, 200, { deleted: true, resource: deletion.resource, targetId: deletion.targetId });
      }

      const ledgerDeletion = await supabase.rpc("admin_delete_ledger", { p_ledger_id: deletion.targetId });
      if (ledgerDeletion.error) throw new Error("ledger_delete_failed");
      if (ledgerDeletion.data !== true) return response(origin, 404, { error: "target_not_found" });
      return response(origin, 200, { deleted: true, resource: deletion.resource, targetId: deletion.targetId });
    }

    const resource: Resource = body.resource === "ledgers" || body.resource === "records" ? body.resource : "users";
    const page = Math.max(1, Number.parseInt(String(body.page ?? 1), 10) || 1);
    const limit = Math.min(100, Math.max(10, Number.parseInt(String(body.limit ?? 25), 10) || 25));
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const [authResult, ledgerCountResult, memberCountResult, recordCountResult] = await Promise.all([
      supabase.auth.admin.listUsers({ page: resource === "users" ? page : 1, perPage: resource === "users" ? limit : 1 }),
      supabase.from("ledgers").select("id", { count: "exact", head: true }),
      supabase.from("ledger_members").select("ledger_id", { count: "exact", head: true }),
      supabase.from("ledger_records").select("record_id", { count: "exact", head: true }).is("deleted_at", null),
    ]);
    if (authResult.error) throw new Error("users_query_failed");
    if (ledgerCountResult.error) throw new Error("ledgers_count_failed");
    if (memberCountResult.error) throw new Error("members_count_failed");
    if (recordCountResult.error) throw new Error("records_count_failed");
    const stats = {
      users: Math.max(authResult.data.total ?? 0, authResult.data.users.length),
      ledgers: ledgerCountResult.count ?? 0,
      activeRecords: recordCountResult.count ?? 0,
      members: memberCountResult.count ?? 0,
    };

    if (resource === "users") {
      const rows = authResult.data.users.map((user) => ({
        id: user.id,
        email: user.email ?? null,
        isAnonymous: user.is_anonymous ?? false,
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at ?? null,
      }));
      return response(origin, 200, { stats, resource, page, limit, total: stats.users, rows });
    }

    if (resource === "ledgers") {
      const ledgerResult = await supabase.from("ledgers").select("id,created_by,created_at", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
      const ledgers = requireSuccess(ledgerResult, "ledger_page") ?? [];
      const ids = ledgers.map((ledger) => ledger.id);
      let members: Array<{ ledger_id: string }> = [];
      let records: Array<{ ledger_id: string }> = [];
      if (ids.length) {
        const [memberResult, activeResult] = await Promise.all([
          supabase.from("ledger_members").select("ledger_id").in("ledger_id", ids),
          supabase.from("ledger_records").select("ledger_id").in("ledger_id", ids).is("deleted_at", null),
        ]);
        members = requireSuccess(memberResult, "ledger_members") ?? [];
        records = requireSuccess(activeResult, "ledger_records") ?? [];
      }
      const rows = ledgers.map((ledger) => ({
        id: ledger.id,
        createdBy: ledger.created_by,
        createdAt: ledger.created_at,
        memberCount: members.filter((member) => member.ledger_id === ledger.id).length,
        activeRecordCount: records.filter((record) => record.ledger_id === ledger.id).length,
      }));
      return response(origin, 200, { stats, resource, page, limit, total: ledgerResult.count ?? 0, rows });
    }

    const recordResult = await supabase
      .from("ledger_records")
      .select("ledger_id,record_type,record_id,payload,updated_at,updated_by", { count: "exact" })
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .range(from, to);
    const records = requireSuccess(recordResult, "record_page") ?? [];
    const rows = records.map((record) => ({
      ledgerId: record.ledger_id,
      recordType: record.record_type,
      recordId: record.record_id,
      payload: record.payload,
      updatedAt: record.updated_at,
      updatedBy: record.updated_by,
    }));
    return response(origin, 200, { stats, resource, page, limit, total: recordResult.count ?? 0, rows });
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : "admin_read_failed";
    console.error("moss-admin read failed", errorCode);
    return response(origin, 500, { error: errorCode });
  }
});
