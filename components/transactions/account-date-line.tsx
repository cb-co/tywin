"use client";

import { useTranslations } from "next-intl";

/** The one-line stand-in for the account, destination and date fields.
 *
 *  One button rather than three: all three land in the same place — the
 *  expanded field set — so splitting them would promise a precision the
 *  disclosure does not have. The line's job is to state what the form already
 *  decided, so the common case is reading it and moving on. */
export function AccountDateLine({
  accountLabel,
  destinationLabel,
  dateLabel,
  onEdit,
}: {
  accountLabel: string;
  destinationLabel?: string;
  dateLabel: string;
  onEdit: () => void;
}) {
  const t = useTranslations("TransactionForm");
  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={t("summaryAria")}
      className="flex w-full items-center gap-1.5 border-y border-(--paper-line) py-2 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
    >
      <span>{accountLabel}</span>
      {destinationLabel ? (
        <>
          <span aria-hidden>→</span>
          <span>{destinationLabel}</span>
        </>
      ) : null}
      <span aria-hidden>·</span>
      <span>{dateLabel}</span>
    </button>
  );
}
