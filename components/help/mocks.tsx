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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ColorTile } from "@/components/ui/color-tile";
import { Note } from "@/components/papel/note";
import { LedgerRow } from "@/components/papel/ledger-row";
import { RuleMeter } from "@/components/papel/rule-meter";
import { SpecimenFrame } from "@/components/papel/specimen-frame";
import { QuincenaEdge } from "@/components/overview/quincena-edge";
import { MoneyDisplay } from "@/components/ui/money-display";
import { Progress } from "@/components/ui/progress";
import { StatPill } from "@/components/ui/stat-pill";
import { PaymentCard } from "@/components/accounts/payment-card";
import { BrandGlyph } from "@/components/ui/brand-glyph";
import { ACCOUNT_TYPE_META } from "@/lib/accounts/meta";
import { SWATCHES } from "@/lib/palette";
import { STATUS_COLOR } from "@/lib/budgets/bar";
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
            <p className="mt-1 text-sm opacity-70">{availableIfCleared}</p>

            <div className="mt-6 space-y-1.5">
              <div className={rowClass}>
                <span className="opacity-80">{liquidLabel}</span>
                <MoneyDisplay amount={3200} currency="USD" size="inline" />
              </div>
              <div className={rowClass}>
                <span className="opacity-80">{committedLabel}</span>
                <MoneyDisplay amount={-200} currency="USD" size="inline" />
              </div>
              <div className={rowClass}>
                <span className="opacity-80">{cardsLabel}</span>
                <MoneyDisplay amount={-350} currency="USD" size="inline" />
              </div>
              <p className="pl-3 text-xs opacity-60">{cardsNote}</p>
              <div className={rowClass}>
                <span className="opacity-80">{loansLabel}</span>
                <MoneyDisplay amount={-180} currency="USD" size="inline" />
              </div>
              <div className={rowClass}>
                <span className="opacity-80">{subscriptionsLabel}</span>
                <MoneyDisplay amount={-46} currency="USD" size="inline" />
              </div>
            </div>

            <div className="mt-6 flex items-baseline justify-between gap-4 border-t border-current/20 pt-4 text-sm">
              <span className="opacity-80">{netWorthLabel}</span>
              <MoneyDisplay amount={18430.12} currency="USD" size="stat" />
            </div>

            <QuincenaEdge start="2026-09-16" end="2026-09-30" today="2026-09-23" />
          </Note>

          <div aria-hidden className="mx-2 border-t-2 border-dashed border-(--ink-soft)" />
          <Card className="gap-0 rounded-t-none border-t-0 p-0">
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
 * The accounts screen, led by the thing that actually distinguishes it.
 *
 * This drew a credit card as a generic tile with a CreditCard icon, which was
 * true when it was written and is not now — cards are rendered as the physical
 * object, and a guide that shows a tile teaches someone to look for the wrong
 * thing. The real PaymentCard is used rather than an imitation of it, so this
 * cannot drift from the screen again: any change to the face shows up here.
 *
 * The face sits FIRST and the chequing row second, inverting the old order.
 * That is the hierarchy of the real screen — cards are the objects people
 * recognise at a glance, and a row of text is what everything else looks like.
 *
 * The owed figure, utilization, real Progress bar, and limit/due line below
 * the face mirror CardBody in account-card.tsx exactly — that block is the
 * ONLY place a standalone card tile shows its balance, so leaving it out
 * here would draw a card that never says how much is owed on it.
 *
 * A sober navy rather than a real product's colour: the labels around it are
 * generic ("Credit card"), and dressing it as somebody's Amex would promise a
 * specific card the copy never names.
 */
export function AccountsMock({
  checking,
  checkingType,
  owedLabel,
  cardLimit,
  cardDue,
  holder,
  lineCurrent,
  lineOther,
}: {
  checking: string;
  checkingType: string;
  owedLabel: string;
  cardLimit: string;
  cardDue: string;
  /** The name embossed on the face, as the real one takes from the profile. */
  holder: string;
  /** The two currency lines of the mocked card group, for the line rail. */
  lineCurrent: string;
  lineOther: string;
}) {
  const checkingMeta = ACCOUNT_TYPE_META.checking;
  return (
    <MockPanel>
      <div className="mx-auto max-w-[15rem]">
        <PaymentCard holder={holder} last4="4821" network="visa" color="#1B4B8F" />
        {/* A still of `CardLineRail`, not the component itself: its segments are
            links to real accounts, and the help guide has no accounts to point
            at. Hand-built the same way this file hand-builds the owed block
            below rather than reusing AccountCard. */}
        <div aria-hidden className="mt-3 flex overflow-hidden rounded-lg border divide-x">
          <span className="flex-1 truncate bg-muted px-3 py-2 text-center text-xs font-medium text-foreground">
            {lineCurrent}
          </span>
          <span className="flex-1 truncate px-3 py-2 text-center text-xs text-muted-foreground">
            {lineOther}
          </span>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <div className="flex items-end justify-between gap-2">
          <div>
            <MoneyDisplay amount={1120.4} currency="USD" size="stat" />
            <p className="mt-1 text-xs text-muted-foreground">{owedLabel}</p>
          </div>
          <span className="text-sm font-medium text-warning">74%</span>
        </div>
        <Progress value={74} />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{cardLimit}</span>
          <span>{cardDue}</span>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3 rounded-lg border bg-background p-3">
        <ColorTile color={checkingMeta.color} icon={checkingMeta.icon} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{checking}</p>
          <p className="truncate text-xs text-muted-foreground">{checkingType}</p>
        </div>
        <MoneyDisplay amount={4382.1} currency="USD" size="inline" className="text-foreground" />
      </div>
    </MockPanel>
  );
}

/**
 * Two triage groups, drawn as a still of `TriageList`'s own card: a merchant
 * name, how many lines it covers, the running total, and the same
 * `CategoryRail` chip styling a real card offers — none of it wired up, and
 * `TriageList` itself is never imported here. The line above mirrors the
 * frozen "{done} of {total} categorised automatically" summary the real
 * screen shows only on the redirect straight out of an import.
 *
 * Both merchant strings are raw bank text, not translated — the same reason
 * `AccountsMock`'s `holder` prop is a fixed name — and the first one keeps
 * its branch tail on purpose, the same location text a real rule pattern
 * would keep unless a person shortens it on the rules screen.
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
  const chips = [categoryOne, categoryTwo, categoryThree];

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{summary}</p>
      {rows.map((row) => (
        <Card key={row.name} className="gap-0 p-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
              <p className="text-xs text-muted-foreground">{row.count}</p>
            </div>
            <MoneyDisplay amount={row.amount} currency="USD" size="inline" />
          </div>
          <div aria-hidden className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {chips.map((chip, i) => (
              <span
                key={chip}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap",
                  i === row.selected
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-input text-muted-foreground",
                )}
              >
                {chip}
              </span>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

const TYPE_ICON = { expense: ArrowUpRight, income: ArrowDownLeft, payment: ArrowLeftRight } as const;

export function LedgerMock({
  label,
  groceries,
  groceriesAccount,
  groceriesBadge,
  paycheck,
  paycheckAccount,
  payment,
  paymentAccounts,
}: {
  label: string;
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
      amount: -64.2,
      signed: false,
      tone: "text-destructive",
    },
    {
      title: paycheck,
      badge: null,
      subtitle: paycheckAccount,
      color: null,
      emoji: null,
      icon: TYPE_ICON.income,
      amount: 2400,
      signed: true,
      tone: "text-success",
    },
    {
      title: payment,
      badge: null,
      subtitle: paymentAccounts,
      color: null,
      emoji: null,
      icon: TYPE_ICON.payment,
      amount: 300,
      signed: false,
      tone: "text-foreground",
    },
  ] as const;

  return (
    <MockPanel>
      <MockLabel>{label}</MockLabel>
      <div className="divide-y">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
            <ColorTile color={row.color} emoji={row.emoji} icon={row.icon} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {row.title}
                {row.badge ? (
                  <Badge className="ml-2 bg-muted uppercase tracking-wide text-muted-foreground">
                    {row.badge}
                  </Badge>
                ) : null}
              </p>
              <p className="truncate text-xs text-muted-foreground">{row.subtitle}</p>
            </div>
            <MoneyDisplay
              amount={row.amount}
              currency="USD"
              size="inline"
              opts={{ signed: row.signed }}
              className={row.tone}
            />
          </div>
        ))}
      </div>
    </MockPanel>
  );
}

export function BudgetsMock({
  month,
  food,
  transport,
  entertainment,
}: {
  month: string;
  food: string;
  transport: string;
  entertainment: string;
}) {
  const rows = [
    { name: food, emoji: "🍽️", color: SWATCHES[1], used: 340, budget: 500, pct: 68, status: "within" as const },
    { name: transport, emoji: "🚗", color: SWATCHES[6], used: 210, budget: 250, pct: 84, status: "approaching" as const },
    { name: entertainment, emoji: "🎬", color: SWATCHES[4], used: 140, budget: 100, pct: 100, status: "over" as const },
  ];

  return (
    <MockPanel>
      <MockLabel>{month}</MockLabel>
      <div className="space-y-4">
        {rows.map((row) => (
          <div key={row.name}>
            <div className="flex items-center gap-3">
              <ColorTile color={row.color} emoji={row.emoji} name={row.name} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
                <p className="figure text-xs text-muted-foreground tabular-nums">
                  ${row.used} of ${row.budget}
                </p>
              </div>
            </div>
            <div className="mt-2 flex items-end justify-between gap-2">
              <MoneyDisplay amount={row.used} currency="USD" size="stat" />
              <StatPill tone={row.status === "over" ? "destructive" : "neutral"}>{row.pct}%</StatPill>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{ width: `${row.pct}%`, backgroundColor: STATUS_COLOR[row.status] }}
              />
            </div>
          </div>
        ))}
      </div>
    </MockPanel>
  );
}

/**
 * The group band as it sits above the category band.
 *
 * Drawn with the same tile, figure, pill and bar as BudgetsMock directly above
 * it, because on the real page the two bands are the same money sliced twice
 * and look it. What the mock is actually teaching is the row count: three
 * coarse buckets over what the guide has just shown as a longer list of
 * categories.
 */
export function BudgetGroupsMock({
  essentials,
  lifestyle,
  future,
}: {
  essentials: string;
  lifestyle: string;
  future: string;
}) {
  const rows = [
    { name: essentials, emoji: "🏠", color: SWATCHES[2], used: 1180, budget: 1400, pct: 84, status: "approaching" as const },
    { name: lifestyle, emoji: "🎈", color: SWATCHES[4], used: 520, budget: 600, pct: 87, status: "approaching" as const },
    { name: future, emoji: "🌱", color: SWATCHES[7], used: 300, budget: 500, pct: 60, status: "within" as const },
  ];

  return (
    <MockPanel>
      <div className="space-y-4">
        {rows.map((row) => (
          <div key={row.name}>
            <div className="flex items-center gap-3">
              <ColorTile color={row.color} emoji={row.emoji} name={row.name} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
                <p className="figure text-xs text-muted-foreground tabular-nums">
                  ${row.used} of ${row.budget}
                </p>
              </div>
            </div>
            <div className="mt-2 flex items-end justify-between gap-2">
              <MoneyDisplay amount={row.used} currency="USD" size="stat" />
              {/* None of these three is over. A plan on track is the truer
                  picture of the group band — the category mock above already
                  shows what over looks like, and it looks the same here. */}
              <StatPill tone="neutral">{row.pct}%</StatPill>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{ width: `${row.pct}%`, backgroundColor: STATUS_COLOR[row.status] }}
              />
            </div>
          </div>
        ))}
      </div>
    </MockPanel>
  );
}

/**
 * Two recurring payments, deliberately showing BOTH marks a person will see
 * and both kinds of template.
 *
 * The first is a subscription the app recognised — its real logo on its real
 * brand colour. The second is a semimonthly transfer to savings, which no model
 * would place, wearing the initial on the theme's accent. Drawing only the good case would leave anyone whose gym or
 * ISP shows a letter thinking something had failed, when that is the
 * finished state.
 *
 * Each is its own Card, not a row in a shared list — the real screen is a
 * grid of recurring-payment cards, each with its own toggle, stat-sized
 * amount, and "Record" action, and stacking two of those is truer than a
 * transaction-style list would be.
 *
 * Spotify by name, because the mark has to be one people actually recognise
 * for the row to make its point. The glyph is a static import, so only this
 * one path ships — see components/accounts/network-mark for why slug lookups
 * may not happen in a client bundle.
 */
export function SubscriptionsMock({
  streaming,
  streamingCycle,
  streamingNext,
  transfer,
  transferCycle,
  transferNext,
  addCharge,
}: {
  streaming: string;
  streamingCycle: string;
  streamingNext: string;
  transfer: string;
  transferCycle: string;
  transferNext: string;
  addCharge: string;
}) {
  const rows = [
    {
      name: streaming,
      cycle: streamingCycle,
      next: streamingNext,
      amt: 15.99,
      active: true,
      mark: <BrandGlyph path={siSpotify.path} className="size-[55%]" />,
      style: { backgroundColor: `#${siSpotify.hex}`, color: readableForeground(`#${siSpotify.hex}`) },
    },
    {
      name: transfer,
      cycle: transferCycle,
      next: transferNext,
      amt: 250,
      active: false,
      mark: transfer[0]?.toUpperCase(),
      style: undefined,
    },
  ];

  return (
    <div className="space-y-3">
      {rows.map((row, i) => (
        <Card key={i} className={cn("gap-0 p-4", !row.active && "opacity-60")}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={cn(
                  "tile-sheen flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                  row.style ? undefined : "bg-accent text-accent-foreground",
                )}
                style={row.style}
              >
                {row.mark}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
                <p className="truncate text-xs text-muted-foreground">{row.cycle}</p>
              </div>
            </div>
            <MockSwitch checked={row.active} />
          </div>
          <p className="mt-3 leading-none">
            <MoneyDisplay amount={row.amt} currency="USD" size="stat" />
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{row.next}</p>
          <Button size="sm" variant="secondary" className="mt-3">
            <Receipt className="size-4" />
            {addCharge}
          </Button>
        </Card>
      ))}
    </div>
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
    { name: discretionary, color: "var(--chart-2)", pct: 23 },
    { name: subscriptions, color: "var(--chart-6)", pct: 15 },
    { name: other, color: "var(--border)", pct: 24 },
  ];
  return (
    <MockPanel>
      <MockLabel>{label}</MockLabel>
      {/* A gap in the surface colour between wedges, like the real ring's
          `stroke="var(--card)"` separator, rather than the touching flat
          segments a bare conic-gradient draws by default. */}
      <div
        className="mx-auto flex size-28 items-center justify-center rounded-full"
        style={{
          background:
            "conic-gradient(var(--chart-1) 0 37%, var(--card) 37% 39%, var(--chart-2) 39% 62%, var(--card) 62% 64%, var(--chart-6) 64% 79%, var(--card) 79% 81%, var(--border) 81% 99%, var(--card) 99% 100%)",
        }}
      >
        <div className="flex size-16 flex-col items-center justify-center gap-0.5 rounded-full bg-card">
          <span className="text-[9px] uppercase tracking-wide text-muted-foreground">{thisMonth}</span>
          <MoneyDisplay amount={2050} currency="USD" size="stat" className="text-base leading-none" />
        </div>
      </div>
      <div className="mt-4 space-y-1.5">
        {legend.map(({ name, color, pct }) => (
          <div key={name} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
              <span className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: color }} />
              <span className="truncate text-foreground">{name}</span>
            </span>
            <span className="figure shrink-0 tabular-nums text-muted-foreground">{pct}%</span>
          </div>
        ))}
      </div>
    </MockPanel>
  );
}

export function AskMock({
  question,
  narration,
  answer,
}: {
  question: string;
  narration: string;
  answer: string;
}) {
  return (
    <MockPanel>
      <div className="space-y-3">
        <div className="flex justify-end">
          <div className="max-w-xs rounded-2xl bg-primary px-4 py-2.5">
            <p className="text-sm text-primary-foreground">{question}</p>
          </div>
        </div>
        <div className="flex justify-start">
          <p className="text-xs text-muted-foreground">{narration}</p>
        </div>
        <div className="flex justify-start">
          <div className="max-w-xs rounded-2xl border bg-background px-4 py-2.5">
            <p className="text-sm text-foreground">{answer}</p>
          </div>
        </div>
      </div>
    </MockPanel>
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
