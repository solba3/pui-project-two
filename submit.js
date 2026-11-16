// Update the description prompt with the name of the person as it is typed.
const nameInput = document.getElementById('person-name');
const descriptionLabel = document.getElementById('description-label');

nameInput.addEventListener('input', () => {
  const name = nameInput.value.trim();
  descriptionLabel.textContent = `What makes this special about ${name || 'them'}?`;
});

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
    dateAdded: new Date().toISOString(),
  };

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
