const $ = selector => document.querySelector(selector);
const productList = $('#product-list');
const editor = $('#product-editor');
const form = $('#product-form');
const photoInput = $('#product-image');
const photoPreview = $('#photo-preview');
let products = [];
let editingId = null;
let activeFilter = 'all';
let searchText = '';
let toastTimer;

async function api(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', ...options });
  if (response.status === 401) {
    window.location.assign('/admin/login');
    throw new Error('Please sign in again.');
  }
  if (response.status === 204) return null;
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || 'Something went wrong. Please try again.');
    error.fieldErrors = result.fieldErrors || {};
    throw error;
  }
  return result;
}

function money(cents) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3200);
}

function updateStats() {
  const published = products.filter(product => product.isPublished).length;
  $('#total-count').textContent = products.length;
  $('#published-count').textContent = published;
  $('#draft-count').textContent = products.length - published;
  $('#all-filter-count').textContent = products.length;
}

function makeProductRow(product) {
  const row = $('#product-row-template').content.firstElementChild.cloneNode(true);
  const image = row.querySelector('[data-product-image]');
  image.src = product.imagePath || '/assets/product-placeholder.svg';
  image.alt = `${product.name} product photo`;
  row.querySelector('[data-product-name]').textContent = product.name;
  row.querySelector('[data-product-category]').textContent = product.category;
  row.querySelector('[data-product-price]').textContent = money(product.priceCents);
  const status = row.querySelector('[data-product-status]');
  status.classList.add(product.isPublished ? 'status-live' : 'status-hidden');
  status.textContent = product.isPublished ? 'Published' : 'Hidden';
  const edit = row.querySelector('[data-action="edit"]');
  edit.setAttribute('aria-label', `Edit ${product.name}`);
  edit.addEventListener('click', () => openEditor(product));
  const remove = row.querySelector('[data-action="delete"]');
  remove.dataset.id = product.id;
  remove.setAttribute('aria-label', `Delete ${product.name}`);
  return row;
}

function renderProducts() {
  productList.replaceChildren();
  updateStats();
  const filtered = products.filter(product => {
    const matchesFilter = activeFilter === 'all'
      || (activeFilter === 'published' && product.isPublished)
      || (activeFilter === 'hidden' && !product.isPublished);
    const haystack = `${product.name} ${product.category} ${product.description}`.toLowerCase();
    return matchesFilter && haystack.includes(searchText);
  });
  $('#empty-state').hidden = products.length > 0 || searchText.length > 0;
  $('.product-list-heading').hidden = filtered.length === 0;
  for (const product of filtered) productList.append(makeProductRow(product));
  if (products.length > 0 && filtered.length === 0) {
    const emptySearch = document.createElement('p');
    emptySearch.className = 'empty-search';
    emptySearch.textContent = 'No products match your search.';
    productList.append(emptySearch);
  }
}

async function loadProducts() {
  products = await api('/api/admin/products');
  renderProducts();
}

function openEditor(product = null) {
  editingId = product?.id ?? null;
  form.reset();
  document.querySelectorAll('[data-error-for]').forEach(node => { node.textContent = ''; });
  $('#editor-error').hidden = true;
  $('#editor-title').textContent = product ? 'Edit product' : 'Add a product';
  $('#product-name').value = product?.name || '';
  $('#product-description').value = product?.description || '';
  $('#product-category').value = product?.category || 'Signature Scents';
  $('#product-price').value = product ? (product.priceCents / 100).toFixed(2) : '';
  $('#product-available').checked = product?.isAvailable ?? true;
  $('#product-published').checked = product?.isPublished ?? false;
  $('#upload-label').textContent = product?.imagePath && !product.imagePath.includes('placeholder') ? 'Choose a different photo' : 'Upload a photo';
  photoPreview.hidden = !product?.imagePath;
  photoPreview.src = product?.imagePath || '';
  photoInput.value = '';
  $('#save-product').textContent = product ? 'Save changes' : 'Save product';
  editor.showModal();
  $('#product-name').focus();
}

function closeEditor() {
  editor.close();
}

function showFormErrors(error) {
  for (const [name, message] of Object.entries(error.fieldErrors || {})) {
    const fieldError = document.querySelector(`[data-error-for="${name}"]`);
    if (fieldError) fieldError.textContent = message;
  }
  $('#editor-error').textContent = error.message;
  $('#editor-error').hidden = false;
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  $('#editor-error').hidden = true;
  document.querySelectorAll('[data-error-for]').forEach(node => { node.textContent = ''; });
  const data = new FormData(form);
  data.set('isAvailable', String($('#product-available').checked));
  data.set('isPublished', String($('#product-published').checked));
  if (!photoInput.files.length) data.delete('image');
  const saveButton = $('#save-product');
  saveButton.disabled = true;
  saveButton.textContent = 'Saving…';
  try {
    await api(editingId ? `/api/admin/products/${editingId}` : '/api/admin/products', {
      method: editingId ? 'PATCH' : 'POST',
      body: data,
    });
    closeEditor();
    await loadProducts();
    showToast(editingId ? 'Your product has been updated.' : 'Your product has been added.');
  } catch (error) {
    showFormErrors(error);
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = editingId ? 'Save changes' : 'Save product';
  }
});

photoInput.addEventListener('change', () => {
  const [file] = photoInput.files;
  if (!file) return;
  photoPreview.src = URL.createObjectURL(file);
  photoPreview.hidden = false;
  $('#upload-label').textContent = file.name;
});

$('#add-product').addEventListener('click', () => openEditor());
$('#empty-add').addEventListener('click', () => openEditor());
$('#close-editor').addEventListener('click', closeEditor);
$('#cancel-editor').addEventListener('click', closeEditor);
$('#search-products').addEventListener('input', event => {
  searchText = event.target.value.trim().toLowerCase();
  renderProducts();
});

document.querySelectorAll('.filter-button').forEach(button => {
  button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll('.filter-button').forEach(item => item.classList.toggle('active', item === button));
    renderProducts();
  });
});

async function signOut() {
  await api('/api/admin/logout', { method: 'POST' });
  window.location.assign('/admin/login');
}
$('#sign-out').addEventListener('click', signOut);
$('#sign-out-mobile').addEventListener('click', signOut);

$('#product-list').addEventListener('click', async event => {
  const button = event.target.closest('[data-action="delete"]');
  if (!button) return;
  const product = products.find(item => String(item.id) === button.dataset.id);
  if (!product || !window.confirm(`Remove “${product.name}” from your products? This cannot be undone.`)) return;
  try {
    await api(`/api/admin/products/${product.id}`, { method: 'DELETE' });
    await loadProducts();
    showToast('The product has been removed.');
  } catch (error) {
    showToast(error.message);
  }
});

(async () => {
  try {
    const current = await api('/api/admin/session');
    if (!current.authenticated) return window.location.assign('/admin/login');
    $('#admin-email').textContent = current.email;
    await loadProducts();
  } catch (error) {
    $('#editor-error').textContent = error.message;
  }
})();
