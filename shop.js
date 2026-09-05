// =========================
// Supabase 연결 정보
// =========================
// Supabase Shop 프로젝트의 Project URL / Publishable Key를 입력하세요.
const SUPABASE_URL = "https://dwtgwncmywmcazdakbad.supabase.co";
const SUPABASE_KEY = "sb_publishable_Px9oHaFswB92Hbq5EAERUg_rEk7o2ei";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

let products = [];

// =========================
// DOM 요소
// =========================
const productGrid = document.getElementById("productGrid");
const filters = document.querySelectorAll(".filter");
const cartDrawer = document.getElementById("cartDrawer");
const cartBtn = document.getElementById("cartBtn");
const closeCart = document.getElementById("closeCart");
const overlay = document.getElementById("overlay");
const cartItems = document.getElementById("cartItems");
const cartCount = document.getElementById("cartCount");
const cartTotal = document.getElementById("cartTotal");
const productModal = document.getElementById("productModal");
const modalClose = document.getElementById("modalClose");
const modalImage = document.getElementById("modalImage");
const modalName = document.getElementById("modalName");
const modalPrice = document.getElementById("modalPrice");
const modalCategory = document.getElementById("modalCategory");
const modalDescription = document.getElementById("modalDescription");
const modalSizes = document.getElementById("modalSizes");
const modalAddBtn = document.getElementById("modalAddBtn");
const imagePrev = document.getElementById("imagePrev");
const imageNext = document.getElementById("imageNext");
const modalQtyMinus = document.getElementById("modalQtyMinus");
const modalQtyPlus = document.getElementById("modalQtyPlus");
const modalQuantity = document.getElementById("modalQuantity");

// =========================
// 상태값
// =========================
const CART_STORAGE_KEY = "idioteque_cart";

function loadSavedCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch (error) {
    console.warn("저장된 장바구니를 불러오지 못했습니다.", error);
    return [];
  }
}

function saveCart() {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
}

let cart = loadSavedCart();
let currentProduct = null;
let selectedSize = null;
let currentImageIndex = 0;
let selectedQuantity = 1;

const formatPrice = price => "₩" + Number(price).toLocaleString("ko-KR");
const mainImage = product => product.images?.[0] || "";

// =========================
// Supabase에서 상품 불러오기
// =========================
async function loadProducts() {
  productGrid.innerHTML = '<p class="empty-cart">LOADING...</p>';

  const { data, error } = await supabaseClient
    .from("products")
    .select(`
      id,
      name,
      price,
      category,
      description,
      is_active,
      product_images (
        image_url,
        sort_order
      ),
      product_variants (
        id,
        size,
        stock
      )
    `)
    .eq("is_active", true)
    .order("id", { ascending: true });

  if (error) {
    console.error("상품 불러오기 실패:", error);
    productGrid.innerHTML = '<p class="empty-cart">상품을 불러오지 못했습니다. Supabase URL/Key와 RLS 설정을 확인해주세요.</p>';
    return;
  }

  products = (data || []).map(product => ({
    id: product.id,
    name: product.name,
    price: product.price,
    category: product.category,
    description: product.description || "",
    images: [...(product.product_images || [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(image => image.image_url),
    variants: [...(product.product_variants || [])]
      .sort((a, b) => sizeOrder(a.size) - sizeOrder(b.size))
  }));

  renderProducts();
}

function sizeOrder(size) {
  const order = { XS: 1, S: 2, M: 3, L: 4, XL: 5, XXL: 6, FREE: 7 };
  return order[String(size).toUpperCase()] ?? 99;
}

// =========================
// 상품 목록
// =========================
function renderProducts(category = "all") {
  productGrid.innerHTML = "";

  const list = category === "all"
    ? products
    : products.filter(product => product.category === category);

  list.forEach(product => {
    const card = document.createElement("article");
    card.className = "product-card";

    card.innerHTML = `
      <button class="product-image" data-id="${product.id}">
        <img src="${mainImage(product)}" alt="${product.name}">
      </button>
      <div class="product-info">
        <div>
          <h3>${product.name}</h3>
          <p>${product.category.toUpperCase()}</p>
        </div>
        <span>${formatPrice(product.price)}</span>
      </div>
    `;

    productGrid.appendChild(card);
  });

  document.querySelectorAll(".product-image").forEach(button => {
    button.onclick = () => {
      const product = products.find(
        item => item.id === Number(button.dataset.id)
      );
      if (product) openProduct(product);
    };
  });
}

filters.forEach(button => {
  button.onclick = () => {
    filters.forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    renderProducts(button.dataset.category);
  };
});

// =========================
// 상품 상세 / 이미지
// =========================
function updateModalImage() {
  if (!currentProduct) return;

  modalImage.src = currentProduct.images[currentImageIndex] || "";
  modalImage.alt = `${currentProduct.name} ${currentImageIndex + 1}`;

  const single = currentProduct.images.length <= 1;
  imagePrev.classList.toggle("is-hidden", single);
  imageNext.classList.toggle("is-hidden", single);
}

function renderSizeButtons(product) {
  modalSizes.innerHTML = "";

  product.variants.forEach(variant => {
    const button = document.createElement("button");
    button.className = "size-btn";
    button.textContent = variant.size;
    button.dataset.size = variant.size;
    button.dataset.stock = variant.stock;

    if (variant.stock <= 0) {
      button.disabled = true;
      button.classList.add("sold-out");
    }

    button.onclick = () => {
      if (button.disabled) return;
      modalSizes.querySelectorAll(".size-btn").forEach(item => {
        item.classList.remove("selected");
      });
      button.classList.add("selected");
      selectedSize = variant.size;
    };

    modalSizes.appendChild(button);
  });
}

function openProduct(product) {
  currentProduct = product;
  currentImageIndex = 0;
  selectedSize = null;
  selectedQuantity = 1;
  modalQuantity.textContent = selectedQuantity;

  updateModalImage();
  renderSizeButtons(product);

  modalName.textContent = product.name;
  modalPrice.textContent = formatPrice(product.price);
  modalCategory.textContent = product.category.toUpperCase();
  modalDescription.textContent = product.description || "제품 상세 설명이 없습니다.";

  productModal.classList.add("open");
  overlay.classList.add("active");
  document.body.classList.add("no-scroll");
}

imagePrev.onclick = event => {
  event.stopPropagation();
  if (!currentProduct || currentProduct.images.length <= 1) return;

  currentImageIndex =
    (currentImageIndex - 1 + currentProduct.images.length) %
    currentProduct.images.length;

  updateModalImage();
};

imageNext.onclick = event => {
  event.stopPropagation();
  if (!currentProduct || currentProduct.images.length <= 1) return;

  currentImageIndex =
    (currentImageIndex + 1) % currentProduct.images.length;

  updateModalImage();
};

// =========================
// 상품 상세 수량 선택
// =========================
modalQtyMinus.onclick = () => {
  if (selectedQuantity > 1) {
    selectedQuantity--;
    modalQuantity.textContent = selectedQuantity;
  }
};

modalQtyPlus.onclick = () => {
  if (!currentProduct) return;

  if (!selectedSize) {
    alert("사이즈를 먼저 선택해주세요.");
    return;
  }

  const variant = currentProduct.variants.find(
    item => item.size === selectedSize
  );

  if (!variant || variant.stock <= 0) {
    alert("품절된 상품입니다.");
    return;
  }

  const same = cart.find(
    item => item.id === currentProduct.id && item.size === selectedSize
  );
  const alreadyInCart = same ? same.quantity : 0;

  if (alreadyInCart + selectedQuantity >= variant.stock) {
    alert("현재 재고보다 많이 선택할 수 없습니다.");
    return;
  }

  selectedQuantity++;
  modalQuantity.textContent = selectedQuantity;
};

// =========================
// 장바구니
// =========================
modalAddBtn.onclick = () => {
  if (!currentProduct) return;

  if (!selectedSize) {
    alert("사이즈를 선택해주세요.");
    return;
  }

  const variant = currentProduct.variants.find(
    item => item.size === selectedSize
  );

  if (!variant || variant.stock <= 0) {
    alert("품절된 상품입니다.");
    return;
  }

  const same = cart.find(
    item => item.id === currentProduct.id && item.size === selectedSize
  );

  const currentQuantity = same ? same.quantity : 0;

  if (currentQuantity + selectedQuantity > variant.stock) {
    alert(`현재 재고는 ${variant.stock}개입니다.`);
    return;
  }

  if (same) {
    same.quantity += selectedQuantity;
  } else {
    cart.push({
      ...currentProduct,
      size: selectedSize,
      variantId: variant.id,
      stock: variant.stock,
      quantity: selectedQuantity
    });
  }

  updateCart();
  closeProductModal();
  openCart();
};

function updateCart() {
  cartItems.innerHTML = cart.length
    ? ""
    : '<p class="empty-cart">YOUR CART IS EMPTY.</p>';

  cart.forEach((item, index) => {
    const element = document.createElement("div");
    element.className = "cart-item";

    element.innerHTML = `
      <img src="${mainImage(item)}" alt="${item.name}">
      <div class="cart-item-info">
        <h3>${item.name}</h3>
        <p>SIZE ${item.size}</p>
        <p>${formatPrice(item.price)}</p>
        <div class="quantity">
          <button onclick="changeQuantity(${index}, -1)">−</button>
          <span>${item.quantity}</span>
          <button onclick="changeQuantity(${index}, 1)">+</button>
        </div>
      </div>
      <button class="remove" onclick="removeItem(${index})">×</button>
    `;

    cartItems.appendChild(element);
  });

  cartCount.textContent = cart.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  cartTotal.textContent = formatPrice(
    cart.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    )
  );

  saveCart();
}

window.changeQuantity = (index, amount) => {
  const item = cart[index];
  if (!item) return;

  const nextQuantity = item.quantity + amount;

  if (nextQuantity <= 0) {
    cart.splice(index, 1);
    updateCart();
    return;
  }

  if (nextQuantity > item.stock) {
    alert("현재 재고보다 많이 담을 수 없습니다.");
    return;
  }

  item.quantity = nextQuantity;
  updateCart();
};

window.removeItem = index => {
  cart.splice(index, 1);
  updateCart();
};

function openCart() {
  cartDrawer.classList.add("open");
  overlay.classList.add("active");
  document.body.classList.add("no-scroll");
}

function closeAll() {
  cartDrawer.classList.remove("open");
  productModal.classList.remove("open");
  overlay.classList.remove("active");
  document.body.classList.remove("no-scroll");
}

function closeProductModal() {
  productModal.classList.remove("open");
  overlay.classList.remove("active");
  document.body.classList.remove("no-scroll");
}

cartBtn.onclick = openCart;
closeCart.onclick = closeAll;
modalClose.onclick = closeProductModal;
overlay.onclick = closeAll;

document.getElementById("checkoutBtn").onclick = () => {
  if (!cart.length) {
    alert("장바구니가 비어 있습니다.");
    return;
  }

  saveCart();
  window.location.href = "checkout.html";
};

// =========================
// 초기 실행
// =========================
updateCart();
loadProducts();
