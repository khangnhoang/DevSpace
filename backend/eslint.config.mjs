// The backend has its own small config: the root one is eslint-config-next, which targets React and the Next compiler.
// `npm run lint:api` runs it from the repository root; the root `npm run lint` ignores backend/.
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["../dist/**", "../dist-e2e/**"] },
  ...tseslint.configs.recommended,
);
