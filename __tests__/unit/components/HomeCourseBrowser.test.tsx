import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import HomeCourseBrowser from "@/app/(main)/_components/HomeCourseBrowser";
import type { HomeCourseData } from "@/lib/types";

// Only modules outside the component are replaced: the image (a raw <img> is a lint error) and the hero slider, whose
// own behaviour is not this file's subject; the stub shows which slides the browser hands it. The search box, the
// filter, the grid and the featured block run for real.
vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));
vi.mock("@/app/components/HeroSlider", () => ({
  default: ({ slides }: { slides: { name: string }[] }) => (
    <div data-testid="hero">{slides.map((slide) => slide.name).join("|")}</div>
  ),
}));

const course = (
  id: number,
  name: string,
  price: number,
  firstLessonSlug: string | null = "bai-1",
): HomeCourseData => ({
  id,
  name,
  slug: `khoa-${id}`,
  description: null as unknown as undefined,
  image_url: null as unknown as undefined,
  price,
  firstLessonSlug,
});

const COURSES = [
  course(1, "Làm quen với HTML", 0),
  course(2, "JavaScript căn bản", 199000),
  course(3, "Python nâng cao", 399000),
  course(4, "CSS cơ bản", 0, null),
];

// The cards of the grid: the level-2 headings except the title of the featured block.
const cardNames = () =>
  screen
    .getAllByRole("heading", { level: 2 })
    .map((card) => card.textContent)
    .filter((name) => name !== "Khóa học chuyên sâu");

describe("HomeCourseBrowser", () => {
  it("[AC7] shows every course in the grid with the count, and the first three in the hero", () => {
    render(<HomeCourseBrowser courses={COURSES} />);
    expect(cardNames()).toEqual([
      "Làm quen với HTML",
      "JavaScript căn bản",
      "Python nâng cao",
      "CSS cơ bản",
    ]);
    expect(screen.getByText("4 khóa học chất lượng")).toBeInTheDocument();
    expect(screen.getByTestId("hero")).toHaveTextContent(
      "Làm quen với HTML|JavaScript căn bản|Python nâng cao",
    );
    expect(screen.getByTestId("hero")).not.toHaveTextContent("CSS cơ bản");
  });

  it("[AC7] a visitor who types part of a name, in any case, sees only the matching courses and a new count", async () => {
    const user = userEvent.setup();
    render(<HomeCourseBrowser courses={COURSES} />);
    await user.type(screen.getByPlaceholderText("Tìm khóa học..."), "SCRIPT");
    expect(cardNames()).toEqual(["JavaScript căn bản"]);
    expect(screen.getByText("1 khóa học chất lượng")).toBeInTheDocument();
  });

  it("[AC7] clearing the search with its button brings every course back", async () => {
    const user = userEvent.setup();
    render(<HomeCourseBrowser courses={COURSES} />);
    const box = screen.getByPlaceholderText("Tìm khóa học...");
    await user.type(box, "python");
    expect(cardNames()).toEqual(["Python nâng cao"]);
    await user.click(
      within(box.parentElement as HTMLElement).getByRole("button"),
    );
    expect(box).toHaveValue("");
    expect(cardNames()).toHaveLength(4);
  });

  it("[AC7] the free filter keeps the courses priced at 0, the paid filter keeps the others, and all restores them", async () => {
    const user = userEvent.setup();
    render(<HomeCourseBrowser courses={COURSES} />);
    const filter = screen.getByRole("combobox");
    await user.selectOptions(filter, "free");
    expect(cardNames()).toEqual(["Làm quen với HTML", "CSS cơ bản"]);
    await user.selectOptions(filter, "pro");
    expect(cardNames()).toEqual(["JavaScript căn bản", "Python nâng cao"]);
    await user.selectOptions(filter, "all");
    expect(cardNames()).toHaveLength(4);
  });

  it("[AC7] the search and the filter apply together", async () => {
    const user = userEvent.setup();
    render(<HomeCourseBrowser courses={COURSES} />);
    await user.selectOptions(screen.getByRole("combobox"), "free");
    await user.type(screen.getByPlaceholderText("Tìm khóa học..."), "css");
    expect(cardNames()).toEqual(["CSS cơ bản"]);
  });

  it("[AC7] a search that matches nothing shows the empty text and a zero count", async () => {
    const user = userEvent.setup();
    render(<HomeCourseBrowser courses={COURSES} />);
    await user.type(screen.getByPlaceholderText("Tìm khóa học..."), "zzz");
    expect(screen.getByText("Không tìm thấy khóa học nào.")).toBeVisible();
    expect(screen.getByText("0 khóa học chất lượng")).toBeInTheDocument();
  });

  it("[AC9] an empty list shows the empty text, an empty hero and no featured block", () => {
    render(<HomeCourseBrowser courses={[]} />);
    expect(screen.getByText("Không tìm thấy khóa học nào.")).toBeVisible();
    expect(screen.getByTestId("hero")).toBeEmptyDOMElement();
    expect(screen.queryByText("Khóa học chuyên sâu")).not.toBeInTheDocument();
  });

  it("[AC7] the featured block shows the two most expensive courses, dearest first, whatever the list order", () => {
    render(<HomeCourseBrowser courses={COURSES} />);
    expect(screen.getByText("Khóa học chuyên sâu")).toBeInTheDocument();
    const featured = screen
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);
    expect(featured).toEqual(["Python nâng cao", "JavaScript căn bản"]);
  });

  it("[AC7] a course with no lesson says it is coming soon in the grid and in the featured block", () => {
    render(
      <HomeCourseBrowser
        courses={[course(1, "Khóa rỗng", 500000, null), course(2, "B", 0)]}
      />,
    );
    expect(screen.getByText("Sắp ra mắt")).toBeInTheDocument();
    expect(screen.getByText("Đang cập nhật nội dung...")).toBeInTheDocument();
  });
});
