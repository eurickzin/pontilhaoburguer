// Configure with the lanchonete's WhatsApp, including country and area code (digits only).
const WHATSAPP_NUMBER = "5584988011667";

let productsData = [];
let categories = ["Tudo"];
const cart = new Map();
let activeCategory = "Tudo";
let searchTerm = "";
const money = (value) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value,
  );
const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
const productsEl = document.querySelector("#products");
function renderCategories() {
  document.querySelector("#categories").innerHTML = categories
    .map(
      (cat) =>
        `<button class="cat-btn ${cat === activeCategory ? "active" : ""}" role="tab" aria-selected="${cat === activeCategory}" data-category="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`,
    )
    .join("");
  document.querySelectorAll(".cat-btn").forEach(
    (btn) =>
      (btn.onclick = () => {
        activeCategory = btn.dataset.category;
        renderCategories();
        renderProducts();
      }),
  );
}
function renderProducts() {
  const filtered = productsData.filter(
    (p) =>
      p.active !== false &&
      (activeCategory === "Tudo" || p.category === activeCategory) &&
      `${p.name} ${p.description} ${p.category}`
        .toLowerCase()
        .includes(searchTerm),
  );
  productsEl.innerHTML = filtered.length
    ? filtered
        .map(
          (p) =>
            `<article class="product-card">${p.badge ? `<span class="badge">${escapeHtml(p.badge)}</span>` : ""}<img class="product-photo" src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy"/><div class="product-info"><span class="product-category">${escapeHtml(p.category)}</span><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.description)}</p><div class="product-bottom"><span class="price">${money(p.price)}</span><button class="add-btn" aria-label="Adicionar ${escapeHtml(p.name)}" data-add="${escapeHtml(p.id)}">+</button></div></div></article>`,
        )
        .join("")
    : '<div class="no-results">Não encontramos esse item. Tente outra busca.</div>';
  document
    .querySelectorAll("[data-add]")
    .forEach((button) => (button.onclick = () => addItem(button.dataset.add)));
}
async function loadPublicMenu() {
  productsEl.innerHTML = '<div class="no-results">Carregando cardápio...</div>';

  const { data, error } = await window.supabaseClient
    .from("produtos")
    .select("id,nome,categoria,preco,descricao,foto_url,selo,disponivel")
    .eq("disponivel", true)
    .order("id");

  if (error) {
    console.error("Erro ao carregar o cardápio:", error);
    productsData = [];
    categories = ["Tudo"];
    renderCategories();
    productsEl.innerHTML =
      '<div class="no-results">Não foi possível carregar o cardápio. Tente novamente em instantes.</div>';
    showToast("Erro ao conectar ao cardápio.");
    return;
  }

  productsData = (data || []).map((row) => ({
    id: String(row.id),
    name: row.nome,
    category: row.categoria,
    price: Number(row.preco),
    description: row.descricao || "",
    image: row.foto_url || "",
    badge: row.selo || "",
    active: row.disponivel,
  }));

  categories = [
    "Tudo",
    ...new Set(productsData.map((product) => product.category)),
  ];

  activeCategory = "Tudo";
  renderCategories();
  renderProducts();
  renderCart();
}

function addItem(id) {
  const item = cart.get(id);
  cart.set(id, { qty: (item?.qty || 0) + 1 });
  renderCart();
  showToast(
    `${productsData.find((p) => p.id === id).name} adicionado à sacola`,
  );
}
function changeQty(id, delta) {
  const item = cart.get(id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart.delete(id);
  renderCart();
}
function renderCart() {
  const list = document.querySelector("#cartItems");
  let total = 0,
    count = 0;
  const entries = [...cart.entries()];
  if (!entries.length) {
    list.innerHTML =
      '<div class="empty-cart"><div class="empty-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></div><strong>Sua sacola tá esperando</strong><span>Escolha um lanche pra começar.</span></div>';
  } else {
    list.innerHTML = entries
      .map(([id, { qty }]) => {
        const product = productsData.find((p) => p.id === id);
        total += qty * product.price;
        count += qty;
        const safeId = escapeHtml(id);
        const safeName = escapeHtml(product.name);
        return `<div class="cart-row"><span class="cart-row-name">${safeName}</span><span class="cart-row-price">${money(qty * product.price)}</span><div class="cart-row-controls"><div class="qty-control"><button aria-label="Remover uma unidade de ${safeName}" data-change="${safeId}" data-delta="-1">−</button><span>${qty}</span><button aria-label="Adicionar uma unidade de ${safeName}" data-change="${safeId}" data-delta="1">+</button></div><button class="remove-item" data-remove="${safeId}">remover</button></div></div>`;
      })
      .join("");
  }
  document.querySelector("#subtotal").textContent = money(total);
  document.querySelector("#cartCount").textContent = `(${count})`;
  document.querySelector("#headerCount").textContent = count;
  document.querySelector("#mobileCount").textContent = count;
  document.querySelector("#mobileSubtotal").textContent = money(total);
  document.querySelector("#checkout").disabled = count === 0;
  document
    .querySelector("#mobileCartBar")
    .classList.toggle("visible", count > 0);
  document.body.classList.toggle("has-mobile-cart", count > 0);
  list
    .querySelectorAll("[data-change]")
    .forEach(
      (btn) =>
        (btn.onclick = () =>
          changeQty(btn.dataset.change, Number(btn.dataset.delta))),
    );
  list.querySelectorAll("[data-remove]").forEach(
    (btn) =>
      (btn.onclick = () => {
        cart.delete(btn.dataset.remove);
        renderCart();
      }),
  );
}
function sendOrder() {
  if (!cart.size) return;
  if (!document.querySelector("#customerName").reportValidity()) return;
  const selectedFulfillment = document.querySelector(
    'input[name="fulfillment"]:checked',
  );
  if (!selectedFulfillment) {
    document.querySelector('input[name="fulfillment"]').reportValidity();
    return;
  }
  const customerAddress = document.querySelector("#customerAddress");
  if (
    selectedFulfillment.value === "Entrega" &&
    !customerAddress.reportValidity()
  )
    return;
  const selectedPayment = document.querySelector(
    'input[name="paymentMethod"]:checked',
  );
  if (!selectedPayment) {
    document.querySelector('input[name="paymentMethod"]').reportValidity();
    return;
  }
  const lines = [...cart.entries()].map(([id, { qty }]) => {
    const p = productsData.find((item) => item.id === id);
    return `- ${qty}x ${p.name} - ${money(p.price * qty)}`;
  });
  const total = [...cart.entries()].reduce(
    (sum, [id, { qty }]) =>
      sum + productsData.find((p) => p.id === id).price * qty,
    0,
  );
  const customerName = document.querySelector("#customerName").value.trim();
  const fulfillment = selectedFulfillment.value;
  const paymentMethod = selectedPayment.value;
  const orderNotes = document.querySelector("#orderNotes").value.trim();
  const message = `NOVO PEDIDO - PONTILHAO BURGUER\n--------------------\n\nITENS DO PEDIDO\n${lines.join("\n")}\n\nTOTAL DOS ITENS: ${money(total)}\n--------------------\n\nDADOS DO CLIENTE\nNome: ${customerName}\nRecebimento: ${fulfillment}${fulfillment === "Entrega" ? `\nEndereco: ${customerAddress.value.trim()}` : ""}\nPagamento: ${paymentMethod}\nObservacoes: ${orderNotes || "Nenhuma"}`;
  if (!WHATSAPP_NUMBER || WHATSAPP_NUMBER === "5585999999999") {
    showToast("Configure o número do WhatsApp da lanchonete em app.js");
    return;
  }
  window.open(
    `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`,
    "_blank",
    "noopener,noreferrer",
  );
}
let toastTimer;
function showToast(text) {
  const toast = document.querySelector("#toast");
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}
document.querySelector("#search").addEventListener("input", (event) => {
  searchTerm = event.target.value.trim().toLocaleLowerCase("pt-BR");
  renderProducts();
});
window.addEventListener("storage", (event) => {
  if (event.key === MENU_STORAGE_KEY) window.location.reload();
});
document.querySelector("#checkout").addEventListener("click", sendOrder);
const cartPanel = document.querySelector("#cartPanel");
let cartModalTrigger = null;
function openCart() {
  if (!window.matchMedia("(max-width: 720px)").matches) {
    cartPanel.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  cartModalTrigger = document.activeElement;
  document.body.classList.add("cart-modal-open");
  cartPanel.setAttribute("aria-modal", "true");
  cartPanel.removeAttribute("aria-hidden");
  document.querySelector("#closeCart").focus();
}
function closeCart() {
  document.body.classList.remove("cart-modal-open");
  cartPanel.removeAttribute("aria-modal");
  cartPanel.setAttribute("aria-hidden", "true");
  if (cartModalTrigger) cartModalTrigger.focus();
}
const mobileCartQuery = window.matchMedia("(max-width: 720px)");
if (mobileCartQuery.matches) {
  cartPanel.setAttribute("aria-hidden", "true");
}
mobileCartQuery.addEventListener("change", (event) => {
  document.body.classList.remove("cart-modal-open");
  cartPanel.removeAttribute("aria-modal");
  if (event.matches) cartPanel.setAttribute("aria-hidden", "true");
  else cartPanel.removeAttribute("aria-hidden");
});
document.querySelector("#headerCart").addEventListener("click", openCart);
document.querySelector("#mobileGoCart").addEventListener("click", openCart);
document.querySelector("#closeCart").addEventListener("click", closeCart);
document.querySelector("#cartModalBackdrop").addEventListener("click", closeCart);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.body.classList.contains("cart-modal-open")) {
    closeCart();
  }
});
document.querySelectorAll('input[name="fulfillment"]').forEach((input) =>
  input.addEventListener("change", () => {
    const isDelivery = input.value === "Entrega" && input.checked;
    document.querySelector("#deliveryAddressWrap").hidden = !isDelivery;
    document.querySelector("#customerAddress").required = isDelivery;
    if (!isDelivery) document.querySelector("#customerAddress").value = "";
  }),
);
renderCart();
loadPublicMenu();
const themeToggle = document.querySelector("#themeToggle");
function setTheme(isDark) {
  document.body.classList.toggle("dark-mode", isDark);
  themeToggle.setAttribute(
    "aria-label",
    isDark ? "Ativar modo claro" : "Ativar modo escuro",
  );
  themeToggle.title = isDark ? "Ativar modo claro" : "Ativar modo escuro";
  themeToggle.querySelector(".theme-label").textContent = isDark
    ? "MODO CLARO"
    : "MODO ESCURO";
}
setTheme(localStorage.getItem("pontilhao-theme") === "dark");
themeToggle.addEventListener("click", () => {
  const isDark = !document.body.classList.contains("dark-mode");
  setTheme(isDark);
  localStorage.setItem("pontilhao-theme", isDark ? "dark" : "light");
});

const ownerDialog = document.querySelector("#ownerAccessDialog");
const ownerForm = document.querySelector("#ownerAccessForm");
const ownerEmail = document.querySelector("#ownerEmail");
const ownerPassword = document.querySelector("#ownerPassword");
const OWNER_EMAIL = "allanaraujo58917@gmail.com";

async function openOwnerLogin() {
  const { data, error } = await window.supabaseClient.auth.getSession();

  if (!error && data.session) {
    window.location.href = "admin.html";
    return;
  }

  ownerForm.reset();
  document.querySelector("#ownerDialogTitle").innerHTML =
    "Área do <em>proprietário</em>";
  document.querySelector("#ownerDialogMessage").textContent =
    "Entre com o e-mail e a senha cadastrados pelo proprietário.";
  document.querySelector("#ownerSubmit").textContent = "ENTRAR NO PAINEL";
  document.querySelector("#ownerAuthError").hidden = true;
  ownerDialog.showModal();
  ownerEmail.focus();
}

document.querySelector("#ownerAccess").addEventListener("click", openOwnerLogin);
document.querySelector("#closeOwnerDialog").addEventListener("click", () => ownerDialog.close());

ownerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const errorEl = document.querySelector("#ownerAuthError");
  const submitButton = document.querySelector("#ownerSubmit");
  errorEl.hidden = true;
  submitButton.disabled = true;

  try {
    const { data, error } = await window.supabaseClient.auth.signInWithPassword({
      email: ownerEmail.value.trim(),
      password: ownerPassword.value,
    });

    if (error) throw error;

    if (data.user?.email?.toLowerCase() !== OWNER_EMAIL) {
      await window.supabaseClient.auth.signOut();
      throw new Error("Esta conta não tem autorização para acessar o painel.");
    }

    window.location.href = "admin.html";
  } catch (authError) {
    errorEl.textContent =
      authError.message === "Invalid login credentials"
        ? "E-mail ou senha incorretos."
        : authError.message || "Não foi possível entrar. Tente novamente.";
    errorEl.hidden = false;
  } finally {
    submitButton.disabled = false;
  }
});

if (new URLSearchParams(window.location.search).get("admin") === "login") {
  openOwnerLogin();
}
