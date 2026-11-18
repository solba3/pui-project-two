// A field for tagging one or more people, used on the submission form and
// when editing a piece in the archive.
//
// - Each chosen person shows as a tag with a button to remove it.
// - Typing previews, in grey, the first saved name (A-Z) starting with what
//   has been typed; Tab fills it in.
// - Enter or a comma adds the typed name as a tag; Backspace in an empty box
//   removes the last tag.
// - The ▾ button lists saved names to tick on and off, plus "Add a new person".
// - A name matching a saved one apart from capitals uses the saved spelling,
//   so the same person is always sorted and shown the same way.

// Joins names into a phrase: "Mom", "Mom and Grandpa", "Mom, Grandpa, and Zoe".
function formatNames(names) {
  return new Intl.ListFormat(undefined, { style: 'long', type: 'conjunction' }).format(names);
}

function createPeopleField(root, { inputId, onChange = () => {} }) {
  const listId = `${inputId}-options`;
  root.classList.add('people-field');
  root.innerHTML = `
    <ul class="people-tags" aria-label="Chosen people"></ul>
    <div class="name-field">
      <span class="name-preview" aria-hidden="true"><span class="name-preview-typed"></span><span class="name-preview-rest"></span></span>
      <input type="text" id="${inputId}" autocomplete="off" role="combobox"
        aria-autocomplete="both" aria-expanded="false" aria-controls="${listId}">
      <button type="button" class="name-toggle" aria-label="Choose saved names"
        aria-expanded="false" aria-controls="${listId}" tabindex="-1" hidden>&#9662;</button>
      <ul id="${listId}" class="name-options" role="listbox" aria-multiselectable="true"
        aria-label="Saved names" hidden></ul>
    </div>`;

  const tagList = root.querySelector('.people-tags');
  const input = root.querySelector('input');
  const toggle = root.querySelector('.name-toggle');
  const optionList = root.querySelector('.name-options');
  const previewTyped = root.querySelector('.name-preview-typed');
  const previewRest = root.querySelector('.name-preview-rest');

  let savedNames = [];    // A-Z
  let chosen = [];        // names tagged so far
  let suggestedName = ''; // the saved name being previewed, if any
  let activeOption = -1;  // the option highlighted with the arrow keys

  const sameName = (a, b) => a.toLowerCase() === b.toLowerCase();
  const isChosen = (name) => chosen.some((other) => sameName(other, name));

  // ---- Tags ----

  function renderTags() {
    tagList.replaceChildren(...chosen.map((name, index) => {
      const tag = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = name;

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Remove ${name}`);
      remove.addEventListener('click', () => {
        chosen.splice(index, 1);
        changed();
        input.focus();
      });

      tag.append(label, remove);
      return tag;
    }));
    tagList.hidden = chosen.length === 0;
  }

  function changed() {
    renderTags();
    renderOptions();
    onChange();
  }

  function addName(rawName) {
    const typed = rawName.trim();
    if (!typed) return;
    const name = savedNames.find((saved) => sameName(saved, typed)) || typed;
    if (!isChosen(name)) chosen.push(name);
    input.value = '';
    updatePreview();
    changed();
  }

  // ---- Fill-in preview ----

  // Shows the rest of the first matching saved name after what has been typed.
  // The typed part is drawn invisibly so the rest lines up after it.
  function updatePreview() {
    const typed = input.value;
    const caretAtEnd = input.selectionStart === typed.length && input.selectionEnd === typed.length;
    const match = typed && caretAtEnd && document.activeElement === input
      ? savedNames.find((name) => !isChosen(name) && name.toLowerCase().startsWith(typed.toLowerCase()))
      : undefined;

    suggestedName = match && match.length > typed.length ? match : '';
    previewTyped.textContent = suggestedName ? typed : '';
    previewRest.textContent = suggestedName ? suggestedName.slice(typed.length) : '';
  }

  // ---- Dropdown of saved names ----

  function renderOptions() {
    const options = savedNames.map((name, index) => {
      const option = document.createElement('li');
      option.id = `${listId}-${index}`;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(isChosen(name)));
      option.dataset.name = name;
      option.textContent = name;
      return option;
    });

    const addNew = document.createElement('li');
    addNew.id = `${listId}-new`;
    addNew.setAttribute('role', 'option');
    addNew.setAttribute('aria-selected', 'false');
    addNew.className = 'name-option-new';
    addNew.textContent = '+ Add a new person';

    optionList.replaceChildren(...options, addNew);
    if (activeOption >= 0) setActiveOption(activeOption);
  }

  function setActiveOption(index) {
    const options = optionList.children;
    activeOption = Math.max(0, Math.min(index, options.length - 1));
    [...options].forEach((option, i) => option.classList.toggle('is-active', i === activeOption));
    input.setAttribute('aria-activedescendant', options[activeOption].id);
    options[activeOption].scrollIntoView({ block: 'nearest' });
  }

  function openOptions() {
    optionList.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-expanded', 'true');
  }

  function closeOptions() {
    optionList.hidden = true;
    activeOption = -1;
    input.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    [...optionList.children].forEach((option) => option.classList.remove('is-active'));
  }

  // Ticks a saved name on or off; the list stays open so several can be picked.
  function chooseOption(option) {
    if (!option.dataset.name) {
      closeOptions();
      input.placeholder = 'Type a name, then press Enter';
      input.focus();
      return;
    }
    const name = option.dataset.name;
    if (isChosen(name)) {
      chosen = chosen.filter((other) => !sameName(other, name));
    } else {
      chosen.push(name);
    }
    changed();
  }

  // ---- Events ----

  input.addEventListener('input', () => {
    closeOptions();
    updatePreview();
    onChange();
  });
  input.addEventListener('focus', updatePreview);
  input.addEventListener('blur', () => {
    closeOptions();
    updatePreview();
  });
  // Moving the caret away from the end hides the preview.
  input.addEventListener('keyup', updatePreview);
  input.addEventListener('click', updatePreview);

  input.addEventListener('keydown', (event) => {
    const listOpen = !optionList.hidden;

    if (event.key === 'Tab' && !event.shiftKey && suggestedName) {
      event.preventDefault();
      input.value = suggestedName;
      updatePreview();
      onChange();
    } else if (event.key === 'ArrowDown' && savedNames.length) {
      event.preventDefault();
      if (!listOpen) openOptions();
      setActiveOption(listOpen ? activeOption + 1 : 0);
    } else if (event.key === 'ArrowUp' && listOpen) {
      event.preventDefault();
      setActiveOption(activeOption - 1);
    } else if (event.key === 'Enter' && listOpen && activeOption >= 0) {
      event.preventDefault(); // tick the name instead of submitting the form
      chooseOption(optionList.children[activeOption]);
    } else if ((event.key === 'Enter' || event.key === ',') && input.value.trim()) {
      event.preventDefault(); // add the name instead of submitting the form
      addName(input.value);
    } else if (event.key === 'Backspace' && !input.value && chosen.length) {
      chosen.pop();
      changed();
    } else if (event.key === 'Escape' && listOpen) {
      event.stopPropagation(); // close just the list, not anything around it
      closeOptions();
    }
  });

  // Pressing on the button or a name would normally take focus from the box
  // (closing the list); keeping focus lets the click go through.
  toggle.addEventListener('mousedown', (event) => event.preventDefault());
  optionList.addEventListener('mousedown', (event) => event.preventDefault());

  toggle.addEventListener('click', () => {
    if (optionList.hidden) {
      openOptions();
    } else {
      closeOptions();
    }
    input.focus();
  });

  optionList.addEventListener('click', (event) => {
    const option = event.target.closest('[role="option"]');
    if (option) chooseOption(option);
  });

  renderTags();

  return {
    // The tagged names; with includeTyped, also a name still being typed.
    getNames({ includeTyped = false } = {}) {
      const typed = input.value.trim();
      return includeTyped && typed && !isChosen(typed) ? [...chosen, typed] : [...chosen];
    },

    // Turns a name still being typed into a tag (used before saving).
    commitTyped() {
      addName(input.value);
    },

    setNames(names) {
      chosen = [];
      names.forEach((name) => {
        if (!isChosen(name)) chosen.push(name);
      });
      input.value = '';
      input.placeholder = '';
      closeOptions();
      updatePreview();
      changed();
    },

    // The dropdown only appears once at least one name has been saved.
    setSavedNames(names) {
      savedNames = [...names];
      toggle.hidden = savedNames.length === 0;
      renderOptions();
    },

    focus() {
      input.focus();
    },
  };
}
