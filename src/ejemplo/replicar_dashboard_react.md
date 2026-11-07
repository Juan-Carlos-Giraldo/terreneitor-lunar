# Dashboard de vuelo en React

Esta guía replica el dashboard de **Terreneitor Lunar** en un proyecto React con Vite. Incluye:

- Cabecera con logo, título y navegación.
- Zona de carga del CSV del vuelo.
- Dos vistas (Resumen y Análisis) con el layout de los wireframes.
- Gráficas con Chart.js (vía `react-chartjs-2`).
- Tema terminal retro.

---

## 1. Crear el proyecto

```bash
npm create vite@latest dashboard-vuelo -- --template react
cd dashboard-vuelo
npm install
npm install chart.js@4.4.1 react-chartjs-2@5.2.0
```

Requisitos: Node.js 18 o más nuevo.

---

## 2. Estructura de carpetas

```
dashboard-vuelo/
├── index.html
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── index.css
    ├── utils/
    │   └── csv.js
    ├── components/
    │   ├── Header.jsx
    │   ├── FileUpload.jsx
    │   ├── Tabs.jsx
    │   ├── Card.jsx
    │   ├── KpiGrid.jsx
    │   └── LineChart.jsx
    └── views/
        ├── ResumenView.jsx
        └── AnalisisView.jsx
```

Borra `src/App.css` y las referencias a él en `App.jsx`.

---

## 3. Lógica de datos: `src/utils/csv.js`

```js
export const FASES = ['ARMADO', 'LISTO', 'IMPULSO', 'ASCENSO', 'APOGEO', 'DESCENSO', 'ATERRIZADO'];
export const FLAGS = {
  1: 'Acelerómetro saturado (16 g)',
  2: 'Impacto',
  4: 'Falla de sensor',
  8: 'Paracaídas abierto',
};

export const fx = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '—');
export const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;

export function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(',').map((s) => s.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const p = lines[i].split(',');
    if (p.length < header.length) continue;
    const o = {};
    header.forEach((k, j) => {
      o[k] = k === 'hora_pc' ? p[j] : Number(p[j]);
    });
    if (Number.isFinite(o.t_ms) && Number.isFinite(o.seq)) rows.push(o);
  }
  return rows;
}

export function analyze(rows) {
  const t0 = rows[0].t_ms;
  rows.forEach((r) => {
    r.t = (r.t_ms - t0) / 1000;
    r.a = Math.hypot(r.ax, r.ay, r.az);
    r.g = Math.hypot(r.gx, r.gy, r.gz);
  });

  const seqs = rows.map((r) => r.seq);
  const seqMin = Math.min(...seqs);
  const seqMax = Math.max(...seqs);
  const esperados = seqMax - seqMin + 1;
  const perdidos = esperados - rows.length;

  const dts = [];
  for (let i = 1; i < rows.length; i++) dts.push(rows[i].t_ms - rows[i - 1].t_ms);

  const fases = [];
  let cur = null;
  rows.forEach((r) => {
    if (!cur || cur.estado !== r.estado) {
      cur = { estado: r.estado, inicio: r.t, fin: r.t, n: 0 };
      fases.push(cur);
    }
    cur.fin = r.t;
    cur.n++;
  });

  const ap = rows.reduce((m, r) => (r.alt_m > m.alt_m ? r : m), rows[0]);
  const maxA = rows.reduce((m, r) => (r.a > m.a ? r : m), rows[0]);
  const maxG = rows.reduce((m, r) => (r.g > m.g ? r : m), rows[0]);

  const flags = new Map();
  rows.forEach((r) => flags.set(r.flags, (flags.get(r.flags) || 0) + 1));

  const reposo = rows.filter((r) => r.estado === 0);
  const calib = ['ax', 'ay', 'az', 'gx', 'gy', 'gz'].map((k) => {
    const v = reposo.map((r) => r[k]);
    return {
      k,
      media: v.length ? mean(v) : NaN,
      min: v.length ? Math.min(...v) : NaN,
      max: v.length ? Math.max(...v) : NaN,
    };
  });

  return {
    rows,
    seqMin,
    seqMax,
    esperados,
    perdidos,
    dts,
    fases,
    ap,
    maxA,
    maxG,
    vb: rows.map((r) => r.vbat),
    flags,
    calib,
    dur: rows[rows.length - 1].t,
    fecha: rows[0].hora_pc,
    hayReposo: reposo.length > 0,
  };
}
```

---

## 4. Punto de entrada: `src/main.jsx`

```jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

---

## 5. Componente raíz: `src/App.jsx`

```jsx
import { useState } from 'react';
import Header from './components/Header.jsx';
import FileUpload from './components/FileUpload.jsx';
import Tabs from './components/Tabs.jsx';
import ResumenView from './views/ResumenView.jsx';
import AnalisisView from './views/AnalisisView.jsx';
import { parseCSV, analyze } from './utils/csv.js';

export default function App() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('resumen');
  const [msg, setMsg] = useState('');

  async function handleFile(file) {
    try {
      const rows = parseCSV(await file.text());
      if (rows.length < 2) throw new Error('el archivo no tiene datos válidos');
      setData(analyze(rows));
      setMsg(`Cargado: ${file.name}`);
    } catch (err) {
      setMsg('Error: ' + err.message);
    }
  }

  return (
    <>
      <Header />
      <FileUpload onFile={handleFile} msg={msg} />
      {data && (
        <>
          <Tabs
            value={tab}
            onChange={setTab}
            options={[
              ['resumen', 'Resumen'],
              ['analisis', 'Análisis'],
            ]}
          />
          {tab === 'resumen' ? <ResumenView d={data} /> : <AnalisisView d={data} />}
        </>
      )}
    </>
  );
}
```

---

## 6. Componentes

### `src/components/Header.jsx`

```jsx
export default function Header() {
  return (
    <header className="top">
      <div className="logo">[ logo ]</div>
      <div className="info">
        <h1>Terreneitor Lunar</h1>
        <p>Programa terrestre que a veces sube unos metros por encima de la tierra</p>
      </div>
      <nav>
        <span>Expediciones pasadas</span>
        <span>Bitacora</span>
        <span>Videos e imagenes</span>
      </nav>
    </header>
  );
}
```

### `src/components/FileUpload.jsx`

```jsx
export default function FileUpload({ onFile, msg }) {
  return (
    <section className="hero">
      <div className="note">&gt; cargar datos del vuelo (CSV)</div>
      <input
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => e.target.files[0] && onFile(e.target.files[0])}
      />
      <div className="note">{msg}</div>
    </section>
  );
}
```

### `src/components/Tabs.jsx`

```jsx
export default function Tabs({ value, onChange, options }) {
  return (
    <div className="tabs">
      {options.map(([key, label]) => (
        <button key={key} className={value === key ? 'on' : ''} onClick={() => onChange(key)}>
          {label}
        </button>
      ))}
    </div>
  );
}
```

### `src/components/Card.jsx`

```jsx
export default function Card({ title, children, style }) {
  return (
    <div className="card" style={style}>
      <h2>{title}</h2>
      {children}
    </div>
  );
}
```

### `src/components/KpiGrid.jsx`

```jsx
export default function KpiGrid({ items }) {
  return (
    <div className="kpis">
      {items.map(([label, value]) => (
        <div key={label}>
          <div className="v">{value}</div>
          <div className="l">{label}</div>
        </div>
      ))}
    </div>
  );
}
```

### `src/components/LineChart.jsx`

```jsx
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend);
ChartJS.defaults.color = '#33ff66';
ChartJS.defaults.font.family = '"Courier New", monospace';
ChartJS.defaults.borderColor = '#1f7a3a88';

export default function LineChart({ rows, series, yLabel }) {
  const step = Math.max(1, Math.ceil(rows.length / 1500));
  const pts = rows.filter((_, i) => i % step === 0);

  const data = {
    datasets: series.map((s) => ({
      label: s.label,
      borderColor: s.color,
      borderWidth: 1.5,
      pointRadius: 0,
      tension: 0.2,
      data: pts.map((r) => ({ x: r.t, y: r[s.key] })),
    })),
  };

  const options = {
    animation: false,
    parsing: false,
    normalized: true,
    scales: {
      x: { type: 'linear', title: { display: true, text: 'Tiempo desde encendido (s)' } },
      y: { title: { display: true, text: yLabel } },
    },
  };

  return (
    <div className="chart">
      <Line data={data} options={options} />
    </div>
  );
}
```

---

## 7. Vistas

### `src/views/ResumenView.jsx`

```jsx
import Card from '../components/Card.jsx';
import KpiGrid from '../components/KpiGrid.jsx';
import LineChart from '../components/LineChart.jsx';
import { FASES, fx, mean } from '../utils/csv.js';

export default function ResumenView({ d }) {
  const kpis = [
    ['Duración captura', `${fx(d.dur, 1)} s`],
    ['Muestras', d.rows.length.toLocaleString('es')],
    ['Altura máxima', `${fx(d.ap.alt_m)} m`],
    ['Instante apogeo', `${fx(d.ap.t)} s`],
    ['Aceleración máx.', `${fx(d.maxA.a)} g`],
    ['Giro máx.', `${fx(d.maxG.g, 0)} °/s`],
    ['Pérdida de paquetes', `${fx((d.perdidos / d.esperados) * 100, 1)} %`],
    ['Intervalo medio', `${fx(mean(d.dts), 1)} ms`],
  ];

  return (
    <div className="stack">
      <Card title="Resumen de vuelo">
        <KpiGrid items={kpis} />
        <div className="note" style={{ marginTop: 10 }}>
          Vuelo registrado el {d.fecha.replace('T', ' ').slice(0, 19)}. Paquetes esperados:{' '}
          {d.esperados.toLocaleString('es')}; recibidos: {d.rows.length.toLocaleString('es')}.
        </div>
      </Card>

      <div className="grid2">
        <Card title="Fases de vuelo">
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Fase</th>
                  <th>Inicio (s)</th>
                  <th>Fin (s)</th>
                  <th>Duración (s)</th>
                  <th>Muestras</th>
                </tr>
              </thead>
              <tbody>
                {d.fases.map((f, i) => (
                  <tr key={i}>
                    <td>
                      {f.estado} · {FASES[f.estado] ?? '?'}
                    </td>
                    <td>{fx(f.inicio)}</td>
                    <td>{fx(f.fin)}</td>
                    <td>{fx(f.fin - f.inicio)}</td>
                    <td>{f.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Altitud">
          <LineChart rows={d.rows} yLabel="Altitud (m)" series={[{ key: 'alt_m', label: 'Altitud (m)', color: '#33ff66' }]} />
        </Card>
      </div>

      <div className="grid2">
        <Card title="Aceleración">
          <LineChart
            rows={d.rows}
            yLabel="Aceleración (g)"
            series={[
              { key: 'a', label: '|a| (g)', color: '#ffb000' },
              { key: 'az', label: 'az (g)', color: '#00ccff' },
            ]}
          />
        </Card>

        <Card title="Giroscopio">
          <LineChart
            rows={d.rows}
            yLabel="°/s"
            series={[
              { key: 'gx', label: 'gx', color: '#ffb000' },
              { key: 'gy', label: 'gy', color: '#00ccff' },
              { key: 'gz', label: 'gz', color: '#ff4d4d' },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
```

### `src/views/AnalisisView.jsx`

```jsx
import Card from '../components/Card.jsx';
import { FLAGS, fx, mean } from '../utils/csv.js';

export default function AnalisisView({ d }) {
  const { rows, fases } = d;
  const ini = (n) => fases.find((f) => f.estado === n)?.inicio ?? null;
  const imp = rows.filter((r) => r.estado === 2);
  const asc = rows.filter((r) => r.estado === 3);

  // Altura
  const tAsc = ini(3);
  const ult = rows[rows.length - 1];
  const vDesc = (d.ap.alt_m - ult.alt_m) / (ult.t - d.ap.t);

  // Calidad
  const vmin = Math.min(...d.vb);
  const vmax = Math.max(...d.vb);
  const flagsRows = [...d.flags.entries()].sort((a, b) => b[1] - a[1]);

  // Despegue
  const pico = imp.reduce((m, x) => (x.a > m.a ? x : m), imp[0]);

  // Giroscopio
  const maxAbs = (k) => Math.max(...asc.map((x) => Math.abs(x[k])));

  return (
    <div className="stack">
      <Card title="Calidad de los datos">
        <p>
          Paquetes perdidos: <strong>{d.perdidos.toLocaleString('es')}</strong> de{' '}
          {d.esperados.toLocaleString('es')} (seq {d.seqMin} a {d.seqMax}).
        </p>
        <p>
          Intervalo entre muestras: mínimo {Math.min(...d.dts)} ms, máximo {Math.max(...d.dts)} ms.
        </p>
        {vmax - vmin < 0.01 ? (
          <p className="warn">
            ⚠ vbat es constante ({fx(vmin)} V). Probablemente es un error del ADC o del divisor.
          </p>
        ) : (
          <p>
            Voltaje de batería entre {fx(vmin)} y {fx(vmax)} V.
          </p>
        )}
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Flags</th>
                <th>Significado</th>
                <th>Muestras</th>
              </tr>
            </thead>
            <tbody>
              {flagsRows.map(([f, n]) => (
                <tr key={f}>
                  <td>{f}</td>
                  <td>
                    {Object.keys(FLAGS)
                      .filter((b) => f & b)
                      .map((b) => FLAGS[b])
                      .join(', ') || 'Todo normal'}
                  </td>
                  <td>{n.toLocaleString('es')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h2 style={{ marginTop: 16 }}>Limitaciones de este vuelo</h2>
        <ul>
          <li>El archivo termina en DESCENSO, a unos 3.6 m, antes del aterrizaje.</li>
          <li>vbat está fija en 0.28 V; no es confiable hasta revisar el divisor de tensión.</li>
          <li>La aceleración en reposo no es exactamente 1 g: el sensor necesita calibración de offset.</li>
          <li>Hay pérdida de paquetes por WiFi; el ESP32 guarda la copia oficial del vuelo.</li>
        </ul>
      </Card>

      <div className="grid2">
        <Card title="Análisis de altura durante vuelo">
          <table>
            <tbody>
              <tr><td>Altura máxima</td><td>{fx(d.ap.alt_m)} m</td></tr>
              <tr><td>Instante del apogeo</td><td>{fx(d.ap.t)} s</td></tr>
              <tr><td>Inicio de ascenso (estado 3)</td><td>{tAsc != null ? `${fx(tAsc)} s` : '—'}</td></tr>
              <tr><td>Tiempo de ascenso</td><td>{tAsc != null ? `${fx(d.ap.t - tAsc)} s` : '—'}</td></tr>
              <tr><td>Velocidad media de descenso</td><td>{fx(vDesc)} m/s</td></tr>
            </tbody>
          </table>
        </Card>

        <Card title="Análisis de aceleración durante despegue">
          {imp.length ? (
            <table>
              <tbody>
                <tr><td>Inicio de impulso</td><td>{fx(imp[0].t)} s</td></tr>
                <tr><td>Duración del impulso</td><td>{fx(imp[imp.length - 1].t - imp[0].t)} s</td></tr>
                <tr><td>Pico de |a| en impulso</td><td>{fx(pico.a)} g en t={fx(pico.t)} s</td></tr>
                <tr><td>|a| media en impulso</td><td>{fx(mean(imp.map((x) => x.a)))} g</td></tr>
                <tr><td>Pico global de |a|</td><td>{fx(d.maxA.a)} g en t={fx(d.maxA.t)} s (estado {d.maxA.estado})</td></tr>
              </tbody>
            </table>
          ) : (
            <p>Sin muestras en fase IMPULSO.</p>
          )}
        </Card>
      </div>

      <div className="grid2">
        <Card title="Aceleración">
          {d.hayReposo ? (
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>Eje</th>
                    <th>Media (g)</th>
                    <th>Mínimo</th>
                    <th>Máximo</th>
                  </tr>
                </thead>
                <tbody>
                  {d.calib
                    .filter((c) => c.k[0] === 'a')
                    .map((c) => (
                      <tr key={c.k}>
                        <td>{c.k}</td>
                        <td>{fx(c.media, 3)}</td>
                        <td>{fx(c.min, 3)}</td>
                        <td>{fx(c.max, 3)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No hay muestras en fase ARMADO.</p>
          )}
        </Card>

        <Card title="Análisis de giroscopio durante vuelo">
          {asc.length ? (
            <table>
              <tbody>
                <tr><td>Máx |gx| en ascenso</td><td>{fx(maxAbs('gx'), 0)} °/s</td></tr>
                <tr><td>Máx |gy| en ascenso</td><td>{fx(maxAbs('gy'), 0)} °/s</td></tr>
                <tr><td>Máx |gz| en ascenso</td><td>{fx(maxAbs('gz'), 0)} °/s</td></tr>
                <tr><td>Máx |g| total en ascenso</td><td>{fx(Math.max(...asc.map((x) => x.g)), 0)} °/s</td></tr>
              </tbody>
            </table>
          ) : (
            <p>Sin muestras en fase ASCENSO.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
```

---

## 8. Estilos: `src/index.css`

Reemplaza el contenido por completo:

```css
:root {
  --bg: #050805;
  --card: #081008;
  --text: #33ff66;
  --muted: #1f9c44;
  --line: #1f7a3a;
  --warn: #ffb000;
  color-scheme: dark;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: "Courier New", Consolas, ui-monospace, monospace;
  background: var(--bg);
  color: var(--text);
  padding: 16px;
  max-width: 1200px;
  margin-inline: auto;
}

body::after {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(to bottom, rgba(0,0,0,.25) 0 1px, transparent 1px 3px);
  z-index: 9;
}

h1 { font-size: 1.4rem; margin: 0 0 6px; font-weight: normal; text-shadow: 0 0 6px var(--text); }
h1::before { content: "root@cohete:~$ "; }
h2 { font-size: 1rem; margin: 0 0 10px; text-transform: uppercase; text-shadow: 0 0 6px var(--text); }
h2::before { content: "> "; }

.note { color: var(--muted); font-size: .85rem; }
.warn { color: var(--warn); }
.stack { display: flex; flex-direction: column; gap: 16px; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.card {
  background: var(--card);
  border: 1px solid var(--line);
  padding: 16px;
  box-shadow: 0 0 12px rgba(51,255,102,.15);
  min-width: 0;
}
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
.v { font-size: 1.3rem; font-weight: 600; }
.l { color: var(--muted); font-size: .85rem; }
.chart { position: relative; height: 260px; }
.scroll { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: .9rem; }
th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--line); }
ul { margin: 6px 0 0 18px; padding: 0; }
li { margin-bottom: 6px; }

header.top {
  display: flex;
  gap: 16px;
  align-items: stretch;
  flex-wrap: wrap;
  border: 1px solid var(--line);
  padding: 12px;
  margin-bottom: 16px;
  background: var(--card);
}
.logo {
  width: 240px;
  height: 135px;
  border: 1px dashed var(--line);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--muted);
  flex-shrink: 0;
}
.info { flex: 1; min-width: 220px; }
.info p { margin: 0; color: var(--muted); }
nav {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 10px;
  border-left: 1px solid var(--line);
  padding-left: 16px;
}

.hero {
  border: 1px solid var(--line);
  height: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 16px;
  background: var(--card);
  text-align: center;
  padding: 16px;
}
input[type=file] { color: var(--text); font-family: inherit; }

.tabs { display: flex; gap: 8px; margin-bottom: 16px; }
.tabs button {
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--line);
  font-family: inherit;
  padding: 8px 14px;
  cursor: pointer;
}
.tabs button.on { background: var(--text); color: var(--bg); }

@media (max-width: 760px) {
  .grid2 { grid-template-columns: 1fr; }
  nav { border-left: none; border-top: 1px solid var(--line); padding: 12px 0 0; flex-direction: row; flex-wrap: wrap; gap: 16px; }
  .logo { width: 100%; height: 160px; }
}
```

---

## 9. Ejecutar

```bash
npm run dev
```

Abre `http://localhost:5173`, sube el CSV del vuelo y revisa las dos vistas.

Para generar la versión de producción:

```bash
npm run build
```

---

## 10. Diferencias con la versión en HTML

- Chart.js se importa como módulo npm; ya no se carga desde cdnjs.
- Las vistas usan estado de React en lugar de manipular el DOM. Por eso no hace falta destruir gráficas a mano.
- Las pestañas Resumen y Análisis viven en `App.jsx`. Al cambiar de pestaña, las gráficas se desmontan y se vuelven a crear.
- Los textos de "Limitaciones" siguen escritos a mano para este vuelo. Para que se actualicen con cada CSV, habría que calcularlos en `analyze()`.
