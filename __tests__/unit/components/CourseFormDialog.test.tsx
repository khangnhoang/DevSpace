import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CourseFormDialog from "@/app/admin/courses/_components/CourseFormDialog";
import type { AdminCourseData } from "@/lib/types";

// Only modules outside the component are replaced (its data writes, the router, the toast and the image
// component); the schema, React Hook Form, the resolver and the component's own handlers run for real.
const { addCourse, updateCourse, refresh, toastError, toastSuccess } =
  vi.hoisted(() => ({
    addCourse: vi.fn(),
    updateCourse: vi.fn(),
    refresh: vi.fn(),
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
  }));

vi.mock("@/lib/supabase", () => ({ addCourse, updateCourse }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({
  toast: { error: toastError, success: toastSuccess },
}));
// Not an <img>: the @next/next/no-img-element rule would warn on it.
vi.mock("next/image", () => ({
  default: ({ src }: { src: string }) => (
    <span data-testid="course-image" data-src={src} />
  ),
}));

const NAME_ERROR = "Vui lòng nhập tên khóa học";
const SLUG_ERROR = "Vui lòng nhập slug";
const PRICE_ERROR = "Giá phải là số nguyên từ 0 trở lên";

const storedCourse: AdminCourseData = {
  id: 7,
  name: "Làm quen với HTML",
  slug: "lam-quen-html",
  description: "Mô tả có sẵn",
  image_url: "https://example.test/html.png",
  lessonCount: 3,
  price: 0,
  instructor_id: null,
};

const nameInput = () => screen.getByLabelText(/^Tên khóa học/);
const slugInput = () => screen.getByLabelText(/^Slug/);
const priceInput = () => screen.getByLabelText(/^Giá khóa học/);
const submitButton = (label: string) =>
  screen.getByRole("button", { name: label });

function renderAdd(onClose = vi.fn()) {
  render(<CourseFormDialog course={null} instructors={[]} onClose={onClose} />);
  return { onClose, user: userEvent.setup() };
}

function renderEdit(onClose = vi.fn()) {
  render(
    <CourseFormDialog
      course={storedCourse}
      instructors={[]}
      onClose={onClose}
    />,
  );
  return { onClose, user: userEvent.setup() };
}

beforeEach(() => {
  vi.clearAllMocks();
  addCourse.mockResolvedValue({ error: null, insertError: null });
  updateCourse.mockResolvedValue({ error: null });
});

describe("CourseFormDialog", () => {
  it("shows the name and slug errors, marks both inputs invalid and saves nothing when an admin submits a blank form", async () => {
    const { user } = renderAdd();

    await user.click(submitButton("Thêm mới"));

    expect(await screen.findByText(NAME_ERROR)).toBeInTheDocument();
    expect(screen.getByText(SLUG_ERROR)).toBeInTheDocument();
    expect(nameInput()).toHaveAttribute("aria-invalid", "true");
    expect(slugInput()).toHaveAttribute("aria-invalid", "true");
    expect(priceInput()).toHaveAttribute("aria-invalid", "false");
    expect(screen.queryByText(PRICE_ERROR)).not.toBeInTheDocument();
    expect(addCourse).not.toHaveBeenCalled();
    expect(updateCourse).not.toHaveBeenCalled();
  });

  it("treats a name of only spaces as blank and shows no error on a valid field", async () => {
    const { user } = renderAdd();

    await user.type(nameInput(), "   ");
    await user.type(slugInput(), "khoa-hoc");
    await user.click(submitButton("Thêm mới"));

    expect(await screen.findByText(NAME_ERROR)).toBeInTheDocument();
    expect(screen.queryByText(SLUG_ERROR)).not.toBeInTheDocument();
    expect(slugInput()).toHaveAttribute("aria-invalid", "false");
    expect(addCourse).not.toHaveBeenCalled();
  });

  it.each([
    ["a price that is not a whole number", "1.5"],
    ["a negative price", "-5"],
  ])(
    "shows the price error and saves nothing for %s",
    async (_label, price) => {
      const { user } = renderAdd();

      await user.type(nameInput(), "Khóa học");
      await user.type(slugInput(), "khoa-hoc");
      await user.type(priceInput(), price);
      await user.click(submitButton("Thêm mới"));

      expect(await screen.findByText(PRICE_ERROR)).toBeInTheDocument();
      expect(priceInput()).toHaveAttribute("aria-invalid", "true");
      expect(addCourse).not.toHaveBeenCalled();
    },
  );

  it("clears a field's error and its aria-invalid when the admin types a valid value into it", async () => {
    const { user } = renderAdd();

    await user.click(submitButton("Thêm mới"));
    expect(await screen.findByText(SLUG_ERROR)).toBeInTheDocument();

    await user.type(slugInput(), "khoa-hoc");

    await waitFor(() =>
      expect(screen.queryByText(SLUG_ERROR)).not.toBeInTheDocument(),
    );
    expect(slugInput()).toHaveAttribute("aria-invalid", "false");
    expect(screen.getByText(NAME_ERROR)).toBeInTheDocument();
  });

  it("clears the price error when the admin empties the price after it was refused", async () => {
    const { user } = renderAdd();

    await user.type(nameInput(), "Khóa học");
    await user.type(slugInput(), "khoa-hoc");
    await user.type(priceInput(), "-5");
    await user.click(submitButton("Thêm mới"));
    expect(await screen.findByText(PRICE_ERROR)).toBeInTheDocument();

    await user.clear(priceInput());

    await waitFor(() =>
      expect(screen.queryByText(PRICE_ERROR)).not.toBeInTheDocument(),
    );
    expect(priceInput()).toHaveAttribute("aria-invalid", "false");
    expect(addCourse).not.toHaveBeenCalled();
  });

  it("saves a valid new course once with the schema output, then toasts, closes and refreshes", async () => {
    const { user, onClose } = renderAdd();

    await user.type(nameInput(), "  Khóa học mới  ");
    await user.type(slugInput(), " khoa-hoc-moi ");
    await user.click(submitButton("Thêm mới"));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(addCourse).toHaveBeenCalledTimes(1);
    expect(addCourse).toHaveBeenCalledWith(
      {
        name: "Khóa học mới",
        slug: "khoa-hoc-moi",
        description: null,
        price: 0,
        instructor_id: null,
        image_url: "",
      },
      null,
    );
    expect(toastSuccess).toHaveBeenCalledWith("Thêm khóa học thành công");
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(updateCourse).not.toHaveBeenCalled();
  });

  it("shows the stored values of a course priced 0 and saves it back unchanged with its id and image", async () => {
    const { user, onClose } = renderEdit();

    expect(nameInput()).toHaveValue(storedCourse.name);
    expect(slugInput()).toHaveValue(storedCourse.slug);
    expect(priceInput()).toHaveValue(0);
    expect(screen.getByLabelText(/^Mô tả ngắn/)).toHaveValue(
      storedCourse.description,
    );
    expect(screen.getByTestId("course-image")).toHaveAttribute(
      "data-src",
      storedCourse.image_url,
    );

    await user.click(submitButton("Lưu thay đổi"));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(updateCourse).toHaveBeenCalledTimes(1);
    expect(updateCourse).toHaveBeenCalledWith(
      storedCourse.id,
      expect.objectContaining({
        name: storedCourse.name,
        slug: storedCourse.slug,
        price: 0,
        image_url: storedCourse.image_url,
      }),
      null,
    );
    expect(toastSuccess).toHaveBeenCalledWith("Cập nhật thành công");
    expect(addCourse).not.toHaveBeenCalled();
  });

  it.each([
    [
      "returns an error",
      () => addCourse.mockResolvedValueOnce({ error: { message: "boom" } }),
      "Lỗi cập nhật: boom",
    ],
    [
      "returns an insert error",
      () =>
        addCourse.mockResolvedValueOnce({ insertError: { message: "dup" } }),
      "Lỗi cập nhật: dup",
    ],
    [
      "throws",
      () => addCourse.mockRejectedValueOnce(new Error("network down")),
      "Lỗi cập nhật: network down",
    ],
  ])(
    "keeps the dialog open with what was typed and lets the admin retry when the save %s",
    async (_label, failOnce, message) => {
      failOnce();
      const { user, onClose } = renderAdd();

      await user.type(nameInput(), "Khóa học");
      await user.type(slugInput(), "khoa-hoc");
      await user.click(submitButton("Thêm mới"));

      await waitFor(() => expect(toastError).toHaveBeenCalledWith(message));
      expect(onClose).not.toHaveBeenCalled();
      expect(toastSuccess).not.toHaveBeenCalled();
      expect(nameInput()).toHaveValue("Khóa học");
      expect(slugInput()).toHaveValue("khoa-hoc");
      await waitFor(() => expect(submitButton("Thêm mới")).toBeEnabled());

      await user.click(submitButton("Thêm mới"));

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(addCourse).toHaveBeenCalledTimes(2);
    },
  );

  it("calls the save once and disables the submit button while a repeated submit event arrives during a pending save", async () => {
    let finish!: (result: { error: null }) => void;
    addCourse.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { user, onClose } = renderAdd();
    await user.type(nameInput(), "Khóa học");
    await user.type(slugInput(), "khoa-hoc");

    const form = nameInput().closest("form")!;
    await act(async () => {
      form.requestSubmit();
      form.requestSubmit();
    });

    await waitFor(() => expect(addCourse).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(submitButton("Thêm mới")).toBeDisabled());
    await act(async () => {
      form.requestSubmit();
    });
    expect(addCourse).toHaveBeenCalledTimes(1);

    await act(async () => {
      finish({ error: null });
    });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(addCourse).toHaveBeenCalledTimes(1);
  });
});
