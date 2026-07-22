import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescript from 'eslint-config-next/typescript';

// Next 16 ships native flat configs, so extend them directly (no FlatCompat).
const eslintConfig = [
  { ignores: ['.next/**', 'node_modules/**'] },
  ...coreWebVitals,
  ...typescript,
];

export default eslintConfig;
