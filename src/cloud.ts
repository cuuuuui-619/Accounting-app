import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";

import type { CloudRecord, PendingMutation } from "./sync";

const SUPABASE_URL = "https://iibhhdpsbjdnqnoljfka.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_uZLS_s8TFJti_5CyDs8nTA_miEatGFn";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export async function ensureAnonymousSession(): Promise<string> {
  const { data: current, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (current.session?.user.id) return current.session.user.id;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  if (!data.user?.id) throw new Error("anonymous_session_missing");
  return data.user.id;
}

export async function createRemoteLedger(codeHash: string): Promise<string> {
  const { data, error } = await supabase.rpc("create_ledger", { p_code_hash: codeHash });
  if (error) throw error;
  if (typeof data !== "string") throw new Error("ledger_id_missing");
  return data;
}

export async function joinRemoteLedger(codeHash: string): Promise<string> {
  const { data, error } = await supabase.rpc("join_ledger", { p_code_hash: codeHash });
  if (error) throw error;
  if (typeof data !== "string") throw new Error("ledger_id_missing");
  return data;
}

export async function fetchRemoteRecords(ledgerId: string): Promise<CloudRecord[]> {
  const { data, error } = await supabase
    .from("ledger_records")
    .select("record_type,record_id,payload,deleted_at,updated_at")
    .eq("ledger_id", ledgerId);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    recordType: row.record_type,
    recordId: row.record_id,
    payload: row.payload,
    deletedAt: row.deleted_at,
    updatedAt: row.updated_at,
  })) as CloudRecord[];
}

export async function pushRemoteMutation(ledgerId: string, mutation: PendingMutation): Promise<void> {
  const { error } = await supabase.rpc("apply_ledger_mutation", {
    p_ledger_id: ledgerId,
    p_record_type: mutation.recordType,
    p_record_id: mutation.recordId,
    p_payload: mutation.payload,
    p_deleted: mutation.deleted,
    p_updated_at: mutation.updatedAt,
  });
  if (error) throw error;
}

export function subscribeToRemoteLedger(ledgerId: string, onChange: () => void, onStatus: (status: string) => void): RealtimeChannel {
  return supabase
    .channel(`ledger:${ledgerId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "ledger_records", filter: `ledger_id=eq.${ledgerId}` }, onChange)
    .subscribe(onStatus);
}

export async function removeRemoteSubscription(channel: RealtimeChannel | null): Promise<void> {
  if (channel) await supabase.removeChannel(channel);
}
