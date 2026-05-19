import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Honor the underscore-prefix convention for intentionally unused
    // variables (e.g. destructure-and-discard patterns: `const { foo, _omit,
    // ...rest } = obj`). This is the canonical JS/TS escape hatch when you
    // need to name a binding to strip a field from an object.
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern:              '^_',
        varsIgnorePattern:              '^_',
        caughtErrorsIgnorePattern:      '^_',
        destructuredArrayIgnorePattern: '^_',
      }],
    },
  },
  {
    // React Email templates render a full HTML document, so they use the raw
    // <head> element on purpose. next/head's <Head /> belongs to the Next.js
    // App Router and would break email rendering. Disable the Next-page-
    // specific rule for the emails/ folder.
    files: ['emails/**/*.{ts,tsx}'],
    rules: {
      '@next/next/no-head-element': 'off',
    },
  },
  {
    // Prevent regressions in server-side code: raw auth.getUser() throws on
    // stale tokens. Use getUserSafe() from @/lib/supabase/server instead.
    // Scoped to API routes and server libs only — client components use the
    // browser Supabase client where getUser() is safe and getUserSafe() doesn't apply.
    files: ['app/api/**/*.ts', 'lib/**/*.ts'],
    // server.ts defines getUserSafe itself; proxy/session.ts wraps the same
    // try/catch but also clears stale sb-* cookies on throw — extra cleanup
    // getUserSafe doesn't do.
    ignores: ['lib/supabase/server.ts', 'lib/proxy/session.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.property.name='auth'][property.name='getUser']",
          message: "Use getUserSafe(supabase) from @/lib/supabase/server instead of supabase.auth.getUser() — raw getUser throws on stale tokens.",
        },
      ],
    },
  },
  {
    // Prevent raw Tailwind color shades from re-appearing anywhere in the codebase.
    // Use semantic role tokens instead (defined in globals.css @theme inline).
    // Note: cn()/clsx() call expressions are NOT caught by this rule — review those manually.
    files: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='className'] Literal[value=/\\btext-orange-[456]00\\b/]",
          message: 'Use text-eyebrow, text-card-title, text-accent-text, or text-accent-text-soft instead of raw text-orange-N.',
        },
        {
          selector: "JSXAttribute[name.name='className'] Literal[value=/\\bbg-orange-(5|6|8|9)00\\b|\\bbg-orange-950\\b/]",
          message: 'Use bg-accent, bg-accent-hover, or bg-accent-tint instead of raw bg-orange-N.',
        },
        {
          selector: "JSXAttribute[name.name='className'] Literal[value=/\\b(bg|text|border)-(neutral|gray)-(800|900|950)\\b/]",
          message: 'Use bg-surface/bg-surface-raised/bg-surface-sunken, text-prose/text-prose-muted/text-prose-faint, or border-soft/border-strong instead of raw neutral/gray-N.',
        },
        {
          selector: "JSXAttribute[name.name='className'] Literal[value=/\\btext-(neutral|gray)-(100|200|400|500|600)\\b/]",
          message: 'Use text-prose, text-prose-muted, or text-prose-faint instead of raw text-neutral/gray-N.',
        },
      ],
    },
  },
]);

export default eslintConfig;
