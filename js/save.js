/* save.js ── 記録はIndexedDB、設定はlocalStorage */
const DB_NAME = 'solgrave';
const DB_VER = 1;
const STORE = 'records';
let _db = null;

function open() {
  if (_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    const rq = indexedDB.open(DB_NAME, DB_VER);
    rq.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const st = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        st.createIndex('at', 'at');
      }
    };
    rq.onsuccess = () => { _db = rq.result; res(_db); };
    rq.onerror = () => rej(rq.error || new Error('記録を開けません'));
  });
}
function wrap(rq) {
  return new Promise((res, rej) => {
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error || new Error('記録の操作に失敗'));
  });
}

export const Save = {
  async add(rec) {
    const db = await open();
    const st = db.transaction(STORE, 'readwrite').objectStore(STORE);
    return wrap(st.put(Object.assign({ at: Date.now() }, rec)));
  },
  async all() {
    const db = await open();
    const st = db.transaction(STORE, 'readonly').objectStore(STORE);
    const rows = await wrap(st.getAll());
    rows.sort((a, b) => b.at - a.at);
    return rows.slice(0, 50);
  },
  async clear() {
    const db = await open();
    const st = db.transaction(STORE, 'readwrite').objectStore(STORE);
    return wrap(st.clear());
  }
};

const CFG_KEY = 'solgrave_cfg';
const DEFAULT_CFG = {
  quality: 'mid', volume: 60, mute: false,
  practice: false, manual: 70, allowCamera: null
};
export const Config = {
  load() {
    try {
      const raw = localStorage.getItem(CFG_KEY);
      return Object.assign({}, DEFAULT_CFG, raw ? JSON.parse(raw) : {});
    } catch (e) { return Object.assign({}, DEFAULT_CFG); }
  },
  save(cfg) {
    try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch (e) {}
  }
};
