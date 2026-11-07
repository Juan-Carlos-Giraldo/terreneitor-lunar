const DATABASE_NAME = "terreneitor-lunar-archive";
const STORE_NAME = "settings";
const DIRECTORY_KEY = "archive-directory";

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storeDirectoryHandle(handle) {
  const database = await openDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(handle, DIRECTORY_KEY);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
  database.close();
}

export async function getSavedDirectory() {
  const database = await openDatabase();
  const handle = await new Promise((resolve, reject) => {
    const request = database
      .transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .get(DIRECTORY_KEY);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return handle;
}

export async function chooseArchiveDirectory() {
  if (!("showDirectoryPicker" in window)) {
    throw new Error(
      "Este navegador no permite elegir carpetas. Usa una versión reciente de Chrome o Edge.",
    );
  }
  const handle = await window.showDirectoryPicker({
    id: "terreneitor-lunar-archive",
    mode: "readwrite",
  });
  await storeDirectoryHandle(handle);
  return handle;
}

export async function ensureDirectoryPermission(handle) {
  const options = { mode: "readwrite" };
  if ((await handle.queryPermission(options)) === "granted") return true;
  return (await handle.requestPermission(options)) === "granted";
}

export function telemetryTimestampFromName(name) {
  const match = name.match(
    /(?:^|[^\d])(\d{4})(\d{2})(\d{2})(?:[_-]?(\d{2})(\d{2})(\d{2}))?/,
  );
  if (!match) return null;

  const [, year, month, day, hour = "00", minute = "00", second = "00"] = match;
  const timestamp = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  if (
    timestamp.getFullYear() !== Number(year) ||
    timestamp.getMonth() !== Number(month) - 1 ||
    timestamp.getDate() !== Number(day) ||
    Number(hour) > 23 ||
    Number(minute) > 59 ||
    Number(second) > 59
  ) {
    return null;
  }
  return timestamp;
}

export function telemetryDateFromCsv(value) {
  if (!value) return null;
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    return new Date(
      Number(dateOnly[1]),
      Number(dateOnly[2]) - 1,
      Number(dateOnly[3]),
    );
  }
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp;
}

export function formatDateFolder(timestamp) {
  if (!timestamp) return "fecha-desconocida";
  const pad = (value) => String(value).padStart(2, "0");
  return `${timestamp.getFullYear()}-${pad(timestamp.getMonth() + 1)}-${pad(timestamp.getDate())}`;
}

export function formatArchiveTimestamp(timestamp) {
  if (!timestamp) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

export async function saveFlightCsv(handle, file, telemetryDate) {
  const folderName = formatDateFolder(telemetryDate);
  const dateDirectory = await handle.getDirectoryHandle(folderName, {
    create: true,
  });
  const names = new Set();
  for await (const [name, entry] of dateDirectory.entries()) {
    if (entry.kind === "file") names.add(name);
  }
  const dot = file.name.lastIndexOf(".");
  const stem = dot > 0 ? file.name.slice(0, dot) : file.name;
  const extension = dot > 0 ? file.name.slice(dot) : "";
  let fileName = file.name;
  let duplicate = 2;
  while (names.has(fileName)) {
    fileName = `${stem}__${duplicate}${extension}`;
    duplicate += 1;
  }
  const fileHandle = await dateDirectory.getFileHandle(fileName, {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  await writable.write(file);
  await writable.close();
  return { folderName, fileName };
}

export async function listArchivedCsvs(handle) {
  const entries = [];
  for await (const [folderName, directory] of handle.entries()) {
    if (directory.kind !== "directory") continue;
    for await (const [fileName, fileHandle] of directory.entries()) {
      if (fileHandle.kind !== "file" || !fileName.toLowerCase().endsWith(".csv")) {
        continue;
      }
      const file = await fileHandle.getFile();
      const telemetryDate =
        telemetryTimestampFromName(fileName) ??
        telemetryDateFromCsv(folderName) ??
        new Date(file.lastModified);
      entries.push({
        folderName,
        fileName,
        fileHandle,
        telemetryDate,
        modifiedAt: new Date(file.lastModified),
        size: file.size,
      });
    }
  }
  return entries.sort(
    (first, second) => second.telemetryDate - first.telemetryDate,
  );
}
