"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { LarkBotChat } from "@/lib/lark/chats";

type FormValues = {
  dailyReportChatId: string;
  dailyReportChatName: string;
  dailyReportDmAdmins: boolean;
};

type Props = {
  defaultValues: FormValues;
  botChats: LarkBotChat[];
  botChatsError: string | null;
  cancelHref: string;
  action: (
    formData: FormData,
  ) => Promise<{ ok: true } | { ok: false; error: string } | void>;
};

export function NotificationSettingsForm({
  defaultValues,
  botChats,
  botChatsError,
  cancelHref,
  action,
}: Props) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [chatId, setChatId] = useState(defaultValues.dailyReportChatId);
  const [chatName, setChatName] = useState(defaultValues.dailyReportChatName);
  const [dmAdmins, setDmAdmins] = useState(defaultValues.dailyReportDmAdmins);
  const [isPending, startTransition] = useTransition();

  function onSelectChat(value: string) {
    if (!value) return;
    const selected = botChats.find((chat) => chat.chatId === value);
    if (selected) {
      setChatId(selected.chatId);
      setChatName(selected.name);
    }
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("dailyReportChatId", chatId);
      fd.set("dailyReportChatName", chatName);
      fd.set("dailyReportDmAdmins", String(dmAdmins));
      const result = await action(fd);
      if (result && "ok" in result && !result.ok) {
        setServerError(result.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="daily-report-chat-id">日報通知の送付先チャットID</Label>
        <input
          id="daily-report-chat-id"
          name="dailyReportChatId"
          value={chatId}
          onChange={(event) => setChatId(event.target.value)}
          placeholder="例：oc_a1b2c3d4e5f6…"
          className={
            "h-9 w-full px-3 text-[14px] bg-white text-[var(--color-text-strong)] " +
            "border border-[var(--color-border)] rounded-[var(--radius-m)] " +
            "focus:border-[var(--color-primary)] focus:outline-none"
          }
        />
        <p className="text-[12px] text-[var(--color-text-mid)]">
          LarkグループチャットのチャットID（oc_ から始まるID）を入力します。
          空欄にすると、グループ通知は送信されません。
        </p>
      </div>

      {botChats.length > 0 ? (
        <div className="space-y-1.5">
          <Label htmlFor="bot-chat-picker">参加中のチャットから選ぶ</Label>
          <Select
            id="bot-chat-picker"
            value=""
            onChange={(event) => onSelectChat(event.target.value)}
          >
            <option value="">チャットを選択してください</option>
            {botChats.map((chat) => (
              <option key={chat.chatId} value={chat.chatId}>
                {chat.name}
              </option>
            ))}
          </Select>
          <p className="text-[12px] text-[var(--color-text-mid)]">
            本システムのボットが参加しているグループチャットの一覧です。
          </p>
        </div>
      ) : botChatsError ? (
        <p className="text-[12px] text-[var(--color-text-weak)]">
          参加中チャットの一覧は取得できませんでした（{botChatsError}）。
          チャットIDを直接入力してください。
        </p>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="daily-report-chat-name">送付先チャット名（表示用）</Label>
        <input
          id="daily-report-chat-name"
          name="dailyReportChatName"
          value={chatName}
          onChange={(event) => setChatName(event.target.value)}
          placeholder="例：日報共有グループ"
          className={
            "h-9 w-full px-3 text-[14px] bg-white text-[var(--color-text-strong)] " +
            "border border-[var(--color-border)] rounded-[var(--radius-m)] " +
            "focus:border-[var(--color-primary)] focus:outline-none"
          }
        />
        <p className="text-[12px] text-[var(--color-text-mid)]">
          通知ログに表示する名前です。チャット一覧から選択すると自動で入ります。
        </p>
      </div>

      <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-[var(--radius-s)] p-3">
        <p className="text-[12px] text-[var(--color-text-mid)]">
          通知を送信するためには、対象のLarkグループチャットに本システムのボット（アプリ）を追加してください。
          ボットが追加されていない場合、送信はエラーになります。
          チャットIDはLarkのグループ設定、またはLark開発者ツールから確認できます。
        </p>
      </div>

      <div className="flex items-start gap-2">
        <input
          id="daily-report-dm-admins"
          type="checkbox"
          checked={dmAdmins}
          onChange={(event) => setDmAdmins(event.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]"
        />
        <div>
          <Label htmlFor="daily-report-dm-admins">
            管理者へのダイレクトメッセージも送る
          </Label>
          <p className="text-[12px] text-[var(--color-text-mid)]">
            オンにすると、グループ通知に加えて管理者ロールの各ユーザーへ個別に通知します。
            送付先チャットが未設定の場合は、この設定に関わらず管理者へ通知します。
          </p>
        </div>
      </div>

      {serverError ? (
        <div
          role="alert"
          className="text-[13px] text-[var(--color-danger)] border border-[var(--color-danger)] rounded-[var(--radius-s)] px-3 py-2"
        >
          {serverError}
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
        <Link
          href={cancelHref}
          className="text-[13px] text-[var(--color-text-mid)] hover:text-[var(--color-text-strong)] px-3 py-2"
        >
          キャンセル
        </Link>
        <Button type="submit" variant="primary" size="md" disabled={isPending}>
          {isPending ? "保存中…" : "変更を保存する"}
        </Button>
      </div>
    </form>
  );
}

const Select = ({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    className={
      "h-9 w-full px-3 text-[14px] bg-white text-[var(--color-text-strong)] " +
      "border border-[var(--color-border)] rounded-[var(--radius-m)] " +
      "focus:border-[var(--color-primary)] focus:outline-none " +
      (className ?? "")
    }
    {...props}
  />
);
