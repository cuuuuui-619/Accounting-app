export const ADMIN_DELETE_CONFIRMATION = "永久删除";

export type AdminDeleteResource = "users" | "ledgers";

type DeleteRequestResult =
  | { ok: true; resource: AdminDeleteResource; targetId: string }
  | { ok: false; error: "invalid_action" | "invalid_delete_resource" | "invalid_target_id" | "invalid_confirmation" };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateDeleteRequest(input: unknown): DeleteRequestResult {
  if (!input || typeof input !== "object") return { ok: false, error: "invalid_action" };
  const candidate = input as Record<string, unknown>;
  if (candidate.action !== "delete") return { ok: false, error: "invalid_action" };
  if (candidate.resource !== "users" && candidate.resource !== "ledgers") return { ok: false, error: "invalid_delete_resource" };
  if (typeof candidate.targetId !== "string" || !UUID_PATTERN.test(candidate.targetId)) return { ok: false, error: "invalid_target_id" };
  if (candidate.confirmation !== ADMIN_DELETE_CONFIRMATION) return { ok: false, error: "invalid_confirmation" };
  return { ok: true, resource: candidate.resource, targetId: candidate.targetId.toLowerCase() };
}
