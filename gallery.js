// Shows the saved pieces as a grid, carousel, catalogue or floating view.

const gridView = document.getElementById('grid-view');
const carouselView = document.getElementById('carousel-view');
const catalogueView = document.getElementById('catalogue-view');
const floatingView = document.getElementById('floating-view');
const VIEWS = { grid: gridView, carousel: carouselView, catalogue: catalogueView, floating: floatingView };
let activeView = 'grid';
const pieceGrid = document.getElementById('piece-grid');
const sortSelect = document.getElementById('sort-order');
const archiveMessage = document.getElementById('archive-message');
const viewButtons = document.querySelectorAll('.view-toggle button');

let allPieces = [];     // every saved piece, sorted in the current order
let pieces = [];        // the pieces being shown: all of them, or one person's
let personFilter = new URLSearchParams(location.search).get('person') || ''; // name shown, or '' for all
let imageUrls = new Map(); // piece id -> URL for its stored image
let personColors = new Map(); // lowercase name -> the color chosen for that person
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
  person: (a, b) => compareText(peopleSortKey(a), peopleSortKey(b)) || newestFirst(a, b),
};

// Pieces tagged with several people sort by their names in A-Z order.
function peopleSortKey(piece) {
  return [...getPiecePeople(piece)].sort(compareText).join(', ');
}

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

function isTaggedWith(piece, name) {
  const key = personKey(name);
  return getPiecePeople(piece).some((person) => personKey(person) === key);
}

// Sorts every piece, then picks out the ones being shown.
function sortAndFilterPieces() {
  allPieces.sort(SORT_ORDERS[sortSelect.value]);
  pieces = personFilter ? allPieces.filter((piece) => isTaggedWith(piece, personFilter)) : allPieces.slice();
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
    details.append(namesWithColors(getPiecePeople(piece), personColors), ` · ${formatDate(collectedDate(piece))}`);

    tile.append(frame, title, details);
    item.append(tile);
    pieceGrid.append(item);
  });
}

function renderCarousel() {
  const piece = pieces[carouselIndex];
  if (!piece) return;

  document.getElementById('carousel-title').textContent = piece.title;
  document.getElementById('carousel-person').replaceChildren(namesWithColors(getPiecePeople(piece), personColors));

  const image = document.getElementById('carousel-image');
  image.src = imageUrls.get(piece.id);
  image.alt = piece.title;

  // Peek at the neighbouring pieces, unless this is the only one.
  const hasNeighbours = pieces.length > 1;
  setPeek(peekPrev, hasNeighbours ? pieces[wrapIndex(carouselIndex - 1)] : null);
  setPeek(peekNext, hasNeighbours ? pieces[wrapIndex(carouselIndex + 1)] : null);

  renderDescriptions(piece);
  document.getElementById('carousel-details').textContent =
    `Collected ${formatDate(collectedDate(piece))} · ${carouselIndex + 1} of ${pieces.length}`;
}

// One description is shown as it is; with several people, each person's name
// heads what the piece means to them.
function renderDescriptions(piece) {
  const area = document.getElementById('carousel-description');
  const entries = getPieceDescriptions(piece);

  if (entries.length === 1) {
    const text = document.createElement('p');
    text.textContent = entries[0].text;
    area.replaceChildren(text);
    return;
  }

  area.replaceChildren(...entries.flatMap(({ person, text }) => {
    const name = document.createElement('h3');
    name.append(coloredName(person, personColors));
    const words = document.createElement('p');
    words.textContent = text;
    return [name, words];
  }));
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
  if (pieces.length === 0 || editing) return;
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

// The view is kept in the address (#carousel, #catalogue or #floating), so a
// refresh stays on it.
function showView(view) {
  if (editing) stopEditing();
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
  if (view === 'floating') renderFloating();
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
  if (editing) stopEditing();
  sortAndFilterPieces();
  carouselIndex = 0;
  renderGrid();
  renderCarousel();
  renderFloating();
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
  if (carouselView.hidden || editing || event.target.closest('select, input, textarea')) return;
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

  // Without saved colors, names just use the text color.
  try {
    personColors = await getPersonColors();
  } catch (error) {
    personColors = new Map();
  }

  if (allPieces.length === 0) {
    showMessage('No pieces yet. <a href="submit.html">Add your first piece.</a>');
    return;
  }

  imageUrls = new Map(allPieces.map((piece) => [piece.id, URL.createObjectURL(piece.image)]));

  // A name in the address that no longer has pieces shows everything instead.
  if (!allPieces.some((piece) => isTaggedWith(piece, personFilter))) {
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
// A piece tagged with several people counts once for each of them.
function getPeople() {
  const people = new Map();
  [...allPieces]
    .sort((a, b) => a.dateAdded.localeCompare(b.dateAdded))
    .forEach((piece) => {
      getPiecePeople(piece).forEach((name) => {
        const key = personKey(name);
        if (people.has(key)) {
          people.get(key).count += 1;
        } else {
          people.set(key, { name, count: 1 });
        }
      });
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
    if (entry.name) {
      button.append(coloredName(entry.name, personColors), ` (${entry.count})`);
    } else {
      button.textContent = `${entry.label} (${entry.count})`;
    }
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
    const person = getPeople().find((entry) => personKey(entry.name) === personKey(personFilter));
    filterStatus.replaceChildren(
      `Showing ${count} ${count === 1 ? 'piece' : 'pieces'} for `,
      coloredName(person.name, personColors),
      '.',
    );
  }
}

// The chosen person is kept in the address (?person=...), so a refresh keeps it.
function choosePerson(name) {
  if (editing) stopEditing();
  personFilter = name;
  const search = name ? `?person=${encodeURIComponent(name)}` : '';
  history.replaceState(null, '', location.pathname + search + location.hash);

  sortAndFilterPieces();
  carouselIndex = 0;
  renderGrid();
  renderCarousel();
  renderFloating();
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
    label.append(colorDot(), person.name);

    // The name and the outline both take the person's color.
    if (personColors.has(personKey(person.name))) book.style.color = personColors.get(personKey(person.name));

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

// ---------------------------------------------------------------------------
// Editing: in the carousel, a piece's title, people and description can be
// changed. The form takes the place of the text while it is open.

const editButton = document.getElementById('edit-piece');
const editForm = document.getElementById('edit-form');
const editTitle = document.getElementById('edit-title');
const editStatus = document.getElementById('edit-status');
const carouselArrows = [document.getElementById('carousel-prev'), document.getElementById('carousel-next')];
const carouselText = ['carousel-title', 'carousel-person', 'carousel-description', 'carousel-details', 'edit-piece']
  .map((id) => document.getElementById(id));
let editing = false;

const editDescriptions = createDescriptionFields(document.getElementById('edit-descriptions'), {
  idPrefix: 'edit-description',
});
const editPeople = createPeopleField(document.getElementById('edit-people'), {
  inputId: 'edit-person',
  onChange: updateEditDescriptions,
});
document.getElementById('edit-person').setAttribute('aria-describedby', 'edit-person-hint');

// One box for each person tagged.
function updateEditDescriptions() {
  editDescriptions.update(editPeople.getNames(), editPeople.getTypedName());
}

function startEditing() {
  const piece = pieces[carouselIndex];
  if (!piece) return;

  editing = true;
  editTitle.value = piece.title;

  // Each person's box starts with what was written for them. Older pieces have
  // one description for everyone, so each box starts with that.
  const people = getPiecePeople(piece);
  const existing = {};
  getPieceDescriptions(piece).forEach(({ person, text }) => {
    if (person) existing[person] = text;
    else people.forEach((name) => { existing[name] = text; });
  });
  editDescriptions.setDescriptions(existing);

  editPeople.setSavedNames(getPeople().map((person) => person.name));
  editPeople.setSavedColors(personColors);
  editPeople.setNames(people);
  editStatus.textContent = '';

  carouselText.forEach((element) => {
    element.hidden = true;
  });
  carouselArrows.forEach((arrow) => {
    arrow.disabled = true;
  });
  editForm.hidden = false;
  editTitle.focus();
}

function stopEditing() {
  editing = false;
  editForm.hidden = true;
  carouselText.forEach((element) => {
    element.hidden = false;
  });
  carouselArrows.forEach((arrow) => {
    arrow.disabled = false;
  });
}

editButton.addEventListener('click', startEditing);

document.getElementById('edit-cancel').addEventListener('click', () => {
  stopEditing();
  editButton.focus();
});

editForm.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    stopEditing();
    editButton.focus();
  }
});

editForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  // A name still being typed counts, as if Enter had been pressed.
  editPeople.commitTyped();

  const piece = pieces[carouselIndex];
  const people = editPeople.getNames();
  const changes = {
    title: editTitle.value.trim(),
    people,
    descriptions: editDescriptions.getDescriptions(people),
  };

  if (!changes.title || people.length === 0 || Object.values(changes.descriptions).some((text) => !text)) {
    editStatus.textContent = 'Please fill in every field before saving.';
    return;
  }

  // Saved pieces now keep a list of people with a description for each, so
  // the old single name and description go.
  const updated = { ...piece, ...changes };
  delete updated.person;
  delete updated.description;

  editStatus.textContent = 'Saving…';
  const colors = editPeople.getColors();
  try {
    await updatePiece(updated);
    await savePersonColors(colors);
  } catch (error) {
    editStatus.textContent = 'Sorry, the changes could not be saved. Please try again.';
    return;
  }

  // The same object is in allPieces, so every view picks up the changes.
  Object.assign(piece, changes);
  delete piece.person;
  delete piece.description;
  Object.entries(colors).forEach(([name, color]) => personColors.set(personKey(name), color));

  stopEditing();

  // If the piece no longer has the person being shown, show everyone, so the
  // piece just edited stays in view.
  if (personFilter && !isTaggedWith(piece, personFilter)) {
    personFilter = '';
    history.replaceState(null, '', location.pathname + location.hash);
  }

  sortAndFilterPieces();
  carouselIndex = pieces.indexOf(piece);
  renderGrid();
  renderCarousel();
  renderPeopleNav();
  renderCatalogue();
  updateFilterStatus();
  editButton.focus();
});

// ---------------------------------------------------------------------------
// Floating view: pieces scattered loosely over a grid at random sizes (0.75 to
// 1.75 times the usual size), so some overlap and some don't, with lines joining
// pieces that share a person. Each piece drifts gently around its spot, and can
// be dragged somewhere else (or moved with the arrow keys) for the rest of the
// visit; reloading the page scatters them afresh.

const floatingField = document.getElementById('floating-field');
const floatingLines = document.getElementById('floating-lines');
const floatingLooks = new Map(); // piece id -> its random size, nudge, layer, drift and drag, kept for the visit
let floatingLayout = null;        // where each piece is drawn now, and the lines that end at it
let topLayer = 101;               // above every random layer, for the piece last dragged

// A random number between min and max.
function between(min, max) {
  return min + Math.random() * (max - min);
}

// A random distance of min to max, either way.
function eitherWay(min, max) {
  return between(min, max) * (Math.random() < 0.5 ? -1 : 1);
}
let floatingWidth = 0;

function floatingLook(piece) {
  if (!floatingLooks.has(piece.id)) {
    floatingLooks.set(piece.id, {
      scale: between(0.75, 1.75),
      nudgeX: between(-1, 1),
      nudgeY: between(-1, 1),
      layer: 1 + Math.floor(Math.random() * 100), // which overlapping piece sits on top
      dragX: 0, // how far the visitor has dragged it from its random spot
      dragY: 0,
      // The drift loop (see .floating-piece .piece-frame in style.css): two
      // points a few pixels away to wander through, a slight tilt, and its own
      // speed, started part-way through so the pieces don't move in step.
      drift: {
        '--drift-x1': `${eitherWay(3, 8)}px`,
        '--drift-y1': `${eitherWay(3, 8)}px`,
        '--drift-x2': `${eitherWay(3, 8)}px`,
        '--drift-y2': `${eitherWay(3, 8)}px`,
        '--drift-turn': `${eitherWay(0.5, 1.5)}deg`,
        '--drift-time': `${between(7, 12)}s`,
        '--drift-start': `${-between(0, 12)}s`,
      },
    });
  }
  return floatingLooks.get(piece.id);
}

// Lines to draw, as [from, to, person]. Each person's pieces are joined by the
// shortest set of lines that connects them all, rather than a line between
// every pair, which would cover the view for someone with many pieces. A
// line is drawn in its person's color.
function floatingConnections(centres) {
  const groups = new Map(); // person -> ids of their pieces
  pieces.forEach((piece) => {
    getPiecePeople(piece).forEach((name) => {
      const key = personKey(name);
      if (!groups.has(key)) groups.set(key, new Set());
      groups.get(key).add(piece.id);
    });
  });

  const distance = (a, b) => Math.hypot(centres.get(a).x - centres.get(b).x, centres.get(a).y - centres.get(b).y);
  const pairs = new Map();

  groups.forEach((idSet, person) => {
    const ids = [...idSet];
    const joined = [ids.shift()];
    while (ids.length) {
      let best = null;
      joined.forEach((from) => {
        ids.forEach((to, index) => {
          const length = distance(from, to);
          if (!best || length < best.length) best = { from, to, index, length };
        });
      });
      joined.push(ids.splice(best.index, 1)[0]);
      const key = [best.from, best.to].sort((a, b) => a - b).join('-');
      if (!pairs.has(key)) pairs.set(key, [best.from, best.to, person]);
    }
  });

  return [...pairs.values()];
}

function renderFloating() {
  if (floatingView.hidden) return;

  const width = floatingField.clientWidth;
  floatingWidth = width;
  const base = Math.min(150, width / 3.4); // a piece's size at 1x
  const cell = base * 1.55;                // distance between grid points
  const columns = Math.max(1, Math.floor(width / cell));
  const left = (width - columns * cell) / 2;
  const centres = new Map();
  const sizes = new Map();

  const tiles = pieces.map((piece, index) => {
    const look = floatingLook(piece);
    const size = base * look.scale;
    const column = index % columns;
    const row = Math.floor(index / columns);

    // The grid point, nudged by up to 30% of the spacing, kept inside the edges.
    const rawX = left + (column + 0.5) * cell + look.nudgeX * cell * 0.3;
    const x = Math.min(Math.max(rawX, size / 2), width - size / 2);
    const y = (row + 0.5) * cell + look.nudgeY * cell * 0.3;
    centres.set(piece.id, { x, y });
    sizes.set(piece.id, size);

    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'floating-piece';
    tile.style.width = `${size}px`;
    tile.style.setProperty('--layer', look.layer);
    tile.title = `${piece.title} · ${formatNames(getPiecePeople(piece))}`;
    tile.setAttribute('aria-label', `${tile.title}. Drag, or use the arrow keys, to move it.`);
    makeDraggable(tile, piece, look, () => {
      carouselIndex = index;
      showView('carousel');
    });

    const frame = document.createElement('span');
    frame.className = 'piece-frame';
    Object.entries(look.drift).forEach(([name, value]) => frame.style.setProperty(name, value));
    const image = document.createElement('img');
    fitInSquare(image);
    image.src = imageUrls.get(piece.id);
    image.alt = '';
    image.draggable = false; // so dragging moves the piece, not a copy of the image
    frame.append(image);
    tile.append(frame);
    return tile;
  });

  // Move everything up so the highest piece sits at the top, and fit the
  // height to the lowest piece.
  const tops = pieces.map((piece) => centres.get(piece.id).y - sizes.get(piece.id) / 2);
  const bottoms = pieces.map((piece) => centres.get(piece.id).y + sizes.get(piece.id) / 2);
  const shift = Math.min(...tops);
  centres.forEach((centre) => {
    centre.y -= shift;
  });

  const height = Math.max(...bottoms) - shift;
  floatingField.style.height = `${height}px`;
  floatingLines.setAttribute('width', width);
  floatingLines.setAttribute('height', height);

  floatingLayout = { width, height, centres, sizes, tiles: new Map(), lineEnds: new Map() };

  // Put each piece where it was dragged to this visit (if anywhere), kept inside the area.
  pieces.forEach((piece, index) => {
    const look = floatingLook(piece);
    const centre = centres.get(piece.id);
    floatingLayout.tiles.set(piece.id, tiles[index]);
    placeFloatingPiece(piece.id, centre.x + look.dragX, centre.y + look.dragY);
  });

  // Lines, remembering which end of each line belongs to which piece, so the
  // ends can follow a piece being dragged.
  floatingLines.replaceChildren(...floatingConnections(centres).map(([from, to, person]) => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    [[from, '1'], [to, '2']].forEach(([id, end]) => {
      line.setAttribute(`x${end}`, centres.get(id).x);
      line.setAttribute(`y${end}`, centres.get(id).y);
      if (!floatingLayout.lineEnds.has(id)) floatingLayout.lineEnds.set(id, []);
      floatingLayout.lineEnds.get(id).push({ line, end });
    });
    if (personColors.has(person)) line.style.stroke = personColors.get(person);
    return line;
  }));

  floatingField.replaceChildren(floatingLines, ...tiles);
}

// Moves a piece's centre to (x, y), kept inside the area, along with the ends
// of its lines.
function placeFloatingPiece(id, x, y) {
  const { width, height, centres, sizes, tiles, lineEnds } = floatingLayout;
  const half = sizes.get(id) / 2;
  const centre = centres.get(id);
  centre.x = Math.min(Math.max(x, half), width - half);
  centre.y = Math.min(Math.max(y, half), height - half);

  const tile = tiles.get(id);
  tile.style.left = `${centre.x - half}px`;
  tile.style.top = `${centre.y - half}px`;

  (lineEnds.get(id) || []).forEach(({ line, end }) => {
    line.setAttribute(`x${end}`, centre.x);
    line.setAttribute(`y${end}`, centre.y);
  });
}

// Moves a piece by a visitor's drag or arrow key, and remembers how far it has
// moved from its random spot for the rest of the visit.
function moveFloatingPiece(piece, look, x, y) {
  const centre = floatingLayout.centres.get(piece.id);
  const before = { x: centre.x, y: centre.y };
  placeFloatingPiece(piece.id, x, y);
  look.dragX += centre.x - before.x;
  look.dragY += centre.y - before.y;
}

function bringToFront(tile, look) {
  topLayer += 1;
  look.layer = topLayer;
  tile.style.setProperty('--layer', look.layer);
}

// Pressing and moving drags a piece; pressing without moving (or Enter) opens it.
const DRAG_DISTANCE = 4; // pixels a press must move before it counts as a drag

function makeDraggable(tile, piece, look, open) {
  let start = null; // where the press began, and the piece's centre then
  let dragged = false;

  tile.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    const centre = floatingLayout.centres.get(piece.id);
    start = { x: event.clientX, y: event.clientY, centreX: centre.x, centreY: centre.y };
    dragged = false;
    tile.setPointerCapture(event.pointerId);
  });

  tile.addEventListener('pointermove', (event) => {
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!dragged && Math.hypot(dx, dy) < DRAG_DISTANCE) return;
    if (!dragged) {
      dragged = true;
      tile.classList.add('is-dragging');
      bringToFront(tile, look);
    }
    moveFloatingPiece(piece, look, start.centreX + dx, start.centreY + dy);
  });

  const finish = () => {
    start = null;
    tile.classList.remove('is-dragging');
  };
  tile.addEventListener('pointerup', finish);
  tile.addEventListener('pointercancel', finish);

  // The click that ends a drag doesn't open the piece.
  tile.addEventListener('click', () => {
    if (dragged) {
      dragged = false;
      return;
    }
    open();
  });

  // Arrow keys move a focused piece: 10px, or 40px with Shift.
  const KEY_STEPS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  tile.addEventListener('keydown', (event) => {
    const direction = KEY_STEPS[event.key];
    if (!direction) return;
    event.preventDefault();
    const step = event.shiftKey ? 40 : 10;
    const centre = floatingLayout.centres.get(piece.id);
    bringToFront(tile, look);
    moveFloatingPiece(piece, look, centre.x + direction[0] * step, centre.y + direction[1] * step);
  });
}

// Lay the pieces out again when the space changes width, such as when the
// window is resized or the people sidebar opens.
new ResizeObserver(() => {
  if (floatingField.clientWidth !== floatingWidth) renderFloating();
}).observe(floatingField);

loadArchive();
