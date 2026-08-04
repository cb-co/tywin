# Savings Goals — Manual Test Guide

**Feature merged:** 2026-08-03 (`62f1144`)
**Spec:** `docs/superpowers/specs/2026-08-03-savings-goals-design.md`

## Before you start

1. Apply the pending migrations — two are outstanding, both cleanup:
   ```bash
   npm run db:push
   ```
2. Start the app (`npm run dev`) and sign in.
3. You need at least **two** non-card, non-loan accounts to exercise the
   interesting cases. Checking and Savings is enough. Note your **base currency**
   (Settings) — goal targets are always in base currency.
4. Have at least one **credit card** account, to confirm it is correctly excluded.

Throughout, the single most important invariant is: **committing money to a goal
never changes an account's real balance, and never changes net worth.** If you
ever see either move because of a goal action, that is a bug, and it is the most
serious kind this feature can have.

---

## 1. The palette and card shading (affects budgets too)

| Step | Expected |
|---|---|
| Go to `/budgets`, click **Add category** | Colour picker shows **16** swatches, wrapping to two rows |
| Pick a strongly coloured swatch, save | The category card takes a faint wash of that colour; text stays readable |
| Switch to the table view (the toggle above the grid) | Rows are washed too, and text stays aligned exactly as before |
| Toggle dark mode | The wash follows the theme — a gentle cast, never a solid block |
| Create a category with **no** colour | Card renders exactly as it always did, no tint |

Narrow the window to ~320px with the colour picker open — swatches should reflow,
not overflow the dialog.

---

## 2. Creating a goal

Go to `/budgets`. Below the rule you should see a **SAVINGS GOALS** band with an
empty state.

| Step | Expected |
|---|---|
| Click **Add goal** | Dialog with emoji, name, target amount, target date, 16 colours |
| Save with an empty name | Blocked |
| Save with target `0` or negative | Blocked (`min` is 0.01, and the DB enforces `> 0`) |
| Create "Japan Trip", target **1000**, no date, pick a colour | Card appears, `$0 of $1,000`, empty bar, pace reads **"No pace yet"** |
| Reopen the dialog via the pencil | All fields pre-filled with the saved values |
| Open **Add goal** again (create mode) | Fields are **empty** — no leakage from the goal you just edited |

---

## 3. Contributing

| Step | Expected |
|---|---|
| Click **Contribute** on Japan Trip | Dialog with a Withdraw toggle, account picker, amount, date, note |
| Open the account picker | Shows your Checking/Savings/Cash/Investment accounts. **Your credit card and any loan must NOT appear.** Each row reads `Name · CUR` |
| Look at the closed picker after selecting | Shows the account **name**, not a raw UUID |
| Contribute **400** from Checking | Card shows `$400 of $1,000`, bar ~40% in the goal's colour, pace updates |

### The core invariant

| Step | Expected |
|---|---|
| Go to `/accounts` | Checking's **headline balance is unchanged** |
| Look under it | New line: `$X available · $400 committed` |
| Go to `/` (overview) | **Net worth is unchanged** by the contribution |
| Look at your credit card's card | **No** available/committed line at all |
| Look at an account with no goal commitments | **No** available/committed line |

### Figure masking

| Step | Expected |
|---|---|
| Click the mask toggle in the sidebar | Both the headline balance **and** the available/committed figures mask |
| | The labels ("available", "committed") stay readable — only numbers hide |

If the available/committed numbers stay visible while the balance masks, that
defeats the mask — the balance is recoverable by arithmetic.

---

## 4. The clamp — the heart of the feature

Set up: Checking balance **1000**, contribute **400** to Japan Trip.
So: `available 600 · committed 400`.

| Step | Expected |
|---|---|
| Add an expense of **900** from Checking | Real balance drops to 100 |
| `/accounts` | `$0 available · $100 committed` — committed **clamped down** from 400 to 100 |
| | Available is **never negative** |
| `/budgets` | Japan Trip shows a **shortfall**: bar is part goal-colour, part muted warning |
| | Pace line reads **"$300 borrowed back"** in red, replacing the pace verdict |
| | Totals row gains a red `$300 borrowed back` |
| Delete that expense | Everything returns to `$600 available · $400 committed`, shortfall gone |

**This must self-heal with no reconciliation step.** Nothing is written when you
overspend; it is recomputed each read.

### Backdating

| Step | Expected |
|---|---|
| Add an expense dated **last month** that overdraws the committed amount | Shortfall appears just the same |

The clamp reads current balance only, so insert order and backdating are
irrelevant. Statement imports insert transactions in the past — this is why.

---

## 5. Borrow-back order (multi-goal)

Set up: Checking balance **800**, both goals funded from Checking:

1. Contribute **600** to "Old Goal" dated **two months ago**
2. Contribute **600** to "New Goal" dated **this month**

| Expected |
|---|
| Committed clamps to 800 |
| **Old Goal: fully backed, no shortfall** |
| **New Goal: $200 backed, $400 shortfall** |

The rule is "the money you set aside most recently is the first borrowed back."
If it is the *older* goal showing the shortfall, the allocation order is inverted
— this was a real bug during development and is worth confirming.

### Over-withdrawal must not steal capacity

Set up: Checking balance **1000**.

1. Contribute **100** to Goal A, then **withdraw 400** from Goal A (same account)
2. Contribute **600** to Goal B

| Expected |
|---|
| **Goal B is fully backed at $600** — Goal A's negative net must not reduce Goal B's capacity |
| Goal A shows a **negative or zero saved**, and **`backed` never exceeds `saved`** |

If Goal B shows only $300 backed, the per-pair clamp has regressed.

---

## 6. Withdrawals

| Step | Expected |
|---|---|
| Contribute 500, then use **Withdraw** for 200 | Goal shows `$300`, Checking's committed drops to 300 |
| Type `-50` **with** the Withdraw toggle on | Records **−50**, not +50 (no double-negation) |
| Reopen the dialog | Withdraw toggle is **reset to off** |

---

## 7. Multi-currency

Only if you have an account in a non-base currency.

| Step | Expected |
|---|---|
| Contribute from a **base-currency** account | **No** exchange-rate field |
| Switch the picker to a **foreign-currency** account | Rate field appears, labelled `1 XXX to <BASE>` |
| Type a rate, then switch to a **different foreign** account | **Rate field clears** — a stale rate must not carry over |
| Switch to a foreign account and try to submit with an empty rate | Blocked |
| Enter rate `0` | Blocked |
| Contribute 1000 units at rate 0.5 | Goal progress rises by **500 base**; the account's committed rises by **1000** in its own currency |

Goal progress is base currency; account commitment is the account's currency.
Seeing 1000 added to goal progress means the two are being mixed — a real defect.

---

## 8. Pace verdicts

Create goals to hit each branch. `saved`/`target`/date drive it.

| Setup | Expected line |
|---|---|
| No contributions | "No pace yet" |
| Contributions, no target date | "Saving $X/mo → ~N months" |
| Target date a few months out, saving comfortably | "Need $A/mo · saving $B/mo" + green **On track** |
| Target date soon, saving little | Same shape + amber **Behind** |
| Target date in the **past**, not complete | "Past its target date" |
| `saved` ≥ `target` | "Target reached" |
| Any shortfall present | **"$X borrowed back"** — this **overrides** every verdict above, including "Target reached" |

Runway counts **inclusively**: on 3 Aug with a 31 Oct target, that's 3 months
(Aug, Sep, Oct), not 2.

---

## 9. Page structure and month scoping

| Step | Expected |
|---|---|
| `/budgets` | Two labelled bands: **BUDGETS** and **SAVINGS GOALS**, separated by a rule |
| | The month picker sits **inside the budgets band**, not at page top |
| Change the month | Budget figures change. **Goal figures do not move at all** |
| Page title / sidebar | "Budgets & Goals" / "Presupuestos y metas" |
| `/insights` | A **Savings goals** card in the first band, beside net worth |
| | It is **above** the month picker's band — goals are cumulative, not monthly |
| Change the month on `/insights` | The savings goals card **does not change** |

---

## 10. Deletion

| Step | Expected |
|---|---|
| Click the trash icon on a goal | **Confirmation dialog**, naming the goal, warning the contribution history is lost |
| Cancel | Nothing is deleted |
| Confirm | Goal disappears; the origin account's committed **drops accordingly** on `/accounts` |
| With 3 goals, delete one | **Only that card's** button spinners — the other two stay clickable |
| Same check on **budget categories** | Only the clicked row's delete spinners (this was fixed here too) |

---

## 11. Totals row

With several goals:

```
Saved $3,200 · Target $11,000 · Backed $3,000 · $200 borrowed back
```

| Expected |
|---|
| The fourth figure appears **only** when a shortfall exists, in red |
| With no shortfall anywhere, the row ends at `Backed` — no `$0`, no empty text |
| `Saved` equals the sum of the cards above it (archived goals excluded) |

---

## 12. Spanish

Switch the language. next-intl **throws on a missing key**, so a crash here is a
missing translation, not a cosmetic issue.

Walk: `/budgets` both bands → open both dialogs → contribute → trigger a
shortfall → delete with confirmation → `/accounts` → `/insights`. Any white
screen or error overlay is a missing key.

---

## 13. Empty and edge states

| State | Expected |
|---|---|
| No goals at all | Empty state, no totals row, no `$0 / $0` |
| A user with **no eligible accounts** | Contribute dialog explains you need a real account first — no broken form |
| Goal with `saved` driven **negative** by withdrawals | Bar renders **empty**, not inverted or overflowing |
| `saved` > `target` | Bar caps at 100%, does not overflow the track |

---

## What would worry me most

In rough order:

1. **Net worth or a headline account balance moving** because of a goal action.
2. **Available going negative**, or committed exceeding the real balance.
3. **`backed` exceeding `saved`** on any card, or in the totals row.
4. **The older goal bearing the shortfall** instead of the newer one.
5. **Goal progress rising by a foreign-currency amount** rather than its base value.
6. A **Spanish crash** — that is a missing key and will hit real users immediately.

## Known gaps (not bugs)

- **No contribution history UI.** You cannot see or delete individual
  contributions; a mistake can only be offset by a withdrawal, leaving two rows
  you cannot inspect.
- **No balance-over-time view** for a goal.
- `app/(app)/accounts/statement-actions.test.ts` fails to import — pre-existing
  on `main`, unrelated to this feature.
