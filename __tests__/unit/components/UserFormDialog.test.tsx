import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UserFormDialog from "@/app/admin/users/_components/UserFormDialog";
import type { UserProfile } from "@/lib/types";

// Only modules outside the component are replaced (its data writes, the server action and the toast); the schema,
// React Hook Form, the resolver and the component's own handlers run for real.
const { createNewUser, editUser, uploadUserAvatar, toastError, toastSuccess } =
  vi.hoisted(() => ({
    createNewUser: vi.fn(),
    editUser: vi.fn(),
    uploadUserAvatar: vi.fn(),
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
  }));

vi.mock("@/lib/supabase", () => ({ editUser, uploadUserAvatar }));
vi.mock("@/app/action/user", () => ({ createNewUser }));
vi.mock("sonner", () => ({
  toast: { error: toastError, success: toastSuccess },
}));

const EMAIL_ERROR = "Email không hợp lệ";
const PASSWORD_ERROR = "Mật khẩu phải có ít nhất 8 ký tự";
const ROLE_ERROR = "Vai trò không hợp lệ";
const SAVE_FAILED = "Lưu người dùng thất bại. Vui lòng thử lại.";
const UPLOADED_URL = "https://example.test/storage/avatars/avatar_1_a.png";

const storedUser: UserProfile = {
  id: "7c1f2f0e-0000-4000-8000-000000000001",
  email: "stored@devspace.test",
  full_name: "Người Có Sẵn",
  avatar_url: "https://example.test/stored.png",
  role: "user",
  created_at: "2026-01-01T00:00:00Z",
};

const emailInput = () => screen.getByLabelText("EMAIL");
const passwordInput = () => screen.getByLabelText("MẬT KHẨU");
const nameInput = () => screen.getByLabelText("HỌ VÀ TÊN");
const roleSelect = () => screen.getByLabelText("VAI TRÒ");
const fileInput = () => screen.getByLabelText("Ảnh đại diện");
const button = (name: string) => screen.getByRole("button", { name });
const avatarFile = () =>
  new File(["x"], "my avatar.png", { type: "image/png" });

function renderCreate() {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(<UserFormDialog user={null} onClose={onClose} onSaved={onSaved} />);
  return { onClose, onSaved, user: userEvent.setup() };
}

function renderEdit(stored: UserProfile = storedUser) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(<UserFormDialog user={stored} onClose={onClose} onSaved={onSaved} />);
  return { onClose, onSaved, user: userEvent.setup() };
}

type Typist = ReturnType<typeof userEvent.setup>;

async function fillCreate(user: Typist) {
  await user.type(emailInput(), "new.user@devspace.test");
  await user.type(passwordInput(), "12345678");
}

beforeEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => "blob:preview");
  createNewUser.mockResolvedValue({ success: true, userId: "u1" });
  editUser.mockResolvedValue({ error: null });
  uploadUserAvatar.mockResolvedValue(UPLOADED_URL);
});

describe("UserFormDialog (create)", () => {
  it("opens with the role user, the look's placeholders and a button named Đóng", () => {
    renderCreate();

    expect(roleSelect()).toHaveValue("user");
    expect(emailInput()).toHaveAttribute("placeholder", "helo@gmail.com");
    expect(passwordInput()).toHaveAttribute("placeholder", "Tối thiểu 8 ký tự");
    expect(nameInput()).toHaveAttribute("placeholder", "Nguyen Van A");
    expect(button("Đóng")).toBeEnabled();
    expect(button("Hủy Bỏ")).toBeEnabled();
    expect(button("Thêm Tài Khoản")).toBeEnabled();
  });

  it.each([
    ["a blank email", "", "12345678", "user", EMAIL_ERROR, () => emailInput()],
    [
      "a malformed email",
      "a@@devspace.test",
      "12345678",
      "user",
      EMAIL_ERROR,
      () => emailInput(),
    ],
    [
      "a password of 7 characters",
      "new.user@devspace.test",
      "1234567",
      "user",
      PASSWORD_ERROR,
      () => passwordInput(),
    ],
    [
      "no role",
      "new.user@devspace.test",
      "12345678",
      "",
      ROLE_ERROR,
      () => roleSelect(),
    ],
  ])(
    "shows the error under the control, marks it invalid and uploads and creates nothing for %s",
    async (_label, email, password, role, message, control) => {
      const { user } = renderCreate();

      if (email) await user.type(emailInput(), email);
      if (password) await user.type(passwordInput(), password);
      await user.selectOptions(roleSelect(), role);
      await user.upload(fileInput(), avatarFile());
      await user.click(button("Thêm Tài Khoản"));

      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(control()).toHaveAttribute("aria-invalid", "true");
      expect(uploadUserAvatar).not.toHaveBeenCalled();
      expect(createNewUser).not.toHaveBeenCalled();
    },
  );

  it("marks only the wrong fields invalid and clears an error once the field is fixed", async () => {
    const { user } = renderCreate();

    await user.click(button("Thêm Tài Khoản"));
    expect(await screen.findByText(EMAIL_ERROR)).toBeInTheDocument();
    expect(screen.getByText(PASSWORD_ERROR)).toBeInTheDocument();
    expect(nameInput()).toHaveAttribute("aria-invalid", "false");
    expect(roleSelect()).toHaveAttribute("aria-invalid", "false");

    await user.type(emailInput(), "new.user@devspace.test");

    await waitFor(() =>
      expect(screen.queryByText(EMAIL_ERROR)).not.toBeInTheDocument(),
    );
    expect(emailInput()).toHaveAttribute("aria-invalid", "false");
    expect(screen.getByText(PASSWORD_ERROR)).toBeInTheDocument();
  });

  it("creates the user with the action's input shape, an empty name and avatar, then toasts, refreshes and closes", async () => {
    const { user, onClose, onSaved } = renderCreate();

    await user.type(emailInput(), "  new.user@devspace.test ");
    await user.type(passwordInput(), "12345678");
    await user.click(button("Thêm Tài Khoản"));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(createNewUser).toHaveBeenCalledTimes(1);
    expect(createNewUser).toHaveBeenCalledWith({
      email: "new.user@devspace.test",
      fullName: "",
      role: "user",
      avatarUrl: "",
      password: "12345678",
    });
    expect(uploadUserAvatar).not.toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith("Thêm thành công");
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(editUser).not.toHaveBeenCalled();
  });

  it("uploads the chosen file first and sends its URL with the trimmed name and the role admin", async () => {
    const { user, onClose } = renderCreate();

    await fillCreate(user);
    await user.type(nameInput(), "  Nguyễn Văn A ");
    await user.selectOptions(roleSelect(), "admin");
    await user.upload(fileInput(), avatarFile());
    await user.click(button("Thêm Tài Khoản"));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(uploadUserAvatar).toHaveBeenCalledTimes(1);
    expect(createNewUser).toHaveBeenCalledWith({
      email: "new.user@devspace.test",
      fullName: "Nguyễn Văn A",
      role: "admin",
      avatarUrl: UPLOADED_URL,
      password: "12345678",
    });
  });

  it("submits when the admin presses Enter in a field", async () => {
    const { user, onClose } = renderCreate();

    await user.type(emailInput(), "new.user@devspace.test");
    await user.type(passwordInput(), "12345678{Enter}");

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(createNewUser).toHaveBeenCalledTimes(1);
  });

  it("toasts the action's message, keeps the dialog open with what was typed and lets the admin retry", async () => {
    createNewUser.mockResolvedValueOnce({
      error: "Email này đã được sử dụng.",
    });
    const { user, onClose } = renderCreate();

    await fillCreate(user);
    await user.type(nameInput(), "Tên đã gõ");
    await user.click(button("Thêm Tài Khoản"));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Lưu người dùng thất bại: Email này đã được sử dụng.",
      ),
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(emailInput()).toHaveValue("new.user@devspace.test");
    expect(nameInput()).toHaveValue("Tên đã gõ");
    await waitFor(() => expect(button("Thêm Tài Khoản")).toBeEnabled());

    await user.click(button("Thêm Tài Khoản"));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(createNewUser).toHaveBeenCalledTimes(2);
  });

  it("toasts, keeps the dialog open and calls no save when the avatar upload fails", async () => {
    uploadUserAvatar.mockResolvedValueOnce(null);
    const { user, onClose } = renderCreate();

    await fillCreate(user);
    await user.upload(fileInput(), avatarFile());
    await user.click(button("Thêm Tài Khoản"));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Lỗi khi upload avatar user"),
    );
    expect(createNewUser).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    await waitFor(() => expect(button("Thêm Tài Khoản")).toBeEnabled());
  });

  it.each([
    [
      "the action request throws",
      () => createNewUser.mockRejectedValueOnce(new Error("network down")),
    ],
    [
      "the avatar upload throws",
      () => uploadUserAvatar.mockRejectedValueOnce(new Error("network down")),
    ],
  ])(
    "toasts a generic failure, keeps the dialog open and lets the admin retry when %s",
    async (_label, failOnce) => {
      failOnce();
      const { user, onClose } = renderCreate();

      await fillCreate(user);
      await user.upload(fileInput(), avatarFile());
      await user.click(button("Thêm Tài Khoản"));

      await waitFor(() => expect(toastError).toHaveBeenCalledWith(SAVE_FAILED));
      expect(onClose).not.toHaveBeenCalled();
      expect(emailInput()).toHaveValue("new.user@devspace.test");
      await waitFor(() => expect(button("Thêm Tài Khoản")).toBeEnabled());
    },
  );

  it("sends one create call for a repeated submit and locks every close path while the save is pending", async () => {
    let finish!: (result: { success: true }) => void;
    createNewUser.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { user, onClose } = renderCreate();
    await fillCreate(user);

    const form = emailInput().closest("form")!;
    await act(async () => {
      form.requestSubmit();
      form.requestSubmit();
    });

    await waitFor(() => expect(createNewUser).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(button("Đang xử lý...")).toBeDisabled());
    expect(button("Đóng")).toBeDisabled();
    expect(button("Hủy Bỏ")).toBeDisabled();
    await act(async () => {
      form.requestSubmit();
    });
    await user.keyboard("{Escape}");
    expect(createNewUser).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      finish({ success: true });
    });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(createNewUser).toHaveBeenCalledTimes(1);
  });

  it("uploads the file once for a repeated submit", async () => {
    let finish!: (url: string) => void;
    uploadUserAvatar.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { user, onClose } = renderCreate();
    await fillCreate(user);
    await user.upload(fileInput(), avatarFile());

    const form = emailInput().closest("form")!;
    await act(async () => {
      form.requestSubmit();
      form.requestSubmit();
    });
    await waitFor(() => expect(uploadUserAvatar).toHaveBeenCalledTimes(1));

    await act(async () => {
      finish(UPLOADED_URL);
    });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(uploadUserAvatar).toHaveBeenCalledTimes(1);
    expect(createNewUser).toHaveBeenCalledTimes(1);
  });
});

describe("UserFormDialog (edit)", () => {
  it("shows the stored values, a disabled email and no password field", () => {
    renderEdit();

    expect(emailInput()).toHaveValue(storedUser.email);
    expect(emailInput()).toBeDisabled();
    expect(screen.queryByLabelText("MẬT KHẨU")).not.toBeInTheDocument();
    expect(nameInput()).toHaveValue(storedUser.full_name);
    expect(roleSelect()).toHaveValue("user");
    expect(button("Lưu Thay Đổi")).toBeEnabled();
  });

  it("saves a changed name and role without the email, keeping the stored avatar when no file is chosen", async () => {
    const { user, onClose, onSaved } = renderEdit();

    await user.clear(nameInput());
    await user.type(nameInput(), "  Tên Mới ");
    await user.selectOptions(roleSelect(), "admin");
    await user.click(button("Lưu Thay Đổi"));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(editUser).toHaveBeenCalledTimes(1);
    expect(editUser).toHaveBeenCalledWith(
      storedUser.id,
      {
        full_name: "Tên Mới",
        avatar_url: storedUser.avatar_url,
        role: "admin",
      },
      null,
    );
    expect(uploadUserAvatar).not.toHaveBeenCalled();
    expect(createNewUser).not.toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith("Sửa thành công");
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("stores a blank name and a blank avatar as null", async () => {
    const { user, onClose } = renderEdit({
      ...storedUser,
      avatar_url: "",
    });

    await user.clear(nameInput());
    await user.click(button("Lưu Thay Đổi"));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(editUser).toHaveBeenCalledWith(
      storedUser.id,
      { full_name: null, avatar_url: null, role: "user" },
      null,
    );
  });

  it("opens a user with no name and no avatar and saves them back as null", async () => {
    const { user, onClose } = renderEdit({
      ...storedUser,
      full_name: null,
      avatar_url: null,
    });

    expect(nameInput()).toHaveValue("");
    await user.click(button("Lưu Thay Đổi"));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(editUser).toHaveBeenCalledWith(
      storedUser.id,
      { full_name: null, avatar_url: null, role: "user" },
      null,
    );
  });

  it("saves the uploaded URL when the admin chooses a file", async () => {
    const { user, onClose } = renderEdit();

    await user.upload(fileInput(), avatarFile());
    await user.click(button("Lưu Thay Đổi"));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(uploadUserAvatar).toHaveBeenCalledTimes(1);
    expect(editUser).toHaveBeenCalledWith(
      storedUser.id,
      expect.objectContaining({ avatar_url: UPLOADED_URL }),
      null,
    );
  });

  it("opens a stored role outside user and admin as the placeholder and refuses to save until the admin picks one", async () => {
    const { user, onClose } = renderEdit({
      ...storedUser,
      role: "Chọn vai trò",
    });

    expect(roleSelect()).toHaveValue("");
    await user.click(button("Lưu Thay Đổi"));

    expect(await screen.findByText(ROLE_ERROR)).toBeInTheDocument();
    expect(roleSelect()).toHaveAttribute("aria-invalid", "true");
    expect(editUser).not.toHaveBeenCalled();
    expect(uploadUserAvatar).not.toHaveBeenCalled();

    await user.selectOptions(roleSelect(), "user");
    await waitFor(() =>
      expect(screen.queryByText(ROLE_ERROR)).not.toBeInTheDocument(),
    );
    await user.click(button("Lưu Thay Đổi"));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(editUser).toHaveBeenCalledWith(
      storedUser.id,
      expect.objectContaining({ role: "user" }),
      null,
    );
  });

  it("offers only the placeholder, user and admin as roles", () => {
    renderEdit();

    const options = Array.from((roleSelect() as HTMLSelectElement).options).map(
      (o) => [o.value, o.textContent],
    );
    expect(options).toEqual([
      ["", "Chọn vai trò"],
      ["user", "user"],
      ["admin", "admin"],
    ]);
  });

  it.each([
    [
      "the write returns an error object",
      () =>
        editUser.mockResolvedValueOnce({
          error: { message: "boom", code: "42501" },
        }),
    ],
    [
      "the write throws",
      () => editUser.mockRejectedValueOnce(new Error("network down")),
    ],
  ])(
    "toasts a readable failure, keeps the dialog open with what was typed and lets the admin retry when %s",
    async (_label, failOnce) => {
      failOnce();
      const { user, onClose } = renderEdit();

      await user.clear(nameInput());
      await user.type(nameInput(), "Tên đã gõ");
      await user.click(button("Lưu Thay Đổi"));

      await waitFor(() => expect(toastError).toHaveBeenCalledWith(SAVE_FAILED));
      expect(toastError).not.toHaveBeenCalledWith(
        expect.stringContaining("[object Object]"),
      );
      expect(onClose).not.toHaveBeenCalled();
      expect(toastSuccess).not.toHaveBeenCalled();
      expect(nameInput()).toHaveValue("Tên đã gõ");
      await waitFor(() => expect(button("Lưu Thay Đổi")).toBeEnabled());

      await user.click(button("Lưu Thay Đổi"));

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(editUser).toHaveBeenCalledTimes(2);
    },
  );

  it("toasts, keeps the dialog open and writes nothing when the avatar upload fails", async () => {
    uploadUserAvatar.mockResolvedValueOnce(null);
    const { user, onClose } = renderEdit();

    await user.upload(fileInput(), avatarFile());
    await user.click(button("Lưu Thay Đổi"));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Lỗi khi upload avatar user"),
    );
    expect(editUser).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    await waitFor(() => expect(button("Lưu Thay Đổi")).toBeEnabled());
  });

  it("writes once for a repeated submit and locks the close paths while the write is pending", async () => {
    let finish!: (result: { error: null }) => void;
    editUser.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { user, onClose } = renderEdit();

    const form = nameInput().closest("form")!;
    await act(async () => {
      form.requestSubmit();
      form.requestSubmit();
    });
    await waitFor(() => expect(editUser).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(button("Đang xử lý...")).toBeDisabled());
    expect(button("Đóng")).toBeDisabled();
    expect(button("Hủy Bỏ")).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      finish({ error: null });
    });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(editUser).toHaveBeenCalledTimes(1);
  });
});
