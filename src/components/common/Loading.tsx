import "./Loading.css";

/** Full-screen splash — identical to the inline splash in index.html, so the hand-off is seamless. */
export function Splash() {
  return (
    <div className="app-splash" role="status" aria-live="polite">
      <div className="app-splash-title">ישיבה גדולה פני מנחם</div>
      <div className="app-splash-spinner" />
    </div>
  );
}

/** Lightweight in-page loader (below the navbar) while a page's code or data is loading. */
export default function Loading({ text = "טוען..." }: { text?: string }) {
  return (
    <div className="page-loader" role="status" aria-live="polite">
      <div className="page-loader-spinner" />
      <span>{text}</span>
    </div>
  );
}
