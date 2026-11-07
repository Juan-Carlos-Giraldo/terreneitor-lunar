import {
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend);
ChartJS.defaults.color = "#88a77e";
ChartJS.defaults.font.family = '"Courier New", Consolas, monospace';
ChartJS.defaults.borderColor = "rgba(98, 134, 83, 0.26)";

export default function LineChart({ rows, series, yLabel }) {
  const step = Math.max(1, Math.ceil(rows.length / 1500));
  const points = rows.filter((_, index) => index % step === 0);
  if (points[points.length - 1] !== rows[rows.length - 1]) {
    points.push(rows[rows.length - 1]);
  }

  const data = {
    datasets: series.map((item) => ({
      label: item.label,
      borderColor: item.color,
      backgroundColor: item.color,
      borderWidth: 1.5,
      pointRadius: 0,
      pointHoverRadius: 3,
      tension: 0.18,
      data: points.map((row) => ({ x: row.t, y: row[item.key] })),
    })),
  };

  const options = {
    animation: false,
    maintainAspectRatio: false,
    parsing: false,
    interaction: { intersect: false, mode: "index" },
    plugins: {
      legend: {
        position: "bottom",
        labels: { boxWidth: 10, usePointStyle: true, padding: 18 },
      },
      tooltip: {
        callbacks: {
          title: (items) => `T+${Number(items[0]?.parsed.x).toFixed(2)} s`,
        },
      },
    },
    scales: {
      x: {
        type: "linear",
        title: {
          display: true,
          text: "TIEMPO DESDE ENCENDIDO (s)",
          color: "#78966e",
        },
        grid: { color: "rgba(98, 134, 83, 0.14)" },
      },
      y: {
        title: { display: true, text: yLabel, color: "#78966e" },
        grid: { color: "rgba(98, 134, 83, 0.2)" },
      },
    },
  };

  return (
    <div className="chart">
      <Line data={data} options={options} />
    </div>
  );
}
