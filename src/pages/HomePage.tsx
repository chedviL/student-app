import { useNavigate } from "react-router-dom";
import { Search, List, Database } from "lucide-react";
import { motion } from "framer-motion";
import "./HomePage.css";
import logo from "../assets/logo.png";
import heroImage from "../assets/hero.JPG";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delayChildren: 0.3,
      staggerChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.5,
    },
  },
};

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <motion.div
      className="landing-page"
      style={{ backgroundImage: `url(${heroImage})` }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="landing-overlay" />
      <div className="landing-ceiling-light" />
      <div className="landing-glow landing-glow-top" />
      <div className="landing-glow landing-glow-bottom" />
      <div className="landing-glow landing-glow-cards" />

      <motion.div
        className="landing-content"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.header className="landing-header" variants={itemVariants}>
          <img src={logo} alt="לוגו הישיבה" className="landing-logo" />

          <div className="landing-title-wrap">
            <h1 className="landing-title">ישיבה גדולה פני מנחם</h1>

            <p className="landing-subtitle">
              רשימה כללית שכר לימוד וניהול תלמידים
            </p>
            <div className="landing-divider" />
          </div>
        </motion.header>

        <motion.section className="landing-cards" variants={containerVariants}>
          <motion.button
            type="button"
            className="landing-card"
            onClick={() => navigate("/search")}
            variants={itemVariants}
            whileHover={{ boxShadow: "0 8px 25px rgba(0,0,0,0.15)" }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="landing-card-top-line" />

            <div className="landing-card-orb">
              <Search size={28} />
            </div>

            <h2 className="landing-card-title">חיפוש</h2>

            <p className="landing-card-text">
              איתור תלמידים לפי שם, משפחה או מספר זהות
            </p>

            <span className="landing-card-link">כניסה</span>
          </motion.button>

          <motion.button
            type="button"
            className="landing-card"
            onClick={() => navigate("/lists")}
            variants={itemVariants}
            whileHover={{ boxShadow: "0 8px 25px rgba(0,0,0,0.15)" }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="landing-card-top-line" />

            <div className="landing-card-orb">
              <List size={28} />
            </div>

            <h2 className="landing-card-title">רשימות</h2>

            <p className="landing-card-text">
              צפייה מסודרת ברשימות ובמיון נתונים
            </p>

            <span className="landing-card-link">כניסה</span>
          </motion.button>

          <motion.a
            className="landing-card"
            href="https://docs.google.com/spreadsheets/d/1GDAVnNMwI2-Qjwj0AVvWbagKwF27KkwngWlMU55Sb3U/edit?gid=2008713622#gid=2008713622"
            rel="noreferrer"
            variants={itemVariants}
            whileHover={{ boxShadow: "0 8px 25px rgba(0,0,0,0.15)" }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="landing-card-top-line" />

            <div className="landing-card-orb">
              <Database size={28} />
            </div>

            <h2 className="landing-card-title">מסד נתונים</h2>

            <p className="landing-card-text">
              ניהול ועדכון נתוני תלמידים בממשק מרוכז
            </p>

            <span className="landing-card-link">כניסה</span>
          </motion.a>
        </motion.section>
      </motion.div>
    </motion.div>
  );
}