# Task 8 report

Files: components/transactions/mark.tsx (new, extracted), transaction-row.tsx (imports Mark), components/help/mocks.tsx (LedgerMock, TriageMock rebuilt in SpecimenFrame; unused Badge import removed), app/(app)/help/page.tsx (dayLabel prop), messages/en.json + es.json, DESIGN.md.

Decisions
- LedgerMock: static legend h3 + rule, three LedgerRows with Stamp leads; expense "−" ink, income "+" teal, payment unsigned; amounts via formatMoney DOP (RD$). New prop dayLabel; new key Help.ledgerMockDay (en "Fri, Sep 4", es "vie, 4 sep"). Existing props/keys kept.
- TriageMock: SpecimenFrame, summary line, one hairline sheet, two blocks (LedgerRow head + static 3-Stamp rail, selected stamp-inked + underline, heavy --rule between blocks). Props unchanged; categories get fixed swatch colours/emoji (specimen data).
- Copy (en+es): transactionsIntro, addingBody (slip + stamps), findingBody (pinned date), triageBody (sheet of blocks, stamped mark), statementsBody (dialog reads statement as ruled sheet of real lines). No keys removed.
- DESIGN.md: new "### Transactions and Imports (Phase 3)"; pending list now Phases 4-7 without Transactions/Imports; counts: ColorTile 9 caller files (10 files incl. its own definition color-tile.tsx), StatPill 5 (6 incl. definition); Structural paragraph names LedgerRow trailing + ProofMark lg.

Tests: tsc clean; eslint on components/help components/transactions app/(app)/help clean; vitest 1130 pass, 0 fail; en/es key sets identical (node diff).

Concerns: prior DESIGN.md "10 callers" apparently counted differently; I counted importing files excluding the definition. Paper-slip form description in DESIGN.md is from the task 5 commit subject, not re-read in code.

## Fix report
- DESIGN.md: reworded "first" claim (first to use ProofMark lg and to put row edit/delete in trailing; onboarding already uses trailing). Verified: lg used only by DoneStamp; trailing edit/delete only in transaction-row. No other "first" claims added.
- Updated Ledger row, Stamp and Specimen frame table rows (help mocks in SpecimenFrame: Overview, Accounts, Ledger, Triage).
- LedgerMock: MockLabel replaced by sr-only label (SpecimenFrame has the visible legend); formatMoney import moved with lib imports.
- Command: npx tsc --noEmit && npx eslint components/help && npx vitest run -> tsc clean, eslint no issues, vitest PASS 1130 FAIL 0.
