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
    // Prevent regressions: raw auth.getUser() throws on stale tokens.
    // Use getUserSafe() from @/lib/supabase/server instead.
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.property.name='auth'][property.name='getUser']",
          message: "Use getUserSafe(supabase) from @/lib/supabase/server instead of supabase.auth.getUser() — raw getUser throws on stale tokens.",
        },
      ],
    },
    ignores: ['lib/supabase/server.ts'],
  },
]);

export default eslintConfig;
