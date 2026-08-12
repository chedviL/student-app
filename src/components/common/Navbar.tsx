import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Search, Database, Home, Pencil, GraduationCap, CreditCard } from "lucide-react";
import logo from "../../assets/logo.png";
import "./Navbar.css";

const NAV_ITEMS = [
  { to: "/",         label: "בית",         icon: <Home          size={16} />, end: true  },
  { to: "/search",   label: "חיפוש",       icon: <Search        size={16} />, end: false },
  { to: "/database", label: "מסד נתונים",  icon: <Database      size={16} />, end: false },
  { to: "/edit",     label: "עריכה",       icon: <Pencil        size={16} />, end: false },
  { to: "/alumni",   label: "בוגרים",      icon: <GraduationCap size={16} />, end: false },
  { to: "/payments", label: "תשלומים",     icon: <CreditCard    size={16} />, end: false },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  function isActive(to: string, end: boolean) {
    if (end) return location.pathname === to;
    return location.pathname.startsWith(to);
  }

  return (
    <>
      <nav className="navbar">
        {/* Brand */}
        <NavLink to="/" className="navbar-brand" onClick={() => setOpen(false)}>
          <img src={logo} alt="לוגו" className="navbar-logo" />
          <span className="navbar-brand-name">
            ישיבת פני מנחם
            <span className="navbar-brand-sub">ניהול תלמידים</span>
          </span>
        </NavLink>

        {/* Desktop links */}
        <ul className="navbar-links">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive: ia }) =>
                  "navbar-link" + (ia ? " active" : "")
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Mobile hamburger */}
        <button
          className={`navbar-hamburger${open ? " open" : ""}`}
          onClick={() => setOpen((o) => !o)}
          aria-label="תפריט ניווט"
        >
          <span />
          <span />
          <span />
        </button>
      </nav>

      {/* Mobile drawer */}
      {open && (
        <div className="navbar-drawer">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={
                isActive(item.to, item.end ?? false)
                  ? "navbar-link active"
                  : "navbar-link"
              }
              onClick={() => setOpen(false)}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </>
  );
}
