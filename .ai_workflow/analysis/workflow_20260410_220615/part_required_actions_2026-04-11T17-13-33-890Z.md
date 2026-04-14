# Part Analysis: REQUIRED ACTIONS

**Run:** workflow_20260410_220615  
**Section:** REQUIRED ACTIONS  
**Generated:** 2026-04-11T17:13:33.906Z

---

## Alignment Score: 9/10

## Summary
This "REQUIRED ACTIONS" section provides advanced, actionable TypeScript and project configuration guidance. Its recommendations are technically sound and align with best practices for type safety, code quality, and maintainability. The advice is broadly applicable and matches the implied project structure, though the truncated CODEBASE CONTEXT does not show direct evidence of TypeScript usage or specific config files. No prompt flaws are present; the only limitation is the inability to verify every detail due to context truncation.

## Findings
- Prompt flaw: None. All recommendations are accurate and relevant for a TypeScript project.
- Context limitation: The CODEBASE CONTEXT is truncated and does not show TypeScript source files, `tsconfig.json`, or ESLint config. This prevents full verification of the project's current state or existing configuration.

## Suggestions
1. No prompt change needed — current wording is aligned.
2. If this section is reused across projects, clarify that some recommendations may not apply if the project is not using TypeScript or ESLint.

**SECTION LABEL**: REQUIRED ACTIONS

**SECTION CONTENT**:
1. **Type System Design**:
   - Replace `any` with `unknown` for values of unknown shape; narrow with type guards before use
   - Use `never` to exhaustively handle discriminated union branches
   - Define shared interfaces/types in dedicated `types/` or `*.d.ts` files for reuse
   - Apply generics to eliminate code duplication across similar structures
   - Use `as const` for literal type inference on configuration objects

2. **Advanced Type Usage**:
   - Apply utility types: `Partial<T>` for optional object shapes, `Required<T>` for mandatory versions, `Readonly<T>` for immutable data
   - Use `Pick<T, K>` and `Omit<T, K>` to derive focused types instead of repeating fields
   - Leverage `ReturnType<typeof fn>` and `Parameters<typeof fn>` to derive types from functions
   - Implement type guards: `function isUser(val: unknown): val is User { ... }` for runtime narrowing
   - Use discriminated unions (`type Shape = Circle | Square`) and exhaustive switch checks with `never`
   - Apply mapped types (`{ [K in keyof T]: ... }`) and conditional types (`T extends U ? X : Y`) for meta-programming

3. **tsconfig.json Configuration**:
   - Enable `"strict": true` to activate all strict type-checking flags
   - Set `"target"` and `"lib"` to match the runtime environment (e.g., `ES2022`, `DOM`)
   - Configure `"paths"` for import aliases (e.g., `@/` → `src/`) to avoid deep relative imports
   - Set `"moduleResolution": "bundler"` (Vite) or `"Node16"` (Node.js) for correct module resolution
   - Enable `"noUnusedLocals"` and `"noUnusedParameters"` to catch dead code
   - Configure `"outDir"` and `"rootDir"` for clean build output separation
   - Add `"skipLibCheck": true` only for third-party `.d.ts` files with known issues

4. **Linting & Quality**:
   - Install and configure `@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin`
   - Enable rules: `@typescript-eslint/no-explicit-any`, `@typescript-eslint/explicit-function-return-type`, `@typescript-eslint/no-fl