// Saves and loads archive pieces using the browser's IndexedDB storage.
// IndexedDB can hold full-size images, unlike localStorage (about 5MB).
const DB_NAME = 'archive';
const STORE_NAME = 'pieces';
const PEOPLE_STORE = 'people'; // each person's color, by lowercase name

// Version 2 added the people store; archives made with version 1 keep their
// pieces and gain the new store.
function openArchive() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(PEOPLE_STORE)) {
        db.createObjectStore(PEOPLE_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Saves one piece: { title, people (a list of names), descriptions ({ name:
// why it reminds the user of them }), image (a File), dateCollected
// (YYYY-MM-DD), dateAdded (when it was submitted) }.
async function savePiece(piece) {
  const db = await openArchive();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).add(piece);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

// Saves changes to a piece that is already in the archive.
async function updatePiece(piece) {
  const db = await openArchive();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(piece);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

// The people a piece is tagged with. Pieces saved before several people could
// be tagged have a single "person" instead of a "people" list.
function getPiecePeople(piece) {
  if (Array.isArray(piece.people)) return piece.people;
  return piece.person ? [piece.person] : [];
}

// A piece's descriptions as [{ person, text }], in the order its people were
// tagged. Pieces saved before each person had their own description have one
// "description" for everyone, returned as a single entry with person: null.
function getPieceDescriptions(piece) {
  if (piece.descriptions) {
    return getPiecePeople(piece).map((person) => ({ person, text: piece.descriptions[person] || '' }));
  }
  return [{ person: null, text: piece.description || '' }];
}

// The color chosen for each person, as a Map of lowercase name -> "#rrggbb".
// People with no color saved are missing from it.
async function getPersonColors() {
  const db = await openArchive();
  return new Promise((resolve, reject) => {
    const request = db.transaction(PEOPLE_STORE, 'readonly').objectStore(PEOPLE_STORE).getAll();
    request.onsuccess = () => {
      db.close();
      resolve(new Map(request.result.map((person) => [person.key, person.color])));
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

// Saves colors given as { name: "#rrggbb" }, replacing any saved before.
async function savePersonColors(colors) {
  const db = await openArchive();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PEOPLE_STORE, 'readwrite');
    const store = transaction.objectStore(PEOPLE_STORE);
    Object.entries(colors).forEach(([name, color]) => {
      store.put({ key: name.toLowerCase(), name, color });
    });
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

// Returns every saved piece, in no particular order.
async function getAllPieces() {
  const db = await openArchive();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
    request.onsuccess = () => {
      db.close();
      resolve(request.result);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

// Returns the names of everyone pieces have been saved for, A-Z, each once.
// Names that differ only in capitals count as one, using the first spelling saved.
async function getSavedPersonNames() {
  const pieces = await getAllPieces();
  pieces.sort((a, b) => a.dateAdded.localeCompare(b.dateAdded));

  const names = new Map();
  pieces.forEach((piece) => {
    getPiecePeople(piece).forEach((name) => {
      const key = name.toLowerCase();
      if (!names.has(key)) names.set(key, name);
    });
  });

  return [...names.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}
