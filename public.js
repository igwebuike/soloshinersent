const productGrid = document.querySelector('#productGrid');
const modal = document.querySelector('#modal');
const drawer = document.querySelector('#drawer');
let products = [];
let cart = [];
let chosenProductId = null;

const money = cents => `$${(cents / 100).toFixed(2)}`;

function makeProductCard(product) {
  const card = document.createElement('article');
  card.className = 'product';
  card.dataset.productId = product.id;

  const image = document.createElement('img');
  image.src = product.imagePath || '/assets/product-placeholder.svg';
  image.alt = product.name;
  image.loading = 'lazy';
  const title = document.createElement('h3');
  title.textContent = product.name;
  const description = document.createElement('p');
  description.textContent = product.description || '';
  const price = document.createElement('span');
  price.className = 'price';
  price.textContent = money(product.priceCents);
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.addToBag = '';
  button.textContent = product.isAvailable ? 'CUSTOMIZE & ADD +' : 'CURRENTLY UNAVAILABLE';
  button.disabled = !product.isAvailable;
  card.append(image, title, description, price, button);
  return card;
}

async function loadProducts() {
  productGrid.replaceChildren();
  try {
    const response = await fetch('/api/products', { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Products are temporarily unavailable. Please try again soon.');
    products = await response.json();
    if (!products.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-shop';
      empty.textContent = 'Our products are on their way. Please check back soon.';
      productGrid.append(empty);
      return;
    }
    for (const product of products) productGrid.append(makeProductCard(product));
  } catch (error) {
    products = [];
    const message = document.createElement('p');
    message.className = 'empty-shop';
    message.textContent = error.message;
    productGrid.append(message);
  }
}

function openModal(productId) {
  const product = products.find(item => String(item.id) === String(productId));
  if (!product) return;
  chosenProductId = product.id;
  document.querySelector('#modalTitle').textContent = product.name;
  document.querySelector('#modalPrice').textContent = money(product.priceCents);
  document.querySelector('#qty').value = '1';
  modal.hidden = false;
}

function closeModal() {
  modal.hidden = true;
}

function buildInquiryUrl(items = cart) {
  if (!items.length) return '';
  const details = items.map(product => `${product.qty} x ${product.name} (${money(product.priceCents)} each) — ${product.scent}; ${product.color}`).join('\n');
  const body = `Hello Serrell, I would like to inquire about:\n\n${details}\n\nPlease confirm availability, final pricing, shipping, and payment instructions.`;
  return `mailto:soloshiners21@yahoo.com?subject=${encodeURIComponent('Shiner Scents order inquiry')}&body=${encodeURIComponent(body)}`;
}

function addToCart() {
  const product = products.find(item => String(item.id) === String(chosenProductId));
  if (!product) return;
  const quantity = Math.min(30, Math.max(1, Number(document.querySelector('#qty').value) || 1));
  cart.push({
    ...product,
    qty: quantity,
    scent: document.querySelector('#scent').value,
    color: document.querySelector('#color').value,
  });
  closeModal();
  showCart();
}

function showCart() {
  drawer.hidden = false;
  document.querySelector('#count').textContent = cart.reduce((total, product) => total + product.qty, 0);
  const cartItems = document.querySelector('#cartItems');
  cartItems.replaceChildren();
  if (!cart.length) {
    cartItems.textContent = 'Your bag is empty.';
  } else {
    cart.forEach((product, index) => {
      const line = document.createElement('div');
      line.className = 'cartline';
      const name = document.createElement('strong');
      name.textContent = product.name;
      const quantity = document.createElement('p');
      quantity.textContent = `${product.qty} × ${money(product.priceCents)}`;
      const options = document.createElement('p');
      options.className = 'note';
      options.textContent = `${product.scent} · ${product.color}`;
      const remove = document.createElement('button');
      remove.className = 'outline';
      remove.type = 'button';
      remove.dataset.remove = String(index);
      remove.textContent = 'Remove';
      line.append(name, quantity, options, remove);
      cartItems.append(line);
    });
  }
  const subtotal = cart.reduce((total, product) => total + product.priceCents * product.qty, 0);
  document.querySelector('#total').textContent = `Estimated subtotal: ${money(subtotal)}`;
}

function hideCart() {
  drawer.hidden = true;
}

function inquire() {
  const href = buildInquiryUrl();
  if (href) window.location.href = href;
}

productGrid.addEventListener('click', event => {
  const button = event.target.closest('[data-add-to-bag]');
  const card = button?.closest('[data-product-id]');
  if (card) openModal(card.dataset.productId);
});
document.querySelector('#openCart').addEventListener('click', showCart);
document.querySelector('#closeModal').addEventListener('click', closeModal);
document.querySelector('#addToBag').addEventListener('click', addToCart);
document.querySelector('#closeCart').addEventListener('click', hideCart);
document.querySelector('#continueShopping').addEventListener('click', hideCart);
document.querySelector('#inquire').addEventListener('click', inquire);
document.querySelector('#cartItems').addEventListener('click', event => {
  const remove = event.target.closest('[data-remove]');
  if (!remove) return;
  cart.splice(Number(remove.dataset.remove), 1);
  showCart();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    hideCart();
    closeModal();
  }
});

window.buildInquiryUrl = buildInquiryUrl;
loadProducts();
