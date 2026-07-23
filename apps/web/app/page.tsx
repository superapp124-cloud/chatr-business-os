export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0B1220",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <h1
        style={{
          fontSize: "3rem",
          fontWeight: 700,
          marginBottom: "1rem",
        }}
      >
        CHATR Business OS
      </h1>

      <p
        style={{
          fontSize: "1.25rem",
          color: "#94A3B8",
          marginBottom: "2rem",
        }}
      >
        Your AI Chief of Staff
      </p>

      <div
        style={{
          background: "#111827",
          padding: "2rem",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "700px",
          border: "1px solid #334155",
        }}
      >
        <h2 style={{ marginBottom: "1rem" }}>Mission Control</h2>

        <p>
          Executive Dashboard initialization complete.
        </p>

        <p style={{ marginTop: "1rem", color: "#94A3B8" }}>
          Next milestones:
        </p>

        <ul
          style={{
            textAlign: "left",
            display: "inline-block",
            marginTop: "1rem",
          }}
        >
          <li>Executive Dashboard</li>
          <li>AI Brief</li>
          <li>Business Graph</li>
          <li>Connector Hub</li>
          <li>Workflow Engine</li>
        </ul>
      </div>
    </main>
  );
}