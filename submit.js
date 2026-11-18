// The people this piece reminds the user of: one or more, as tags.
const descriptionLabel = document.getElementById('description-label');
const peopleField = createPeopleField(document.getElementById('people-field'), {
  inputId: 'person-name',
  onChange: updateDescriptionLabel,
});
document.getElementById('person-name').setAttribute('aria-describedby', 'person-hint');

// The description prompt names the people as they are added.
function updateDescriptionLabel() {
  const names = peopleField.getNames({ includeTyped: true });
  descriptionLabel.textContent = `Why does this remind you of ${names.length ? formatNames(names) : 'them'}?`;
}

getSavedPersonNames()
  .then((names) => peopleField.setSavedNames(names))
  .catch(() => {
    // Without saved names the field still works as a plain text box.
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

// Save the piece with today's date, then go to the archive to see it.
const submitForm = document.getElementById('submit-form');
const submitStatus = document.getElementById('submit-status');

submitForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  // A name still being typed counts, as if Enter had been pressed.
  peopleField.commitTyped();

  const piece = {
    title: document.getElementById('piece-title').value.trim(),
    people: peopleField.getNames(),
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

  // The fields are required, but a field holding only spaces still gets through.
  if (!piece.title || piece.people.length === 0 || !piece.description) {
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
