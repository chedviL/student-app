import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Search, Database, Home, Pencil, GraduationCap, CreditCard, LogOut } from "lucide-react";
import logo from "../../assets/logo.png";
import { useAuth } from "../../context/AuthContext";
import { getMyProfile } from "../../api/tuitionApi";
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
  const [displayName, setDisplayName] = useState('');
  const location = useLocation();
  const { signOut } = useAuth();

  useEffect(() => {
    getMyProfile().then((p) => { if (p) setDisplayName(p.displayName); }).catch(() => {});
  }, []);

  async function handleLogout() {
    await signOut();
  }

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

        {/* User info + logout */}
        <div className="navbar-user">
          {displayName && (
            <span className="navbar-username" title={displayName}>
              {displayName}
            </span>
          )}
          <button
            className="navbar-logout"
            onClick={handleLogout}
            title="התנתקות"
            aria-label="התנתקות"
          >
            <LogOut size={16} />
          </button>
        </div>

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
