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
    // Prevent regressions in server-side code: raw auth.getUser() throws on
    // stale tokens. Use getUserSafe() from @/lib/supabase/server instead.
    // Scoped to API routes and server libs only — client components use the
    // browser Supabase client where getUser() is safe and getUserSafe() doesn't apply.
    files: ['app/api/**/*.ts', 'lib/**/*.ts'],
    ignores: ['lib/supabase/server.ts'],
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
]);

export default eslintConfig;
