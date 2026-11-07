export default function Header({ view, onNavigate }) {
  return (
    <header className="top">
      <div className="logo" aria-label="Ilustración de una luna y un cohete">
        <pre aria-hidden="true">{`   .  *  .       .\n       .---.  *\n      /     \\\n     |  .-.  |\n      \\     /\n       '---'     /\\\n                 /  \\\n                /____\\\n                 |  |\n                /|  |\\`}</pre>
        <span>EST. 2025 · BASE LUNAR</span>
      </div>
      <div className="info">
        <span className="system-tag">SISTEMA DE TELEMETRÍA · EN LÍNEA</span>
        <h1>Terreneitor Lunar</h1>
        <p>Programa terrestre que a veces sube unos metros por encima de la tierra.</p>
      </div>
      <nav aria-label="Navegación principal">
        <button
          className={`nav-link${view === "history" ? " nav-link--active" : ""}`}
          type="button"
          aria-current={view === "history" ? "page" : undefined}
          onClick={() => onNavigate(view === "history" ? "dashboard" : "history")}
        >
          {view === "history"
            ? "← Volver a telemetría"
            : "01 / Expediciones pasadas"}
        </button>
        <span>02 / Bitácora</span>
        <span>03 / Videos e imágenes</span>
      </nav>
    </header>
  );
}
