import { test } from "@playwright/test";

export const recoveryDiagnostics = test.extend({
  context: async ({ context }, provide) => {
    try {
      await provide(context);
    } finally {
      // Playwright can snapshot the first live page at context close even with
      // traces off. Close all tabs first, including after failure or timeout.
      await Promise.all(context.pages().map((page) => page.close()));
    }
  },
});
