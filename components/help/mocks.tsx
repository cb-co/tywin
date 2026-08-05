import { ArrowLeftRight, Banknote, CreditCard, Tags, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
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

export function OnboardingMock({
  label,
  account,
  noBank,
}: {
  label: string;
  account: string;
  noBank: string;
}) {
  return (
    <MockPanel>
      <MockLabel>{label}</MockLabel>
      <div className="flex items-center gap-3 rounded-lg border bg-background p-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <Wallet className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{account}</p>
          <p className="text-xs text-muted-foreground">{noBank}</p>
        </div>
        <p className="figure text-sm text-foreground">$1,200.00</p>
      </div>
    </MockPanel>
  );
}

export function OverviewMock({
  netWorthLabel,
  incomeLabel,
  spentLabel,
  budgetUsedLabel,
}: {
  netWorthLabel: string;
  incomeLabel: string;
  spentLabel: string;
  budgetUsedLabel: string;
}) {
  return (
    <MockPanel>
      <MockLabel>{netWorthLabel}</MockLabel>
      <p className="figure text-3xl text-foreground">$18,430.12</p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-md border bg-background p-2">
          <p className="text-[0.65rem] font-medium text-muted-foreground">{incomeLabel}</p>
          <p className="figure mt-1 text-sm text-success">$3,120</p>
        </div>
        <div className="rounded-md border bg-background p-2">
          <p className="text-[0.65rem] font-medium text-muted-foreground">{spentLabel}</p>
          <p className="figure mt-1 text-sm text-destructive">$2,040</p>
        </div>
        <div className="rounded-md border bg-background p-2">
          <p className="text-[0.65rem] font-medium text-muted-foreground">{budgetUsedLabel}</p>
          <p className="figure mt-1 text-sm text-foreground">64%</p>
        </div>
      </div>
    </MockPanel>
  );
}

export function AccountsMock({
  checking,
  checkingBank,
  card,
  cardDue,
}: {
  checking: string;
  checkingBank: string;
  card: string;
  cardDue: string;
}) {
  return (
    <MockPanel>
      <div className="flex items-center gap-3 rounded-lg border bg-background p-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <Wallet className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{checking}</p>
          <p className="truncate text-xs text-muted-foreground">{checkingBank}</p>
        </div>
        <p className="figure text-sm text-foreground">$4,382.10</p>
      </div>
      <div className="mt-2 flex items-center gap-3 rounded-lg border bg-background p-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <CreditCard className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{card}</p>
          <p className="truncate text-xs text-muted-foreground">{cardDue}</p>
        </div>
        <p className="figure text-sm text-destructive">$1,120.40</p>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-[34%] rounded-full bg-primary" />
      </div>
    </MockPanel>
  );
}

export function LedgerMock({
  label,
  groceries,
  groceriesTag,
  paycheck,
  paycheckTag,
  payment,
  paymentTag,
}: {
  label: string;
  groceries: string;
  groceriesTag: string;
  paycheck: string;
  paycheckTag: string;
  payment: string;
  paymentTag: string;
}) {
  const rows = [
    { icon: Tags, tone: "destructive", desc: groceries, tag: groceriesTag, amount: "−$64.20" },
    { icon: Banknote, tone: "success", desc: paycheck, tag: paycheckTag, amount: "+$2,400.00" },
    { icon: ArrowLeftRight, tone: "primary", desc: payment, tag: paymentTag, amount: "$300.00" },
  ] as const;

  return (
    <MockPanel>
      <MockLabel>{label}</MockLabel>
      <div className="divide-y">
        {rows.map(({ icon: Icon, tone, desc, tag, amount }, i) => (
          <div key={i} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full",
                tone === "destructive" && "bg-destructive/10 text-destructive",
                tone === "success" && "bg-success/10 text-success",
                tone === "primary" && "bg-primary/10 text-primary",
              )}
            >
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{desc}</p>
              <p className="truncate text-xs text-muted-foreground">{tag}</p>
            </div>
            <p
              className={cn(
                "figure shrink-0 text-sm",
                tone === "destructive" && "text-destructive",
                tone === "success" && "text-success",
                tone === "primary" && "text-foreground",
              )}
            >
              {amount}
            </p>
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
  onTrack,
  approaching,
  over,
}: {
  month: string;
  food: string;
  transport: string;
  entertainment: string;
  onTrack: string;
  approaching: string;
  over: string;
}) {
  const rows = [
    { cat: food, amt: "$340 / $500", pct: 68, state: "ok" as const, label: onTrack },
    { cat: transport, amt: "$210 / $250", pct: 84, state: "warn" as const, label: approaching },
    { cat: entertainment, amt: "$140 / $100", pct: 100, state: "over" as const, label: over },
  ];

  return (
    <MockPanel>
      <MockLabel>{month}</MockLabel>
      <div className="space-y-3">
        {rows.map(({ cat, amt, pct, state, label }, i) => (
          <div key={i}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-semibold text-foreground">{cat}</span>
              <span className="figure text-xs text-muted-foreground">{amt}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full",
                  state === "ok" && "bg-success",
                  state === "warn" && "bg-warning",
                  state === "over" && "bg-destructive",
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p
              className={cn(
                "mt-1 text-[0.7rem] font-semibold",
                state === "ok" && "text-success",
                state === "warn" && "text-warning",
                state === "over" && "text-destructive",
              )}
            >
              {label}
            </p>
          </div>
        ))}
      </div>
    </MockPanel>
  );
}

export function SubscriptionsMock({
  streaming,
  streamingCycle,
  cloud,
  cloudCycle,
}: {
  streaming: string;
  streamingCycle: string;
  cloud: string;
  cloudCycle: string;
}) {
  const rows = [
    { initials: "ST", name: streaming, cycle: streamingCycle, amt: "$15.99" },
    { initials: "CL", name: cloud, cycle: cloudCycle, amt: "$99.00" },
  ];
  return (
    <MockPanel>
      <div className="divide-y">
        {rows.map(({ initials, name, cycle, amt }, i) => (
          <div key={i} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-[0.65rem] font-bold text-accent-foreground">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{name}</p>
              <p className="truncate text-xs text-muted-foreground">{cycle}</p>
            </div>
            <p className="figure shrink-0 text-sm text-foreground">{amt}</p>
          </div>
        ))}
      </div>
    </MockPanel>
  );
}

export function InsightsMock({
  label,
  essentials,
  discretionary,
  subscriptions,
  other,
}: {
  label: string;
  essentials: string;
  discretionary: string;
  subscriptions: string;
  other: string;
}) {
  const legend = [
    { name: essentials, color: "var(--chart-1)" },
    { name: discretionary, color: "var(--chart-2)" },
    { name: subscriptions, color: "var(--chart-6)" },
    { name: other, color: "var(--border)" },
  ];
  return (
    <MockPanel>
      <MockLabel>{label}</MockLabel>
      <div
        className="mx-auto flex size-28 items-center justify-center rounded-full"
        style={{
          background:
            "conic-gradient(var(--chart-1) 0 40%, var(--chart-2) 40% 65%, var(--chart-6) 65% 82%, var(--border) 82% 100%)",
        }}
      >
        <div className="flex size-16 items-center justify-center rounded-full bg-card">
          <span className="figure text-sm text-foreground">64%</span>
        </div>
      </div>
      <div className="mt-4 space-y-1.5">
        {legend.map(({ name, color }) => (
          <div key={name} className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            {name}
          </div>
        ))}
      </div>
    </MockPanel>
  );
}

export function SettingsMock({
  currencyLabel,
  themeLabel,
  soundLabel,
  installLabel,
  themeValue,
  on,
  available,
}: {
  currencyLabel: string;
  themeLabel: string;
  soundLabel: string;
  installLabel: string;
  themeValue: string;
  on: string;
  available: string;
}) {
  const rows = [
    { label: currencyLabel, value: "USD" },
    { label: themeLabel, value: themeValue },
    { label: soundLabel, value: on },
    { label: installLabel, value: available },
  ];
  return (
    <MockPanel>
      <div className="divide-y">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between py-2.5 text-sm first:pt-0 last:pb-0">
            <span className="font-semibold text-foreground">{label}</span>
            <span className="text-xs text-muted-foreground">{value}</span>
          </div>
        ))}
      </div>
    </MockPanel>
  );
}
