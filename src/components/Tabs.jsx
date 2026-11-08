export default function Tabs({ activeTab, onChange, options }) {
  return (
    <div className="tabs" role="tablist" aria-label="Vistas del dashboard">
      {options.map(([key, label]) => (
        <button
          key={key}
          id={`tab-${key}`}
          className={`tab${activeTab === key ? " on" : ""}`}
          type="button"
          role="tab"
          aria-selected={activeTab === key}
          aria-controls={`panel-${key}`}
          onClick={() => onChange(key)}
        >
          <span className="tab__index">
            {String(options.findIndex(([optionKey]) => optionKey === key) + 1).padStart(2, "0")}
          </span>
          {label}
        </button>
      ))}
    </div>
  );
}
