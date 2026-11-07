export default function KpiGrid({ items }) {
  return (
    <div className="kpis">
      {items.map(([label, value], index) => (
        <div className="kpi" key={label}>
          <span className="kpi__index">0{index + 1}</span>
          <div className="v">{value}</div>
          <div className="l">{label}</div>
        </div>
      ))}
    </div>
  );
}
