"use strict";
/* ---------- وضعیت ---------- */
let DB = dbLoad();
const state = { qrId: null, qr: null, cart: loadCart(), catId: null };

/* ---------- ابزار ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fa = n => Number(n || 0).toLocaleString("fa-IR");
const money = n => fa(n) + " تومان";
const dateFa = ts => new Date(ts).toLocaleDateString("fa-IR");
const timeFa = ts => new Date(ts).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });

function loadCart() { try { return JSON.parse(localStorage.getItem("jikopik_cart") || "[]"); } catch { return []; } }
function saveCart() { localStorage.setItem("jikopik_cart", JSON.stringify(state.cart)); }
function cartCount() { return state.cart.reduce((s, i) => s + i.qty, 0); }
function cartTotal() { return state.cart.reduce((s, i) => s + i.price * i.qty, 0); }

function toast(msg, err) {
  const t = document.createElement("div");
  t.className = "toast" + (err ? " err" : "");
  t.textContent = msg;
  $("#toastBox").appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

function openOverlay() { $("#overlay").classList.remove("hidden"); document.body.style.overflow = "hidden"; }
function closeAll() {
  $("#overlay").classList.add("hidden");
  document.body.style.overflow = "";
  ["#cartDrawer", "#productModal", "#checkoutModal", "#trackModal"].forEach(s => $(s).classList.add("hidden"));
}

/* ---------- منو ---------- */
function catEmoji(id) { const c = DB.categories.find(c => c.id === id); return c ? (c.emoji || "🍽️") : "🍽️"; }
function ratingOf(pid) {
  const rs = DB.reviews.filter(r => r.productId === pid && r.status === "approved");
  if (!rs.length) return { avg: 0, count: 0 };
  return { avg: rs.reduce((s, r) => s + r.rating, 0) / rs.length, count: rs.length };
}
function starsHtml(avg) {
  const full = Math.round(avg);
  let s = "";
  for (let i = 1; i <= 5; i++) s += i <= full ? "★" : "☆";
  return `<span class="stars">${s}</span>`;
}
function placeholder(pid) {
  const p = DB.products.find(x => x.id === pid);
  return `<div class="card-img">${catEmoji(p && p.categoryId)}</div>`;
}

function renderMenu() {
  const cats = [...DB.categories].sort((a, b) => a.order - b.order);
  $("#chipsBar").innerHTML = cats.map(c =>
    `<button class="chip" data-act="goto-cat" data-id="${c.id}">${esc(c.emoji || "")} ${esc(c.name)}</button>`
  ).join("");

  const uncategorized = DB.products.filter(p => !cats.some(c => c.id === p.categoryId));
  let html = "";
  for (const c of cats) {
    const items = DB.products.filter(p => p.categoryId === c.id).sort((a, b) => a.order - b.order);
    if (!items.length) continue;
    html += `<section class="menu-section" id="cat-${c.id}"><h3>${esc(c.emoji || "")} ${esc(c.name)}</h3><div class="grid">`;
    html += items.map(cardHtml).join("");
    html += `</div></section>`;
  }
  if (uncategorized.length) {
    html += `<section class="menu-section"><h3>🍽️ سایر موارد</h3><div class="grid">` + uncategorized.map(cardHtml).join("") + `</div></section>`;
  }
  $("#menuSections").innerHTML = html || `<div class="cart-empty">هنوز محصولی ثبت نشده است.</div>`;
  $("#menuFoot").innerHTML = [
    DB.settings.address ? `<div>📍 ${esc(DB.settings.address)}</div>` : "",
    DB.settings.phone ? `<div>☎️ ${esc(DB.settings.phone)}</div>` : "",
    DB.settings.instagram ? `<div>📷 ${esc(DB.settings.instagram)}</div>` : "",
  ].join("") || "کافه جیک و پیک";
}

function cardHtml(p) {
  const r = ratingOf(p.id);
  return `<article class="card ${p.available ? "" : "out"}" data-act="open-product" data-id="${p.id}" role="button" tabindex="0">
    ${p.image ? `<div class="card-img"><img src="${p.image}" alt="${esc(p.name)}" loading="lazy"></div>` : placeholder(p.id)}
    <div class="card-body">
      <div class="card-name">${esc(p.name)}</div>
      ${p.desc ? `<div class="card-desc">${esc(p.desc)}</div>` : ""}
      <div class="card-meta">
        ${r.count ? `${starsHtml(r.avg)} <span class="rev-count">(${fa(r.count)})</span>` : `<span class="rev-count">بدون امتیاز</span>`}
        <span class="card-price">${money(p.price)}</span>
      </div>
      <div class="card-foot">
        ${p.available
          ? `<button class="btn btn-accent btn-sm btn-block" data-act="open-product" data-id="${p.id}">مشاهده و سفارش</button>`
          : `<span class="badge badge-out">ناموجود</span>`}
      </div>
    </div>
  </article>`;
}

/* ---------- مودال محصول ---------- */
let pmQty = 1, pmProduct = null, pmStar = 5;

function openProduct(id) {
  const p = DB.products.find(x => x.id === id);
  if (!p) return;
  pmProduct = p; pmQty = 1; pmStar = 5;
  renderProductModal();
  openOverlay();
  $("#productModal").classList.remove("hidden");
}

function renderProductModal() {
  const p = pmProduct, r = ratingOf(p.id);
  const revs = DB.reviews.filter(x => x.productId === p.id && x.status === "approved")
    .sort((a, b) => b.createdAt - a.createdAt).slice(0, 12);
  $("#productModal").innerHTML = `
    <button class="modal-close" data-act="close-all" aria-label="بستن">✕</button>
    ${p.image ? `<div class="pm-img"><img src="${p.image}" alt="${esc(p.name)}"></div>` : `<div class="pm-img">${catEmoji(p.categoryId)}</div>`}
    <div class="pm-name">${esc(p.name)}</div>
    <div class="pm-row">
      ${r.count ? `<span>${starsHtml(r.avg)} <b>${fa(Math.round(r.avg * 10) / 10)}</b> <span class="rev-count">از ۵ (${fa(r.count)} نظر)</span></span>` : `<span class="rev-count">هنوز نظری ثبت نشده</span>`}
      ${p.available ? `<span class="badge badge-in">موجود</span>` : `<span class="badge badge-out">ناموجود</span>`}
    </div>
    <div class="pm-desc">${esc(p.desc || "")}</div>
    <div class="pm-row">
      <span class="pm-price">${money(p.price)}</span>
      <div class="stepper qty-big">
        <button data-act="pm-minus" aria-label="کاهش">−</button>
        <span id="pmQty">${fa(pmQty)}</span>
        <button data-act="pm-plus" aria-label="افزایش">+</button>
      </div>
    </div>
    <button class="btn btn-primary btn-block" data-act="pm-add" ${p.available ? "" : "disabled"}>
      ${p.available ? "افزودن به سبد خرید" : "این محصول در حال حاضر موجود نیست"}
    </button>
    <div class="reviews-box">
      <h4>💬 نظرات مشتریان</h4>
      <div>${revs.length ? revs.map(rv => `
        <div class="review"><b>${esc(rv.name)}</b> ${starsHtml(rv.rating)}<p>${esc(rv.text)}</p><small>${dateFa(rv.createdAt)}</small></div>`).join("")
        : `<div class="rev-count">اولین نفر باشید که نظر می‌دهد!</div>`}
      </div>
      <form class="review-form" id="reviewForm">
        <input name="rname" placeholder="نام شما (می‌تواند مستعار باشد)" required maxlength="40">
        <div class="star-pick" id="starPick">
          ${[1,2,3,4,5].map(i => `<button type="button" data-star="${i}" class="${i <= pmStar ? "on" : ""}">★</button>`).join("")}
        </div>
        <textarea name="rtext" placeholder="نظر شما درباره این محصول..." required maxlength="400"></textarea>
        <button class="btn btn-ghost" type="submit">ثبت نظر</button>
      </form>
    </div>`;
  $("#reviewForm").addEventListener("submit", submitReview);
}

function submitReview(e) {
  e.preventDefault();
  const f = e.target;
  DB.reviews.push({
    id: uid("rv"), productId: pmProduct.id, name: f.rname.value.trim(),
    rating: pmStar, text: f.rtext.value.trim(), status: "pending", createdAt: Date.now()
  });
  dbSave(DB);
  f.reset();
  toast("نظر شما با موفقیت ثبت شد و پس از بررسی نمایش داده می‌شود.");
}

/* ---------- سبد خرید ---------- */
function addToCart(pid, qty) {
  const p = DB.products.find(x => x.id === pid);
  if (!p || !p.available) { toast("این محصول در حال حاضر موجود نیست.", true); return; }
  const row = state.cart.find(i => i.id === pid);
  if (row) row.qty += qty; else state.cart.push({ id: pid, qty });
  saveCart(); updateCartUI();
  toast("محصول با موفقیت به سبد خرید اضافه شد.");
}
function updateCartUI() {
  $("#cartBadge").textContent = fa(cartCount());
  const box = $("#cartItems");
  if (!state.cart.length) {
    box.innerHTML = `<div class="cart-empty">سبد خرید شما خالی است.</div>`;
  } else {
    box.innerHTML = state.cart.map(i => {
      const p = DB.products.find(x => x.id === i.id);
      if (!p) return "";
      return `<div class="cart-row">
        ${p.image ? `<img class="cart-thumb" src="${p.image}" alt="">` : `<div class="cart-thumb">${catEmoji(p.categoryId)}</div>`}
        <div class="cart-info"><b>${esc(p.name)}</b><small>${money(p.price)}</small></div>
        <div class="stepper">
          <button data-act="cart-minus" data-id="${p.id}">−</button>
          <span>${fa(i.qty)}</span>
          <button data-act="cart-plus" data-id="${p.id}">+</button>
        </div>
        <span class="cart-row-total">${money(p.price * i.qty)}</span>
        <button class="del-btn" data-act="cart-del" data-id="${p.id}" aria-label="حذف">🗑</button>
      </div>`;
    }).join("");
  }
  $("#cartTotal").textContent = money(cartTotal());
}

/* ---------- ثبت سفارش ---------- */
function openCheckout() {
  if (!state.cart.length) { toast("سبد خرید شما خالی است.", true); return; }
  if (!state.qr || !state.qr.active) { toast("برای ثبت سفارش باید از QR Code فعال کافه وارد شوید.", true); return; }
  renderCheckout();
  $("#cartDrawer").classList.add("hidden");
  $("#checkoutModal").classList.remove("hidden");
}

function renderCheckout() {
  const rows = state.cart.map(i => {
    const p = DB.products.find(x => x.id === i.id);
    return `<div class="row"><span>${esc(p.name)} × ${fa(i.qty)}</span><span>${money(p.price * i.qty)}</span></div>`;
  }).join("");
  $("#checkoutModal").innerHTML = `
    <button class="modal-close" data-act="close-all">✕</button>
    <h3 style="font-size:17px;margin-bottom:6px">ثبت سفارش</h3>
    <p class="hint">QR شماره ${fa(state.qrId)} — سفارش به همین میز ثبت می‌شود.</p>
    <div class="order-summary" style="margin-top:10px">${rows}
      <div class="row total"><span>مبلغ کل</span><span>${money(cartTotal())}</span></div>
    </div>
    <form class="form-grid" id="orderForm" style="margin-top:14px">
      <div><label>نام شما *</label><input name="oname" required maxlength="50" placeholder="مثلاً: علی"></div>
      <div><label>شماره تماس (اختیاری)</label><input name="ophone" inputmode="tel" maxlength="15" placeholder="۰۹۱۲..."></div>
      <div><label>شماره میز (در صورت استفاده)</label><input name="otable" inputmode="numeric" maxlength="5" placeholder="مثلاً ۳"></div>
      <div><label>توضیحات سفارش</label><textarea name="onote" maxlength="300" placeholder="مثلاً: یخ کمتر، بدون شکر، سس اضافه"></textarea></div>
      <button class="btn btn-primary btn-block" type="submit">ثبت نهایی سفارش</button>
      <p class="hint">پرداخت به‌صورت حضوری در کافه انجام می‌شود.</p>
    </form>`;
  $("#orderForm").addEventListener("submit", submitOrder);
}

function submitOrder(e) {
  e.preventDefault();
  const f = e.target;
  if (!state.qr || !state.qr.active) { toast("این QR Code در حال حاضر فعال نیست.", true); return; }
  /* اعتبارسنجی واقعی: قیمت و موجودی دوباره از دیتابیس خوانده می‌شود، نه از سمت مرورگر */
  const items = [];
  for (const ci of state.cart) {
    const p = DB.products.find(x => x.id === ci.id);
    if (!p) { toast("یکی از محصولات حذف شده است. سبد را به‌روزرسانی کنید.", true); return; }
    if (!p.available) { toast(`«${p.name}» موجود نیست. لطفاً آن را از سبد حذف کنید.`, true); return; }
    if (ci.qty < 1 || ci.qty > 50) { toast("تعداد نامعتبر است.", true); return; }
    items.push({ productId: p.id, name: p.name, price: p.price, qty: ci.qty });
  }
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  const id = DB.orders.reduce((m, o) => Math.max(m, o.id), 100) + 1;
  const order = {
    id, qrId: state.qrId, name: f.oname.value.trim(), phone: f.ophone.value.trim() || "",
    table: f.otable.value.trim() || "", note: f.onote.value.trim() || "",
    items, total, status: "pending", createdAt: Date.now()
  };
  DB.orders.push(order);
  if (!dbSave(DB)) { toast("خطا در ذخیره‌سازی. دوباره تلاش کنید.", true); return; }
  state.cart = []; saveCart(); updateCartUI();
  localStorage.setItem("jikopik_last_order", String(id));
  closeAll();
  showSuccess(order);
}

function showSuccess(o) {
  $("#menuView").classList.add("hidden");
  $("#successView").classList.remove("hidden");
  $("#successFacts").innerHTML = `
    <div class="row"><span>شماره سفارش</span><strong>#${fa(o.id)}</strong></div>
    <div class="row"><span>QR Code</span><strong>QR شماره ${fa(o.qrId)}</strong></div>
    <div class="row"><span>مبلغ</span><strong>${money(o.total)}</strong></div>
    <div class="row"><span>وضعیت</span><strong>در انتظار بررسی</strong></div>`;
  $("#successTrackBtn").onclick = () => openTrack(o.id);
}

function backToMenu() {
  $("#successView").classList.add("hidden");
  $("#menuView").classList.remove("hidden");
  DB = dbLoad(); renderMenu();
}

/* ---------- پیگیری سفارش ---------- */
const TRACK_STEPS = [
  { key: "pending", label: "سفارش ثبت شد" },
  { key: "preparing", label: "در حال آماده‌سازی" },
  { key: "ready", label: "آماده شد" },
  { key: "delivered", label: "تحویل داده شد" },
];
function openTrack(preId) {
  closeAll();
  const last = preId || parseInt(localStorage.getItem("jikopik_last_order") || "", 10) || "";
  $("#trackModal").innerHTML = `
    <button class="modal-close" data-act="close-all">✕</button>
    <h3 style="font-size:17px">🧾 پیگیری سفارش</h3>
    <form class="form-grid" id="trackForm">
      <div><label>شماره سفارش</label><input name="oid" inputmode="numeric" value="${last ? fa(last) : ""}" placeholder="مثلاً ۱۰۱" required></div>
      <button class="btn btn-primary" type="submit">مشاهده وضعیت</button>
    </form>
    <div id="trackResult"></div>`;
  $("#trackModal").classList.remove("hidden");
  openOverlay();
  $("#trackForm").addEventListener("submit", e => {
    e.preventDefault();
    const id = parseInt(toEn(e.target.oid.value).replace(/\D/g, ""), 10);
    const o = DB.orders.find(x => x.id === id);
    const box = $("#trackResult");
    if (!o) { box.innerHTML = `<div class="track-canceled">سفارشی با این شماره پیدا نشد.</div>`; return; }
    const idx = TRACK_STEPS.findIndex(s => s.key === o.status);
    box.innerHTML = `
      <div class="order-summary" style="margin-top:12px">
        <div class="row"><span>سفارش</span><strong>#${fa(o.id)}</strong></div>
        <div class="row"><span>QR</span><span>شماره ${fa(o.qrId)}</span></div>
        <div class="row"><span>مبلغ</span><span>${money(o.total)}</span></div>
        <div class="row"><span>زمان ثبت</span><span>${dateFa(o.createdAt)} ${timeFa(o.createdAt)}</span></div>
      </div>
      ${o.status === "canceled"
        ? `<div class="track-canceled">این سفارش لغو شده است.</div>`
        : `<div class="track-steps">${TRACK_STEPS.map((s, i) => `
            <div class="t-step ${i < idx ? "done" : ""} ${i === idx ? "done current" : ""}">
              <span class="t-dot">${i < idx ? "✓" : i === idx ? "●" : ""}</span>
              <span class="t-label">${s.label}</span>
            </div>`).join("")}</div>`}`;
  });
}
function toEn(s) { return String(s).replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)); }

/* ---------- رویدادها ---------- */
document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const act = el.dataset.act, id = el.dataset.id;
  switch (act) {
    case "open-cart": openOverlay(); $("#cartDrawer").classList.remove("hidden"); break;
    case "close-all": closeAll(); break;
    case "open-track": openTrack(); break;
    case "back-to-menu": backToMenu(); break;
    case "goto-cat": {
      document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
      el.classList.add("active");
      const sec = document.getElementById("cat-" + id);
      if (sec) sec.scrollIntoView({ behavior: "smooth", block: "start" });
      break;
    }
    case "open-product": if (!e.target.closest("[disabled]")) openProduct(id); break;
    case "pm-plus": pmQty = Math.min(50, pmQty + 1); $("#pmQty").textContent = fa(pmQty); break;
    case "pm-minus": pmQty = Math.max(1, pmQty - 1); $("#pmQty").textContent = fa(pmQty); break;
    case "pm-add": addToCart(pmProduct.id, pmQty); closeAll(); break;
    case "cart-plus": { const r = state.cart.find(i => i.id === id); if (r && r.qty < 50) { r.qty++; saveCart(); updateCartUI(); } break; }
    case "cart-minus": { const r = state.cart.find(i => i.id === id); if (r) { r.qty--; if (r.qty <= 0) state.cart = state.cart.filter(i => i.id !== id); saveCart(); updateCartUI(); } break; }
    case "cart-del": state.cart = state.cart.filter(i => i.id !== id); saveCart(); updateCartUI(); break;
    case "go-checkout": openCheckout(); break;
  }
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeAll();
  if (e.key === "Enter" && e.target.matches(".card")) e.target.click();
});
document.addEventListener("click", e => {
  const b = e.target.closest("#starPick button");
  if (!b) return;
  pmStar = parseInt(b.dataset.star, 10);
  document.querySelectorAll("#starPick button").forEach(s => s.classList.toggle("on", parseInt(s.dataset.star, 10) <= pmStar));
});
$("#overlay").addEventListener("click", closeAll);
window.addEventListener("storage", () => { DB = dbLoad(); renderMenu(); updateCartUI(); });

/* ---------- شروع ---------- */
(function init() {
  DB = dbLoad();
  $("#cafeName").textContent = DB.settings.cafeName || "کافه جیک و پیک";
  $("#heroTitle").textContent = "منوی " + (DB.settings.cafeName || "کافه جیک و پیک");
  if (DB.settings.desc) $("#heroSub").textContent = DB.settings.desc;
  if (DB.settings.logo) $("#brandLogo").textContent = DB.settings.logo;

  const q = parseInt(new URLSearchParams(location.search).get("qr"), 10);
  const banner = $("#qrBanner");
  if (q >= 1 && q <= 8) {
    state.qrId = q;
    state.qr = DB.qrCodes.find(r => r.id === q);
    if (state.qr && state.qr.active) {
      banner.className = "qr-banner ok";
      banner.textContent = `🟢 QR شماره ${fa(q)} — آنلاین`;
    } else {
      banner.className = "qr-banner off";
      banner.textContent = `🔴 این QR Code در حال حاضر فعال نیست.`;
      $("#menuSections").innerHTML = `<div class="cart-empty" style="padding:60px 20px">این QR Code در حال حاضر فعال نیست.<br>لطفاً از یکی دیگر از QR Codeهای روی میز استفاده کنید.</div>`;
      $("#chipsBar").classList.add("hidden");
    }
  } else {
    banner.className = "qr-banner warn";
    banner.textContent = "برای ثبت سفارش، QR Code روی میز خود را اسکن کنید.";
  }
  renderMenu();
  updateCartUI();
})();