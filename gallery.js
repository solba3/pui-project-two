// Shows the saved pieces as a grid or a carousel, in the chosen order.

const gridView = document.getElementById('grid-view');
const carouselView = document.getElementById('carousel-view');
const catalogueView = document.getElementById('catalogue-view');
const VIEWS = { grid: gridView, carousel: carouselView, catalogue: catalogueView };
let activeView = 'grid';
const pieceGrid = document.getElementById('piece-grid');
const sortSelect = document.getElementById('sort-order');
const archiveMessage = document.getElementById('archive-message');
const viewButtons = document.querySelectorAll('.view-toggle button');

let allPieces = [];     // every saved piece, sorted in the current order
let pieces = [];        // the pieces being shown: all of them, or one person's
let personFilter = new URLSearchParams(location.search).get('person') || ''; // name shown, or '' for all
let imageUrls = new Map(); // piece id -> URL for its stored image
let carouselIndex = 0;  // which piece the carousel is showing

function compareText(a, b) {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

// The day a piece was collected, as YYYY-MM-DD. Pieces saved before the
// collected date was asked for use the day they were added instead.
function collectedDate(piece) {
  if (piece.dateCollected) return piece.dateCollected;
  const added = new Date(piece.dateAdded);
  const month = String(added.getMonth() + 1).padStart(2, '0');
  const day = String(added.getDate()).padStart(2, '0');
  return `${added.getFullYear()}-${month}-${day}`;
}

// YYYY-MM-DD and ISO date strings both order by date when compared as text.
// Pieces collected on the same day are ordered by when they were added, and
// the id breaks ties between pieces saved in the same millisecond.
function newestFirst(a, b) {
  return collectedDate(b).localeCompare(collectedDate(a))
    || b.dateAdded.localeCompare(a.dateAdded)
    || b.id - a.id;
}

const SORT_ORDERS = {
  newest: newestFirst,
  oldest: (a, b) => newestFirst(b, a),
  title: (a, b) => compareText(a.title, b.title) || newestFirst(a, b),
  person: (a, b) => compareText(a.person, b.person) || newestFirst(a, b),
};

// Shows a YYYY-MM-DD date like "May 3, 2024". The parts are read directly,
// because new Date("2024-05-03") means midnight UTC, which is the day
// before in time zones west of UTC.
function formatDate(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Names that differ only in capitals belong to the same person.
function personKey(name) {
  return name.toLowerCase();
}

// Sorts every piece, then picks out the ones being shown.
function sortAndFilterPieces() {
  allPieces.sort(SORT_ORDERS[sortSelect.value]);
  const key = personKey(personFilter);
  pieces = personFilter ? allPieces.filter((piece) => personKey(piece.person) === key) : allPieces.slice();
}

function renderGrid() {
  pieceGrid.replaceChildren();

  pieces.forEach((piece, index) => {
    const item = document.createElement('li');

    // Selecting a piece opens it in the carousel.
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'piece-tile';
    tile.addEventListener('click', () => {
      carouselIndex = index;
      showView('carousel');
    });

    const frame = document.createElement('span');
    frame.className = 'piece-frame';
    const image = document.createElement('img');
    fitInSquare(image);
    image.src = imageUrls.get(piece.id);
    image.alt = piece.title;
    frame.append(image);

    const title = document.createElement('span');
    title.className = 'piece-title';
    title.textContent = piece.title;

    const details = document.createElement('span');
    details.className = 'piece-details';
    details.textContent = `${piece.person} · ${formatDate(collectedDate(piece))}`;

    tile.append(frame, title, details);
    item.append(tile);
    pieceGrid.append(item);
  });
}

function renderCarousel() {
  const piece = pieces[carouselIndex];
  if (!piece) return;

  document.getElementById('carousel-title').textContent = piece.title;
  document.getElementById('carousel-person').textContent = piece.person;

  const image = document.getElementById('carousel-image');
  image.src = imageUrls.get(piece.id);
  image.alt = piece.title;

  // Peek at the neighbouring pieces, unless this is the only one.
  const hasNeighbours = pieces.length > 1;
  setPeek(peekPrev, hasNeighbours ? pieces[wrapIndex(carouselIndex - 1)] : null);
  setPeek(peekNext, hasNeighbours ? pieces[wrapIndex(carouselIndex + 1)] : null);

  document.getElementById('carousel-description').textContent = piece.description;
  document.getElementById('carousel-details').textContent =
    `Collected ${formatDate(collectedDate(piece))} · ${carouselIndex + 1} of ${pieces.length}`;
}

// Turns any step past either end into a position that wraps around.
function wrapIndex(index) {
  return (index + pieces.length) % pieces.length;
}

// Shows a neighbouring piece in a sneak-peek square, or hides the square
// (keeping its space, so the main image stays centered) when there is none.
function setPeek(peek, piece) {
  peek.style.visibility = piece ? 'visible' : 'hidden';
  if (piece) peek.querySelector('img').src = imageUrls.get(piece.id);
}

// Move through the carousel, wrapping around at either end.
function moveCarousel(step) {
  if (pieces.length === 0) return;
  carouselIndex = wrapIndex(carouselIndex + step);
  renderCarousel();
  swingInMainImage(Math.sign(step));
}

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// The new main image swings in from the side its sneak peek was on (1 for
// next, -1 for previous), starting at the peek's 3D angle and unfolding into
// the centre. Nothing else in the carousel animates when switching pieces.
function swingInMainImage(direction) {
  if (reduceMotion.matches) return;

  // Stop any swing still playing, so clicking quickly never leaves one half-finished.
  carouselFrame.getAnimations().forEach((animation) => animation.cancel());
  carouselFrame.animate(
    [
      {
        opacity: 0.5,
        transform: `perspective(800px) translateX(${direction * 60}%) rotateY(${direction * -40}deg) scale(0.55)`,
      },
      { opacity: 1, transform: 'none' },
    ],
    { duration: 600, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' } // same easing as the float-in
  );
}

// Marks a picture taller than it is wide, so it fills its square's height
// instead of its width.
function fitInSquare(image) {
  image.addEventListener('load', () => {
    image.classList.toggle('is-tall', image.naturalHeight > image.naturalWidth);
  });
}

// The view is kept in the address (#carousel or #catalogue), so a refresh stays on it.
function showView(view) {
  activeView = view;
  const hash = view === 'grid' ? '' : `#${view}`;
  history.replaceState(null, '', location.pathname + location.search + hash);

  viewButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.view === view));
  });

  // The catalogue orders books by name; the other views order pieces.
  document.getElementById('sort-order-control').hidden = view === 'catalogue';
  document.getElementById('catalogue-order-control').hidden = view !== 'catalogue';

  if (allPieces.length === 0) return;
  Object.entries(VIEWS).forEach(([name, section]) => {
    section.hidden = name !== view;
  });
  if (view === 'carousel') renderCarousel();
  updateFilterStatus();
}

function currentView() {
  const view = location.hash.slice(1);
  return view in VIEWS ? view : 'grid';
}

function showMessage(html) {
  archiveMessage.innerHTML = html;
  archiveMessage.hidden = false;
  Object.values(VIEWS).forEach((section) => {
    section.hidden = true;
  });
}

viewButtons.forEach((button) => {
  button.addEventListener('click', () => showView(button.dataset.view));
});

sortSelect.addEventListener('change', () => {
  sortAndFilterPieces();
  carouselIndex = 0;
  renderGrid();
  renderCarousel();
});

document.getElementById('carousel-prev').addEventListener('click', () => moveCarousel(-1));
document.getElementById('carousel-next').addEventListener('click', () => moveCarousel(1));

// Clicking a sneak peek moves to that piece.
const peekPrev = document.getElementById('carousel-peek-prev');
const peekNext = document.getElementById('carousel-peek-next');
const carouselFrame = document.querySelector('.carousel-frame');

// The carousel's images change source as it moves; each new picture is fitted.
[
  document.getElementById('carousel-image'),
  peekPrev.querySelector('img'),
  peekNext.querySelector('img'),
].forEach(fitInSquare);
peekPrev.addEventListener('click', () => moveCarousel(-1));
peekNext.addEventListener('click', () => moveCarousel(1));

// Left and right arrow keys also move the carousel.
document.addEventListener('keydown', (event) => {
  if (carouselView.hidden || event.target.closest('select, input, textarea')) return;
  if (event.key === 'ArrowLeft') moveCarousel(-1);
  if (event.key === 'ArrowRight') moveCarousel(1);
});

async function loadArchive() {
  try {
    allPieces = await getAllPieces();
  } catch (error) {
    showMessage('The archive could not be loaded in this browser.');
    return;
  }

  if (allPieces.length === 0) {
    showMessage('No pieces yet. <a href="submit.html">Add your first piece.</a>');
    return;
  }

  imageUrls = new Map(allPieces.map((piece) => [piece.id, URL.createObjectURL(piece.image)]));

  // A name in the address that no longer has pieces shows everything instead.
  if (!allPieces.some((piece) => personKey(piece.person) === personKey(personFilter))) {
    personFilter = '';
  }

  sortAndFilterPieces();
  renderGrid();
  renderPeopleNav();
  renderCatalogue();
  updateFilterStatus();
  setUpPeopleToggle();
  showView(currentView());
}

// ---------------------------------------------------------------------------
// People sidebar: everyone in the archive, A-Z, with how many pieces each has.
// Choosing a name shows only that person's pieces in the grid and carousel.

const peopleToggle = document.getElementById('people-toggle');
const peopleList = document.getElementById('people-list');
const filterStatus = document.getElementById('filter-status');
const wideScreen = window.matchMedia('(min-width: 900px)');
const PEOPLE_OPEN_KEY = 'archive-people-open';

// Each person once, using the spelling of their first piece, with a count.
function getPeople() {
  const people = new Map();
  [...allPieces]
    .sort((a, b) => a.dateAdded.localeCompare(b.dateAdded))
    .forEach((piece) => {
      const key = personKey(piece.person);
      if (people.has(key)) {
        people.get(key).count += 1;
      } else {
        people.set(key, { name: piece.person, count: 1 });
      }
    });
  return [...people.values()].sort((a, b) => compareText(a.name, b.name));
}

function renderPeopleNav() {
  const entries = [{ name: '', label: 'All pieces', count: allPieces.length }]
    .concat(getPeople().map((person) => ({ ...person, label: person.name })));

  peopleList.replaceChildren(...entries.map((entry) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${entry.label} (${entry.count})`;
    if (personKey(entry.name) === personKey(personFilter)) button.setAttribute('aria-current', 'true');
    button.addEventListener('click', () => choosePerson(entry.name));
    item.append(button);
    return item;
  }));
}

function updateFilterStatus() {
  // The catalogue always shows everyone, so the filter line doesn't apply there.
  filterStatus.hidden = !personFilter || activeView === 'catalogue';
  if (personFilter) {
    const count = pieces.length;
    filterStatus.textContent = `Showing ${count} ${count === 1 ? 'piece' : 'pieces'} for ${pieces[0].person}.`;
  }
}

// The chosen person is kept in the address (?person=...), so a refresh keeps it.
function choosePerson(name) {
  personFilter = name;
  const search = name ? `?person=${encodeURIComponent(name)}` : '';
  history.replaceState(null, '', location.pathname + search + location.hash);

  sortAndFilterPieces();
  carouselIndex = 0;
  renderGrid();
  renderCarousel();
  renderPeopleNav();
  updateFilterStatus();

  // On a narrow screen the sidebar covers the pieces, so close it.
  if (!wideScreen.matches) setPeopleOpen(false);
}

// ---------------------------------------------------------------------------
// Catalogue: a shelf of books, one album per person, A-Z or Z-A. A book is wider the
// more pieces its person has, and opening it shows their pieces in the grid.

const bookshelf = document.getElementById('bookshelf');
const catalogueOrder = document.getElementById('catalogue-order');

function renderCatalogue() {
  const people = getPeople(); // A-Z
  if (catalogueOrder.value === 'za') people.reverse();

  bookshelf.replaceChildren(...people.map((person) => {
    const item = document.createElement('li');

    const book = document.createElement('button');
    book.type = 'button';
    book.className = 'book';
    book.style.setProperty('--pieces', person.count); // sets the width in style.css
    book.setAttribute('aria-label', `${person.name}, ${person.count} ${person.count === 1 ? 'piece' : 'pieces'}`);
    book.title = person.name; // shows the full name if a long one is cut off

    const label = document.createElement('span');
    label.className = 'book-label';
    label.textContent = person.name;

    book.append(label);
    book.addEventListener('click', () => {
      choosePerson(person.name);
      showView('grid');
    });

    item.append(book);
    return item;
  }));
}

catalogueOrder.addEventListener('change', renderCatalogue);

function setPeopleOpen(open) {
  document.body.classList.toggle('people-open', open);
  peopleToggle.setAttribute('aria-expanded', String(open));
  peopleToggle.textContent = open ? 'Hide people' : 'Show people';
}

// Open or closed is remembered; the first visit opens it on wide screens only.
function setUpPeopleToggle() {
  let saved = null;
  try {
    saved = localStorage.getItem(PEOPLE_OPEN_KEY);
  } catch (error) {
    // Storage can be unavailable (such as in a private window); use the default.
  }

  // Apply the starting state without sliding, so the page doesn't shift on load.
  document.body.classList.add('people-no-slide');
  setPeopleOpen(saved === null ? wideScreen.matches : saved === 'true');
  peopleToggle.hidden = false;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => document.body.classList.remove('people-no-slide'));
  });
}

peopleToggle.addEventListener('click', () => {
  const open = !document.body.classList.contains('people-open');
  setPeopleOpen(open);
  try {
    localStorage.setItem(PEOPLE_OPEN_KEY, String(open));
  } catch (error) {
    // Not remembering is fine.
  }
});

loadArchive();
