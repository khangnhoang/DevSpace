import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Header from "@/app/components/Header";

// Only modules outside the component are replaced (the Supabase client, the router and the avatar image); the
// component's own handlers run for real.
const { signOut, push } = vi.hoisted(() => ({
  signOut: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  searchLesson: vi.fn(),
  supabase: {
    auth: {
      getSession: async () => ({
        data: {
          session: { user: { id: "u1", email: "student@devspace.test" } },
        },
      }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signOut,
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { role: "user", avatar_url: null },
            error: null,
          }),
        }),
      }),
    }),
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next/image", () => ({
  default: () => <span data-testid="avatar-image" />,
}));

beforeEach(() => {
  signOut.mockReset().mockResolvedValue({ error: null });
  push.mockReset();
});

describe("Header user menu", () => {
  it("closes the open menu when a signed-in user signs out", async () => {
    const user = userEvent.setup();
    render(<Header />);

    // The avatar button is the only button until the menu opens.
    await user.click(await screen.findByRole("button"));
    expect(screen.getByText("Hồ sơ cá nhân")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Đăng xuất" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Hồ sơ cá nhân")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Đăng xuất" }),
    ).not.toBeInTheDocument();
  });
});
