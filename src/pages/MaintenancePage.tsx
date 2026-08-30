export default function MaintenancePage() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        fontFamily: "inherit",
        textAlign: "center",
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "rgba(255, 255, 255, 0.95)",
          borderRadius: "20px",
          padding: "60px 40px",
          maxWidth: "600px",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
          backdropFilter: "blur(10px)",
        }}
      >
        {/* Icon/Logo */}
        <div
          style={{
            fontSize: "80px",
            marginBottom: "30px",
            animation: "pulse 2s ease-in-out infinite",
          }}
        >
          🔧
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: "32px",
            fontWeight: 700,
            color: "#333",
            marginBottom: "20px",
            margin: "0 0 20px 0",
          }}
        >
          תחזוקה קצרה
        </h1>

        {/* Message */}
        <p
          style={{
            fontSize: "18px",
            color: "#666",
            lineHeight: "1.8",
            marginBottom: "40px",
            margin: "0 0 40px 0",
          }}
        >
          האתר נמצא כעת בתחזוקה קצרה ויחזור לפעילות בעוד מספר דקות.
          <br />
          תודה על הסבלנות 💛
        </p>

        {/* Loading indicator */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "8px",
            marginTop: "30px",
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: "#667eea",
                animation: `bounce 1.4s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.05);
          }
        }

        @keyframes bounce {
          0%, 80%, 100% {
            opacity: 0.5;
            transform: translateY(0);
          }
          40% {
            opacity: 1;
            transform: translateY(-10px);
          }
        }
      `}</style>
    </div>
  );
}
