import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarClock,
  ChevronDown,
  Download,
  PieChart,
  Receipt,
} from "lucide-react";
import { siSpotify } from "simple-icons";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ColorTile } from "@/components/ui/color-tile";
import { Note } from "@/components/papel/note";
import { LedgerRow } from "@/components/papel/ledger-row";
import { ProofMark } from "@/components/papel/proof-mark";
import { Stamp } from "@/components/papel/stamp";
import { Mark } from "@/components/transactions/mark";
import { Perforation } from "@/components/papel/perforation";
import { RuleMeter } from "@/components/papel/rule-meter";
import { LedgerBlock } from "@/components/papel/ledger-block";
import { SectionLegend } from "@/components/papel/section-legend";
import { BudgetStatusMark } from "@/components/budgets/budget-status-mark";
import { SpecimenFrame } from "@/components/papel/specimen-frame";
import { QuincenaEdge } from "@/components/overview/quincena-edge";
import { MoneyDisplay } from "@/components/ui/money-display";
import { CardFace } from "@/components/papel/card-face";
import { BrandGlyph } from "@/components/ui/brand-glyph";
import { formatMoney, formatPercent } from "@/lib/format";
import { ACCOUNT_TYPE_META } from "@/lib/accounts/meta";
import { SWATCHES } from "@/lib/palette";
import { barPct, meterArgs } from "@/lib/budgets/bar";
import { readableForeground } from "@/lib/color";
import { cn } from "@/lib/utils";

function MockLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

function MockPanel({ children }: { children: React.ReactNode }) {
  return <Card className="p-4">{children}</Card>;
}

/** A single row of the real Switch's classes, minus the interactivity —
 *  this panel is a picture of the settings screen, not a working one. */
function MockSwitch({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex h-[18.4px] w-[32px] shrink-0 items-center rounded-full border border-transparent",
        checked ? "bg-primary" : "bg-input",
      )}
    >
      <span
        className={cn(
          "block size-4 rounded-full bg-background",
          checked ? "translate-x-[calc(100%-2px)]" : "translate-x-0",
        )}
      />
    </span>
  );
}

export function OnboardingMock({
  label,
  account,
  subtitle,
}: {
  label: string;
  account: string;
  subtitle: string;
}) {
  const meta = ACCOUNT_TYPE_META.checking;
  return (
    <MockPanel>
      <MockLabel>{label}</MockLabel>
      <div className="flex items-center gap-3 rounded-lg border bg-background p-3">
        <ColorTile color={meta.color} icon={meta.icon} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{account}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <MoneyDisplay amount={45000} currency="DOP" size="inline" className="text-foreground" />
      </div>
    </MockPanel>
  );
}

/**
 * Home base as a specimen of the real composition.
 *
 * One peso Note carries the Disponible figure, the "if you clear your cards"
 * line, the breakdown rows and the net-worth line, with the quincena engraved
 * on its bottom edge. A dashed perforation joins it to the ruled period stub
 * (income, paid out, budget used), then Upcoming as a ledger row. Built from
 * the same primitives as `AvailableHero` and `PeriodStub`, with fixed figures,
 * and framed as a specimen so it is never read as the user's own numbers.
 */
export function OverviewMock({
  availableLabel,
  availableIfCleared,
  liquidLabel,
  committedLabel,
  cardsLabel,
  cardsNote,
  loansLabel,
  subscriptionsLabel,
  netWorthLabel,
  thisPeriodLabel,
  incomeLabel,
  spentLabel,
  budgetUsedLabel,
  upcomingItem,
  upcomingSubtitle,
}: {
  availableLabel: string;
  availableIfCleared: string;
  liquidLabel: string;
  committedLabel: string;
  cardsLabel: string;
  cardsNote: string;
  loansLabel: string;
  subscriptionsLabel: string;
  netWorthLabel: string;
  thisPeriodLabel: string;
  incomeLabel: string;
  spentLabel: string;
  budgetUsedLabel: string;
  upcomingItem: string;
  upcomingSubtitle: string;
}) {
  const budgetPct = 64;
  const glyph = "size-4 shrink-0 text-muted-foreground";
  const rowClass = "flex items-baseline justify-between gap-4 text-sm";
  return (
    <SpecimenFrame className="mt-4">
      <div className="space-y-4">
        <div>
          <Note tone="peso" label={availableLabel} serial="QNA 2026-09 B">
            <MoneyDisplay
              amount={1840}
              currency="USD"
              size="hero"
              className="text-3xl sm:text-3xl font-extrabold [font-stretch:125%]"
            />
            <p className="mt-1 text-sm opacity-90">{availableIfCleared}</p>

            <div className="mt-6 space-y-1.5">
              <div className={rowClass}>
                <span className="opacity-90">{liquidLabel}</span>
                <MoneyDisplay amount={3200} currency="USD" size="inline" />
              </div>
              <div className={rowClass}>
                <span className="opacity-90">{committedLabel}</span>
                <MoneyDisplay amount={-200} currency="USD" size="inline" />
              </div>
              <div className={rowClass}>
                <span className="opacity-90">{cardsLabel}</span>
                <MoneyDisplay amount={-350} currency="USD" size="inline" />
              </div>
              <p className="pl-3 text-xs opacity-90">{cardsNote}</p>
              <div className={rowClass}>
                <span className="opacity-90">{loansLabel}</span>
                <MoneyDisplay amount={-180} currency="USD" size="inline" />
              </div>
              <div className={rowClass}>
                <span className="opacity-90">{subscriptionsLabel}</span>
                <MoneyDisplay amount={-46} currency="USD" size="inline" />
              </div>
            </div>

            <div className="mt-6 flex items-baseline justify-between gap-4 border-t border-current/20 pt-4 text-sm">
              <span className="opacity-90">{netWorthLabel}</span>
              <MoneyDisplay amount={18430.12} currency="USD" size="stat" />
            </div>

            <QuincenaEdge start="2026-09-16" end="2026-09-30" today="2026-09-23" />
          </Note>

          <div aria-hidden className="mx-2 border-t-2 border-dashed border-(--ink-soft)" />
          <Card className="gap-0 rounded-t-none border-t-0 p-0">
            <h2 className="legend px-4 pt-3 pb-1 text-[11px] text-muted-foreground">{thisPeriodLabel}</h2>
            <LedgerRow
              lead={<ArrowDownLeft aria-hidden className={glyph} />}
              title={incomeLabel}
              amount={<MoneyDisplay amount={3120} currency="USD" size="inline" className="text-foreground" />}
            />
            <LedgerRow
              lead={<ArrowUpRight aria-hidden className={glyph} />}
              title={spentLabel}
              amount={<MoneyDisplay amount={2040} currency="USD" size="inline" className="text-foreground" />}
            />
            <LedgerRow
              className="border-b-0 pb-2"
              lead={<PieChart aria-hidden className={glyph} />}
              title={budgetUsedLabel}
              amount={
                <>
                  <MoneyDisplay amount={2040} currency="USD" size="inline" className="text-foreground" />
                  <p className="figure text-xs text-muted-foreground">{budgetPct}%</p>
                </>
              }
            />
            <div className="px-4 pb-3">
              <RuleMeter used={budgetPct} total={100} label={budgetUsedLabel} />
            </div>
          </Card>
        </div>

        <Card className="gap-0 p-0">
          <LedgerRow
            lead={<CalendarClock aria-hidden className={glyph} />}
            title={upcomingItem}
            meta={upcomingSubtitle}
            amount={<MoneyDisplay amount={15.99} currency="USD" size="inline" className="text-foreground" />}
          />
        </Card>
      </div>
    </SpecimenFrame>
  );
}

/**
 * The accounts screen, led by Attention First — the same order the real page
 * composes itself in: what needs a decision, then what you're worth, then
 * the accounts themselves.
 *
 * Needs a look is a real `LedgerRow` in a real `AttentionLedger` box: a
 * `Stamp` lead, the account's name, and a `ProofMark` carrying the reason
 * (here, overdue). On the real screen the whole section — heading included —
 * renders nothing at all once there's nothing to flag; this specimen only
 * ever shows the "something needs a look" state, since a guide has nothing
 * to gain from illustrating a section that draws no pixels.
 *
 * Net worth sits on its own violet `Note` underneath, the same tone and the
 * same component `AccountsPage` prints its own net-worth figure on — never
 * the peso tone, which is reserved for the "what you can still spend" figure
 * on Overview.
 *
 * The card face is the real `CardFace`, not an imitation of one — a generic
 * tile would teach someone to look for the wrong thing once cards render as
 * the physical object. "BHD Visa Platino" is a fixed, static, illustrative
 * name, never a person's name (see CardFace's own doc comment on why the
 * face shows the card's own name only). Its two currency lines print as real
 * `LedgerRow`s under a `border-t-2 border-(--rule)` — the exact rule weight
 * and token `CardGroupTile` draws its own lines under — rather than a second
 * card.
 *
 * The cuota strip closes it out: an outstanding balance, then a real
 * `Perforation` for how many installments are paid — solid cells for paid,
 * dashed outlines for what's left — the same component `AccountCard`'s loan
 * body draws.
 */
export function AccountsMock({
  attentionTitle,
  attentionOverdue,
  lineCurrent,
  lineCurrentUtil,
  lineOther,
  lineOtherUtil,
  loanOutstandingLabel,
  loanProgress,
}: {
  attentionTitle: string;
  attentionOverdue: string;
  /** The two currency lines of the mocked card group. */
  lineCurrent: string;
  lineCurrentUtil: string;
  lineOther: string;
  lineOtherUtil: string;
  loanOutstandingLabel: string;
  /** The accessible reading for the Perforation strip ("5 / 12 paid"). */
  loanProgress: string;
}) {
  // A static, illustrative card name — the same convention the marketing
  // home page's two specimens use (components/marketing/marketing-home.tsx,
  // "Visa Oro" / "Mastercard Black") — never a person's name; see CardFace's
  // own doc comment on why the face shows the card's own name only. Reused
  // for the attention row's Stamp so the specimen reads as one wallet, not
  // several unrelated illustrations.
  const cardName = "BHD Visa Platino";
  return (
    <SpecimenFrame className="mt-4">
      <div className="space-y-5">
        <div className="space-y-1">
          <MockLabel>{attentionTitle}</MockLabel>
          <div className="rounded-[4px] border border-(--paper-line)">
            <LedgerRow
              lead={<Stamp color="#1B4B8F" name={cardName} size="sm" />}
              title={cardName}
              amount={<ProofMark tone="flag">{attentionOverdue}</ProofMark>}
            />
          </div>
        </div>

        <div className="mx-auto max-w-[15rem]">
          <CardFace name={cardName} last4="4821" network="visa" accent="#1B4B8F" />
          <div className="mt-4 border-t-2 border-(--rule)">
            <LedgerRow
              title={lineCurrent}
              subtitle={lineCurrentUtil}
              amount={<MoneyDisplay amount={1120.4} currency="USD" size="inline" className="text-foreground" />}
            />
            <LedgerRow
              title={lineOther}
              subtitle={lineOtherUtil}
              amount={<MoneyDisplay amount={35800} currency="DOP" size="inline" className="text-foreground" />}
            />
          </div>
        </div>

        <Card className="p-3">
          <MoneyDisplay amount={82500} currency="DOP" size="stat" />
          <p className="mt-1 text-xs text-muted-foreground">{loanOutstandingLabel}</p>
          <Perforation total={12} paid={5} label={loanProgress} className="mt-3" />
        </Card>
      </div>
    </SpecimenFrame>
  );
}

/**
 * Two triage groups, drawn as a still of `TriageList`'s own sheet: the frozen
 * summary line, then one hairline sheet of ledger blocks — a `LedgerRow` head
 * (merchant, line count, running total) over a static stamp rail of three
 * `Stamp`s with names, the picked one `stamp-inked` and underlined, exactly as
 * `CategoryRail` prints it. None of it is wired up, and `TriageList` itself is
 * never imported here. The summary mirrors the frozen "{done} of {total}
 * categorised automatically" line the real screen shows only on the redirect
 * straight out of an import.
 *
 * Both merchant strings are raw bank text, not translated — the same reason
 * `AccountsMock`'s card name is a fixed, hardcoded string rather than a prop
 * — and the first one keeps its branch tail on purpose, the same location
 * text a real rule pattern would keep unless a person shortens it on the
 * rules screen.
 */
export function TriageMock({
  summary,
  merchantOne,
  merchantOneCount,
  merchantTwo,
  merchantTwoCount,
  categoryOne,
  categoryTwo,
  categoryThree,
}: {
  summary: string;
  merchantOne: string;
  merchantOneCount: string;
  merchantTwo: string;
  merchantTwoCount: string;
  categoryOne: string;
  categoryTwo: string;
  categoryThree: string;
}) {
  const rows = [
    { name: merchantOne, count: merchantOneCount, amount: 84.5, selected: 0 },
    { name: merchantTwo, count: merchantTwoCount, amount: 32.0, selected: 1 },
  ];
  // The message strings carry their own leading emoji ("🍽️ Food"): split it
  // off so the stamp holds the emoji and the label is the plain name, as in
  // the real CategoryRail.
  const splitEmoji = (label: string) => {
    const m = label.match(/^(\P{L}+?)\s+(.+)$/u);
    return m ? { emoji: m[1], name: m[2] } : { emoji: null, name: label };
  };
  const cats = [
    { ...splitEmoji(categoryOne), color: SWATCHES[1] },
    { ...splitEmoji(categoryTwo), color: SWATCHES[4] },
    { ...splitEmoji(categoryThree), color: SWATCHES[7] },
  ];

  return (
    <SpecimenFrame className="mt-4">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{summary}</p>
        <div className="rounded-[4px] border border-(--paper-line)">
          {rows.map((row) => (
            <div key={row.name} className="border-b-2 border-(--rule) last:border-b-0">
              <LedgerRow
                className="border-b-0 px-4 pt-3"
                title={row.name}
                subtitle={row.count}
                amount={<span className="text-sm font-semibold">{formatMoney(row.amount, "USD")}</span>}
              />
              <div aria-hidden className="-mx-1 flex gap-0.5 overflow-x-auto px-5 pb-3">
                {cats.map((c, i) => {
                  const on = i === row.selected;
                  return (
                    <span
                      key={c.name}
                      className={cn(
                        "flex w-[3.25rem] shrink-0 flex-col items-center gap-1 border-b-[3px] pb-1 pt-0.5",
                        on ? "border-foreground text-foreground" : "border-transparent text-muted-foreground",
                      )}
                    >
                      <Stamp
                        color={c.color}
                        emoji={c.emoji}
                        name={c.name}
                        size="sm"
                        className={on ? "stamp-inked" : undefined}
                      />
                      <span className="w-full truncate text-center text-[10px] font-semibold leading-tight">{c.name}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SpecimenFrame>
  );
}

const TYPE_ICON = { expense: ArrowUpRight, income: ArrowDownLeft, payment: ArrowLeftRight } as const;

/**
 * The ledger, drawn from the real primitives: a static date legend over a rule
 * (the pinned `DateRule` minus its stickiness) and three `LedgerRow`s led by
 * `Stamp`s, with `TransactionRow`'s own sign rules — an expense prints `−` in
 * ink, income `+` in teal, a payment no sign — and the shared `Mark` for the
 * statement tag.
 */
export function LedgerMock({
  label,
  dayLabel,
  groceries,
  groceriesAccount,
  groceriesBadge,
  paycheck,
  paycheckAccount,
  payment,
  paymentAccounts,
}: {
  label: string;
  dayLabel: string;
  groceries: string;
  groceriesAccount: string;
  groceriesBadge: string;
  paycheck: string;
  paycheckAccount: string;
  payment: string;
  paymentAccounts: string;
}) {
  const rows = [
    {
      title: groceries,
      badge: groceriesBadge,
      subtitle: groceriesAccount,
      color: SWATCHES[1],
      emoji: "🛒",
      icon: TYPE_ICON.expense,
      amount: 3850,
      sign: "−",
      income: false,
    },
    {
      title: paycheck,
      badge: null,
      subtitle: paycheckAccount,
      color: null,
      emoji: null,
      icon: TYPE_ICON.income,
      amount: 48000,
      sign: "+",
      income: true,
    },
    {
      title: payment,
      badge: null,
      subtitle: paymentAccounts,
      color: null,
      emoji: null,
      icon: TYPE_ICON.payment,
      amount: 15000,
      sign: "",
      income: false,
    },
  ] as const;

  return (
    <SpecimenFrame className="mt-4">
      {/* SpecimenFrame already carries the visible legend; keep the label for screen readers. */}
      <p className="sr-only">{label}</p>
      <p className="legend border-b border-(--rule) py-1.5 text-[10px] text-muted-foreground">{dayLabel}</p>
      <div>
        {rows.map((row, i) => (
          <LedgerRow
            key={i}
            className="px-0 py-2.5"
            lead={<Stamp color={row.color} emoji={row.emoji} name={row.title} icon={row.icon} size="sm" />}
            title={
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate">{row.title}</span>
                {row.badge ? <Mark>{row.badge}</Mark> : null}
              </span>
            }
            subtitle={row.subtitle}
            amount={
              <span className={cn("text-sm font-semibold", row.income ? "text-(--teal)" : "text-foreground")}>
                {row.sign}
                {formatMoney(row.amount, "DOP")}
              </span>
            }
          />
        ))}
      </div>
    </SpecimenFrame>
  );
}

type MockBudgetRow = {
  name: string;
  emoji: string;
  color: string;
  used: number;
  budget: number;
  status: "within" | "approaching" | "over";
};

/**
 * One budget line as the live `BudgetLine` prints it, minus its inputs and
 * edit/delete controls (those need client hooks): a `LedgerBlock` whose head
 * is a stamped `LedgerRow`, with the ruled meter and its status mark under it.
 * The percent is the clamped `barPct`, exactly what the real head shows.
 */
/** The message strings carry a leading emoji ("🍽️ Food"); an aria-label wants the name alone. */
function plainName(label: string) {
  const m = label.match(/^\P{L}+?\s+(.+)$/u);
  return m ? m[1] : label;
}

function MockBudgetBlock({
  row,
  nearLabel,
  overLabel,
  usedOf,
}: {
  row: MockBudgetRow;
  nearLabel: string;
  overLabel: string;
  usedOf: (used: string, budget: string) => string;
}) {
  const { used, total } = meterArgs(row.used, row.budget);
  return (
    <LedgerBlock
      head={
        <LedgerRow
          lead={<Stamp color={row.color} emoji={row.emoji} name={row.name} size="md" />}
          title={row.name}
          subtitle={usedOf(formatMoney(row.used, "DOP"), formatMoney(row.budget, "DOP"))}
          amount={<MoneyDisplay amount={row.used} currency="DOP" size="inline" />}
          meta={formatPercent(barPct(row.used, row.budget))}
        />
      }
    >
      <div className="flex items-center gap-3">
        <RuleMeter
          className="flex-1"
          used={used}
          total={total}
          near={row.status === "approaching"}
          label={plainName(row.name)}
          overLabel={overLabel}
        />
        <BudgetStatusMark status={row.status} overLabel={overLabel} nearLabel={nearLabel} />
      </div>
    </LedgerBlock>
  );
}

/**
 * The Budgets screen in miniature: the peso note that carries the period total,
 * then one budget line per state. Within prints nothing extra, approaching a
 * "Near" tag and a heavy rule, over a flag mark and the red double-rule end.
 * Everything sits in a SpecimenFrame, so the figures read as an example.
 */
export function BudgetsMock({
  month,
  food,
  transport,
  entertainment,
  nearLabel,
  overLabel,
  usedOf,
  usedLabel,
  remainingLabel,
}: {
  month: string;
  food: string;
  transport: string;
  entertainment: string;
  nearLabel: string;
  overLabel: string;
  usedOf: (used: string, budget: string) => string;
  usedLabel: string;
  remainingLabel: string;
}) {
  const rows: MockBudgetRow[] = [
    { name: food, emoji: "🍽️", color: SWATCHES[1], used: 340, budget: 500, status: "within" },
    { name: transport, emoji: "🚗", color: SWATCHES[6], used: 210, budget: 250, status: "approaching" },
    { name: entertainment, emoji: "🎬", color: SWATCHES[4], used: 196, budget: 140, status: "over" },
  ];

  return (
    <SpecimenFrame className="mt-4">
      <div className="space-y-3">
        <Note tone="peso" ornament={false} label={month} className="p-4 sm:p-4">
          <MoneyDisplay amount={890} currency="DOP" size="stat" />
          <div className="mt-3 space-y-1.5 border-t border-current/30 pt-3 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <span className="opacity-90">{usedLabel}</span>
              <MoneyDisplay amount={746} currency="DOP" size="inline" />
            </div>
            <div className="flex items-baseline justify-between gap-4 font-semibold">
              <span>{remainingLabel}</span>
              <MoneyDisplay amount={144} currency="DOP" size="inline" />
            </div>
          </div>
        </Note>
        <div className="rounded-[4px] border border-(--paper-line)">
          {rows.map((row) => (
            <MockBudgetBlock key={row.name} row={row} nearLabel={nearLabel} overLabel={overLabel} usedOf={usedOf} />
          ))}
        </div>
      </div>
    </SpecimenFrame>
  );
}

/**
 * The group band as it sits above the category band: the same budget line,
 * because on the real page the two bands are the same money sliced twice and
 * look it. What the mock teaches is the row count: three coarse buckets over
 * the longer list of categories the guide has just shown. None is over: a plan
 * on track is the truer picture, and the mock above already shows over.
 */
export function BudgetGroupsMock({
  heading,
  essentials,
  lifestyle,
  future,
  nearLabel,
  overLabel,
  usedOf,
}: {
  heading: string;
  essentials: string;
  lifestyle: string;
  future: string;
  nearLabel: string;
  overLabel: string;
  usedOf: (used: string, budget: string) => string;
}) {
  const rows: MockBudgetRow[] = [
    { name: essentials, emoji: "🏠", color: SWATCHES[2], used: 1180, budget: 1400, status: "approaching" },
    { name: lifestyle, emoji: "🎈", color: SWATCHES[4], used: 520, budget: 600, status: "approaching" },
    { name: future, emoji: "🌱", color: SWATCHES[7], used: 300, budget: 500, status: "within" },
  ];

  return (
    <SpecimenFrame className="mt-4">
      <div className="space-y-2">
        <SectionLegend>{heading}</SectionLegend>
        <div className="rounded-[4px] border border-(--paper-line)">
          {rows.map((row) => (
            <MockBudgetBlock key={row.name} row={row} nearLabel={nearLabel} overLabel={overLabel} usedOf={usedOf} />
          ))}
        </div>
      </div>
    </SpecimenFrame>
  );
}

/**
 * Two recurring payments, deliberately showing BOTH marks a person will see
 * and both kinds of template.
 *
 * The first is a subscription the app recognised: its real logo on its real
 * brand colour. The second is a semimonthly transfer to savings, which no model
 * would place, wearing the initial on the theme's accent. Drawing only the good
 * case would leave anyone whose gym or ISP shows a letter thinking something
 * had failed, when that is the finished state.
 *
 * Drawn as the live screen is: one ledger, each recurring payment a
 * `LedgerBlock` in next-charge order with paused ones last (at 60% opacity),
 * the "Next <date>" as the head's meta, the account line, then the control row
 * with Record at the right edge.
 *
 * Spotify by name, because the mark has to be one people actually recognise
 * for the row to make its point. The glyph is a static import, so only this
 * one path ships; see lib/brand/simple-icon for why a slug lookup at runtime
 * may not happen in a client bundle.
 */
export function SubscriptionsMock({
  heading,
  streaming,
  streamingCycle,
  streamingNext,
  transfer,
  transferCycle,
  transferNext,
  addCharge,
}: {
  heading: string;
  streaming: string;
  streamingCycle: string;
  streamingNext: string;
  transfer: string;
  transferCycle: string;
  transferNext: string;
  addCharge: string;
}) {
  // The catalogue strings read "Next <date> · <account>". The live row splits
  // them into a meta line and an account line, so split on the first " · ".
  const splitNext = (s: string) => {
    const i = s.indexOf(" · ");
    return i < 0 ? { next: s, account: null } : { next: s.slice(0, i), account: s.slice(i + 3) };
  };
  const rows = [
    {
      name: streaming,
      cycle: streamingCycle,
      ...splitNext(streamingNext),
      amt: 15.99,
      active: true,
      mark: <BrandGlyph path={siSpotify.path} className="size-[55%]" />,
      style: { backgroundColor: `#${siSpotify.hex}`, color: readableForeground(`#${siSpotify.hex}`) },
    },
    {
      name: transfer,
      cycle: transferCycle,
      ...splitNext(transferNext),
      amt: 250,
      active: false,
      mark: transfer[0]?.toUpperCase(),
      style: undefined,
    },
  ];

  return (
    <SpecimenFrame className="mt-4">
      <div className="space-y-2">
        <SectionLegend>{heading}</SectionLegend>
        <div className="rounded-[4px] border border-(--paper-line)">
          {rows.map((row, i) => (
            <LedgerBlock
              key={i}
              className={cn(!row.active && "opacity-60")}
              head={
                <LedgerRow
                  lead={
                    <span
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                        row.style ? undefined : "bg-accent text-accent-foreground",
                      )}
                      style={row.style}
                    >
                      {row.mark}
                    </span>
                  }
                  title={row.name}
                  subtitle={row.cycle}
                  amount={<MoneyDisplay amount={row.amt} currency="USD" size="inline" />}
                  meta={row.next}
                />
              }
            >
              {row.account ? <p className="truncate text-xs text-muted-foreground">{row.account}</p> : null}
              <div className="flex items-center justify-between gap-2">
                <MockSwitch checked={row.active} />
                <Button size="sm" variant="secondary">
                  <Receipt className="size-4" />
                  {addCharge}
                </Button>
              </div>
            </LedgerBlock>
          ))}
        </div>
      </div>
    </SpecimenFrame>
  );
}

export function InsightsMock({
  label,
  thisMonth,
  essentials,
  discretionary,
  subscriptions,
  other,
}: {
  label: string;
  thisMonth: string;
  essentials: string;
  discretionary: string;
  subscriptions: string;
  other: string;
}) {
  const legend = [
    { name: essentials, color: "var(--chart-1)", pct: 38 },
    { name: other, color: "var(--muted-foreground)", pct: 24 },
    { name: discretionary, color: "var(--chart-2)", pct: 23 },
    { name: subscriptions, color: "var(--chart-6)", pct: 15 },
  ];
  return (
    <SpecimenFrame>
      <MockLabel>{label}</MockLabel>
      {/* The real card is a stamped ledger: one ruled row per category with
          its share and a hairline share strip, largest first. */}
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="legend text-[10px] text-muted-foreground">{thisMonth}</span>
        <MoneyDisplay amount={2050} currency="USD" size="stat" className="text-base leading-none" />
      </div>
      <div className="border-t border-(--paper-line)">
        {legend.map(({ name, color, pct }) => (
          <div key={name} className="border-b border-(--paper-line) py-1.5 last:border-b-0">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-2">
                <Stamp color={color} name={name} className="size-6 text-[10px]" />
                <span className="truncate text-foreground">{name}</span>
              </span>
              <span className="figure shrink-0 tabular-nums text-muted-foreground">{pct}%</span>
            </div>
            <RuleMeter className="mt-1.5" used={pct} total={38} label={`${name} ${pct}%`} />
          </div>
        ))}
      </div>
    </SpecimenFrame>
  );
}

export function AskMock({
  you,
  question,
  narration,
  answer,
}: {
  you: string;
  question: string;
  narration: string;
  answer: string;
}) {
  return (
    <SpecimenFrame>
      <div className="space-y-3">
        {/* The real sheet: a question is a right-aligned ruled slip, the answer
            prints as the body of the sheet between hairlines. */}
        <div className="flex justify-end">
          <div className="max-w-xs border border-(--paper-line) bg-muted/50 px-3 py-2">
            <p className="legend text-[10px] text-muted-foreground">{you}</p>
            <p className="text-sm text-foreground">{question}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{narration}</p>
        <div className="border-y border-(--paper-line) py-3">
          <p className="text-sm text-foreground">{answer}</p>
        </div>
      </div>
    </SpecimenFrame>
  );
}

export function SettingsMock({
  currencyLabel,
  currencyValue,
  themeLabel,
  soundLabel,
  installLabel,
  installButton,
}: {
  currencyLabel: string;
  currencyValue: string;
  themeLabel: string;
  soundLabel: string;
  installLabel: string;
  installButton: string;
}) {
  return (
    <MockPanel>
      <div className="divide-y">
        <div className="flex items-center justify-between gap-3 py-3 first:pt-0">
          <span className="text-sm font-medium text-foreground">{currencyLabel}</span>
          <span className="flex h-8 w-fit items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm text-foreground">
            {currencyValue}
            <ChevronDown className="size-4 text-muted-foreground" />
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 py-3">
          <span className="text-sm font-medium text-foreground">{themeLabel}</span>
          <Button variant="ghost" size="icon-sm" aria-hidden tabIndex={-1}>
            <SunGlyph />
          </Button>
        </div>
        <div className="flex items-center justify-between gap-3 py-3">
          <span className="text-sm font-medium text-foreground">{soundLabel}</span>
          <MockSwitch checked />
        </div>
        <div className="flex items-center justify-between gap-3 py-3 last:pb-0">
          <span className="text-sm font-medium text-foreground">{installLabel}</span>
          <Button variant="outline" size="sm" aria-hidden tabIndex={-1}>
            <Download className="size-4" />
            {installButton}
          </Button>
        </div>
      </div>
    </MockPanel>
  );
}

/** Inline rather than imported from lucide-react a second time under a new
 *  name — this is the same glyph ThemeToggle shows at rest, without pulling
 *  in next-themes for a button that never actually flips. */
function SunGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}
