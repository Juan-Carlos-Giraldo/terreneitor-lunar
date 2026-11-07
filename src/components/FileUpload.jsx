import { useRef, useState } from "react";

export default function FileUpload({
  message,
  isError,
  onFile,
  directoryName,
  onChooseDirectory,
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  function chooseFile(file) {
    if (file) onFile(file);
  }

  return (
    <section
      className={`upload card${dragging ? " upload--dragging" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        chooseFile(event.dataTransfer.files[0]);
      }}
      aria-label="Carga de archivo CSV"
    >
      <div className="upload__prompt">
        <span className="upload__icon" aria-hidden="true">
          [ CSV ]
        </span>
        <div className="note">&gt; CARGAR DATOS DEL VUELO</div>
        <h2>Inyectar telemetría</h2>
        <p>Arrastra tu archivo aquí o selecciónalo desde el equipo.</p>
        <button
          className="button button--primary"
          type="button"
          onClick={() =>
            directoryName ? inputRef.current?.click() : onChooseDirectory()
          }
        >
          {directoryName ? "SELECCIONAR ARCHIVO" : "ELEGIR CARPETA DE ARCHIVO"}
        </button>
        <input
          ref={inputRef}
          className="upload__input"
          type="file"
          accept=".csv,text/csv"
          aria-label="Seleccionar archivo CSV"
          onChange={(event) => {
            chooseFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <span className="upload__format">
          {directoryName
            ? `ARCHIVO: ${directoryName} / AAAA-MM-DD`
            : "SELECCIONA LA CARPETA DONDE SE GUARDARÁN LOS CSV"}
        </span>
        <div className={`upload__message${isError ? " warn" : ""}`} role="status" aria-live="polite">
          {message || "Esperando archivo de misión..."}
        </div>
      </div>
      <div className="upload__side" aria-hidden="true">
        <div className="screen">
          <span>FLIGHT DATA LINK</span>
          <span>----------------</span>
          <span>STATUS: STANDBY</span>
          <span>PORT: LOCAL</span>
          <span>AWAITING INPUT_</span>
        </div>
        <div className="upload__serial">TL / FLIGHT RECORDER / 0001</div>
      </div>
    </section>
  );
}
