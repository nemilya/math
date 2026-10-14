// The child's own voice: explanations, ideas and questions.
// "Mathematics is the art of explanation" — so explaining out loud is the main
// thing a child produces here. Recordings stay in this browser (IndexedDB) and
// are never uploaded anywhere.

const DB = 'lumo';
const STORE = 'voices';
let dbp = null;

function db() {
  return (dbp ??= new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }));
}

async function tx(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
}

export const voices = {
  async save(star, blob) {
    const rec = { id: `${star}@${Date.now()}`, star, blob, at: Date.now() };
    await tx('readwrite', (s) => s.put(rec));
    return rec;
  },
  async all() {
    try {
      return ((await tx('readonly', (s) => s.getAll())) || []).sort((a, b) => a.at - b.at);
    } catch {
      return [];
    }
  },
  async list(star) {
    return (await voices.all()).filter((r) => r.star === star);
  },
  async remove(id) {
    await tx('readwrite', (s) => s.delete(id));
  },
};

let stream = null;
let rec = null;
let chunks = [];

export const mic = {
  supported: () => !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder && window.indexedDB),

  async start() {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find(
      (t) => MediaRecorder.isTypeSupported?.(t),
    );
    rec = new MediaRecorder(stream, type ? { mimeType: type } : {});
    chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.start();
  },

  stop() {
    return new Promise((resolve) => {
      if (!rec || rec.state === 'inactive') return resolve(null);
      rec.onstop = () => {
        mic.release();
        resolve(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
      };
      rec.stop();
    });
  },

  release() {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
  },

  cancel() {
    if (rec && rec.state !== 'inactive') {
      rec.onstop = null;
      rec.stop();
    }
    mic.release();
  },
};

export function playBlob(blob, signal) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const a = new Audio(url);
    const done = () => {
      a.pause();
      URL.revokeObjectURL(url);
      signal?.removeEventListener('abort', done);
      resolve();
    };
    a.onended = done;
    a.onerror = done;
    signal?.addEventListener('abort', done);
    a.play().catch(done);
  });
}
