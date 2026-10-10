
const OWNER_EMAIL = "allanaraujo58917@gmail.com";

const products = [];
const listEl = document.querySelector("#productList");
const editor = document.querySelector("#editorDialog");
const form = document.querySelector("#productForm");

let toastTimer;
let busy = false;

function normalizeProduct(product) {
  return {
    id: String(product.id ?? ""),
    name: String(product.nome ?? product.name ?? ""),
    category: String(product.categoria ?? product.category ?? "Outros"),
    price: Number(product.preco ?? product.price) || 0,
    description: String(product.descricao ?? product.description ?? ""),
    image: String(product.foto_url ?? product.image ?? ""),
    badge: String(product.selo ?? product.badge ?? ""),
    active: (product.disponivel ?? product.active) !== false,
  };
}

function toDatabaseProduct(product) {
  return {
    nome: product.name,
    categoria: product.category,
    preco: product.price,
    descricao: product.description,
    foto_url: product.image || null,
    selo: product.badge || null,
    disponivel: product.active,
  };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function showToast(message) {
  const toast = document.querySelector("#adminToast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
}

async function verifyOwnerSession() {
  const { data, error } = await window.supabaseClient.auth.getSession();
  const email = data.session?.user?.email?.toLowerCase();

  if (error || !data.session || email !== OWNER_EMAIL) {
    await window.supabaseClient.auth.signOut();
    window.location.replace("index.html?admin=login");
    return false;
  }

  return true;
}

async function loadProducts() {
  const { data, error } = await window.supabaseClient
    .from("produtos")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    console.error("Erro ao carregar produtos:", error);
    showToast("Erro ao carregar produtos. Confira a conexão e as permissões.");
    return false;
  }

  products.splice(0, products.length, ...(data || []).map(normalizeProduct));
  render();
  return true;
}

async function saveProduct(product) {
  const payload = toDatabaseProduct(product);

  let query;

  if (product.id) {
    query = window.supabaseClient
      .from("produtos")
      .update(payload)
      .eq("id", product.id)
      .select()
      .single();
  } else {
    query = window.supabaseClient
      .from("produtos")
      .insert(payload)
      .select()
      .single();
  }

  const { data, error } = await query;

  if (error) {
    console.error("Erro ao salvar produto:", error);
    showToast("Não foi possível salvar o produto no banco.");
    return false;
  }

  if (product.id) {
    const index = products.findIndex((item) => item.id === product.id);
    if (index !== -1) products[index] = normalizeProduct(data);
  } else {
    products.push(normalizeProduct(data));
  }

  render();
  return true;
}

async function toggleProduct(product) {
  const { data, error } = await window.supabaseClient
    .from("produtos")
    .update({ disponivel: !product.active })
    .eq("id", product.id)
    .select()
    .single();

  if (error) {
    console.error(error);
    showToast("Não foi possível alterar a disponibilidade.");
    return;
  }

  const index = products.findIndex((item) => item.id === product.id);
  if (index !== -1) products[index] = normalizeProduct(data);

  render();
  showToast(product.active ? "Produto ocultado do cardápio." : "Produto publicado no cardápio.");
}

async function deleteProduct(product) {
  if (!window.confirm(`Excluir "${product.name}" do cardápio?`)) return;

  const { error } = await window.supabaseClient
    .from("produtos")
    .delete()
    .eq("id", product.id);

  if (error) {
    console.error(error);
    showToast("Não foi possível excluir o produto.");
    return;
  }

  const index = products.findIndex((item) => item.id === product.id);
  if (index !== -1) products.splice(index, 1);

  render();
  showToast("Produto excluído do banco de dados.");
}

function renderCategories() {
  const categories = [
    ...new Set(products.map((product) => product.category).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));

  const filter = document.querySelector("#categoryFilter");
  const previous = filter.value;

  filter.innerHTML =
    '<option value="">Todas as categorias</option>' +
    categories.map((category) =>
      `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`
    ).join("");

  if (categories.includes(previous)) filter.value = previous;

  document.querySelector("#categoryOptions").innerHTML = categories
    .map((category) => `<option value="${escapeHtml(category)}"></option>`)
    .join("");
}

function render() {
  renderCategories();

  const query = document.querySelector("#productSearch")
    .value.trim().toLocaleLowerCase("pt-BR");
  const category = document.querySelector("#categoryFilter").value;
  const status = document.querySelector("#statusFilter").value;

  const filtered = products.filter((product) => {
    const text = `${product.name} ${product.category} ${product.description}`
      .toLocaleLowerCase("pt-BR");

    return (
      text.includes(query) &&
      (!category || product.category === category) &&
      (!status || (status === "active" ? product.active : !product.active))
    );
  });

  listEl.innerHTML = filtered.map((product) => `
    <article class="admin-product">
      <img data-product-image src="${escapeHtml(product.image)}"
        alt="${escapeHtml(product.name)}" />
      <div class="admin-product-info">
        <strong>${escapeHtml(product.name)}</strong>
        <span>${escapeHtml(product.category)}</span>
        <p>${escapeHtml(product.description || "Sem descrição")}</p>
      </div>
      <strong class="admin-price">${formatMoney(product.price)}</strong>
      <button class="status-toggle ${product.active ? "" : "inactive"}"
        data-toggle="${escapeHtml(product.id)}" type="button">
        <i class="status-dot"></i>${product.active ? "Visível" : "Oculto"}
      </button>
      <div class="product-actions">
        <button class="small-action" data-edit="${escapeHtml(product.id)}"
          type="button">EDITAR</button>
        <button class="small-action delete" data-delete="${escapeHtml(product.id)}"
          type="button">EXCLUIR</button>
      </div>
    </article>
  `).join("");

  listEl.querySelectorAll("[data-product-image]").forEach((image) => {
    image.addEventListener("error", () => { image.hidden = true; });
  });

  listEl.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => openEditor(button.dataset.edit));
  });

  listEl.querySelectorAll("[data-toggle]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (busy) return;
      const product = products.find((item) => item.id === button.dataset.toggle);
      if (product) await toggleProduct(product);
    });
  });

  listEl.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (busy) return;
      const product = products.find((item) => item.id === button.dataset.delete);
      if (product) await deleteProduct(product);
    });
  });

  document.querySelector("#productTotal").textContent = products.length;
  document.querySelector("#categoryTotal").textContent =
    new Set(products.map((product) => product.category)).size;
  document.querySelector("#activeTotal").textContent =
    products.filter((product) => product.active).length;
  document.querySelector("#emptyState").hidden = filtered.length > 0;
}

function openEditor(id = "") {
  form.reset();

  const product = products.find((item) => item.id === id);

  document.querySelector("#productId").value = product?.id || "";
  document.querySelector("#editorTitle").textContent =
    product ? "Editar produto" : "Adicionar produto";
  document.querySelector("#saveProduct").textContent =
    product ? "SALVAR ALTERAÇÕES" : "ADICIONAR AO CARDÁPIO";

  document.querySelector("#productName").value = product?.name || "";
  document.querySelector("#productCategory").value = product?.category || "";
  document.querySelector("#productPrice").value =
    product ? product.price.toFixed(2) : "";
  document.querySelector("#productDescription").value = product?.description || "";
  document.querySelector("#productBadge").value = product?.badge || "";
  document.querySelector("#productImage").value = product?.image || "";
  document.querySelector("#productActive").checked = product?.active ?? true;

  updateImagePreview();
  editor.showModal();
}

function updateImagePreview() {
  const image = document.querySelector("#imagePreview");
  const placeholder = document.querySelector("#imagePlaceholder");
  const path = document.querySelector("#productImage").value.trim();

  image.hidden = !path;
  placeholder.hidden = Boolean(path);

  image.onerror = () => {
    image.hidden = true;
    placeholder.hidden = false;
  };

  if (path) image.src = path;
}

document.querySelector("#adminLogout").addEventListener("click", async () => {
  const { error } = await window.supabaseClient.auth.signOut();

  if (error) {
    showToast("Não foi possível encerrar a sessão.");
    return;
  }

  window.location.href = "index.html";
});

document.querySelector("#addProduct").addEventListener("click", () => openEditor());
document.querySelector("#closeEditor").addEventListener("click", () => editor.close());
document.querySelector("#cancelEditor").addEventListener("click", () => editor.close());
document.querySelector("#productImage").addEventListener("input", updateImagePreview);
document.querySelector("#productSearch").addEventListener("input", render);
document.querySelector("#categoryFilter").addEventListener("change", render);
document.querySelector("#statusFilter").addEventListener("change", render);

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (busy) return;
  busy = true;

  const saveButton = document.querySelector("#saveProduct");
  saveButton.disabled = true;

  const id = document.querySelector("#productId").value;
  const product = normalizeProduct({
    id,
    name: document.querySelector("#productName").value.trim(),
    category: document.querySelector("#productCategory").value.trim(),
    price: Number(document.querySelector("#productPrice").value),
    description: document.querySelector("#productDescription").value.trim(),
    badge: document.querySelector("#productBadge").value.trim(),
    image: document.querySelector("#productImage").value.trim(),
    active: document.querySelector("#productActive").checked,
  });

  try {
    const saved = await saveProduct(product);

    if (saved) {
      editor.close();
      showToast(id ? "Produto atualizado." : "Produto adicionado ao cardápio.");
    }
  } finally {
    busy = false;
    saveButton.disabled = false;
  }
});

document.querySelector("#exportMenu").addEventListener("click", () => {
  const search = document.querySelector("#productSearch");
  const category = document.querySelector("#categoryFilter");
  const status = document.querySelector("#statusFilter");
  const previousTitle = document.title;
  search.value = "";
  category.value = "";
  status.value = "active";
  document.title = "Cardápio - Pontilhão Burguer";
  render();
  window.addEventListener("afterprint", () => {
    status.value = "";
    document.title = previousTitle;
    render();
  }, { once: true });
  window.print();
});

const adminThemeToggle = document.querySelector("#adminThemeToggle");
function setAdminTheme(dark) {
  document.body.classList.toggle("admin-dark", dark);
  adminThemeToggle.setAttribute("aria-pressed", String(dark));
  adminThemeToggle.innerHTML = dark
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 15.2A8.5 8.5 0 0 1 8.8 3.8 8.5 8.5 0 1 0 20.2 15.2Z"/></svg>MODO CLARO'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>MODO ESCURO';
  localStorage.setItem("pontilhao-admin-theme", dark ? "dark" : "light");
}
setAdminTheme(localStorage.getItem("pontilhao-admin-theme") === "dark");
adminThemeToggle.addEventListener("click", () => {
  setAdminTheme(!document.body.classList.contains("admin-dark"));
});

async function initAdmin() {
  const authorized = await verifyOwnerSession();
  if (!authorized) return;

  await loadProducts();
}

initAdmin();
