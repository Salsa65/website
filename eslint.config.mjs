import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Reforge intentionally hydrates auth, invite, guest, and realtime state from
      // external systems inside effects. These are synchronization effects, not
      // derived render state.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    'mobile-dist/**',
    'android/**',
    'out/**',
    'build/**',
    'supabase/functions/**',
    'next-env.d.ts',
  ]),
]);
