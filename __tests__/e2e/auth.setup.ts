import { ACCOUNTS, IDS, authFile, type Actor } from "./accounts";
import { expect, test as setup } from "./fixtures";
import { createServerClient } from "@supabase/ssr";
import { readLocalStack } from "../helpers/local-stack";
import { join } from "node:path";

const ACTORS: Actor[] = ["learner", "student", "admin"];
const stack = readLocalStack(join(__dirname, "../.."));

// Each seed user signs in through the login form once per run and the session is saved for the specs.
for (const actor of ACTORS) {
  setup(`[L1] signs in ${actor} through the login form`, async ({ page, context }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Email...").fill(ACCOUNTS[actor].email);
    await page.getByPlaceholder("Mật khẩu...").fill(ACCOUNTS[actor].password);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();

    // The login page pushes "/" one second after it shows the success message.
    await expect(page).toHaveURL(/\/$/);
    const cookies = await context.cookies();
    expect(cookies.some((cookie) => /^sb-.*-auth-token/.test(cookie.name))).toBe(true);

    // Ownership selectors use stable seed IDs. A valid session for a different ID must stop setup before
    // actions can create resources outside those selectors. Verify the fresh session without persisting it.
    const client = createServerClient(stack.apiUrl, stack.anonKey, { cookies: { getAll: () => context.cookies(), setAll: () => {} } });
    const { data, error } = await client.auth.getUser();
    expect(error).toBeNull();
    expect(data.user?.id).toBe(IDS[actor]);
    expect(data.user?.email).toBe(ACCOUNTS[actor].email);

    await context.storageState({ path: authFile(actor) });
  });
}
