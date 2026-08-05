# Card network logos — drop folder

Source files for the marks on card faces. **Build-time inputs, not shipped
assets**: the SVG paths get inlined into `components/accounts/network-mark.tsx`
so they cost no network request, work behind the CSP, and can inherit
`currentColor` where the mark allows it. Nothing here is served from `/`.

## What is here

Three networks — the ones issued in the DR. Discover, Diners, JCB and UnionPay
were dropped from `CardNetwork` rather than shipped as marks nobody would see;
a card naming one now gets no mark, the same graceful path as any unrecognised
name.

| File | Rendered by | Source licence | Treatment |
|---|---|---|---|
| `visa.svg` | `network-logos/visa.tsx` | svgrepo "Logo" — share, no remix | Visa Blue `#1434CB` on light fills, white reversed on dark |
| `mastercard.svg` | `network-logos/mastercard.tsx` | Apache-2.0 | Colour-locked, always its own red/amber |
| `amex.svg` | `network-logos/amex.tsx` | Public domain / CC0 | Colour-locked to the blue plate |

## Licence notes

The Visa file is the constrained one: its licence permits sharing but not
remixing, and grants no trademark rights. The two-tone switch in `visa.tsx` is
**not** a remix in that sense — Visa's own brand guidance publishes exactly
those two treatments (blue on light, solid white reversed on dark), and the
geometry is untouched. Do not introduce a third colour, and do not stretch,
rotate or add effects to it.

Mastercard's Apache licence does permit modification, which is why the
interlock could be corrected — see the note in `mastercard.tsx`.

None of these grant trademark rights. Displaying them to label a card someone
already holds is the ordinary nominative use; putting them on marketing or
implying endorsement is not.

## Adding a network later

1. Drop `<slug>.svg` here, named for the slug you will add.
2. Add the slug to `CARD_NETWORKS` and a word-boundary pattern to `PATTERNS`,
   both in `lib/accounts/network.ts`.
3. Add a component under `components/accounts/network-logos/` and a branch in
   `network-mark.tsx`.

Marks are inlined, not served: no third-party request on the accounts page,
nothing that leaks which cards a person holds, nothing to fail behind a CSP.
Heights are tuned **optically** per mark, not matched numerically — their
proportions differ enough that equal heights look wrong.
