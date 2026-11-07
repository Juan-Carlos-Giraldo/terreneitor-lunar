import Card from "../components/Card.jsx";
import KpiGrid from "../components/KpiGrid.jsx";
import LineChart from "../components/LineChart.jsx";
import { formatNumber, mean, PHASES } from "../utils/csv.js";

export default function ResumenView({ data }) {
  const kpis = [
    ["Duración de captura", `${formatNumber(data.duration, 1)} s`],
    ["Muestras recibidas", data.rows.length.toLocaleString("es")],
    ["Altitud máxima", `${formatNumber(data.apogee.alt_m)} m`],
    ["Instante del apogeo", `${formatNumber(data.apogee.t)} s`],
    ["Aceleración máxima", `${formatNumber(data.maxAcceleration.a)} g`],
    ["Giro máximo", `${formatNumber(data.maxGyroscope.g, 0)} °/s`],
    [
      "Paquetes perdidos",
      `${formatNumber((data.lost / data.expected) * 100, 1)} %`,
    ],
    ["Intervalo medio", `${formatNumber(mean(data.intervals), 1)} ms`],
  ];

  return (
    <div
      className="stack"
      id="panel-resumen"
      role="tabpanel"
      aria-labelledby="tab-resumen"
    >
      <Card title="Resumen de vuelo" className="summary-card">
        <KpiGrid items={kpis} />
        <div className="coverage note">
          <span className="coverage__lamp" />
          Vuelo registrado: {data.date ? data.date.replace("T", " ").slice(0, 19) : "fecha no disponible"}
          {" · "}Paquetes esperados: {data.expected.toLocaleString("es")}
          {" · "}recibidos: {data.received.toLocaleString("es")}
          {data.duplicates > 0 && ` · duplicados: ${data.duplicates.toLocaleString("es")}`}
        </div>
      </Card>

      <div className="grid2">
        <Card title="Fases de vuelo">
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Fase</th>
                  <th>Inicio</th>
                  <th>Fin</th>
                  <th>Duración</th>
                  <th>Muestras</th>
                </tr>
              </thead>
              <tbody>
                {data.phases.map((phase, index) => (
                  <tr key={`${phase.estado}-${index}`}>
                    <td>
                      <span className="phase-code">{String(phase.estado).padStart(2, "0")}</span>
                      {PHASES[phase.estado] ?? "DESCONOCIDA"}
                    </td>
                    <td>{formatNumber(phase.inicio)} s</td>
                    <td>{formatNumber(phase.fin)} s</td>
                    <td>{formatNumber(phase.fin - phase.inicio)} s</td>
                    <td>{phase.n.toLocaleString("es")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Altitud">
          <LineChart
            rows={data.rows}
            yLabel="ALTITUD (m)"
            series={[{ key: "alt_m", label: "Altitud (m)", color: "#a9d57f" }]}
          />
        </Card>
      </div>

      <div className="grid2">
        <Card title="Aceleración">
          <LineChart
            rows={data.rows}
            yLabel="ACELERACIÓN (g)"
            series={[
              { key: "a", label: "|a| total (g)", color: "#e5ad5c" },
              { key: "az", label: "az (g)", color: "#78b9ad" },
            ]}
          />
        </Card>
        <Card title="Giroscopio">
          <LineChart
            rows={data.rows}
            yLabel="VELOCIDAD ANGULAR (°/s)"
            series={[
              { key: "gx", label: "gx", color: "#e5ad5c" },
              { key: "gy", label: "gy", color: "#78b9ad" },
              { key: "gz", label: "gz", color: "#c78068" },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
