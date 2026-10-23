import { ACCOUNTS, authFile, type Actor } from "./accounts";
import { expect, test as setup } from "./fixtures";

const ACTORS: Actor[] = ["learner", "student", "admin"];

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

    await context.storageState({ path: authFile(actor) });
  });
}
