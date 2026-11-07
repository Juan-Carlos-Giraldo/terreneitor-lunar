import { useEffect, useState } from "react";
import Header from "./components/Header.jsx";
import FileUpload from "./components/FileUpload.jsx";
import Tabs from "./components/Tabs.jsx";
import ResumenView from "./views/ResumenView.jsx";
import AnalisisView from "./views/AnalisisView.jsx";
import HistoryView from "./views/HistoryView.jsx";
import {
  chooseArchiveDirectory,
  ensureDirectoryPermission,
  getSavedDirectory,
  listArchivedCsvs,
  saveFlightCsv,
  telemetryDateFromCsv,
  telemetryTimestampFromName,
} from "./utils/archive.js";
import { analyze, parseCSV } from "./utils/csv.js";

export default function App() {
  const [data, setData] = useState(null);
  const [view, setView] = useState("dashboard");
  const [activeTab, setActiveTab] = useState("resumen");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [directoryHandle, setDirectoryHandle] = useState(null);
  const [directoryReady, setDirectoryReady] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyError, setHistoryError] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    let active = true;
    getSavedDirectory()
      .then(async (handle) => {
        if (!active || !handle) return;
        setDirectoryHandle(handle);
        const permission =
          (await handle.queryPermission({ mode: "readwrite" })) === "granted";
        if (!active) return;
        setDirectoryReady(permission);
        if (permission) setHistory(await listArchivedCsvs(handle));
      })
      .catch((error) => {
        if (active) setHistoryError(`No se pudo recuperar el archivo: ${error.message}`);
      });
    return () => {
      active = false;
    };
  }, []);

  async function refreshHistory(handle = directoryHandle) {
    if (!handle) {
      setHistory([]);
      return;
    }
    setHistoryLoading(true);
    setHistoryError("");
    try {
      setHistory(await listArchivedCsvs(handle));
    } catch (error) {
      setHistoryError(`No se pudo leer la carpeta: ${error.message}`);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleChooseDirectory() {
    setIsError(false);
    try {
      let handle = directoryHandle;
      const permission = handle
        ? await ensureDirectoryPermission(handle)
        : false;
      if (!permission) handle = await chooseArchiveDirectory();
      setDirectoryHandle(handle);
      setDirectoryReady(true);
      await refreshHistory(handle);
      setMessage(`Carpeta de archivo vinculada: ${handle.name}`);
    } catch (error) {
      if (error.name === "AbortError") return;
      setIsError(true);
      setMessage(`Error al seleccionar la carpeta: ${error.message}`);
      setHistoryError(`No se pudo acceder a la carpeta: ${error.message}`);
    }
  }

  async function handleNavigate(nextView) {
    setView(nextView);
    if (nextView !== "history" || !directoryHandle) return;
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const permission = await ensureDirectoryPermission(directoryHandle);
      if (!permission) {
        setDirectoryReady(false);
        setHistoryError("Concede acceso a la carpeta para consultar las expediciones.");
        return;
      }
      setDirectoryReady(true);
      await refreshHistory(directoryHandle);
    } catch (error) {
      setHistoryError(`No se pudo consultar el archivo: ${error.message}`);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleFile(file) {
    setIsError(false);
    setMessage(`Leyendo ${file.name}...`);

    try {
      if (!directoryHandle) {
        throw new Error("elige una carpeta de archivo antes de cargar el CSV.");
      }
      if (!directoryReady && !(await ensureDirectoryPermission(directoryHandle))) {
        setDirectoryReady(false);
        throw new Error("concede acceso a la carpeta para guardar la expedición.");
      }
      const { rows, skipped } = parseCSV(await file.text());
      const summary = analyze(rows);
      const telemetryDate =
        telemetryTimestampFromName(file.name) ??
        telemetryDateFromCsv(summary.date) ??
        new Date(file.lastModified);
      const saved = await saveFlightCsv(directoryHandle, file, telemetryDate);
      setData(summary);
      setView("dashboard");
      setActiveTab("resumen");
      setDirectoryReady(true);
      await refreshHistory(directoryHandle);
      setMessage(
        `> Guardado en ${saved.folderName}/${saved.fileName}${skipped ? ` · ${skipped} filas inválidas omitidas` : ""}`,
      );
    } catch (error) {
      setIsError(true);
      setMessage(`Error: ${error.message}`);
    }
  }

  async function handleOpenFlight(entry) {
    setIsError(false);
    setMessage(`Leyendo ${entry.fileName}...`);
    try {
      const file = await entry.fileHandle.getFile();
      const { rows, skipped } = parseCSV(await file.text());
      setData(analyze(rows));
      setView("dashboard");
      setActiveTab("resumen");
      setMessage(
        `> Expedición ${entry.fileName} cargada${skipped ? ` · ${skipped} filas inválidas omitidas` : ""}`,
      );
    } catch (error) {
      setHistoryError(`No se pudo abrir ${entry.fileName}: ${error.message}`);
    }
  }

  return (
    <main className="shell">
      <Header view={view} onNavigate={handleNavigate} />

      {view === "history" ? (
        <HistoryView
          directoryName={directoryHandle?.name}
          entries={history}
          error={historyError}
          loading={historyLoading}
          onChooseDirectory={handleChooseDirectory}
          onOpenFlight={handleOpenFlight}
        />
      ) : (
        <>
          <FileUpload
            message={message}
            isError={isError}
            onFile={handleFile}
            directoryName={directoryReady ? directoryHandle?.name : null}
            onChooseDirectory={handleChooseDirectory}
          />
          {data ? (
            <>
              <Tabs
                activeTab={activeTab}
                onChange={setActiveTab}
                options={[
                  ["resumen", "Resumen"],
                  ["analisis", "Análisis"],
                ]}
              />
              {activeTab === "resumen" ? (
                <ResumenView data={data} />
              ) : (
                <AnalisisView data={data} />
              )}
            </>
          ) : (
            <section className="empty-state card" aria-live="polite">
              <span className="empty-state__icon" aria-hidden="true">
                {">_"}
              </span>
              <h2>Esperando telemetría</h2>
              <p>
                Elige una carpeta de archivo y carga un CSV para iniciar el análisis.
                <br />
                Los archivos se guardan en subcarpetas por fecha de telemetría.
              </p>
              <span className="note">
                {directoryReady
                  ? `ARCHIVO VINCULADO · ${directoryHandle?.name}`
                  : "SISTEMA EN ESPERA · CARPETA DE ARCHIVO NO VINCULADA"}
              </span>
            </section>
          )}
        </>
      )}
      <footer className="footer">TERRENEITOR LUNAR · SISTEMA DE TELEMETRÍA</footer>
    </main>
  );
}
