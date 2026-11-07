import { formatArchiveTimestamp } from "../utils/archive.js";

export default function HistoryView({
  directoryName,
  entries,
  error,
  loading,
  onChooseDirectory,
  onOpenFlight,
}) {
  return (
    <section className="history card" aria-labelledby="history-title">
      <div className="history__heading">
        <div>
          <span className="note">&gt; ARCHIVO DE MISIONES</span>
          <h2 id="history-title">Expediciones pasadas</h2>
          <p>
            {directoryName
              ? `Carpeta vinculada: ${directoryName}`
              : "Vincula una carpeta para consultar los CSV archivados."}
          </p>
        </div>
        <button
          className="button button--primary"
          type="button"
          onClick={onChooseDirectory}
        >
          {directoryName ? "CAMBIAR CARPETA" : "ELEGIR CARPETA"}
        </button>
      </div>

      {error && (
        <p className="history__message warn" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <div className="history__empty" role="status">
          Leyendo expediciones...
        </div>
      ) : entries.length ? (
        <div className="scroll">
          <table className="history__table">
            <thead>
              <tr>
                <th>Expedición / archivo CSV</th>
                <th>Fecha / hora según nombre</th>
                <th>Carpeta</th>
                <th>Tamaño</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={`${entry.folderName}/${entry.fileName}`}>
                  <td>
                    <span className="history__file-icon">[CSV]</span>
                    {entry.fileName}
                  </td>
                  <td>{formatArchiveTimestamp(entry.telemetryDate)}</td>
                  <td>{entry.folderName}</td>
                  <td>{formatFileSize(entry.size)}</td>
                  <td>
                    <button
                      className="history__open"
                      type="button"
                      onClick={() => onOpenFlight(entry)}
                    >
                      ABRIR →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="history__empty">
          <span className="empty-state__icon" aria-hidden="true">
            {"{ }"}
          </span>
          <strong>No hay expediciones archivadas</strong>
          <span>
            Los CSV se guardan automáticamente dentro de una subcarpeta con la
            fecha de telemetría.
          </span>
        </div>
      )}
      <p className="history__footnote">
        Las fechas se extraen del nombre del CSV cuando sigue el formato
        YYYYMMDD_HHMMSS.
      </p>
    </section>
  );
}

function formatFileSize(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
