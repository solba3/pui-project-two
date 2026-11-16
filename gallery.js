// Shows the saved pieces as a grid or a carousel, in the chosen order.

const gridView = document.getElementById('grid-view');
const carouselView = document.getElementById('carousel-view');
const pieceGrid = document.getElementById('piece-grid');
const sortSelect = document.getElementById('sort-order');
const archiveMessage = document.getElementById('archive-message');
const viewButtons = document.querySelectorAll('.view-toggle button');

let pieces = [];        // saved pieces, sorted in the current order
let imageUrls = new Map(); // piece id -> URL for its stored image
let carouselIndex = 0;  // which piece the carousel is showing

function compareText(a, b) {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

// dateAdded is an ISO date string, so comparing the strings orders by date.
// The id breaks ties between pieces saved in the same millisecond.
function newestFirst(a, b) {
  return b.dateAdded.localeCompare(a.dateAdded) || b.id - a.id;
}

const SORT_ORDERS = {
  newest: newestFirst,
  oldest: (a, b) => newestFirst(b, a),
  title: (a, b) => compareText(a.title, b.title) || newestFirst(a, b),
  person: (a, b) => compareText(a.person, b.person) || newestFirst(a, b),
};

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function sortPieces() {
  pieces.sort(SORT_ORDERS[sortSelect.value]);
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
    image.src = imageUrls.get(piece.id);
    image.alt = piece.title;
    frame.append(image);

    const title = document.createElement('span');
    title.className = 'piece-title';
    title.textContent = piece.title;

    const details = document.createElement('span');
    details.className = 'piece-details';
    details.textContent = `${piece.person} · ${formatDate(piece.dateAdded)}`;

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
    `Added ${formatDate(piece.dateAdded)} · ${carouselIndex + 1} of ${pieces.length}`;
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
  animateCarousel(Math.sign(step));
}

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)'; // same easing as the float-in

// Plays an animation on an element, first stopping any it is still playing,
// so clicking quickly through pieces never leaves one half-finished.
function play(element, keyframes, duration) {
  element.getAnimations().forEach((animation) => animation.cancel());
  element.animate(keyframes, { duration, easing: EASE_OUT });
}

// Animates the change to a new piece. direction is 1 for next, -1 for
// previous, or 0 when there is no direction (such as a new sort order).
function animateCarousel(direction) {
  if (reduceMotion.matches) return;

  // The new piece swings in from the sneak peek it was showing in, starting
  // at the same 3D angle and unfolding into the centre.
  const startFrame = direction === 0
    ? { opacity: 0, transform: 'scale(0.96)' }
    : {
        opacity: 0.5,
        transform: `perspective(800px) translateX(${direction * 60}%) rotateY(${direction * -40}deg) scale(0.55)`,
      };
  play(carouselFrame, [startFrame, { opacity: 1, transform: 'none' }], 600);

  // The peeks fade back in to their usual 50% opacity.
  [peekPrev, peekNext].forEach((peek) => {
    play(peek, [{ opacity: 0 }, { opacity: 0.5 }], 600);
  });

  // The text fades up into place.
  carouselText.forEach((element) => {
    play(element, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], 450);
  });
}

// The view is kept in the address (#carousel), so a refresh stays on it.
function showView(view) {
  const isCarousel = view === 'carousel';
  history.replaceState(null, '', isCarousel ? '#carousel' : location.pathname + location.search);

  viewButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.view === view));
  });

  if (pieces.length === 0) return;
  gridView.hidden = isCarousel;
  carouselView.hidden = !isCarousel;
  if (isCarousel) renderCarousel();
}

function currentView() {
  return location.hash === '#carousel' ? 'carousel' : 'grid';
}

function showMessage(html) {
  archiveMessage.innerHTML = html;
  archiveMessage.hidden = false;
  gridView.hidden = true;
  carouselView.hidden = true;
}

viewButtons.forEach((button) => {
  button.addEventListener('click', () => showView(button.dataset.view));
});

sortSelect.addEventListener('change', () => {
  sortPieces();
  carouselIndex = 0;
  renderGrid();
  renderCarousel();
  if (!carouselView.hidden) animateCarousel(0);
});

document.getElementById('carousel-prev').addEventListener('click', () => moveCarousel(-1));
document.getElementById('carousel-next').addEventListener('click', () => moveCarousel(1));

// Clicking a sneak peek moves to that piece.
const peekPrev = document.getElementById('carousel-peek-prev');
const peekNext = document.getElementById('carousel-peek-next');
const carouselFrame = document.querySelector('.carousel-frame');
const carouselText = ['carousel-title', 'carousel-person', 'carousel-description', 'carousel-details']
  .map((id) => document.getElementById(id));
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
    pieces = await getAllPieces();
  } catch (error) {
    showMessage('The archive could not be loaded in this browser.');
    return;
  }

  if (pieces.length === 0) {
    showMessage('No pieces yet. <a href="submit.html">Add your first piece.</a>');
    return;
  }

  imageUrls = new Map(pieces.map((piece) => [piece.id, URL.createObjectURL(piece.image)]));
  sortPieces();
  renderGrid();
  showView(currentView());
}

loadArchive();
