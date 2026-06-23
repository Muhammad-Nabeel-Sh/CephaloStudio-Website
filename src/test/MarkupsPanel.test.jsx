import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarkupsPanel } from "../panels.jsx";

describe("MarkupsPanel", () => {
  const defaultProps = {
    t: {},
    selectedId: null,
    onSelect: () => {},
    onDelete: () => {},
    onToggleVisible: () => {},
    onToggleLock: () => {},
    onToggleLabel: () => {},
    calibration: { done: false, pxPerMm: 1 },
    formatAngle: (v) => v.toFixed(1) + "°",
    placingMode: false,
    placingQueue: [],
    placingIdx: -1,
    onStopPlacing: () => {},
    onPausePlacing: () => {},
    onResumePlacing: () => {},
    onClear: () => {},
    onAddPoint: () => {},
  };

  it("shows empty state when no markups", () => {
    render(<MarkupsPanel markups={[]} {...defaultProps} />);
    expect(screen.getByText(/No markups yet/)).toBeInTheDocument();
  });

  it("renders a list of markups", () => {
    const markups = [
      { id: "1", type: "point", label: "N", color: "#f59e0b", size: 6, points: [{ x: 100, y: 200 }], placed: true, visible: true },
    ];
    render(
      <MarkupsPanel markups={markups} {...defaultProps} />
    );
    expect(screen.getByText("N")).toBeInTheDocument();
  });

  it("sections are rendered for each markup type", () => {
    const markups = [
      { id: "1", type: "point", label: "S", color: "#f59e0b", size: 6, points: [{ x: 0, y: 0 }], placed: true, visible: true },
      { id: "2", type: "line", label: "SN", color: "#38bdf8", width: 1.5, points: [{ x: 0, y: 0 }, { x: 10, y: 10 }], visible: true, mode: "segment" },
    ];
    render(
      <MarkupsPanel markups={markups} {...defaultProps} calibration={{ done: true, pxPerMm: 2 }} />
    );
    expect(screen.getByText("Landmarks")).toBeInTheDocument();
    expect(screen.getByText("Lines & Planes")).toBeInTheDocument();
  });
});
