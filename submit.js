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

    var reader = new FileReader();

    reader.onload = function(e) {
      document.getElementById("display-image").src = e.target.result;
    }

    reader.readAsDataURL(image);

} 
