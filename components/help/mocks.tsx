import type { LucideIcon } from "lucide-react";
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
import { HeroCard } from "@/components/ui/hero-card";
import { MoneyDisplay } from "@/components/ui/money-display";
import { Progress } from "@/components/ui/progress";
import { StatPill } from "@/components/ui/stat-pill";
import { PaymentCard } from "@/components/accounts/payment-card";
import { BrandGlyph } from "@/components/ui/brand-glyph";
import { ACCOUNT_TYPE_META } from "@/lib/accounts/meta";
import { SWATCHES } from "@/lib/palette";
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

function StatRow({
  icon: Icon,
  color,
  label,
  amount,
  tone,
}: {
  icon: LucideIcon;
  color: string | null;
  label: string;
  amount: number;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3">
      <ColorTile color={color} icon={Icon} size="sm" />
      <p className="flex-1 text-xs text-muted-foreground">{label}</p>
      <MoneyDisplay amount={amount} currency="USD" size="inline" className={tone} />
    </div>
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
        <MoneyDisplay amount={1200} currency="USD" size="inline" className="text-foreground" />
      </div>
    </MockPanel>
  );
}

/**
 * Home base, drawn as its own pieces rather than one boxed panel.
 *
 * The real screen is a gradient HeroCard followed by loose stat cards and an
 * upcoming rail — nothing on it sits inside a second bordered container. A
 * MockPanel wrapper around that composition would double-box the one element
 * on the whole app that is deliberately never boxed twice, so this mock skips
 * it and stacks the real pieces directly, the way the dashboard does.
 */
export function OverviewMock({
  netWorthLabel,
  incomeLabel,
  spentLabel,
  budgetUsedLabel,
  upcomingItem,
  upcomingSubtitle,
}: {
  netWorthLabel: string;
  incomeLabel: string;
  spentLabel: string;
  budgetUsedLabel: string;
  upcomingItem: string;
  upcomingSubtitle: string;
}) {
  const budgetPct = 64;
  return (
    <div className="space-y-3">
      <HeroCard label={netWorthLabel} className="p-5">
        <MoneyDisplay amount={18430.12} currency="USD" size="stat" />
      </HeroCard>

      <Card className="divide-y gap-0 p-0">
        <StatRow icon={ArrowDownLeft} color="var(--success)" label={incomeLabel} amount={3120} tone="text-success" />
        <StatRow icon={ArrowUpRight} color={null} label={spentLabel} amount={2040} tone="text-foreground" />
        <div className="p-3">
          <div className="flex items-center gap-3">
            <ColorTile color="var(--brand)" icon={PieChart} size="sm" />
            <p className="flex-1 text-xs text-muted-foreground">{budgetUsedLabel}</p>
            <StatPill tone="neutral">{budgetPct}%</StatPill>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-brand" style={{ width: `${budgetPct}%` }} />
          </div>
        </div>
      </Card>

      <Card className="p-0">
        <div className="flex items-center gap-3 px-3 py-3">
          <ColorTile color={null} icon={CalendarClock} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{upcomingItem}</p>
            <p className="truncate text-xs text-muted-foreground">{upcomingSubtitle}</p>
          </div>
          <MoneyDisplay amount={15.99} currency="USD" size="inline" className="text-foreground" />
        </div>
      </Card>
    </div>
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

// Same escalation as budget-grid.tsx's STATUS_COLOR: the calm state is the
// quietest mark on the row, not green — see the comment there for why.
const BUDGET_STATUS_COLOR = {
  within: "var(--brand)",
  approaching: "var(--warning)",
  over: "var(--destructive)",
} as const;

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
                style={{ width: `${row.pct}%`, backgroundColor: BUDGET_STATUS_COLOR[row.status] }}
              />
            </div>
          </div>
        ))}
      </div>
    </MockPanel>
  );
}

/**
 * Two subscriptions, deliberately showing BOTH marks a person will see.
 *
 * The first is a service the app recognised — its real logo on its real
 * brand colour. The second is one it did not, wearing the initial on the
 * theme's accent. Drawing only the good case would leave anyone whose gym or
 * ISP shows a letter thinking something had failed, when that is the
 * finished state.
 *
 * Each is its own Card, not a row in a shared list — the real screen is a
 * grid of subscription cards, each with its own toggle, stat-sized amount,
 * and "Add charge" action, and stacking two of those is truer than a
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
  cloud,
  cloudCycle,
  cloudNext,
  addCharge,
}: {
  streaming: string;
  streamingCycle: string;
  streamingNext: string;
  cloud: string;
  cloudCycle: string;
  cloudNext: string;
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
      name: cloud,
      cycle: cloudCycle,
      next: cloudNext,
      amt: 99,
      active: false,
      mark: "C",
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
