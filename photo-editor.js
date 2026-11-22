// The photo editor, used when submitting a piece and when editing one: a
// pop-up laid out like the submission card, with the photo on the left and
// its settings on the right.
//
// - Crop: drag the box to move it, or a corner to resize it. With the box or a
//   corner focused, the arrow keys move or resize it (Shift for bigger steps).
// - Brightness: 50% to 150%.
// - Saturation: 0% to 200%.
//
// openPhotoEditor(original, edits) resolves with { edits, image } on Apply, or
// null on Cancel. `edits` are the settings, { crop: { x, y, width, height } as
// shares of the photo, brightness, saturation }, kept with the piece so the
// photo can be edited again from the original. `image` is the edited photo,
// or null when the settings leave the photo as it was.

const NO_PHOTO_EDITS = { crop: { x: 0, y: 0, width: 1, height: 1 }, brightness: 1, saturation: 1 };
const MIN_CROP = 0.1;          // the crop can't be smaller than a tenth of the photo
const MAX_EDITED_SIDE = 2400;  // the longest side of an edited photo, in pixels

function photoEditsChangeNothing(edits) {
  const { crop, brightness, saturation } = edits;
  return crop.x === 0 && crop.y === 0 && crop.width === 1 && crop.height === 1
    && brightness === 1 && saturation === 1;
}

let photoEditor = null; // the pop-up, made the first time it's needed

function buildPhotoEditor() {
  const dialog = document.createElement('dialog');
  dialog.className = 'photo-editor';
  dialog.setAttribute('aria-labelledby', 'photo-editor-heading');
  dialog.innerHTML = `
    <form method="dialog" class="photo-editor-card">
      <h2 id="photo-editor-heading">Edit photo</h2>

      <div class="photo-editor-picture">
        <div class="photo-editor-stage">
          <img class="photo-editor-image" alt="The photo being edited">
          <div class="crop-box" tabindex="0" role="group"
            aria-label="Crop area: drag, or use the arrow keys, to move it">
            <span class="crop-handle" data-corner="nw" tabindex="0" aria-label="Top left corner of the crop"></span>
            <span class="crop-handle" data-corner="ne" tabindex="0" aria-label="Top right corner of the crop"></span>
            <span class="crop-handle" data-corner="sw" tabindex="0" aria-label="Bottom left corner of the crop"></span>
            <span class="crop-handle" data-corner="se" tabindex="0" aria-label="Bottom right corner of the crop"></span>
          </div>
        </div>
      </div>

      <div class="photo-editor-settings">
        <div class="field">
          <span class="photo-editor-label">Crop</span>
          <p class="field-hint">Drag the box or its corners on the photo.</p>
          <button type="button" class="photo-editor-reset-crop">Reset crop</button>
        </div>
        <div class="field">
          <label for="photo-editor-brightness">Brightness <output class="photo-editor-brightness-value">100%</output></label>
          <input type="range" id="photo-editor-brightness" min="50" max="150" step="1" value="100">
        </div>
        <div class="field">
          <label for="photo-editor-saturation">Saturation <output class="photo-editor-saturation-value">100%</output></label>
          <input type="range" id="photo-editor-saturation" min="0" max="200" step="1" value="100">
        </div>
        <div class="photo-editor-actions">
          <button type="button" class="photo-editor-reset">Reset</button>
          <button type="button" class="photo-editor-cancel">Cancel</button>
          <button type="button" class="photo-editor-apply">Apply</button>
        </div>
        <p class="photo-editor-status" role="status"></p>
      </div>
    </form>`;
  document.body.append(dialog);

  const parts = {
    dialog,
    stage: dialog.querySelector('.photo-editor-stage'),
    image: dialog.querySelector('.photo-editor-image'),
    box: dialog.querySelector('.crop-box'),
    brightness: dialog.querySelector('#photo-editor-brightness'),
    saturation: dialog.querySelector('#photo-editor-saturation'),
    brightnessValue: dialog.querySelector('.photo-editor-brightness-value'),
    saturationValue: dialog.querySelector('.photo-editor-saturation-value'),
    status: dialog.querySelector('.photo-editor-status'),
    apply: dialog.querySelector('.photo-editor-apply'),
  };

  let crop = { ...NO_PHOTO_EDITS.crop };
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  function drawCrop() {
    parts.box.style.left = `${crop.x * 100}%`;
    parts.box.style.top = `${crop.y * 100}%`;
    parts.box.style.width = `${crop.width * 100}%`;
    parts.box.style.height = `${crop.height * 100}%`;
  }

  // The live preview of brightness and saturation, done with the same
  // formulas the saved photo uses.
  function drawSettings() {
    const brightness = parts.brightness.value / 100;
    const saturation = parts.saturation.value / 100;
    parts.image.style.filter = `brightness(${brightness}) saturate(${saturation})`;
    parts.brightnessValue.textContent = `${parts.brightness.value}%`;
    parts.saturationValue.textContent = `${parts.saturation.value}%`;
  }

  // Moving the whole box, or one corner, keeping it inside the photo and at
  // least the smallest size.
  function moveBox(dx, dy) {
    crop.x = clamp(crop.x + dx, 0, 1 - crop.width);
    crop.y = clamp(crop.y + dy, 0, 1 - crop.height);
    drawCrop();
  }

  function moveCorner(corner, dx, dy) {
    let { x, y, width, height } = crop;
    if (corner.includes('w')) {
      const left = clamp(x + dx, 0, x + width - MIN_CROP);
      width += x - left;
      x = left;
    } else {
      width = clamp(width + dx, MIN_CROP, 1 - x);
    }
    if (corner.includes('n')) {
      const top = clamp(y + dy, 0, y + height - MIN_CROP);
      height += y - top;
      y = top;
    } else {
      height = clamp(height + dy, MIN_CROP, 1 - y);
    }
    crop = { x, y, width, height };
    drawCrop();
  }

  // Dragging: pointer movement as a share of the photo's size on screen.
  let drag = null;
  parts.stage.addEventListener('pointerdown', (event) => {
    const handle = event.target.closest('.crop-handle');
    if (!handle && !event.target.closest('.crop-box')) return;
    event.preventDefault();
    drag = { corner: handle ? handle.dataset.corner : null, x: event.clientX, y: event.clientY };
    parts.stage.setPointerCapture(event.pointerId);
  });
  parts.stage.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const box = parts.image.getBoundingClientRect();
    const dx = (event.clientX - drag.x) / box.width;
    const dy = (event.clientY - drag.y) / box.height;
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (drag.corner) {
      moveCorner(drag.corner, dx, dy);
    } else {
      moveBox(dx, dy);
    }
  });
  ['pointerup', 'pointercancel'].forEach((type) => {
    parts.stage.addEventListener(type, () => {
      drag = null;
    });
  });

  // Arrow keys: 1% at a time, or 5% with Shift.
  const KEY_STEPS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  parts.box.addEventListener('keydown', (event) => {
    const step = KEY_STEPS[event.key];
    if (!step) return;
    event.preventDefault();
    const size = event.shiftKey ? 0.05 : 0.01;
    const handle = event.target.closest('.crop-handle');
    if (handle) {
      moveCorner(handle.dataset.corner, step[0] * size, step[1] * size);
    } else {
      moveBox(step[0] * size, step[1] * size);
    }
  });

  parts.brightness.addEventListener('input', drawSettings);
  parts.saturation.addEventListener('input', drawSettings);
  dialog.querySelector('.photo-editor-reset-crop').addEventListener('click', () => {
    crop = { ...NO_PHOTO_EDITS.crop };
    drawCrop();
  });
  dialog.querySelector('.photo-editor-reset').addEventListener('click', () => {
    crop = { ...NO_PHOTO_EDITS.crop };
    parts.brightness.value = 100;
    parts.saturation.value = 100;
    drawCrop();
    drawSettings();
  });

  return {
    parts,
    setEdits(edits) {
      crop = { ...edits.crop };
      parts.brightness.value = Math.round(edits.brightness * 100);
      parts.saturation.value = Math.round(edits.saturation * 100);
      drawCrop();
      drawSettings();
    },
    getEdits() {
      const round = (value) => Math.round(value * 10000) / 10000;
      return {
        crop: { x: round(crop.x), y: round(crop.y), width: round(crop.width), height: round(crop.height) },
        brightness: parts.brightness.value / 100,
        saturation: parts.saturation.value / 100,
      };
    },
  };
}

function openPhotoEditor(original, edits = NO_PHOTO_EDITS) {
  if (!photoEditor) photoEditor = buildPhotoEditor();
  const { parts, setEdits, getEdits } = photoEditor;
  const url = URL.createObjectURL(original);
  parts.image.src = url;
  parts.status.textContent = '';
  parts.apply.disabled = false;
  setEdits(edits);

  return new Promise((resolve) => {
    let finished = false;
    const finish = (result) => {
      if (finished) return;
      finished = true;
      parts.apply.removeEventListener('click', onApply);
      cancel.removeEventListener('click', onCancel);
      parts.dialog.removeEventListener('close', onClose);
      if (parts.dialog.open) parts.dialog.close();
      URL.revokeObjectURL(url);
      resolve(result);
    };

    const cancel = parts.dialog.querySelector('.photo-editor-cancel');
    const onCancel = () => finish(null);
    const onClose = () => finish(null); // Escape
    const onApply = async () => {
      const chosen = getEdits();
      if (photoEditsChangeNothing(chosen)) {
        finish({ edits: chosen, image: null });
        return;
      }
      parts.apply.disabled = true;
      parts.status.textContent = 'Saving the photo…';
      try {
        finish({ edits: chosen, image: await renderEditedPhoto(original, chosen) });
      } catch (error) {
        parts.status.textContent = 'Sorry, the photo could not be edited. Please try again.';
        parts.apply.disabled = false;
      }
    };

    parts.apply.addEventListener('click', onApply);
    cancel.addEventListener('click', onCancel);
    parts.dialog.addEventListener('close', onClose);
    parts.dialog.showModal();
  });
}

// Makes the edited photo: the crop, at up to MAX_EDITED_SIDE pixels on its
// longest side, with brightness then saturation applied to each pixel. These
// match the CSS brightness() and saturate() the live preview uses.
async function renderEditedPhoto(original, edits) {
  const bitmap = await createImageBitmap(original);
  const sx = Math.round(edits.crop.x * bitmap.width);
  const sy = Math.round(edits.crop.y * bitmap.height);
  const sw = Math.max(1, Math.round(edits.crop.width * bitmap.width));
  const sh = Math.max(1, Math.round(edits.crop.height * bitmap.height));
  const scale = Math.min(1, MAX_EDITED_SIDE / Math.max(sw, sh));
  const width = Math.max(1, Math.round(sw * scale));
  const height = Math.max(1, Math.round(sh * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height);
  bitmap.close();

  const { brightness: b, saturation: s } = edits;
  if (b !== 1 || s !== 1) {
    const frame = context.getImageData(0, 0, width, height);
    const px = frame.data;
    // The saturate() color matrix, from the Filter Effects specification.
    const m = [
      0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
      0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
      0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s,
    ];
    for (let i = 0; i < px.length; i += 4) {
      const r = Math.min(255, px[i] * b);
      const g = Math.min(255, px[i + 1] * b);
      const bl = Math.min(255, px[i + 2] * b);
      px[i] = m[0] * r + m[1] * g + m[2] * bl;
      px[i + 1] = m[3] * r + m[4] * g + m[5] * bl;
      px[i + 2] = m[6] * r + m[7] * g + m[8] * bl;
    }
    context.putImageData(frame, 0, 0);
  }

  const type = original.type === 'image/png' ? 'image/png' : 'image/jpeg';
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('no image'))), type, 0.92);
  });
}
