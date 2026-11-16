// Update the description prompt with the name of the person as it is typed.
const nameInput = document.getElementById('person-name');
const descriptionLabel = document.getElementById('description-label');

function updateDescriptionLabel() {
  const name = nameInput.value.trim();
  descriptionLabel.textContent = `Why does this remind you of ${name || 'them'}?`;
}

nameInput.addEventListener('input', updateDescriptionLabel);

// The collected date defaults to today, and dates after today can't be picked.
const dateInput = document.getElementById('piece-date');

// Today's date as YYYY-MM-DD in the user's own time zone (the format date inputs use).
function todayString() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

// Kept up to date in case the page stays open past midnight.
function setLatestDate() {
  dateInput.max = todayString();
}

setLatestDate();
dateInput.value = dateInput.max;
dateInput.addEventListener('focus', setLatestDate);

function handleImageUpload() 
{

var image = document.getElementById("piece-image").files[0];
var displayImage = document.getElementById("display-image");

    // Keep the preview hidden until an image has been chosen.
    if (!image) {
      displayImage.hidden = true;
      return;
    }

    var reader = new FileReader();

    reader.onload = function(e) {
      displayImage.src = e.target.result;
      displayImage.hidden = false;
    }

    reader.readAsDataURL(image);

} 

// Save the piece with today's date, then go to the archive to see it.
const submitForm = document.getElementById('submit-form');
const submitStatus = document.getElementById('submit-status');

submitForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const piece = {
    title: document.getElementById('piece-title').value.trim(),
    person: nameInput.value.trim(),
    description: document.getElementById('piece-description').value.trim(),
    image: document.getElementById('piece-image').files[0],
    dateCollected: dateInput.value,
    dateAdded: new Date().toISOString(),
  };

  // The picker stops later dates, but one could still be typed in.
  setLatestDate();
  if (piece.dateCollected > dateInput.max) {
    submitStatus.textContent = "The date collected can't be after today.";
    return;
  }

  // A name matching a saved one apart from capitals uses the saved spelling,
  // so the same person is always sorted and shown the same way.
  const savedSpelling = savedNames.find((name) => name.toLowerCase() === piece.person.toLowerCase());
  if (savedSpelling) piece.person = savedSpelling;

  // The fields are required, but a field holding only spaces still gets through.
  if (!piece.title || !piece.person || !piece.description) {
    submitStatus.textContent = 'Please fill in every field before submitting.';
    return;
  }

  const submitButton = submitForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitStatus.textContent = 'Saving…';

  try {
    await savePiece(piece);
    window.location.href = 'index.html';
  } catch (error) {
    submitStatus.textContent = 'Sorry, this piece could not be saved. Please try again.';
    submitButton.disabled = false;
  }
});

// ---------------------------------------------------------------------------
// Saved names: a dropdown of everyone already in the archive, and a fill-in
// preview of the first saved name (A-Z) that starts with what has been typed.
// Pressing Tab fills the previewed name in.

const nameToggle = document.getElementById('person-toggle');
const nameOptions = document.getElementById('person-options');
const previewTyped = document.getElementById('name-preview-typed');
const previewRest = document.getElementById('name-preview-rest');

let savedNames = [];     // A-Z
let suggestedName = '';  // the saved name being previewed, if any
let activeOption = -1;   // the option highlighted with the arrow keys

function fillInName(name) {
  nameInput.value = name;
  updateDescriptionLabel();
  updatePreview();
}

// Shows the rest of the first matching saved name after what has been typed.
// The typed part is drawn invisibly so the rest lines up after it.
function updatePreview() {
  const typed = nameInput.value;
  const caretAtEnd = nameInput.selectionStart === typed.length && nameInput.selectionEnd === typed.length;
  const match = typed && caretAtEnd && document.activeElement === nameInput
    ? savedNames.find((name) => name.toLowerCase().startsWith(typed.toLowerCase()))
    : undefined;

  suggestedName = match && match.length > typed.length ? match : '';
  previewTyped.textContent = suggestedName ? typed : '';
  previewRest.textContent = suggestedName ? suggestedName.slice(typed.length) : '';
}

function renderNameOptions() {
  const options = savedNames.map((name, index) => {
    const option = document.createElement('li');
    option.id = `person-option-${index}`;
    option.setAttribute('role', 'option');
    option.textContent = name;
    return option;
  });

  const addNew = document.createElement('li');
  addNew.id = 'person-option-new';
  addNew.setAttribute('role', 'option');
  addNew.className = 'name-option-new';
  addNew.dataset.addNew = 'true';
  addNew.textContent = '+ Add a new person';

  nameOptions.replaceChildren(...options, addNew);
}

function setActiveOption(index) {
  const options = nameOptions.children;
  activeOption = Math.max(0, Math.min(index, options.length - 1));

  [...options].forEach((option, i) => option.setAttribute('aria-selected', String(i === activeOption)));
  nameInput.setAttribute('aria-activedescendant', options[activeOption].id);
  options[activeOption].scrollIntoView({ block: 'nearest' });
}

function openNameOptions() {
  nameOptions.hidden = false;
  nameInput.setAttribute('aria-expanded', 'true');
  nameToggle.setAttribute('aria-expanded', 'true');
}

function closeNameOptions() {
  nameOptions.hidden = true;
  activeOption = -1;
  nameInput.setAttribute('aria-expanded', 'false');
  nameToggle.setAttribute('aria-expanded', 'false');
  nameInput.removeAttribute('aria-activedescendant');
  [...nameOptions.children].forEach((option) => option.setAttribute('aria-selected', 'false'));
}

function chooseOption(option) {
  if (option.dataset.addNew) {
    nameInput.placeholder = "Type their name";
    fillInName('');
  } else {
    fillInName(option.textContent);
  }
  closeNameOptions();
  nameInput.focus();
}

nameInput.addEventListener('input', () => {
  closeNameOptions();
  updatePreview();
});
nameInput.addEventListener('focus', updatePreview);
nameInput.addEventListener('blur', () => {
  closeNameOptions();
  updatePreview();
});
// Moving the caret away from the end hides the preview.
nameInput.addEventListener('keyup', updatePreview);
nameInput.addEventListener('click', updatePreview);

nameInput.addEventListener('keydown', (event) => {
  const listOpen = !nameOptions.hidden;

  if (event.key === 'Tab' && !event.shiftKey && suggestedName) {
    event.preventDefault();
    fillInName(suggestedName);
  } else if (event.key === 'ArrowDown' && savedNames.length) {
    event.preventDefault();
    if (!listOpen) openNameOptions();
    setActiveOption(listOpen ? activeOption + 1 : 0);
  } else if (event.key === 'ArrowUp' && listOpen) {
    event.preventDefault();
    setActiveOption(activeOption - 1);
  } else if (event.key === 'Enter' && listOpen && activeOption >= 0) {
    event.preventDefault(); // choose the name instead of submitting the form
    chooseOption(nameOptions.children[activeOption]);
  } else if (event.key === 'Escape' && listOpen) {
    closeNameOptions();
  }
});

// Pressing on the button or a name would normally take focus from the field
// (closing the list); keeping focus lets the click go through.
nameToggle.addEventListener('mousedown', (event) => event.preventDefault());
nameOptions.addEventListener('mousedown', (event) => event.preventDefault());

nameToggle.addEventListener('click', () => {
  if (nameOptions.hidden) {
    openNameOptions();
  } else {
    closeNameOptions();
  }
  nameInput.focus();
});

nameOptions.addEventListener('click', (event) => {
  const option = event.target.closest('[role="option"]');
  if (option) chooseOption(option);
});

// The dropdown only appears once at least one name has been saved.
getSavedPersonNames()
  .then((names) => {
    savedNames = names;
    if (savedNames.length === 0) return;
    renderNameOptions();
    nameToggle.hidden = false;
  })
  .catch(() => {
    // Without saved names the field still works as a plain text box.
  });
