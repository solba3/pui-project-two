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
