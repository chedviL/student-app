import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Database, Pencil, GraduationCap, CreditCard } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import "./HomePage.css";
import logo from "../assets/logo.png";

import slide1 from "../images/optimized/044A1227.webp";
import slide2 from "../images/optimized/044A1230.webp";
import slide3 from "../images/optimized/044A1231.webp";
import slide4 from "../images/optimized/044A1236.webp";
import slide5 from "../images/optimized/044A1249.webp";

const slides = [slide1, slide2, slide3, slide4, slide5];
const DISPLAY_DURATION = 5000; // ms to show each slide AFTER it has loaded

/** Preload a single image URL, returns a cleanup function */
function preloadImage(src: string): () => void {
  const img = new window.Image();
  img.src = src;
  return () => { img.src = ""; };
}

export default function HomePage() {
  const navigate = useNavigate();

  // index of the slide currently displayed
  const [current, setCurrent]     = useState(0);
  // index of the slide that is being faded in (may differ from current during transition)
  const [next, setNext]           = useState<number | null>(null);
  // whether the "next" slide's <img> has finished loading
  const [nextLoaded, setNextLoaded] = useState(false);

  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef  = useRef(true);

  // Clear any pending timer
  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // After current slide is fully visible, schedule the next transition
  const scheduleNext = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      const nextIdx = (current + 1) % slides.length;
      setNext(nextIdx);
      setNextLoaded(false);
    }, DISPLAY_DURATION);
  }, [current, clearTimer]);

  // Kick off timer once on mount and whenever current changes
  useEffect(() => {
    scheduleNext();
    return clearTimer;
  }, [scheduleNext, clearTimer]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Preload next image in background after current slide appears
  useEffect(() => {
    const nextIdx = (current + 1) % slides.length;
    const cancel = preloadImage(slides[nextIdx]);
    return cancel;
  }, [current]);

  // When the hidden "next" img fires onLoad, mark it loaded
  const handleNextLoaded = useCallback(() => {
    if (!mountedRef.current) return;
    setNextLoaded(true);
  }, []);

  // Once next image is loaded, perform the actual transition
  useEffect(() => {
    if (next === null || !nextLoaded) return;
    // Swap: next becomes current
    setCurrent(next);
    setNext(null);
    setNextLoaded(false);
  }, [next, nextLoaded]);

  // Manual dot click – jump immediately
  const goTo = useCallback((idx: number) => {
    clearTimer();
    setNext(null);
    setNextLoaded(false);
    setCurrent(idx);
  }, [clearTimer]);

  return (
    <div className="home-page with-navbar">

      {/* ── HERO ── */}
      <div className="home-hero">

        {/* Current visible slide */}
        <AnimatePresence>
          <motion.div
            key={current}
            className="home-hero-slide"
            style={{ backgroundImage: `url(${slides[current]})` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.0 }}
          />
        </AnimatePresence>

        {/*
          Hidden img tags used purely for load detection.
          The first image gets loading="eager" for priority; the rest are lazy.
        */}
        {slides.map((src, i) => (
          <img
            key={src}
            src={src}
            alt=""
            aria-hidden="true"
            loading={i === 0 ? "eager" : "lazy"}
            decoding="async"
            style={{ display: "none" }}
            onLoad={i === next ? handleNextLoaded : undefined}
          />
        ))}

        <div className="home-hero-overlay" />

        {/* logo + title over image */}
        <motion.div
          className="home-hero-content"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <img src={logo} alt="לוגו" className="home-hero-logo" />
          <h1 className="home-hero-title">ישיבה גדולה פני מנחם</h1>
          <p className="home-hero-sub">מערכת ניהול תלמידים</p>
          <div className="home-hero-divider" />
        </motion.div>

        {/* dots */}
        <div className="home-dots">
          {slides.map((_, i) => (
            <button
              key={i}
              className={`home-dot${i === current ? " active" : ""}`}
              onClick={() => goTo(i)}
              aria-label={`תמונה ${i + 1}`}
            />
          ))}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="home-content">
        <div className="home-cards">
          {[
            { icon: <Search size={26} />, title: "חיפוש", text: "איתור תלמידים לפי שם, משפחה או מספר זהות", path: "/search" },
            { icon: <Database size={26} />, title: "מסד נתונים", text: "צפייה, סינון, מיון ועריכה של נתוני התלמידים", path: "/database" },
            { icon: <Pencil size={26} />, title: "עריכה", text: "עדכון נתונים לתלמיד בודד או לקבוצה בבת אחת", path: "/edit" },
            { icon: <GraduationCap size={26} />, title: "בוגרים", text: "רשימת בוגרי הישיבה וניהול נתוניהם", path: "/alumni" },
            { icon: <CreditCard size={26} />, title: "תשלומים", text: "ניהול שכר לימוד, יתרות, תנועות וחיובים", path: "/payments" },
          ].map((card, i) => (
            <motion.button
              key={card.path}
              type="button"
              className="home-card"
              onClick={() => navigate(card.path)}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.12, duration: 0.45 }}
              whileHover={{ y: -6 }}
              whileTap={{ scale: 0.97 }}
            >
              <div className="home-card-orb">{card.icon}</div>
              <h2 className="home-card-title">{card.title}</h2>
              <p className="home-card-text">{card.text}</p>
              <span className="home-card-link">כניסה ←</span>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
