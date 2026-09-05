const CART_STORAGE_KEY = "idioteque_cart";
const SUPABASE_URL = "https://dwtgwncmywmcazdakbad.supabase.co";
const SUPABASE_KEY = "sb_publishable_Px9oHaFswB92Hbq5EAERUg_rEk7o2ei";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const orderItems = document.getElementById("orderItems");
const subtotal = document.getElementById("subtotal");
const orderTotal = document.getElementById("orderTotal");
const paymentBtn = document.getElementById("paymentBtn");
const checkoutForm = document.getElementById("checkoutForm");

const formatPrice = price => "₩" + Number(price).toLocaleString("ko-KR");
const mainImage = item => item.images?.[0] || "";

function getCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch (error) {
    console.warn("장바구니를 불러오지 못했습니다.", error);
    return [];
  }
}

function renderOrder() {
  const cart = getCart();
  orderItems.innerHTML = "";

  if (!cart.length) {
    orderItems.innerHTML = '<p class="empty-order">YOUR CART IS EMPTY.<br><br><a href="shop.html">← 쇼핑 계속하기</a></p>';
    paymentBtn.disabled = true;
  } else {
    cart.forEach(item => {
      const element = document.createElement("article");
      element.className = "order-item";
      element.innerHTML = `
        <img src="${mainImage(item)}" alt="${item.name}">
        <div><h3>${item.name}</h3><p>SIZE ${item.size}</p><p>QTY ${item.quantity}</p></div>
        <span class="order-item-price">${formatPrice(item.price * item.quantity)}</span>
      `;
      orderItems.appendChild(element);
    });
  }

  const total = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  subtotal.textContent = formatPrice(total);
  orderTotal.textContent = formatPrice(total);
}

document.getElementById("postcodeBtn").onclick = () => {
  alert("다음 단계에서 카카오 주소 검색 API를 연결하면 자동 주소 검색을 사용할 수 있습니다.");
};

checkoutForm.onsubmit = async event => {
  event.preventDefault();
  const cart = getCart();
  if (!cart.length || paymentBtn.disabled) return;

  const formData = new FormData(checkoutForm);
  const originalText = paymentBtn.textContent;
  paymentBtn.disabled = true;
  paymentBtn.textContent = "SAVING...";

  const items = cart.map(item => ({
    product_id: item.id,
    variant_id: item.variantId,
    quantity: item.quantity
  }));

  const { data, error } = await supabaseClient.rpc("create_order", {
    p_customer_name: formData.get("name"),
    p_phone: formData.get("phone"),
    p_postal_code: formData.get("postcode"),
    p_address: formData.get("address"),
    p_address_detail: formData.get("addressDetail"),
    p_delivery_note: formData.get("deliveryNote"),
    p_items: items
  });

  if (error) {
    console.error("주문 저장 실패:", error);
    alert(`주문을 저장하지 못했습니다.\n${error.message}`);
    paymentBtn.disabled = false;
    paymentBtn.textContent = originalText;
    return;
  }

  localStorage.removeItem(CART_STORAGE_KEY);
  const orderCode = data?.order_code || "확인 중";
  alert(`테스트 주문이 저장되었습니다.\n주문번호: ${orderCode}`);
  window.location.href = "shop.html";
};

renderOrder();
