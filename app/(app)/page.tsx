import Link from "next/link";
import { Wallet, PieChart, Repeat, ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const STARTERS = [
  {
    href: "/accounts",
    icon: Wallet,
    tint: "var(--chart-1)",
    title: "Accounts & cards",
    body: "Add bank accounts, credit cards, and loans to see balances and utilization.",
  },
  {
    href: "/budgets",
    icon: PieChart,
    tint: "var(--chart-2)",
    title: "Budgets",
    body: "Set a monthly budget per category and watch what's used and what's left.",
  },
  {
    href: "/subscriptions",
    icon: Repeat,
    tint: "var(--chart-3)",
    title: "Subscriptions",
    body: "Track recurring charges and their next payment dates in one place.",
  },
];

export default function OverviewPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        title="Good to see you"
        description="Your money at a glance, once your accounts are set up."
      />

      {/* Net-worth hero — zero state, showcasing the ledger figure */}
      <Card className="relative overflow-hidden p-7">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/5"
        />
        <p className="text-sm font-medium text-muted-foreground">Net worth</p>
        <p className="figure mt-2 text-5xl leading-none text-foreground">$0.00</p>
        <p className="mt-3 max-w-md text-sm text-muted-foreground">
          Add your first account and every balance, in any currency, rolls up
          here in your base currency.
        </p>
        <Button className="mt-5" render={<Link href="/accounts" />}>
          Add an account
          <ArrowUpRight className="size-4" />
        </Button>
      </Card>

      {/* Starter cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {STARTERS.map(({ href, icon: Icon, tint, title, body }) => (
          <Link key={href} href={href} className="group">
            <Card className="h-full p-5 transition-colors group-hover:border-primary/40">
              <span
                className="flex size-10 items-center justify-center rounded-lg"
                style={{ backgroundColor: `color-mix(in oklab, ${tint} 16%, transparent)`, color: tint }}
              >
                <Icon className="size-5" />
              </span>
              <p className="mt-4 font-serif text-lg font-medium text-foreground">
                {title}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
