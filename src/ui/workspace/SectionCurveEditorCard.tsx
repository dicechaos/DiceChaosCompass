import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  computeDefaultWallEdgeBulge,
  convertLegacyWallCurveToSegments,
  getWallSegmentArcInfo,
  getWallSegmentCount,
  hasWallSegmentCurves,
} from "@/engine/geometry";
import { useDocumentStore, type SelectionRef } from "@/store/documentStore";
import type { Point2D } from "@/types/map";

export interface SectionCurveEditorCardProps {
  selection: SelectionRef;
  points: Point2D[];
  closed: boolean;
  curved: boolean;
  segmentCurves?: Array<number | null>;
  sectionNoun?: string;
  wholeNoun?: string;
  showWholeToggle?: boolean;
  onWholeStraight?: () => void;
  onWholeSmooth?: () => void;
}

/**
 * Shared Per-Section Straight <-> Curved Editor Card used across Walls,
 * Lines/Paths, Roofs, Water Rivers/Lakes, World Rivers, World Trails & Realms.
 */
export const SectionCurveEditorCard: React.FC<SectionCurveEditorCardProps> = ({
  selection,
  points,
  closed,
  curved,
  segmentCurves,
  sectionNoun = "Section",
  wholeNoun = "Whole Shape",
  showWholeToggle = true,
  onWholeStraight,
  onWholeSmooth,
}) => {
  const selectedSegIndex = useDocumentStore((s) => s.selectedWallSegmentIndex);
  const st = useDocumentStore.getState();

  const segCount = getWallSegmentCount(points, closed);
  if (segCount <= 0) return null;

  const shape = { points, closed, curved, segmentCurves };
  const effectiveCurves = convertLegacyWallCurveToSegments(shape);
  const curvedSegCount = effectiveCurves.filter(
    (v) => typeof v === "number" && Math.abs(v) >= 0.04,
  ).length;
  const hasMixedCurves = hasWallSegmentCurves(shape);
  const focusedSegIdx =
    selectedSegIndex !== null && selectedSegIndex >= 0 && selectedSegIndex < segCount
      ? selectedSegIndex
      : 0;
  const segA = points[focusedSegIdx];
  const segB = points[(focusedSegIdx + 1) % points.length];
  const segSagitta = effectiveCurves[focusedSegIdx] ?? 0;
  const segInfo = getWallSegmentArcInfo(segA, segB, segSagitta);
  const maxSegBow = Math.max(0.5, Math.round(segInfo.chord * 1.1 * 20) / 20);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        style={{
          padding: "7px 8px",
          borderRadius: 6,
          background: "rgba(34, 211, 238, 0.06)",
          border: "1px solid rgba(34, 211, 238, 0.3)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 6,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: "#67E8F9",
            }}
          >
            {sectionNoun} {focusedSegIdx + 1} of {segCount}
            {segInfo.curved ? ` · ${segInfo.sweepDeg}° Arc` : " · Straight"}
          </span>
          {segCount > 1 && (
            <div style={{ display: "inline-flex", gap: 3 }}>
              <button
                type="button"
                className="dc-mini-icon-btn"
                title={`Previous ${sectionNoun.toLowerCase()}`}
                aria-label={`Previous ${sectionNoun.toLowerCase()}`}
                onClick={() =>
                  st.setSelectedWallSegmentIndex((focusedSegIdx - 1 + segCount) % segCount)
                }
              >
                <ChevronLeft size={12} />
              </button>
              <button
                type="button"
                className="dc-mini-icon-btn"
                title={`Next ${sectionNoun.toLowerCase()}`}
                aria-label={`Next ${sectionNoun.toLowerCase()}`}
                onClick={() => st.setSelectedWallSegmentIndex((focusedSegIdx + 1) % segCount)}
              >
                <ChevronRight size={12} />
              </button>
            </div>
          )}
        </div>

        <div className="dc-field-row" style={{ marginBottom: segInfo.curved ? 6 : 0 }}>
          <span className="dc-field-label">{sectionNoun} Style (C)</span>
          <div style={{ display: "inline-flex", gap: 4 }}>
            <button
              type="button"
              className={`dc-chip ${!segInfo.curved ? "active" : ""}`}
              onClick={() => {
                st.setSelectedWallSegmentIndex(focusedSegIdx);
                st.setEntitySegmentCurve(selection, focusedSegIdx, null, true);
              }}
            >
              Straight
            </button>
            <button
              type="button"
              className={`dc-chip ${segInfo.curved ? "active" : ""}`}
              onClick={() => {
                st.setSelectedWallSegmentIndex(focusedSegIdx);
                if (!segInfo.curved) {
                  const bulge = computeDefaultWallEdgeBulge(shape, focusedSegIdx, "90");
                  st.setEntitySegmentCurve(selection, focusedSegIdx, bulge, true);
                }
              }}
            >
              Curved
            </button>
          </div>
        </div>

        {segInfo.curved && (
          <>
            <div className="dc-field-row" style={{ marginBottom: 5 }}>
              <span className="dc-field-label">
                Bow ({segInfo.sagitta >= 0 ? "+" : ""}
                {segInfo.sagitta.toFixed(2)} sq)
              </span>
              <input
                type="range"
                className="dc-range"
                style={{ width: 112 }}
                min={-maxSegBow}
                max={maxSegBow}
                step={0.05}
                aria-label={`${sectionNoun} Curve Bow`}
                value={segInfo.sagitta}
                onChange={(e) => {
                  st.setSelectedWallSegmentIndex(focusedSegIdx);
                  st.setEntitySegmentCurve(selection, focusedSegIdx, Number(e.target.value), false);
                }}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 3 }}>
              <button
                type="button"
                className="dc-chip"
                style={{ justifyContent: "center", height: 21, fontSize: 10, padding: 0 }}
                title={`Flatten just this ${sectionNoun.toLowerCase()} straight`}
                onClick={() => {
                  st.setSelectedWallSegmentIndex(focusedSegIdx);
                  st.setEntitySegmentCurve(selection, focusedSegIdx, null, true);
                }}
              >
                Flat
              </button>
              <button
                type="button"
                className="dc-chip"
                style={{ justifyContent: "center", height: 21, fontSize: 10, padding: 0 }}
                title="Snap to crisp 90° quarter-arch"
                onClick={() => {
                  st.setSelectedWallSegmentIndex(focusedSegIdx);
                  const sign = segInfo.sagitta >= 0 ? 1 : -1;
                  st.setEntitySegmentCurve(
                    selection,
                    focusedSegIdx,
                    sign * segInfo.chord * 0.20710678,
                    true,
                  );
                }}
              >
                90°
              </button>
              <button
                type="button"
                className="dc-chip"
                style={{ justifyContent: "center", height: 21, fontSize: 10, padding: 0 }}
                title="Snap to exact 180° semicircle"
                onClick={() => {
                  st.setSelectedWallSegmentIndex(focusedSegIdx);
                  const sign = segInfo.sagitta >= 0 ? 1 : -1;
                  st.setEntitySegmentCurve(selection, focusedSegIdx, sign * segInfo.chord * 0.5, true);
                }}
              >
                180°
              </button>
              <button
                type="button"
                className="dc-chip"
                style={{ justifyContent: "center", height: 21, fontSize: 10, padding: 0 }}
                title="Flip curve inward ↔ outward"
                onClick={() => {
                  st.setSelectedWallSegmentIndex(focusedSegIdx);
                  st.flipEntitySegmentCurve(selection, focusedSegIdx);
                }}
              >
                Flip
              </button>
            </div>
          </>
        )}
      </div>

      {showWholeToggle && (
        <div className="dc-field-row" style={{ marginBottom: 0 }}>
          <span className="dc-field-label">
            {wholeNoun}
            {hasMixedCurves && (
              <span style={{ color: "#67E8F9", marginLeft: 4, fontSize: 9.5 }}>
                ({curvedSegCount} curved)
              </span>
            )}
          </span>
          <div style={{ display: "inline-flex", gap: 4 }}>
            <button
              type="button"
              className={`dc-chip ${!curved && !hasMixedCurves ? "active" : ""}`}
              onClick={() => {
                if (onWholeStraight) {
                  onWholeStraight();
                } else {
                  st.flattenEntityCurves(selection);
                }
              }}
            >
              All Straight
            </button>
            <button
              type="button"
              className={`dc-chip ${curved && !hasMixedCurves ? "active" : ""}`}
              onClick={() => {
                if (onWholeSmooth) {
                  onWholeSmooth();
                } else {
                  st.bendSelectedIntoCurve();
                }
              }}
            >
              Smooth All
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
