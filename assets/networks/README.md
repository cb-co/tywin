# Card network logos — drop folder

Source files for the marks on card faces. **Build-time inputs, not shipped
assets**: the SVG paths get inlined into `components/accounts/network-mark.tsx`
so they cost no network request, work behind the CSP, and can inherit
`currentColor` where the mark allows it. Nothing here is served from `/`.

## Filenames

One file per slug. The name must match the `CardNetwork` slug in
`lib/accounts/network.ts` exactly — that string is the map key.

| File | Network | Colour-locked? |
|---|---|---|
| `visa.svg` | Visa | No — single colour, recolours cleanly |
| `mastercard.svg` | Mastercard | **Yes** — the red/amber circles are the mark |
| `amex.svg` | American Express | No — the blue box can knock out |
| `discover.svg` | Discover | **Yes** — the orange orb is the tell |
| `diners.svg` | Diners Club | No |
| `jcb.svg` | JCB | **Yes** — the three bars are blue/red/green |
| `unionpay.svg` | UnionPay | **Yes** — red/blue/teal |

Optional, only for the "No" rows above — a reversed/white version if the brand
kit ships one, otherwise I recolour the single-colour file:

```
visa-white.svg   amex-white.svg   diners-white.svg
```

## What to grab

- **SVG**, from the network's own brand centre where possible, so the
  trademarks are the correct current form. PNG only as a last resort, and then
  at 3x.
- **No baked-in background plate or padding** — just the mark on transparent.
  I set the sizing and spacing.
- Any `viewBox` is fine; I normalise all seven to a common height so networks
  do not jitter against each other on a wall of cards.
- If the kit offers "logo" vs "symbol/icon", take the one that reads at ~32px
  tall. For Visa and Amex that is the wordmark; for Mastercard it is the
  circles alone, no accompanying text.

## Note

These are the networks' registered trademarks. Using them to label a card
someone already holds is ordinary, but the official kits come with usage
guidelines worth a skim — mainly minimum clear space and no recolouring of the
colour-locked marks.
