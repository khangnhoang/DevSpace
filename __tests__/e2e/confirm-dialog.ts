import type { Page } from "@playwright/test";
import { expect } from "./fixtures";

// The confirm dialog of the destructive actions (app/components/ConfirmDialog.tsx).
export const confirmDialogOf = (page: Page) => page.getByRole("alertdialog");

// Every request that could change data, recorded from the moment this is called. Supabase Auth token refreshes are
// not data writes and are left out.
export function recordMutations(page: Page): string[] {
  const seen: string[] = [];
  page.on("request", (request) => {
    if (["GET", "HEAD", "OPTIONS"].includes(request.method()) || request.url().includes("/auth/v1/")) return;
    seen.push(`${request.method()} ${request.url()}`);
  });
  return seen;
}

// Escape and the cancel button each close the dialog, nothing is sent and the object is still there.
export async function expectDismissKeepsObject(
  page: Page,
  open: () => Promise<void>,
  cancelName: string,
  stillThere: () => Promise<void>,
  mutations: string[],
): Promise<void> {
  const dialog = confirmDialogOf(page);
  for (const dismiss of ["escape", "cancel"] as const) {
    await open();
    await expect(dialog).toBeVisible();
    if (dismiss === "escape") await page.keyboard.press("Escape");
    else await dialog.getByRole("button", { name: cancelName, exact: true }).click();
    await expect(dialog).toBeHidden();
    await stillThere();
    expect(mutations, `nothing was sent after ${dismiss}`).toEqual([]);
  }
}

// M7: focus enters the dialog, Tab stays inside it, Escape returns focus to the control that opened it.
export async function expectKeyboardFlow(page: Page, trigger: ReturnType<Page["locator"]>): Promise<void> {
  const dialog = confirmDialogOf(page);
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();
  const insideDialog = () => dialog.evaluate((el) => el.contains(document.activeElement));
  expect(await insideDialog(), "focus is inside the dialog on open").toBe(true);
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    expect(await insideDialog(), `focus stays inside after Tab ${i + 1}`).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
}

// M8: the dialog fits a 375px viewport with a margin, the page does not scroll sideways and the buttons stack.
export async function expectFitsPhone(page: Page): Promise<void> {
  const dialog = confirmDialogOf(page);
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box && box.x >= 8 && box.x + box.width <= 375 - 8, "the dialog sits inside the viewport with a margin").toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const [first, second] = await Promise.all((await dialog.getByRole("button").all()).map((button) => button.boundingBox()));
  expect(first && second && Math.abs(first.y - second.y) > 10, "the buttons are stacked").toBe(true);
}

// The point at the centre of the dialog belongs to the dialog, so no fixed layer of the page covers it.
export async function expectOnTop(page: Page): Promise<void> {
  const onTop = await confirmDialogOf(page).evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return el.contains(hit);
  });
  expect(onTop, "the dialog is the topmost element at its centre").toBe(true);
}

export const backgroundOf = (page: Page) => confirmDialogOf(page).evaluate((el) => getComputedStyle(el).backgroundColor);
