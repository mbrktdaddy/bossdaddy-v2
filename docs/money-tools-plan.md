# Money Tools Plan — the Calculators path

> Status: **BUILT 2026-09-24** — all four shipped (uncommitted at time of writing). Routes: `/tools/emergency-runway`, `/tools/life-insurance`, `/tools/debt-payoff`, `/tools/loan-math`. Engine `lib/dad-tools/finance.ts` + `tests/unit/finance.test.ts`; shared UI `components/dad-tools/{NumberField,CalculatorParts}.tsx`; URL helpers `lib/dad-tools/{url-params,debt-params}.ts`.
> Scope: four new calculators in the `/tools` **Calculators** section, joining Dad Math.

## Decisions (locked)

- **Stateless, no account, no DB changes.** Every calculator works signed-out. Shareable state lives in URL params (same pattern as Dad Math's `initialFromUrl`). No migrations.
- **Car + personal loan = ONE tool** (Loan Math) with a Car / Personal toggle. Car adds down payment, trade-in, sales tax, fees; the amortization is identical.
- **Dad Math stays its own tool.** Different question (growth toward a kid's goal vs. debt paid down) and it's kid-aware.
- **One number per page.** Each calculator has a single headline number; everything else is supporting.
- **Shared math, separate pages.** All amortization/growth math lives in one pure module: `lib/dad-tools/finance.ts`, unit-tested. Pages are thin.
- **Display labels in `lib/labels.ts`** under `LABELS.tools.*`, per the Naming Doctrine.

## The path — how they relate

The calculators are ordered as the sequence a dad should tackle his money in. The hub shows them in **path order**, and each result ends with a **"Next step"** link to the next tool.

| # | Role (eyebrow) | Tool | Question it answers | Headline number |
|---|---|---|---|---|
| 1 | **Steady** | Emergency Runway | How long could we last without a paycheck? | Months of runway |
| 2 | **Protect** | Life Insurance Needs | If I'm gone tomorrow, is my family covered? | Coverage gap ($) |
| 3 | **Clear** | Debt Payoff Planner | What's the fastest way out of debt? | Debt-free date |
| 4 | **Clear** | Loan Math (car / personal) | What does this loan really cost me? | Monthly payment |
| 5 | **Build** | Dad Math (exists) | Am I on track for my kid's future? | On track / behind |

Why this order: you can't protect or build on top of a crisis (Steady first). Term life is cheap and the downside of skipping it is catastrophic for dependents (Protect before Clear). Debt drag kills compounding (Clear before Build). Loan Math sits with Clear as the "before you sign" door — the cheapest debt to pay off is the loan you never took.

### URL handoffs (no DB, no login)

The tools feed each other through query params, so the path feels connected without storing anything:

- **Loan Math → Debt Payoff:** "Add this to a payoff plan" prefills the loan as a debt row.
- **Runway → Life Insurance:** monthly expenses prefill the income-replacement input.
- **Debt Payoff → Life Insurance:** total debt prefills the D in DIME.
- **Life Insurance ↔ Dad Math:** the Education input links to Dad Math ("figure your college number") and accepts its target back.

## Build order (dependency-driven, not path order)

1. **Loan Math**: builds the shared `finance.ts` amortization engine. Already decided, and every later tool leans on it.
2. **Emergency Runway**: smallest build. Sets up the "Next step" and handoff pattern early.
3. **Debt Payoff Planner**: reuses the engine across several debts. Snowball vs. avalanche side by side, plus an extra-payment slider. The heaviest UI.
4. **Life Insurance Needs**: built last because it *consumes* the other three (runway expenses, payoff debts, Dad Math education). **Edge OFF** (brand guide §1.6): steady and warm, no jokes. Educational only, never a product recommendation. The Boss voice line should point to "talk to an independent agent," not a carrier.

## Hub changes (`app/(public)/tools/page.tsx`)

- Order `REFERENCE_TOOLS` by path, not build order, and add each tool as it ships.
- Dad Math's `spokeRole` changes `Money` → `Build` when the second calculator lands, so the eyebrows read as a path.
- Update the "More coming" placeholder copy as tools ship. Delete it once the section is full or the copy runs out.
- Calculators stay out of `ToolTiles`: the launcher is the four daily tools only (see that file's header).

## Per-tool notes

- **Loan Math:** inputs are price/amount, APR, term; for Car, add down payment, trade-in, tax %, and fees. Supporting numbers: total interest, total cost, payoff date. Voice line compares interest to something real, e.g. "$9,400 in interest. That's two years of soccer fees."
- **Emergency Runway:** inputs are cash on hand and monthly essentials (with an optional split). Show the months, plus a target band of 3–6 months.
- **Debt Payoff:** a list of debts (balance, APR, minimum payment), a monthly budget, and a strategy toggle. Headline is the debt-free date. Supporting numbers: interest saved vs. minimums only, and payoff order.
- **Life Insurance (DIME):** Debt + Income × years + Mortgage + Education, minus existing coverage and savings. Headline is the gap, and "You're covered" when there's no gap.

## Not doing

Mortgage/refi (Loan Math covers the core), retirement (saturated category), anything that stores financial data.
