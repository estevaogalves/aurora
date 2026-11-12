/**
 * Conteúdo dos comprovantes no modo sem conta (só neste navegador): IndexedDB, porque o localStorage não comporta
 * arquivos. Os dados do comprovante (nome, tipo, tamanho) ficam junto dos demais dados do app; aqui só os bytes.
 */
const DB_NAME = "aurora-receipts";
const STORE = "files";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("Este navegador não guarda arquivos."));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error("Não foi possível guardar o arquivo neste navegador."));
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(new Error("Não foi possível ler ou guardar o arquivo neste navegador."));
    });
  } finally {
    db.close();
  }
}

export const putReceiptFile = (id: string, data: ArrayBuffer) => run("readwrite", (s) => s.put(data, id)).then(() => undefined);
export const getReceiptFile = (id: string) => run<ArrayBuffer | undefined>("readonly", (s) => s.get(id));
export const deleteReceiptFile = (id: string) => run("readwrite", (s) => s.delete(id)).then(() => undefined);
