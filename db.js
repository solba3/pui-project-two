// Saves and loads archive pieces using the browser's IndexedDB storage.
// IndexedDB can hold full-size images, unlike localStorage (about 5MB).
const DB_NAME = 'archive';
const STORE_NAME = 'pieces';

function openArchive() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Saves one piece: { title, person, description, image (a File), dateAdded }.
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
