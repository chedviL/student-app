import "./Skeleton.css";

/*
 * Loading "skeletons": grey outlines in the shape of the real content.
 * The screen keeps its layout while data loads, so nothing jumps when it arrives.
 */

export function SkeletonLine({ width = "100%", height = 12 }: { width?: number | string; height?: number }) {
  return <span className="sk sk-line" style={{ width, height }} />;
}

/** Table placeholder — header bar + rows with uneven cell widths. */
export function SkeletonTable({ rows = 8, cols = 6, label = "טוען נתונים..." }: { rows?: number; cols?: number; label?: string }) {
  const widths = ["70%", "55%", "85%", "45%", "65%", "50%", "75%", "40%"];
  return (
    <div className="sk-table" role="status" aria-label={label}>
      <div className="sk-table-head" />
      {Array.from({ length: rows }, (_, r) => (
        <div className="sk-table-row" key={r}>
          {Array.from({ length: cols }, (_, c) => (
            <span key={c} className="sk-table-cell">
              <SkeletonLine width={widths[(r + c) % widths.length]} />
            </span>
          ))}
        </div>
      ))}
      <span className="sk-sr-only">{label}</span>
    </div>
  );
}

/** Student / alumni card placeholder — title, action row and a grid of fields. */
export function SkeletonProfile({ label = "טוען כרטיס..." }: { label?: string }) {
  return (
    <div className="sk-profile" role="status" aria-label={label}>
      <div className="sk-profile-head">
        <SkeletonLine width={220} height={30} />
        <SkeletonLine width={140} height={14} />
      </div>
      <div className="sk-profile-grid">
        {Array.from({ length: 12 }, (_, i) => (
          <div className="sk-profile-field" key={i}>
            <SkeletonLine width="40%" height={10} />
            <SkeletonLine width={i % 3 === 0 ? "80%" : "60%"} height={16} />
          </div>
        ))}
      </div>
      <span className="sk-sr-only">{label}</span>
    </div>
  );
}

/** Simple list placeholder (search results, small panels). */
export function SkeletonList({ rows = 5, label = "טוען..." }: { rows?: number; label?: string }) {
  return (
    <div className="sk-list" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div className="sk-list-row" key={i}>
          <SkeletonLine width={i % 2 ? "45%" : "60%"} height={14} />
          <SkeletonLine width="20%" height={12} />
        </div>
      ))}
      <span className="sk-sr-only">{label}</span>
    </div>
  );
}
