## Summary

- Extend money helpers in `src/lib/utils.ts`: locale-aware `formatCurrency`, USD-to-display conversion, grouped parsing, and `useMoneyFormatter()` hook
- Add `CurrencyNumField` for LCCA cost inputs (grouped display, USD storage; IDR divides by rate on commit)
- Apply formatting across Economics, Compare, Sensitivity (cost metric), Reports PDF export, and CSV exports

Closes #293

## Test plan

- [ ] `pnpm exec tsx --test tests/unit/money-format.test.ts`
- [ ] `pnpm exec tsc --noEmit`
- [ ] Manual: Settings -> IDR, verify Economics opex/LCCA tables and charts show IDR grouping
- [ ] Manual: LCCA construction/resurfacing fields accept grouped IDR input and persist correct USD
- [ ] Manual: Compare page operating cost rows respect display currency
- [ ] Manual: PDF export uses selected currency for cost table
