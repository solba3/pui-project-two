// The people this piece reminds the user of: one or more, as tags, each with
// their own "Why does this remind you of …?" box.
const descriptionFields = createDescriptionFields(document.getElementById('description-fields'), {
  idPrefix: 'piece-description',
});
const peopleField = createPeopleField(document.getElementById('people-field'), {
  inputId: 'person-name',
  onChange: updateDescriptionFields,
});
document.getElementById('person-name').setAttribute('aria-describedby', 'person-hint');

function updateDescriptionFields() {
  descriptionFields.update(peopleField.getNames(), peopleField.getTypedName());
}

updateDescriptionFields();

getSavedPersonNames()
  .then((names) => peopleField.setSavedNames(names))
  .catch(() => {
    // Without saved names the field still works as a plain text box.
  });

// Existing people's colors, so typing their name selects their color.
getPersonColors()
  .then((colors) => peopleField.setSavedColors(colors))
  .catch(() => {
    // Without saved colors everyone starts at black.
  });

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

// Dragging a picture onto the preview chooses it, as the "Choose File" button
// does. The preview is highlighted while a file is held over it.
const photoDrop = document.getElementById('photo-drop');
const photoCaption = document.getElementById('photo-caption');
const imageInput = document.getElementById('piece-image');
const PHOTO_CAPTION = 'upload file here';
const carriesFiles = (event) => [...event.dataTransfer.types].includes('Files');

photoDrop.addEventListener('dragover', (event) => {
  if (!carriesFiles(event)) return;
  event.preventDefault(); // allows the drop
  event.dataTransfer.dropEffect = 'copy';
  photoDrop.classList.add('is-drag-over');
});

photoDrop.addEventListener('dragleave', (event) => {
  if (!photoDrop.contains(event.relatedTarget)) photoDrop.classList.remove('is-drag-over');
});

photoDrop.addEventListener('drop', (event) => {
  event.preventDefault();
  photoDrop.classList.remove('is-drag-over');

  const file = [...event.dataTransfer.files].find((item) => item.type.startsWith('image/'));
  if (!file) {
    photoCaption.textContent = "that isn't an image: please drop a picture";
    return;
  }

  // Put the dropped picture in the file field, so it is saved like a chosen one.
  const chosen = new DataTransfer();
  chosen.items.add(file);
  imageInput.files = chosen.files;
  photoCaption.textContent = PHOTO_CAPTION;
  handleImageUpload();
  resetPhotoEdits();
});

imageInput.addEventListener('change', () => {
  photoCaption.textContent = PHOTO_CAPTION;
  resetPhotoEdits();
});

// A file dropped anywhere else on the page would make the browser open it,
// leaving the form and losing what was typed, so it is ignored.
['dragover', 'drop'].forEach((type) => {
  window.addEventListener(type, (event) => {
    if (!carriesFiles(event) || photoDrop.contains(event.target)) return;
    event.preventDefault();
    if (type === 'dragover') event.dataTransfer.dropEffect = 'none';
  });
});

// Save the piece with today's date, then go to the archive to see it.
const submitForm = document.getElementById('submit-form');
const submitStatus = document.getElementById('submit-status');

submitForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  // A name still being typed counts, as if Enter had been pressed.
  peopleField.commitTyped();
  const people = peopleField.getNames();

  const piece = {
    title: document.getElementById('piece-title').value.trim(),
    people,
    descriptions: descriptionFields.getDescriptions(people),
    image: photoEdited || document.getElementById('piece-image').files[0],
    dateCollected: dateInput.value,
    dateAdded: new Date().toISOString(),
  };

  // The picker stops later dates, but one could still be typed in.
  setLatestDate();
  if (piece.dateCollected > dateInput.max) {
    submitStatus.textContent = "The date collected can't be after today.";
    return;
  }

  // The fields are required, but a field holding only spaces still gets through.
  if (!piece.title || people.length === 0 || Object.values(piece.descriptions).some((text) => !text)) {
    submitStatus.textContent = 'Please fill in every field before submitting.';
    return;
  }

  // An edited photo is saved along with the original and its settings, so it
  // can be edited again from the original later.
  if (photoEdited) {
    piece.originalImage = photoOriginal;
    piece.photoEdits = photoEdits;
  }

  const submitButton = submitForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitStatus.textContent = 'Saving…';

  try {
    await savePiece(piece, { giftIdea: document.getElementById('gift-idea').checked });
    await savePersonColors(peopleField.getColors());
    window.location.href = 'index.html';
  } catch (error) {
    submitStatus.textContent = 'Sorry, this piece could not be saved. Please try again.';
    submitButton.disabled = false;
  }
});

// ---------------------------------------------------------------------------
// Editing the photo: once a photo is chosen, "Edit photo" (below the preview)
// opens the photo editor to crop it or change its brightness and saturation.
// The preview then shows the edited photo, which is what gets saved.

const editPhotoButton = document.getElementById('edit-photo');
const previewImage = document.getElementById('display-image');
let photoOriginal = null; // the photo as chosen
let photoEdits = null;    // the editor's settings, once applied
let photoEdited = null;   // the edited photo, when the settings change anything
let previewUrl = null;

// A newly chosen photo starts with no edits.
function resetPhotoEdits() {
  photoOriginal = imageInput.files[0] || null;
  photoEdits = null;
  photoEdited = null;
  editPhotoButton.hidden = !photoOriginal;
}

editPhotoButton.addEventListener('click', async () => {
  if (!photoOriginal) return;
  const result = await openPhotoEditor(photoOriginal, photoEdits || NO_PHOTO_EDITS);
  editPhotoButton.focus();
  if (!result) return; // cancelled

  photoEdits = result.edits;
  photoEdited = result.image;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(photoEdited || photoOriginal);
  previewImage.src = previewUrl;
  previewImage.hidden = false;
});
