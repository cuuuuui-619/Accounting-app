import { ADMIN_DELETE_CONFIRMATION, type AdminDeleteResource } from "../../supabase/functions/moss-admin/contract";

export type AdminResource = "users" | "ledgers" | "records";

export type AdminStats = {
  users: number;
  ledgers: number;
  activeRecords: number;
  members: number;
};

export type AdminUserRow = {
  id: string;
  email: string | null;
  isAnonymous: boolean;
  createdAt: string;
  lastSignInAt: string | null;
};

export type AdminLedgerRow = {
  id: string;
  createdBy: string;
  createdAt: string;
  memberCount: number;
  activeRecordCount: number;
};

export type AdminRecordRow = {
  ledgerId: string;
  recordType: string;
  recordId: string;
  payload: Record<string, unknown>;
  updatedAt: string;
  updatedBy: string;
};

export type AdminPageResponse = {
  stats: AdminStats;
  resource: AdminResource;
  page: number;
  limit: number;
  total: number;
  rows: AdminUserRow[] | AdminLedgerRow[] | AdminRecordRow[];
};

const ADMIN_FUNCTION_URL = "https://iibhhdpsbjdnqnoljfka.supabase.co/functions/v1/moss-admin";

type AdminDeleteResponse = { deleted: true; resource: AdminDeleteResource; targetId: string };

async function requestAdmin<T>(password: string, body: Record<string, unknown>): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(ADMIN_FUNCTION_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-moss-admin-password": password,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null) as (T & { error?: string }) | null;
    if (!response.ok) {
      if (response.status === 401) throw new Error("管理员密码不正确。");
      if (response.status === 404) throw new Error("目标不存在，可能已被其他管理员删除。");
      if (response.status === 429) throw new Error("尝试次数过多，请稍后再试。");
      if (response.status === 503) throw new Error("管理端尚未完成服务端配置。");
      if (response.status === 400) throw new Error("删除请求校验失败，请重新输入完整 UUID 和确认词。");
      throw new Error(payload?.error === "origin_not_allowed" ? "当前网址无权访问管理接口。" : "管理请求失败，请稍后重试。");
    }
    if (!payload) throw new Error("管理接口返回了空数据。");
    return payload as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("管理数据读取超时，请检查网络后重试。");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function requestAdminPage(password: string, resource: AdminResource, page: number, limit = 25): Promise<AdminPageResponse> {
  return requestAdmin<AdminPageResponse>(password, { resource, page, limit });
}

export function deleteAdminResource(password: string, resource: AdminDeleteResource, targetId: string, confirmation: string): Promise<AdminDeleteResponse> {
  return requestAdmin<AdminDeleteResponse>(password, { action: "delete", resource, targetId, confirmation });
}

export { ADMIN_DELETE_CONFIRMATION, type AdminDeleteResource };
