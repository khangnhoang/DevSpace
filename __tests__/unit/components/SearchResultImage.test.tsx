import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SearchResultImage } from "@/app/components/Header";

// The Header module imports the Supabase client and the router; neither is used by the image, so both are stubbed.
// next/image runs for real: the fallback depends on its onError reaching the component.
vi.mock("@/lib/supabase", () => ({ searchLesson: vi.fn(), supabase: {} }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const IMAGE_URL = "https://images.unsplash.com/e2e-course.png";

describe("Header search result image", () => {
  it("shows the course image while it loads", () => {
    render(<SearchResultImage src={IMAGE_URL} alt="JavaScript căn bản" />);

    expect(screen.getByAltText("JavaScript căn bản")).toBeInTheDocument();
  });

  it("replaces an image that fails to load with the fallback icon", () => {
    const { container } = render(
      <SearchResultImage src={IMAGE_URL} alt="JavaScript căn bản" />,
    );

    fireEvent.error(screen.getByAltText("JavaScript căn bản"));

    expect(screen.queryByAltText("JavaScript căn bản")).not.toBeInTheDocument();
    expect(container.querySelector("svg.lucide-file-text")).not.toBeNull();
  });
});
