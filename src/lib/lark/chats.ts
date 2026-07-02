/*
 * ボットが参加中のLarkグループチャット一覧
 * see: ../../G-DX_Lark_Integration_Rules.md §4.1
 *
 * 通知設定画面の送付先ピッカーに使う。
 * im:chat:readonly スコープが未付与の場合は取得できないため、
 * 呼び出し側は手入力へフォールバックする。
 */

import { getLarkApiWithTenantToken, toLarkApiError } from "./provider-client";

export type LarkBotChat = {
  chatId: string;
  name: string;
};

type ChatListData = {
  items?: Array<{ chat_id?: string; name?: string }>;
  has_more?: boolean;
  page_token?: string;
};

export type BotChatsResult =
  | { ok: true; chats: LarkBotChat[] }
  | { ok: false; reason: string };

export async function listBotChatsAsync(): Promise<BotChatsResult> {
  const chats: LarkBotChat[] = [];
  let pageToken: string | undefined;

  try {
    do {
      const data = await getLarkApiWithTenantToken<ChatListData>("/im/v1/chats", {
        page_size: 100,
        page_token: pageToken,
      });
      for (const item of data.items ?? []) {
        if (item.chat_id) {
          chats.push({ chatId: item.chat_id, name: item.name || item.chat_id });
        }
      }
      pageToken = data.has_more ? data.page_token : undefined;
    } while (pageToken);
  } catch (error) {
    const larkError = toLarkApiError(
      error,
      "参加中のチャット一覧を取得できませんでした",
    );
    return { ok: false, reason: larkError.message };
  }

  chats.sort((a, b) => a.name.localeCompare(b.name, "ja"));
  return { ok: true, chats };
}
