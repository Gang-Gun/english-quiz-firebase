import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

describe("App", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    window.location.hash = "";
    vi.spyOn(window, "alert").mockImplementation(() => undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: query.includes("max-width"),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined
      })
    });
  });

  it("opens the original single-input student login", () => {
    render(<App />);
    expect(screen.getByText("단어 학습")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("학번 입력")).toBeInTheDocument();
    expect(screen.queryByLabelText("이름")).not.toBeInTheDocument();
  });

  it("does not expose the admin access code on the student login screen", () => {
    render(<App />);
    expect(screen.queryByText(/1223/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "관리자" })).not.toBeInTheDocument();
  });

  it("logs in by student id and shows the original dashboard structure", async () => {
    render(<App />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    });
    expect(await screen.findByText("권도엽")).toBeInTheDocument();
    expect(screen.getByText("정답률")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "정규 시험 시작" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "오답 재시험" })).toBeInTheDocument();
  });

  it("opens admin only after a hidden prompt code is entered", async () => {
    vi.spyOn(window, "prompt").mockReturnValue("teacher-code");
    render(<App />);

    act(() => {
      window.location.hash = "#admin";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    await waitFor(() => expect(screen.getByText("학급 관리")).toBeInTheDocument());
    expect(sessionStorage.getItem("voca_admin_code")).toBe("teacher-code");
    expect(screen.getByText("학습왕(정규 점수)")).toBeInTheDocument();
  });

  it("refreshes admin data without leaving the admin page", async () => {
    vi.spyOn(window, "prompt").mockReturnValue("teacher-code");
    window.location.hash = "#admin";
    render(<App />);

    expect(await screen.findByText("학급 관리")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "새로고침" }));

    await waitFor(() => expect(screen.getByText("학습왕(정규 점수)")).toBeInTheDocument());
    expect(window.location.hash).toBe("#admin");
  });
});
