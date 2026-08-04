# SDD ledger — plan: docs/plans/2026-08-04-playful-redesign.md

> **This is the committed, durable copy.** The live working ledger is at
> `.superpowers/sdd/2026-08-04-playful-redesign/progress.md`, which is **git-ignored**
> (`.gitignore:48`) and therefore destroyed by `git clean -fdx`. This copy exists so the
> handoff survives that. The task briefs, implementer reports and review-package diffs
> referenced below live only in that git-ignored directory — if it is gone, regenerate
> briefs with the skill's `scripts/task-brief` and rely on this file plus `git log`.
> **When resuming, copy this file back over the working ledger and keep appending there.**

> **RESUMING? Read the `RESUME HERE` block at the END of this file first.** It carries
> the execution order, the exact next step (Task 12, brief generated, no implementer
> dispatched), pre-computed and verified chart-palette values, a design trap to decide
> before dispatching, a Task 15 blocker needing a user decision, and two tooling traps
> that will silently mislead you. Tasks with a `Task <N>: complete` line below are DONE —
> do not re-dispatch them.

## Pre-flight (controller decisions, no human input needed)
- Execution order: 1,2,3,4,5,9,6,7,8,10,11,12,13,14,15 (not 1..15). Task 9 depends only
  on Task 4 (ColorTile) and Task 5 (StatPill, pill Badge), not on Tasks 6-8. Running it
  right after Task 5 closes a broken-build window Task 4 Step 5 explicitly accepts
  (colorCardStyle import removed in Task 4, only fixed by Task 9's budget-grid.tsx edit).
- Task 7 dispatch: brief contains a deliberately-wrong inferNetwork draft before the
  corrected version. Dispatch instructs implementer to use only the `match()`-based
  second form.

Task 1: minor (deferred): app/globals.css:162-271 several inline comments (warm-tinted shadow, 32px blur, "ivory" mentions, stale L-values) now stale against the new cool/violet values — not touched by this task's scope, worth a cleanup pass.
Task 1: minor (deferred): app/globals.css:52 --color-hero-foreground mapping has no explanatory comment for why --hero itself has no --color-* counterpart.
Task 1: complete (commits fea0a3c..a24b5aa, review clean)

Task 2: parked — reviewer flagged Critical: "colorCardStyle not removed" per Task 2's
Interfaces "Produces" line — ruling: false positive. That line was ambiguous plan text
(attributes the removal to Task 4 in the same sentence it lists it under Task 2's
Produces). Task 2's actual Steps 1-5 never mention colorCardStyle; Task 4 Step 3 is the
real removal instruction. Removing it now would also reopen the broken-build window
closed by the Task 9 reorder (see pre-flight note). Plan text corrected in commit d3ad1d8
so this does not recur for future readers. All other spec items and both quality
strengths in the review stand; no other findings.
Task 2: complete (commits a24b5aa..1140199, 1 parked)

Task 3: complete (commits d3ad1d8..637e343, review clean)

Task 4: found (not this task's fault) — components/goals/goal-grid.tsx:113 also used
colorCardStyle, a call site the plan's Task 9 originally missed. Plan corrected in
commit 4109433 (Task 9 Step 0 added, see below). npm run build expected to fail on
budget-grid.tsx and goal-grid.tsx until Task 9 lands — this is intentional, not a bug.
Task 4: minor (deferred): components/ui/money-display.tsx:57,65 redundant tabular-nums
Tailwind class layered on .figure's own tabular-nums CSS (harmless, inherited from brief).
Task 4: minor (deferred): components/ui/color-tile.tsx:52 name.charAt(0) doesn't trim
leading whitespace before taking the initial (inherited from brief, unlikely to occur).
Task 4: complete (commits 637e343..f1f2132, review clean; plan gap fixed in 4109433)

Task 5: complete (commits 4109433..44860d6, review clean; also fixed app/(app)/page.tsx:67
stale group-hover:ring-foreground/20, same bug pattern as account-card.tsx, found via
full-repo grep — no remaining instances anywhere)

Task 9: controller resolved reviewer's ⚠️ item — the two leftover `color-mix(in oklab, ${`
occurrences are components/accounts/account-card.tsx:38 (owned by Task 8, which modifies that
file) and components/marketing/marketing-home.tsx (owned by Task 13). Both carried forward as
dispatch pointers; Step 5's grep goes clean project-wide only after Task 13. Not a Task 9 gap.
Task 9: minor (deferred): implementer's own `npm test` reported 1 failed suite-collection
(fx.ts vi.mock hoisting); controller's independent `npx vitest run` at 0d316b6 shows 236/0
clean. Treated as implementer environment noise, not a regression.
Task 9: controller ruling on reviewer's "plan-mandated" label for the sticky `top-0` finding —
NOT a plan conflict, so no human adjudication needed: the brief's Step 4 mandates the snippet
AND says "Verify the header actually sticks before moving on." Those two clauses are in tension
and the verification clause governs. Fixing top-0 -> top-14 md:top-0 fulfils the brief rather
than contradicting it. Confirmed the collision myself: components/shell/mobile-header.tsx:13 is
`sticky top-0 z-30 h-14 md:hidden`, and app-shell.tsx:40 only applies overflow-y-auto at `md:`,
so below md both stick to the document at the same offset and the opaque header wins.
Task 9: fix round 1/5 (2 addressed, 0 open — sticky header now top-14 md:top-0; both
amountOfBudget call sites routed through useMaskedFormatMoney; commits 0d316b6..e6918d3)
Task 9: minor (deferred): components/budgets/budget-grid.tsx:161,165,170 month-switcher
totals row (totalBudget/totalUsed/remaining) renders money via bare formatMoney, unmasked
— pre-existing, no masked twin, so not Finding 2's duplicate defect, but it does violate the
global figure-mask constraint. Must be picked up by Task 15 Step 3 (verify masking end to end).
Task 9: PRE-EXISTING BRANCH-WIDE DEFECT (controller-verified, needs a decision at Task 15):
app/(app)/accounts/statement-actions.test.ts fails to COLLECT — 'No "unstable_cache" export is
defined on the "next/cache" mock' via lib/fx.ts:37. Verified present unchanged at merge-base
79004aa (1 failed file / 33 passed) and at e6918d3 (1 failed / 35 passed); this branch never
touches lib/fx.ts or that test. Task 15 Step 5 demands `npm test` "all pass", which CANNOT hold
until this is fixed. NOTE: `rtk`-proxied `npx vitest run` prints "PASS (236) FAIL (0)" and hides
the file-level collection failure — always run ./node_modules/.bin/vitest run directly.
Task 9: complete (commits 44860d6..e6918d3, review clean)

Task 6: controller resolved reviewer's ⚠️ item — RED-before-GREEN cannot be corroborated from
git history because the brief's own Step 5 bundles test+implementation into one commit. Report's
RED output is structurally correct and plausible; accepted. Not an implementer shortcut.
Task 6: minor (deferred): lib/color.ts:8-9 channels() does not handle 3-digit shorthand hex
(#fff misparses as (0,15,255)), malformed, or empty input — verbatim from the brief, untested by
it. Relevant to Task 8, which feeds stored user colours into readableForeground/gradientFrom;
carried as a dispatch pointer to Task 8.
Task 6: complete (commits e6918d3..761b551, review clean)

Task 7: complete (commits 761b551..3ebbe17, review clean — used the match()-based inferNetwork,
no trace of the brief's deliberately-wrong haystack draft; reviewer independently re-executed the
regexes and confirmed the McDonald's/McKinsey word-boundary and year-vs-card-number edge cases)

Task 8: USER DECISIONS (2026-08-04, override plan text where they conflict):
 (a) NO cross-currency balance unification on the card face. Card groups are "usually cross
     currency", so show the summed figure ONLY when every line shares one currency; otherwise
     omit the figure from the face entirely. FX conversion explicitly rejected.
     Orphaning concern the user raised is moot: card-group-tile.tsx:38 already wraps BOTH the
     face and the per-line rows in one <Card>, so the lines are rows on the same tile.
 (b) Network mark: infer from name via regex (already the behaviour); when inference fails,
     render NOTHING. This OVERRIDES the plan's Task 8 Step 2 text ("No network known: a neutral
     chip stands in so the corner is not empty") — the neutral-chip fallback is removed.
 (c) last4 must become an optional field on the card form. Split by schema cost:
     card_groups.last4 ALREADY EXISTS (check constraint ^[0-9]{4}$) -> form field needs no
     migration; accounts has NO last4 column -> needs a new migration the user must push.
     Tracked as new Tasks 16 and 17 respectively.
 (d) art_color: user has no defined idea; ideal is real card art, possibly via the LLM
     integration from the card name. Recorded in the plan's Deferred section. Not implemented.
Task 8: controller rulings on the reviewer's plan-mandated findings — Global Constraints
outrank an illustrative task snippet, so both are fixed rather than escalated: the AMEX
knockout fill="var(--card)" (invisible in the default theme; violates "Both themes are
first-class" + the contrast contract) and aria-label="Card" (violates "No hardcoded English").
User was informed of both rulings and did not object.
Task 8: fix round 1/5 (8 addressed, 1 open; commits ff3368e..38375e5)
Task 8: controller ruling on the one open finding — CLOSED, not escalated, and not a silent
discard. The re-reviewer held that aria-label="Mastercard" (network-mark.tsx:33) and
aria-label="American Express" (:41) must be routed through next-intl, because MY fix instruction
said "any remaining hardcoded English aria-label in the file must go through next-intl". That
instruction was over-broad and the finding traces to my prompt wording, not to the plan or the
code: both strings are proper-noun trademarks, identical in Spanish, so translating them would
add two keys holding the same value in both locales for zero user benefit. The FIRST reviewer had
already explicitly blessed them ("The other two labels are proper nouns and fine"). The genuinely
bad label, the generic English aria-label="Card" on the unknown-network fallback, is gone — that
whole element was deleted by User Decision 2. No user-visible defect remains.
Task 8: minor (deferred): messages/en.json + es.json still carry dead keys
`cardGroupFallbackName` and `currencyLines` — controller confirmed zero code usage across
app/components/lib. Dead copy for the final whole-branch review to sweep.
Task 8: complete (commits 3ebbe17..38375e5, 1 finding closed by controller ruling)

Task 10: controller resolved reviewer's ⚠️ item — the empty-state CTA keeps variant="default"
(not "brand", which would render invisibly against the identical hero gradient). Reviewer's token
math puts the button surface at ~4.8:1 against the gradient in light and ~3.2:1 in dark. Both
clear the plan's stated 3:1 contract for large elements, so no defect; carried to Task 15 Step 1
as a dark-mode eyeball item.
Task 10: minor (deferred): app/(app)/page.tsx spending stat card has a redundant
className="mt-2 text-foreground" on MoneyDisplay (ambient Card context already supplies it).
Task 10: minor (deferred): HeroCard's brief-verbatim signature accepts no `style`, forcing a
wrapper div for rise/--i at each call site. Verified genuinely equivalent against globals.css
:332-343 (--i is read on the same node that declares it) and consistent with the existing
STARTER_CARDS pattern in the same file. Revisit only if a third HeroCard call site appears.
Task 10: complete (commits 38375e5..26dcc31, review clean)

Task 11: controller resolved reviewer's ⚠️ item — computed --sidebar-primary contrast directly:
LIGHT #6C4EF5 on #ffffff = 5.19:1; DARK #8B72FF on #12091f = 5.48:1; and 5.19:1 / 5.36:1 against
the respective sidebar backgrounds. All clear the 3:1 contract and even 4.5:1. No defect.
Task 11: controller ruling on the reviewer's "plan-mandated" label for the safe-area padding —
NOT a plan conflict, so no human adjudication needed. The brief says "Preserve both existing
BEHAVIOURS: the env(safe-area-inset-bottom) padding, and the equal-column gridTemplateColumns."
It asks to preserve the behaviour, not the literal CSS property. Folding the inset into
bottom-[calc(1rem+env(safe-area-inset-bottom))] preserves the behaviour (bar still clears the home
indicator) and fixes the lopsided pill, so it fulfils the brief rather than contradicting it.
Controller re-derived clearance under the fix: pill top edge 16+inset+56 = 72+inset; FAB top edge
80+60 = 140; main padding 9.5rem+inset = 152+inset clears both.
Task 11: minor (deferred, being addressed in the fix round): bottom-nav.tsx:113 dropped `border-t`
without the brief asking; reasoning is sound but was only recorded in the report, not the file.
Task 11: fix round 1/5 (2 addressed, 0 open; commits c80204b..2078145). Implementer also caught,
unprompted, that its round-1 comments literally quoted Tailwind arbitrary-value syntax
(bottom-4, bottom-[calc(...)], bottom-[5rem]) in prose — Tailwind v4's content scanner matches
class-like tokens ANYWHERE in file text including comments, so this emitted three stray CSS rules,
one invalid. Reworded to prose-only and added a warning note. Saved to memory as a repo-wide trap.
Task 11: complete (commits 26dcc31..2078145, review clean)

Task 12: implemented directly by the controller, not via a subagent — this session's
harness instructions forbid dispatching agents unless the user asks, which overrides the
skill's dispatch loop. Steps followed as written; no brief deviation otherwise.
Task 12: DARK VALUES — did NOT use the handoff's pre-computed candidate. Validated all four
criteria the rationale states (not just the 3:1 the handoff checked) and the candidate lost on
two: OKLab L spread 0.085 vs the committed set's 0.040, and chroma floor 0.108. Generated
instead by carrying each NEW light hue AND chroma across unchanged and lifting only lightness,
anchored on the committed set's per-slot L offsets re-centred at 0.685. Result
#8B72FF #D88C1F #2FB39D #F36549 #BA6DDC #97AA48 #35A8E1 #ED5B85: L spread 0.057, chroma floor
0.115, min contrast 5.09:1 vs #16161f, and better protan (0.138 vs 0.109) and deutan (0.126 vs
0.111) adjacent-pair separation than the candidate. Tritan min 0.114 is below the candidate's
0.137 but above the committed set's shipped 0.084. Script kept nowhere — regenerate from the
method above if these are ever revisited.
Task 12: took option (a) on the DESIGN TRAP — lib/palette.test.ts reads app/globals.css via
`new URL("../app/globals.css", import.meta.url)` (cwd-independent) and slices the `:root` and
`.dark` blocks. Added a guard test asserting the parse actually found 8+8 values, so a broken
parse cannot make the contrast assertions vacuously true. Mutation-checked: setting --chart-3
to #FFF2A0 fails with "expected 1.1375661230490883 to be >= 3". Also asserts slot 1 == --ring
on each theme, so a future brand re-hue drags the lead series with it.
Task 12: fixed in passing — spend-donut.tsx had THREE unmasked money figures (centre total,
tooltip, legend rows), all now masked. The centre one is fixed by Step 3's MoneyDisplay swap;
the other two were the same defect class as the Task 9 finding and are in this task's file.
Task 12: minor (deferred): app/(app)/page.tsx:18 and marketing-home.tsx:10 use var(--chart-1)
as a nav-tile tint, which is now the same violet as --brand/--ring. Intentional per the design
(lead hue IS the brand) but worth an eyeball at Task 15 Step 1 — those tiles no longer read as
a distinct colour from the hero.
Task 12: verification — lint clean ("No issues found"), build succeeded (24/24 static pages),
./node_modules/.bin/vitest run = 37 passed / 1 failed FILE, 271 tests passed. The 1 failed file
is the documented pre-existing statement-actions.test.ts collection error, unchanged.
Task 12: complete (commit 2078145..66d435d, self-reviewed)

Task 13: CONFIRMED THE LEDGER'S OPEN QUESTION — Task 1 had NOT already fixed app/login/page.tsx.
It still carried the background/text utilities built on the removed brand panel tokens. The build
stayed green because Tailwind v4 emits NOTHING for an unknown utility rather than erroring, so
the login brand panel had been shipping with no background at all. This is the same failure mode
as the comment-scanner trap, in reverse, and no automated check on this branch would have caught
it. Fixed to the hero gradient.
Task 13: LEDGER CORRECTION — the claim that marketing-home.tsx held "the LAST" raw
`color-mix(in oklab, ${` was WRONG. Four existed; Task 13 removed only the one it owns. Still
open, all out of Task 13's file scope, all one-line ColorTile swaps, ALL FOR TASK 15:
  * app/(app)/page.tsx:72                (STARTER_CARDS tile, literal var(--chart-n) tint)
  * app/(app)/accounts/[id]/page.tsx:104 (stored account.color — ColorTile is built for this)
  * app/(app)/budgets/goals/[id]/page.tsx:43 (stored goal.color — same)
Task 9 Step 5's grep does NOT go clean until these three land. Do not re-report this as a
Task 13 gap.
Task 13: deviated from the brief's Step 1 snippet — scenes paint `fill="currentColor"` with the
wrapper defaulting to `text-brand`, instead of `fill="var(--brand)"`. Default rendering is
byte-identical to the brief's intent; the indirection exists because Step 2 puts a scene ON the
hero gradient, where `--brand` is violet on violet and disappears. The brief's own constraint
line already permits currentColor. Hero call sites override with `text-current` (twMerge drops
the default, verified lib/utils.ts uses twMerge not bare clsx).
Task 13: Step 3's "new button sizes" was already satisfied — marketing-home already used
size="lg"/size="sm" and button.tsx already carries the Task 5 h-12/h-10 scale. No work needed.
Task 13: Step 4 note — the OVERVIEW empty state does not use the EmptyState component at all;
it is a HeroCard in app/(app)/page.tsx. Illustration placed inside it, absolutely positioned
against HeroCard's inner `relative` content wrapper and clipped by the card's overflow-hidden.
app/(app)/page.tsx is not in the brief's Files list but Step 4 names the overview explicitly.
Task 13: minor (deferred): EmptyState now takes both `icon` and `illustration`; they are
alternatives, illustration wins. Only account-gallery.tsx was migrated. The other six call sites
(ledger, contributions-list, goal-grid, subscriptions-view, account-activity, budget-grid) still
pass `icon` and render unchanged — fine, but the split is worth a look during the Task 15 sweep.
Task 13: verification — grep for the dead token clean (needed two passes: my own explanatory
comment quoted the class name and matched it; reworded to prose, which is ALSO what the Tailwind
comment-scanner trap demands). lint "No issues found", build succeeded, vitest 37 passed /
1 failed file, 271 tests passed — the same documented pre-existing failure, unchanged.
Task 13: complete (commit 66d435d..70f384e, self-reviewed)

Task 14: react-hooks/set-state-in-effect rejected BOTH first drafts, correctly. Neither was
suppressed. useCountUp now holds `number | null` where null means "show the real value", writes
state only from inside the rAF callback, and returns `enabled && shown !== null ? shown : value`
so the non-animating paths need no state at all. The goal burst dropped React state entirely and
drives the class on the DOM through a ref — which is ALSO what makes a second arrival replay the
animation (remove class, force reflow via offsetWidth, re-add) instead of finding it finished.
Task 14: once-per-arrival trap that nearly shipped — SoundProvider redeclares playSuccess on
every render, so putting it in the effect deps re-fires the burst on unrelated parent renders.
Read through a ref synced in its own effect; deps are the single `reached` boolean. wasReached
is SEEDED with the mount value so an already-complete goal does not celebrate on every visit.
Task 14: .burst is the one animation whose reduce-block end state is correctly `opacity: 0` —
it carries no information, unlike everything above it in that block. The success sound still
plays under reduce; that setting is about motion, not feedback. Noted inline.
Task 14: STEP 6 NOT DONE — needs a browser (emulate reduce, reload, confirm nothing invisible).
Carried to the same browser pass as Task 15 Steps 1-4.
Task 14: complete except Step 6 (commit 70f384e..6e96059, self-reviewed)

Task 16: complete (commit 08da60d). The plan said "translated error"; actions.ts has NO
translation anywhere and returns English throughout, so the translated message the person reads
is raised in the dialog and the action keeps an English guard as the backstop for direct
invocation. Keys landed in the AccountForm namespace (NOT Accounts), both locales verified.

Task 17: complete (commit 1a9ac39). Key decisions:
 * MIGRATION UNPUSHED: supabase/migrations/20260804130000_accounts_last4.sql. See STANDING
   USER ACTIONS — there are now TWO unpushed migrations.
 * Pre-migration safety is implemented as a RETRY, not just a hope: isMissingLast4() detects
   PGRST204 / 42703 mentioning last4, and create/update re-run once with `last4: undefined`
   (supabase-js JSON.stringify drops undefined keys, so the column is genuinely omitted).
   Without it, adding the column ahead of its migration breaks account create/edit for
   EVERYONE, not just people who fill the optional field. Delete both branches after the push.
 * Reads needed no guard — every accounts query is select("*"), and inferLast4 treats an absent
   column the same as an unset one. Verified before relying on it.
 * lib/supabase/types.ts was HAND-EXTENDED (3 lines, alphabetical). db:types generates from the
   linked remote, which lacks the column. REGENERATE AFTER PUSHING.
 * TS trap: `let { data, error } = await ...` breaks the discriminated-union narrowing and the
   build fails with "'data' is possibly 'null'". Hold the whole response object instead.

Task 15: PARTIALLY DONE (commit 3d2b819) — every item that does not need a browser:
 * All FOUR raw color-mix tiles replaced with ColorTile. The project-wide grep from Task 9
   Step 5 is now CLEAN — verified, zero matches.
 * budget-grid month-switcher totals routed through the mask. The now-unused formatMoney import
   in that file confirms no unmasked money remains there.
 * Dead keys cardGroupFallbackName / currencyLines removed from both locales.
   NOTE: do NOT remove these with a JSON.parse/stringify round-trip — it strips the blank
   separator lines that group the Help section and produces a 22-line diff for a 4-line change.
   Delete the lines directly. I made this mistake and reverted it.
 * lint clean, build succeeds, vitest 271 passed / 1 pre-existing failed file.
STILL OPEN on Task 15 — Steps 1-4 and Step 6, plus Task 14 Step 6. All need a running dev
server, which per user preference must not be started without asking. Two questions were put
to the user at the end of this session: (a) start the dev server for the visual pass, and
(b) how to resolve the Step 5 test blocker below.

================================================================================
== RESUME HERE — handoff written 2026-08-04, session ended by user request     ==
== UPDATED: Tasks 12,13,14,16,17 DONE and Task 15 partially done. Only the     ==
== BROWSER pass remains (T15 Steps 1-4 + 6, T14 Step 6) plus the test blocker. ==
== The pre-computed dark chart candidate below was SUPERSEDED — do not reuse.  ==
== The "last color-mix instance" claim below is WRONG — see the Task 13 block. ==
== The color-mix grep is now CLEAN; ignore the stale claim that it is not.     ==
================================================================================

HEAD at handoff: 2078145  (branch redesign/playful-app-ui, working tree CLEAN)
Plan:            docs/plans/2026-08-04-playful-redesign.md
Skill:           superpowers:subagent-driven-development (re-invoke it; do not
                 improvise the loop — briefs/reports/review-packages live in
                 this directory and the scripts are under the skill's scripts/).

--- EXECUTION ORDER (pre-flight decision, NOT 1..17) -----------------------------
  1,2,3,4,5,9,6,7,8,10,11,  >>12<<,13,14,16,17,15
  Task 9 runs early: Task 4 deleted colorCardStyle and only Task 9 repairs its
  call sites, so any other order leaves the build broken in between.
  Tasks 16 and 17 are NEW (user decision, see Task 8 block above) and are now
  written into the plan document. They run BEFORE Task 15 so the sweep covers
  them. Task 15 is last.

--- DONE (all committed, all reviewed clean or with rulings logged above) --------
  Task 1  fea0a3c..a24b5aa   Task 2  a24b5aa..1140199   Task 3  d3ad1d8..637e343
  Task 4  637e343..f1f2132   Task 5  4109433..44860d6   Task 9  44860d6..e6918d3
  Task 6  e6918d3..761b551   Task 7  761b551..3ebbe17   Task 8  3ebbe17..38375e5
  Task 10 38375e5..26dcc31   Task 11 26dcc31..2078145

--- NEXT: TASK 12 (Insights and charts) -----------------------------------------
Status: brief generated at task-12-brief.md; NO implementer dispatched yet.
BASE for the review package is 2078145.

I did the colour work up front so the next session does not have to. All values
below were computed with the WCAG relative-luminance formula and are verified:

PROPOSED LIGHT (from the plan's Task 12 Step 1) vs #ffffff, all >= 3:1:
  chart-1 #6C4EF5 5.19 | chart-2 #CE830A 3.05 | chart-3 #00A08A 3.28
  chart-4 #E85B3F 3.50 | chart-5 #9B4FBC 4.95 | chart-6 #899C39 3.05
  chart-7 #1A96CE 3.33 | chart-8 #DB4A76 4.00
  (3.05 for amber and olive is the tightest pair — matches the palette
  rationale's own stated figure, so these are the intended values.)

CANDIDATE DARK — the plan does NOT specify these; it only says "lift each into
the dark band". Derived by lifting each light hue 18% toward white (hue-
preserving), with slot 1 taking the dark brand violet. All vs #16161f, all >= 3:1:
  chart-1 #8B72FF 5.09 | chart-2 #D79936 7.27 | chart-3 #2EB19F 6.76
  chart-4 #EC7962 6.40 | chart-5 #AD6FC8 5.04 | chart-6 #9EAE5D 7.42
  chart-7 #43A9D7 6.76 | chart-8 #E16B8F 5.73
  These are a STARTING POINT, not gospel. The plan's existing rationale also
  demands a lightness band, a chroma floor, and adjacent-pair separation under
  deutan/protan/tritan simulation — the 3:1 check alone does not cover those.
  The current committed dark values (#6286d8 #bf8532 #24a592 #ce6c54 #a867c3
  #8a9c4a #329acd #d5587c) all already pass 3:1 (4.61-5.93) if a smaller change
  is preferred.

*** DESIGN TRAP in Task 12 Step 2 — decide this before dispatching. ***
Step 2 says "Extend lib/palette.test.ts with a contrast assertion over the eight
light values and the eight dark values." Chart colours are CSS custom properties
in app/globals.css and cannot be imported into vitest. So either:
  (a) the test reads and parses app/globals.css with fs — real coverage, fails
      when someone edits the shipped values; or
  (b) the 16 hex strings get duplicated into the test — which asserts nothing
      about what ships and is exactly the "test that asserts nothing" pattern
      the review rubric flags as Important.
Instruct the implementer to do (a). Left unsaid, implementers reach for (b).

--- THEN: 13, 14, 16, 17, 15 ----------------------------------------------------
Briefs already generated for 13, 14, 15. Tasks 16/17 have full step lists in the
plan document (added this session). Carry these pointers into the dispatches:
  * Task 13 owns components/marketing/marketing-home.tsx, which still holds the
    LAST raw `color-mix(in oklab, ${` tile — the sixth instance. Task 9 Step 5's
    grep only goes clean project-wide after Task 13 replaces it with ColorTile.
  * Task 13 MUST update app/login/page.tsx: it is the only consumer of the
    removed --brand-panel / --brand-panel-foreground tokens. The build currently
    passes, so verify whether Task 1 already handled this before assuming work.
  * Task 14 wires CountUp into MoneyDisplay behind an opt-in `animate` prop and
    must add every new animation to the prefers-reduced-motion reduce block.

--- TASK 15 BLOCKER — needs a user decision, do not silently fix ----------------
Task 15 Step 5 demands `npm test` "all pass". It CANNOT, because
app/(app)/accounts/statement-actions.test.ts fails to COLLECT:
  'No "unstable_cache" export is defined on the "next/cache" mock' via lib/fx.ts:37
Verified present unchanged at merge-base 79004aa (1 failed file / 33 passed) and
at 2078145 (1 failed / 37 passed). This branch never touches lib/fx.ts or that
test, so it is NOT ours. Options: fix it (small — add unstable_cache to the
vi.mock), or get the user to accept it and amend Step 5. ASK; do not fold an
unrelated test fix into the redesign silently.

--- TOOLING TRAPS (both cost real time this session; also saved to memory) -------
1. `rtk` proxies npm/npx and HIDES file-level vitest collection failures — it
   prints "PASS (236) FAIL (0)" while a whole file failed to load. ALWAYS run
   ./node_modules/.bin/vitest run directly and read the `Test Files` line.
   I reported a clean suite to the user before a subagent contradicted me.
   rtk-filtered grep/ls output has also come back mangled or wrongly aggregated
   in this repo — verify surprising shell output a second way.
2. Tailwind v4's content scanner matches class-like tokens ANYWHERE in file text
   INCLUDING COMMENTS. A comment quoting `bottom-[5rem]` emits real CSS. This
   already shipped three stray rules (one invalid) in app-shell.tsx and
   bottom-nav.tsx before being caught. Describe layout maths in prose.

--- STANDING USER ACTIONS -------------------------------------------------------
  * supabase/migrations/20260804120000_brighten_palette.sql is STILL UNPUSHED.
    Agents must never run `npm run db:push`. Until it is pushed, rows hold the
    OLD palette, which is why every consumer must treat a stored colour as an
    arbitrary hex. Task 15 Step 4 verifies the pre-migration state.
  * Task 17 will add a SECOND migration (accounts.last4) needing the same.

--- DEFERRED MINORS FOR THE FINAL WHOLE-BRANCH REVIEW ---------------------------
Collected above under their tasks. The load-bearing ones:
  * budget-grid.tsx:161,165,170 month-switcher totals use bare formatMoney and
    are UNMASKED — a real figure-mask constraint violation. Task 15 Step 3 must
    catch it.
  * messages/en.json + es.json carry dead keys `cardGroupFallbackName` and
    `currencyLines` (zero code usage, controller-verified).
  * app/globals.css:162-271 inline comments are stale against the new cool/
    violet values ("warm-tinted shadow", 32px blur, "ivory", old L-values).
  * lib/color.ts channels() mishandles 3-digit shorthand/malformed hex; guarded
    at PaymentCard's call site only. lib/accounts/schema.ts:10 still lets a
    malformed colour reach the DB (z.string().trim().max(9), no pattern).
  * app/(app)/page.tsx spending stat card: redundant className text-foreground.
  * HeroCard takes no `style`, so rise/--i sit on a wrapper div at each call
    site. Verified equivalent; revisit only if a third call site appears.
================================================================================
