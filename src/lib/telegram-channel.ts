import type { Env } from "../types/env";

const MEMBER_STATUSES = new Set(["creator", "administrator", "member", "restricted"]);

type GetChatMemberResponse = {
  ok: boolean;
  result?: { status: string };
};

export function getRequiredChannelId(env: Env): string | null {
  const id = env.REQUIRED_CHANNEL_ID?.trim();
  return id || null;
}

export function getRequiredChannelUrl(env: Env): string {
  const url = env.REQUIRED_CHANNEL_URL?.trim();
  return url || "https://t.me/+kaJ_f75v8i5lNTgy";
}

export async function fetchChannelMemberStatus(
  token: string,
  channelId: string,
  userId: string
): Promise<string | null> {
  const url = new URL(`https://api.telegram.org/bot${token}/getChatMember`);
  url.searchParams.set("chat_id", channelId);
  url.searchParams.set("user_id", userId);
  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as GetChatMemberResponse;
    if (!data.ok || !data.result?.status) {
      return null;
    }
    return data.result.status;
  } catch {
    return null;
  }
}

/** When REQUIRED_CHANNEL_ID is unset, access is allowed (local dev). */
export async function isChannelMember(env: Env, userId: string): Promise<boolean> {
  const channelId = getRequiredChannelId(env);
  if (!channelId) {
    return true;
  }
  const status = await fetchChannelMemberStatus(env.TELEGRAM_BOT_TOKEN, channelId, userId);
  if (!status) {
    return false;
  }
  return MEMBER_STATUSES.has(status);
}
