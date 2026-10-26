"use strict";
/* ============================================================
   پنل مدیریت کافه جیک و پیک
   ============================================================ */
let DB = dbLoad();
let currentSec = "dashboard";
let reviewFilterProduct = "";

/* ---------- ابزار ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fa = faNum, money = faMoney;
function toast(msg, err) {
  const t = document.createElement("div");
  t.className = "toast" + (err ? " err" : "");
  t.textContent = msg;
  $("#toastBox").appendChild(t);
  setTimeout(() => t.remove(), 2800);
}
function save() { if (!dbSave(DB)) toast("خطا در ذخیره‌سازی — فضای مرورگر پر است.", true); }
function catName(id) { const c = DB.categories.find(c => c.id === id); return c ? c.name : "بدون دسته"; }
function catEmoji(id) { const c = DB.categories.find(c => c.id === id); return c ? (c.emoji || "") : ""; }
function qrLabel(id) { return "QR شماره " + fa(id); }
function statusPill(s) {
  const st = ORDER_STATUSES[s] || ORDER_STATUSES.pending;
  return `<span class="pill" style="background:${st.bg};color:${st.fg}">${st.dot} ${st.label}</span>`;
}
function openModal(html) { $("#modalBox").innerHTML = `<button class="modal-close" data-act="close-modal">✕</button>` + html; $("#modalRoot").classList.remove("hidden"); }
function closeModal() { $("#modalRoot").classList.add("hidden"); }
function starsHtml(avg) { let s = ""; const f = Math.round(avg); for (let i = 1; i <= 5; i++) s += i <= f ? "★" : "☆"; return `<span style="color:#e8a723">${s}</span>`; }

/* ---------- ورود ---------- */
function checkLogin() {
  if (sessionStorage.getItem("jikopik_admin") === "1") {
    $("#loginView").classList.add("hidden");
    $("#panelView").classList.remove("hidden");
    renderSec(currentSec);
    return true;
  }
  $("#loginView").classList.remove("hidden");
  return false;
}
$("#loginForm").addEventListener("submit", e => {
  e.preventDefault();
  const u = e.target.u.value.trim(), p = e.target.p.value;
  if (u === DB.settings.adminUser && p === DB.settings.adminPass) {
    sessionStorage.setItem("jikopik_admin", "1");
    $("#loginErr").classList.add("hidden");
    checkLogin();
    toast("خوش آمدید!");
  } else {
    $("#loginErr").classList.remove("hidden");
  }
});
$("#logoutBtn").addEventListener("click", () => {
  sessionStorage.removeItem("jikopik_admin");
  location.reload();
});

/* ---------- مسیریابی بخش‌ها ---------- */
const RENDERERS = {
  dashboard: renderDashboard, orders: renderOrders, products: renderProducts,
  categories: renderCategories, reviews: renderReviews, qrs: renderQrs,
  reports: renderReports, settings: renderSettings,
};
document.querySelectorAll(".nav-btn[data-sec]").forEach(b => {
  b.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    currentSec = b.dataset.sec;
    renderSec(currentSec);
  });
});
function renderSec(sec) { RENDERERS[sec](); }

/* ---------- داشبورد ---------- */
function renderDashboard() {
  const today = DB.orders.filter(o => isToday(o.createdAt) && o.status !== "canceled");
  const cnt = s => DB.orders.filter(o => o.status === s).length;
  const newRev = DB.reviews.filter(r => r.status === "pending").length;
  const onlineQr = DB.qrCodes.filter(q => q.active).length;
  const latest = [...DB.orders].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
  $("#content").innerHTML = `
    <h2>📊 داشبورد</h2>
    <p class="sub">نمای کلی وضعیت کافه در یک نگاه</p>
    <div class="stats">
      <div class="stat"><b>${fa(today.length)}</b><span>سفارش‌های امروز</span></div>
      <div class="stat hl"><b>${money(today.reduce((s, o) => s + o.total, 0))}</b><span>فروش امروز</span></div>
      <div class="stat"><b>${fa(cnt("pending"))}</b><span>در انتظار بررسی</span></div>
      <div class="stat"><b>${fa(cnt("preparing"))}</b><span>در حال آماده‌سازی</span></div>
      <div class="stat"><b>${fa(cnt("ready"))}</b><span>آماده تحویل</span></div>
      <div class="stat"><b>${fa(DB.products.length)}</b><span>تعداد محصولات</span></div>
      <div class="stat"><b>${fa(newRev)}</b><span>نظرات جدید</span></div>
      <div class="stat"><b>${fa(onlineQr)} / ${fa(DB.qrCodes.length)}</b><span>QR های آنلاین</span></div>
    </div>
    <h3 style="font-size:15px;margin:6px 0 10px">آخرین سفارش‌ها</h3>
    ${latest.length ? `<div class="table-wrap"><table><thead><tr>
      <th>شماره</th><th>مشتری</th><th>QR</th><th>مبلغ</th><th>ساعت</th><th>وضعیت</th></tr></thead><tbody>
      ${latest.map(o => `<tr class="click" data-act="view-order" data-id="${o.id}">
        <td><b>#${fa(o.id)}</b></td><td>${esc(o.name)}</td><td>${qrLabel(o.qrId)}</td>
        <td>${money(o.total)}</td><td>${timeFa(o.createdAt)}</td><td>${statusPill(o.status)}</td></tr>`).join("")}
    </tbody></table></div>` : `<div class="empty">هنوز سفارشی ثبت نشده است. اولین سفارش را مشتریان با اسکن QR ثبت می‌کنند. 🎉</div>`}`;
}

/* ---------- سفارشات ---------- */
let orderFilters = { q: "", qr: "", status: "" };
function filteredOrders() {
  return [...DB.orders].sort((a, b) => b.createdAt - a.createdAt).filter(o => {
    if (orderFilters.qr && o.qrId !== parseInt(orderFilters.qr, 10)) return false;
    if (orderFilters.status && o.status !== orderFilters.status) return false;
    if (orderFilters.q) {
      const q = toEnDigits(orderFilters.q).trim().toLowerCase();
      const hit = String(o.id).includes(q.replace("#", "")) || o.name.toLowerCase().includes(q);
      if (!hit) return false;
    }
    return true;
  });
}
function renderOrders() {
  const list = filteredOrders();
  const opts = Object.entries(ORDER_STATUSES).map(([k, v]) => `<option value="${k}" ${orderFilters.status === k ? "selected" : ""}>${v.label}</option>`).join("");
  $("#content").innerHTML = `
    <h2>🛒 سفارشات</h2>
    <p class="sub">مدیریت و پیگیری سفارش‌های ثبت‌شده</p>
    <div class="toolbar">
      <input id="fQ" placeholder="جستجوی شماره یا نام مشتری..." value="${esc(orderFilters.q)}">
      <select id="fQr"><option value="">همه QR ها</option>${DB.qrCodes.map(q => `<option value="${q.id}" ${orderFilters.qr == q.id ? "selected" : ""}>${qrLabel(q.id)}</option>`).join("")}</select>
      <select id="fSt"><option value="">همه وضعیت‌ها</option>${opts}</select>
    </div>
    ${list.length ? `<div class="table-wrap"><table><thead><tr>
      <th>شماره</th><th>تاریخ / ساعت</th><th>QR</th><th>مشتری</th><th>میز</th><th>اقلام</th><th>مبلغ</th><th>وضعیت</th></tr></thead><tbody>
      ${list.map(o => `<tr class="click" data-act="view-order" data-id="${o.id}">
        <td><b>#${fa(o.id)}</b></td>
        <td>${dateFa(o.createdAt)}<br><small style="color:var(--muted)">${timeFa(o.createdAt)}</small></td>
        <td>${qrLabel(o.qrId)}</td><td>${esc(o.name)}</td><td>${o.table ? fa(o.table) : "—"}</td>
        <td>${fa(o.items.reduce((s, i) => s + i.qty, 0))} قلم</td>
        <td>${money(o.total)}</td><td>${statusPill(o.status)}</td></tr>`).join("")}
    </tbody></table></div>` : `<div class="empty">سفارشی با این فیلترها پیدا نشد.</div>`}`;
  $("#fQ").addEventListener("input", e => { orderFilters.q = e.target.value; refreshOrdersTable(); });
  $("#fQr").addEventListener("change", e => { orderFilters.qr = e.target.value; refreshOrdersTable(); });
  $("#fSt").addEventListener("change", e => { orderFilters.status = e.target.value; refreshOrdersTable(); });
}
function refreshOrdersTable() { if (currentSec === "orders") renderOrders(); }

function viewOrder(id) {
  const o = DB.orders.find(x => x.id === id);
  if (!o) return;
  const stOpts = Object.entries(ORDER_STATUSES).map(([k, v]) => `<option value="${k}" ${o.status === k ? "selected" : ""}>${v.dot} ${v.label}</option>`).join("");
  openModal(`
    <h3 style="font-size:16px">سفارش #${fa(o.id)}</h3>
    <div class="detail-sec" style="margin-top:10px">
      <div class="row"><span>QR Code</span><b>${qrLabel(o.qrId)}</b></div>
      <div class="row"><span>مشتری</span><b>${esc(o.name)}</b></div>
      ${o.phone ? `<div class="row"><span>تماس</span><b>${esc(o.phone)}</b></div>` : ""}
      ${o.table ? `<div class="row"><span>میز</span><b>${fa(o.table)}</b></div>` : ""}
      <div class="row"><span>زمان ثبت</span><b>${dateFa(o.createdAt)} — ${timeFa(o.createdAt)}</b></div>
    </div>
    <div class="detail-sec">
      ${o.items.map(i => `<div class="row"><span>${esc(i.name)} × ${fa(i.qty)}</span><span>${money(i.price * i.qty)}</span></div>`).join("")}
      <div class="row" style="border-top:1px dashed var(--line);margin-top:6px;padding-top:6px;font-weight:800"><span>مبلغ کل</span><span>${money(o.total)}</span></div>
    </div>
    ${o.note ? `<div class="detail-sec">📝 توضیحات مشتری: <b>${esc(o.note)}</b></div>` : ""}
    <div class="form-grid">
      <label>تغییر وضعیت سفارش
        <select id="oStatus" class="status-select">${stOpts}</select>
      </label>
      <button class="btn btn-primary btn-block" data-act="save-status" data-id="${o.id}">ذخیره وضعیت</button>
    </div>`);
}

/* ---------- محصولات ---------- */
function renderProducts() {
  const pf = prodFilters;
  let list = [...DB.products].sort((a, b) => a.order - b.order);
  if (pf.q) list = list.filter(p => p.name.includes(toEnDigits(pf.q).trim()));
  if (pf.cat) list = list.filter(p => p.categoryId === pf.cat);
  if (pf.stock === "in") list = list.filter(p => p.available);
  if (pf.stock === "out") list = list.filter(p => !p.available);
  $("#content").innerHTML = `
    <h2>🍰 محصولات</h2>
    <p class="sub">افزودن، ویرایش و مدیریت منو — تغییرات بلافاصله در منوی مشتری اعمال می‌شود</p>
    <div class="toolbar">
      <input id="pQ" placeholder="جستجوی نام محصول..." value="${esc(pf.q)}">
      <select id="pCat"><option value="">همه دسته‌ها</option>${DB.categories.map(c => `<option value="${c.id}" ${pf.cat === c.id ? "selected" : ""}>${esc(c.emoji || "")} ${esc(c.name)}</option>`).join("")}</select>
      <select id="pStock">
        <option value="">همه</option>
        <option value="in" ${pf.stock === "in" ? "selected" : ""}>موجود</option>
        <option value="out" ${pf.stock === "out" ? "selected" : ""}>ناموجود</option>
      </select>
      <button class="btn btn-accent" data-act="new-product">+ افزودن محصول جدید</button>
    </div>
    ${list.length ? `<div class="prod-grid">${list.map(p => {
      const r = productRating(DB, p.id);
      return `<div class="prod-card">
        ${p.image ? `<img class="prod-thumb" src="${p.image}" alt="">` : `<div class="prod-thumb">${catEmoji(p.categoryId) || "🍽️"}</div>`}
        <div class="prod-info">
          <b>${esc(p.name)}</b>
          <small>${money(p.price)} — ${esc(catName(p.categoryId))}</small>
          ${r.count ? `<small>${starsHtml(r.avg)} ${fa(Math.round(r.avg * 10) / 10)} (${fa(r.count)} نظر)</small>` : ""}
          <div class="prod-actions">
            <button class="toggle ${p.available ? "on" : ""}" data-act="toggle-stock" data-id="${p.id}" title="موجود / ناموجود" aria-label="موجودی"></button>
            <button class="btn btn-ghost btn-sm" data-act="edit-product" data-id="${p.id}">ویرایش</button>
            <button class="btn btn-danger btn-sm" data-act="del-product" data-id="${p.id}">حذف</button>
          </div>
        </div>
      </div>`;
    }).join("")}</div>` : `<div class="empty">محصولی پیدا نشد. با دکمه «افزودن محصول جدید» شروع کنید.</div>`}`;
  $("#pQ").addEventListener("input", e => { prodFilters.q = e.target.value; renderProducts(); });
  $("#pCat").addEventListener("change", e => { prodFilters.cat = e.target.value; renderProducts(); });
  $("#pStock").addEventListener("change", e => { prodFilters.stock = e.target.value; renderProducts(); });
}
const prodFilters = { q: "", cat: "", stock: "" };

function productForm(p) {
  const isEdit = !!p;
  p = p || { name: "", price: "", categoryId: DB.categories[0] ? DB.categories[0].id : "", desc: "", available: true, order: DB.products.length + 1, image: "" };
  openModal(`
    <h3 style="font-size:16px">${isEdit ? "ویرایش محصول" : "افزودن محصول جدید"}</h3>
    <form class="form-grid" id="prodForm">
      <label>نام محصول *<input name="name" required maxlength="60" value="${esc(p.name)}" placeholder="مثلاً: شیک نوتلا"></label>
      <label>قیمت (تومان) *<input name="price" inputmode="numeric" required value="${p.price || ""}" placeholder="مثلاً ۱۸۰۰۰۰"></label>
      <label>دسته‌بندی
        <select name="categoryId">${DB.categories.map(c => `<option value="${c.id}" ${p.categoryId === c.id ? "selected" : ""}>${esc(c.emoji || "")} ${esc(c.name)}</option>`).join("")}</select>
      </label>
      <label>توضیحات<textarea name="desc" maxlength="400" placeholder="مثلاً: شیک شکلاتی خنک با بستنی، شیر و سس شکلات.">${esc(p.desc)}</textarea></label>
      <div class="img-row">
        <div><label>تصویر محصول</label>
          <input type="file" name="image" accept="image/*" style="margin-top:4px">
        </div>
        <img id="imgPrev" class="img-preview ${p.image ? "" : "empty-ph"}" src="${p.image || ""}" alt="" ${p.image ? "" : 'style="display:grid"'}>${p.image ? "" : "🖼️"}
      </div>
      ${isEdit && p.image ? `<button type="button" class="btn btn-ghost btn-sm" data-act="clear-img">حذف تصویر فعلی</button>` : ""}
      <div style="display:flex;gap:14px;align-items:center">
        <label style="flex-direction:row;align-items:center;gap:8px">موجود است؟
          <input type="checkbox" name="available" ${p.available ? "checked" : ""} style="width:18px;height:18px">
        </label>
        <label style="flex:1">ترتیب نمایش<input name="order" inputmode="numeric" value="${p.order}"></label>
      </div>
      <button class="btn btn-primary btn-block" type="submit">${isEdit ? "ذخیره تغییرات" : "افزودن محصول"}</button>
    </form>`);
  let imgData = p.image || "";
  const fileInput = document.querySelector('#prodForm [name="image"]');
  fileInput.addEventListener("change", async e => {
    const f = e.target.files[0];
    if (!f) return;
    imgData = await downscaleImage(f);
    const prev = $("#imgPrev");
    prev.src = imgData; prev.classList.remove("empty-ph");
    prev.textContent = "";
    toast("تصویر بارگذاری شد.");
  });
  document.querySelectorAll('[data-act="clear-img"]').forEach(b => b.addEventListener("click", () => {
    imgData = "";
    const prev = $("#imgPrev");
    prev.removeAttribute("src"); prev.classList.add("empty-ph"); prev.textContent = "🖼️";
  }));
  $("#prodForm").addEventListener("submit", e => {
    e.preventDefault();
    const f = e.target;
    const price = parseInt(toEnDigits(f.price.value).replace(/\D/g, ""), 10);
    if (!price || price < 1000) { toast("قیمت معتبر وارد کنید (حداقل ۱۰۰۰ تومان).", true); return; }
    const data = {
      name: f.name.value.trim(), price, categoryId: f.categoryId.value,
      desc: f.desc.value.trim(), available: f.available.checked,
      order: parseInt(toEnDigits(f.order.value).replace(/\D/g, ""), 10) || 1,
      image: imgData,
    };
    if (isEdit) {
      Object.assign(p, data, { updatedAt: Date.now() });
      toast("تغییرات با موفقیت ذخیره شد.");
    } else {
      DB.products.push({ id: uid("p"), ...data, createdAt: Date.now(), updatedAt: Date.now() });
      toast("محصول با موفقیت اضافه شد و در منوی مشتری نمایش داده می‌شود.");
    }
    save(); closeModal(); renderProducts();
  });
}
/* فشرده‌سازی تصویر برای سرعت و مصرف کم حافظه */
function downscaleImage(file, max = 640) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement("canvas");
        cv.width = Math.round(img.width * scale);
        cv.height = Math.round(img.height * scale);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        resolve(cv.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = () => resolve(reader.result);
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ---------- دسته‌بندی‌ها ---------- */
function renderCategories() {
  const cats = [...DB.categories].sort((a, b) => a.order - b.order);
  $("#content").innerHTML = `
    <h2>📁 دسته‌بندی‌ها</h2>
    <p class="sub">مدیریت دسته‌های منو — ترتیب، نام و حذف</p>
    <div class="toolbar"><button class="btn btn-accent" data-act="new-cat">+ دسته جدید</button></div>
    ${cats.length ? `<div class="table-wrap"><table><thead><tr><th>دسته</th><th>تعداد محصول</th><th>ترتیب</th><th>عملیات</th></tr></thead><tbody>
      ${cats.map((c, i) => `<tr>
        <td><b>${esc(c.emoji || "")} ${esc(c.name)}</b></td>
        <td>${fa(DB.products.filter(p => p.categoryId === c.id).length)}</td>
        <td>${fa(c.order)}</td>
        <td style="white-space:nowrap">
          <button class="btn-icon" data-act="cat-up" data-id="${c.id}" ${i === 0 ? "disabled" : ""} title="بالا">↑</button>
          <button class="btn-icon" data-act="cat-down" data-id="${c.id}" ${i === cats.length - 1 ? "disabled" : ""} title="پایین">↓</button>
          <button class="btn btn-ghost btn-sm" data-act="edit-cat" data-id="${c.id}">ویرایش</button>
          <button class="btn btn-danger btn-sm" data-act="del-cat" data-id="${c.id}">حذف</button>
        </td></tr>`).join("")}
    </tbody></table></div>` : `<div class="empty">دسته‌ای وجود ندارد.</div>`}`;
}
function catForm(c) {
  const isEdit = !!c;
  c = c || { name: "", emoji: "" };
  openModal(`
    <h3 style="font-size:16px">${isEdit ? "ویرایش دسته" : "دسته جدید"}</h3>
    <form class="form-grid" id="catForm">
      <label>نام دسته *<input name="name" required maxlength="40" value="${esc(c.name)}" placeholder="مثلاً: صبحانه"></label>
      <label>ایموجی (اختیاری)<input name="emoji" maxlength="4" value="${esc(c.emoji)}" placeholder="مثلاً 🍳"></label>
      <button class="btn btn-primary btn-block" type="submit">ذخیره</button>
    </form>`);
  $("#catForm").addEventListener("submit", e => {
    e.preventDefault();
    const name = e.target.name.value.trim();
    const emoji = e.target.emoji.value.trim();
    if (!name) return;
    if (isEdit) { c.name = name; c.emoji = emoji; toast("دسته با موفقیت ویرایش شد."); }
    else { DB.categories.push({ id: uid("c"), name, emoji, order: DB.categories.length + 1 }); toast("دسته جدید ایجاد شد."); }
    save(); closeModal(); renderCategories();
  });
}

/* ---------- نظرات ---------- */
function renderReviews() {
  let list = [...DB.reviews].sort((a, b) => b.createdAt - a.createdAt);
  if (reviewFilterProduct) list = list.filter(r => r.productId === reviewFilterProduct);
  const pendCount = DB.reviews.filter(r => r.status === "pending").length;
  const stLabel = { pending: "در انتظار بررسی", approved: "تأییدشده", rejected: "ردشده" };
  const stBg = { pending: "#fdf3e3", approved: "#e5f6ec", rejected: "#fdeaea" };
  const stFg = { pending: "#8a5a17", approved: "#1d6b3c", rejected: "#9c2b2b" };
  $("#content").innerHTML = `
    <h2>💬 نظرات محصولات</h2>
    <p class="sub">${pendCount ? fa(pendCount) + " نظر در انتظار بررسی است." : "همه نظرات بررسی شده‌اند."} فقط نظرات تأییدشده در سایت نمایش داده می‌شوند.</p>
    <div class="toolbar">
      <select id="rvProd" style="max-width:280px">
        <option value="">همه محصولات</option>
        ${DB.products.map(p => { const r = productRating(DB, p.id);
          return `<option value="${p.id}" ${reviewFilterProduct === p.id ? "selected" : ""}>${esc(p.name)} — ${r.count ? fa(Math.round(r.avg * 10) / 10) + " از ۵ (" + fa(r.count) + " نظر)" : "بدون نظر"}</option>`; }).join("")}
      </select>
    </div>
    ${list.length ? `<div class="table-wrap"><table><thead><tr><th>محصول</th><th>نظردهنده</th><th>امتیاز</th><th>متن نظر</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>
      ${list.map(r => { const p = DB.products.find(x => x.id === r.productId);
        return `<tr>
          <td>${p ? esc(p.name) : "محصول حذف‌شده"}</td><td>${esc(r.name)}</td>
          <td>${starsHtml(r.rating)} ${fa(r.rating)}</td><td style="max-width:220px">${esc(r.text)}</td>
          <td><span class="pill" style="background:${stBg[r.status]};color:${stFg[r.status]}">${stLabel[r.status]}</span></td>
          <td style="white-space:nowrap">
            ${r.status !== "approved" ? `<button class="btn btn-ghost btn-sm" data-act="rv-approve" data-id="${r.id}">تأیید</button>` : ""}
            ${r.status !== "rejected" ? `<button class="btn btn-sm" style="background:#fdf3e3;color:#8a5a17" data-act="rv-reject" data-id="${r.id}">رد</button>` : ""}
            <button class="btn btn-danger btn-sm" data-act="rv-del" data-id="${r.id}">حذف</button>
          </td></tr>`; }).join("")}
    </tbody></table></div>` : `<div class="empty">نظری برای نمایش وجود ندارد.</div>`}`;
  $("#rvProd").addEventListener("change", e => { reviewFilterProduct = e.target.value; renderReviews(); });
}

/* ---------- QR Code ها ---------- */
function qrLink(id) {
  const u = new URL("index.html", location.href);
  u.searchParams.set("qr", id);
  return u.href;
}
function renderQrs() {
  $("#content").innerHTML = `
    <h2>📱 مدیریت QR Code ها</h2>
    <p class="sub">۸ QR اختصاصی کافه — هر میز یک QR. لینک هر QR را پرینت کنید یا تصویر PNG آن را دانلود و چاپ کنید.</p>
    <div class="qr-grid">
      ${DB.qrCodes.map(q => {
        const st = qrStats(DB, q.id);
        return `<div class="qr-card">
          <div class="qr-head">
            <b>${qrLabel(q.id)}</b>
            <span class="pill" style="background:${q.active ? "#e5f6ec" : "#fdeaea"};color:${q.active ? "#1d6b3c" : "#9c2b2b"}">${q.active ? "🟢 آنلاین" : "🔴 آفلاین"}</span>
          </div>
          <div class="qr-stats">
            <span>تعداد سفارش: <b>${fa(st.count)}</b></span>
            <span>مجموع فروش: <b>${money(st.sum)}</b></span>
            <span>آخرین سفارش: <b>${st.last ? "#" + fa(st.last.id) + " — " + dateFa(st.last.createdAt) : "—"}</b></span>
          </div>
          <div class="qr-link">${esc(qrLink(q.id))}</div>
          <div class="qr-actions">
            <button class="toggle ${q.active ? "on" : ""}" data-act="qr-toggle" data-id="${q.id}" title="فعال / غیرفعال"></button>
            <button class="btn btn-ghost btn-sm" data-act="qr-show" data-id="${q.id}">نمایش QR</button>
            <button class="btn btn-ghost btn-sm" data-act="qr-copy" data-id="${q.id}">کپی لینک</button>
            <button class="btn btn-ghost btn-sm" data-act="qr-dl" data-id="${q.id}">دانلود PNG</button>
            <button class="btn btn-sm" style="background:var(--bg);color:var(--coffee)" data-act="qr-view" data-id="${q.id}">مشاهده</button>
          </div>
        </div>`;
      }).join("")}
    </div>`;
}
function showQrModal(id) {
  const link = qrLink(id);
  openModal(`
    <h3 style="font-size:16px;text-align:center">${qrLabel(id)}</h3>
    <div style="display:grid;place-items:center;padding:14px 0">
      <canvas id="qrCanvas" style="border:1px solid var(--line);border-radius:12px;width:min(260px,70vw);height:auto"></canvas>
    </div>
    <div class="qr-link" style="margin-bottom:12px">${esc(link)}</div>
    <button class="btn btn-primary btn-block" id="qrDlBtn">دانلود تصویر QR (PNG)</button>
    ${QRCodeGen.encode(link) ? "" : `<p class="sub" style="margin-top:8px;text-align:center">لینک بسیار طولانی است و در QR جا نمی‌شود.</p>`}`);
  const ok = QRCodeGen.toCanvas($("#qrCanvas"), link, 8);
  $("#qrDlBtn").addEventListener("click", () => downloadQr(id));
  if (!ok) { $("#qrCanvas").style.display = "none"; }
}
function downloadQr(id) {
  const link = qrLink(id);
  const cv = document.createElement("canvas");
  if (!QRCodeGen.toCanvas(cv, link, 12)) { toast("لینک برای QR بسیار طولانی است.", true); return; }
  const a = document.createElement("a");
  a.href = cv.toDataURL("image/png");
  a.download = "jikopik-qr-" + id + ".png";
  a.click();
  toast("تصویر QR دانلود شد.");
}

/* ---------- گزارش‌ها ---------- */
function renderReports() {
  const valid = DB.orders.filter(o => o.status !== "canceled");
  const totalSales = valid.reduce((s, o) => s + o.total, 0);
  /* پرفروش‌ترین محصولات */
  const byProduct = {};
  for (const o of valid) for (const i of o.items) {
    byProduct[i.name] = byProduct[i.name] || { qty: 0, sum: 0 };
    byProduct[i.name].qty += i.qty;
    byProduct[i.name].sum += i.price * i.qty;
  }
  const top = Object.entries(byProduct).sort((a, b) => b[1].qty - a[1].qty).slice(0, 10);
  const maxQty = top.length ? top[0][1].qty : 1;
  $("#content").innerHTML = `
    <h2>📈 گزارش‌ها</h2>
    <p class="sub">آمار فروش بر اساس QR و محصول</p>
    <div class="stats">
      <div class="stat hl"><b>${money(totalSales)}</b><span>مجموع فروش کل</span></div>
      <div class="stat"><b>${fa(valid.length)}</b><span>مجموع سفارش‌ها</span></div>
      <div class="stat"><b>${money(valid.length ? Math.round(totalSales / valid.length) : 0)}</b><span>میانگین هر سفارش</span></div>
    </div>
    <div class="grid-2">
      <div class="card-box">
        <h3>فروش به تفکیک QR</h3>
        <div class="table-wrap" style="box-shadow:none"><table><thead><tr><th>QR</th><th>سفارش‌ها</th><th>مجموع فروش</th><th>آخرین سفارش</th></tr></thead><tbody>
          ${DB.qrCodes.map(q => { const st = qrStats(DB, q.id);
            return `<tr><td><b>${qrLabel(q.id)}</b> ${q.active ? "🟢" : "🔴"}</td><td>${fa(st.count)}</td><td>${money(st.sum)}</td><td>${st.last ? "#" + fa(st.last.id) : "—"}</td></tr>`;
          }).join("")}
        </tbody></table></div>
      </div>
      <div class="card-box">
        <h3>پرفروش‌ترین محصولات</h3>
        ${top.length ? top.map(([name, d]) => `
          <div class="bar-row">
            <span class="bar-name">${esc(name)}</span>
            <div class="bar-track"><div class="bar-fill" style="width:${Math.round(d.qty / maxQty * 100)}%"></div></div>
            <span class="bar-val">${fa(d.qty)} عدد — ${money(d.sum)}</span>
          </div>`).join("") : `<div class="empty" style="box-shadow:none">هنوز فروشی ثبت نشده است.</div>`}
      </div>
    </div>`;
}

/* ---------- تنظیمات ---------- */
function renderSettings() {
  const s = DB.settings;
  $("#content").innerHTML = `
    <h2>⚙️ تنظیمات سایت</h2>
    <p class="sub">اطلاعات عمومی کافه و حساب مدیر</p>
    <form class="card-box form-grid" id="setForm" style="max-width:560px">
      <label>نام کافه<input name="cafeName" value="${esc(s.cafeName)}" maxlength="50"></label>
      <label>ایموجی یا نماد لوگو<input name="logo" value="${esc(s.logo)}" maxlength="4"></label>
      <label>لوگوی تصویری (اختیاری — در هدر منو نمایش داده می‌شود)<input type="file" name="logoImg" accept="image/*"></label>
      <label>شماره تماس<input name="phone" value="${esc(s.phone)}" inputmode="tel"></label>
      <label>آدرس<input name="address" value="${esc(s.address)}" maxlength="150"></label>
      <label>توضیحات صفحه اصلی<textarea name="desc" maxlength="200">${esc(s.desc)}</textarea></label>
      <label>اینستاگرام<input name="instagram" value="${esc(s.instagram)}" placeholder="cafe.jikopik@"></label>
      <label>تلگرام<input name="telegram" value="${esc(s.telegram)}"></label>
      <label>نام کاربری مدیر<input name="adminUser" value="${esc(s.adminUser)}"></label>
      <label>رمز عبور مدیر<input name="adminPass" value="${esc(s.adminPass)}"></label>
      <button class="btn btn-primary" type="submit">ذخیره تنظیمات</button>
    </form>`;
  $("#setForm").addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.target;
    DB.settings.cafeName = f.cafeName.value.trim() || DB.settings.cafeName;
    DB.settings.logo = f.logo.value.trim() || "☕";
    DB.settings.phone = f.phone.value.trim();
    DB.settings.address = f.address.value.trim();
    DB.settings.desc = f.desc.value.trim();
    DB.settings.instagram = f.instagram.value.trim();
    DB.settings.telegram = f.telegram.value.trim();
    DB.settings.adminUser = f.adminUser.value.trim() || "admin";
    DB.settings.adminPass = f.adminPass.value || DB.settings.adminPass;
    if (f.logoImg.files[0]) DB.settings.logoImg = await downscaleImage(f.logoImg.files[0], 200);
    save();
    toast("تنظیمات با موفقیت ذخیره شد.");
  });
}

/* ---------- رویدادهای سراسری ---------- */
document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const act = el.dataset.act, id = el.dataset.id;
  switch (act) {
    case "close-modal": closeModal(); break;
    case "view-order": viewOrder(parseInt(id, 10)); break;
    case "save-status": {
      const o = DB.orders.find(x => x.id === parseInt(id, 10));
      if (o) { o.status = $("#oStatus").value; save(); closeModal(); toast("وضعیت سفارش به‌روزرسانی شد."); renderSec(currentSec); }
      break;
    }
    case "toggle-stock": {
      const p = DB.products.find(x => x.id === id);
      if (p) { p.available = !p.available; p.updatedAt = Date.now(); save(); toast(p.available ? "محصول موجود شد." : "محصول ناموجود شد."); renderProducts(); }
      break;
    }
    case "new-product": productForm(null); break;
    case "edit-product": productForm(DB.products.find(x => x.id === id)); break;
    case "del-product": {
      const p = DB.products.find(x => x.id === id);
      if (!p) break;
      openModal(`<h3 style="font-size:16px">حذف محصول</h3>
        <p style="margin:12px 0">آیا از حذف «${esc(p.name)}» مطمئن هستید؟<br><small class="sub">اطلاعات سفارش‌های قبلی حفظ می‌شود.</small></p>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost" style="flex:1" data-act="close-modal">لغو</button>
          <button class="btn btn-danger" style="flex:1" data-act="del-product-yes" data-id="${p.id}">حذف</button>
        </div>`);
      break;
    }
    case "del-product-yes": {
      DB.products = DB.products.filter(x => x.id !== id);
      save(); closeModal(); toast("محصول حذف شد."); renderProducts();
      break;
    }
    case "new-cat": catForm(null); break;
    case "edit-cat": catForm(DB.categories.find(x => x.id === id)); break;
    case "cat-up": case "cat-down": {
      const c = DB.categories.find(x => x.id === id);
      const sibs = [...DB.categories].sort((a, b) => a.order - b.order);
      const i = sibs.indexOf(c), j = act === "cat-up" ? i - 1 : i + 1;
      if (c && sibs[j]) {
        [c.order, sibs[j].order] = [sibs[j].order, c.order];
        save(); renderCategories();
      }
      break;
    }
    case "del-cat": {
      const c = DB.categories.find(x => x.id === id);
      if (!c) break;
      const n = DB.products.filter(p => p.categoryId === id).length;
      openModal(`<h3 style="font-size:16px">حذف دسته</h3>
        <p style="margin:12px 0">آیا از حذف دسته «${esc(c.name)}» مطمئن هستید؟${n ? `<br><small style="color:var(--red)">${fa(n)} محصول این دسته به «بدون دسته» منتقل می‌شود.</small>` : ""}</p>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost" style="flex:1" data-act="close-modal">لغو</button>
          <button class="btn btn-danger" style="flex:1" data-act="del-cat-yes" data-id="${c.id}">حذف</button>
        </div>`);
      break;
    }
    case "del-cat-yes": {
      DB.categories = DB.categories.filter(x => x.id !== id);
      DB.products.forEach(p => { if (p.categoryId === id) p.categoryId = ""; });
      save(); closeModal(); toast("دسته حذف شد."); renderCategories();
      break;
    }
    case "rv-approve": { const r = DB.reviews.find(x => x.id === id); if (r) { r.status = "approved"; save(); toast("نظر تأیید شد و در سایت نمایش داده می‌شود."); renderReviews(); } break; }
    case "rv-reject": { const r = DB.reviews.find(x => x.id === id); if (r) { r.status = "rejected"; save(); toast("نظر رد شد."); renderReviews(); } break; }
    case "rv-del": { DB.reviews = DB.reviews.filter(x => x.id !== id); save(); toast("نظر حذف شد."); renderReviews(); break; }
    case "qr-toggle": {
      const q = DB.qrCodes.find(x => x.id === parseInt(id, 10));
      if (q) { q.active = !q.active; save(); toast(q.active ? qrLabel(q.id) + " آنلاین شد." : qrLabel(q.id) + " آفلاین شد."); renderQrs(); }
      break;
    }
    case "qr-show": showQrModal(parseInt(id, 10)); break;
    case "qr-dl": downloadQr(parseInt(id, 10)); break;
    case "qr-copy": {
      const link = qrLink(parseInt(id, 10));
      if (navigator.clipboard) navigator.clipboard.writeText(link).then(() => toast("لینک کپی شد."));
      else { const t = document.createElement("textarea"); t.value = link; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); toast("لینک کپی شد."); }
      break;
    }
    case "qr-view": {
      const q = DB.qrCodes.find(x => x.id === parseInt(id, 10));
      const st = qrStats(DB, q.id);
      openModal(`<h3 style="font-size:16px">${qrLabel(q.id)}</h3>
        <div class="detail-sec" style="margin-top:10px">
          <div class="row"><span>وضعیت</span><b>${q.active ? "🟢 آنلاین" : "🔴 آفلاین"}</b></div>
          <div class="row"><span>لینک</span><b style="direction:ltr;font-size:11px">${esc(qrLink(q.id))}</b></div>
          <div class="row"><span>تعداد سفارش</span><b>${fa(st.count)}</b></div>
          <div class="row"><span>مجموع فروش</span><b>${money(st.sum)}</b></div>
          <div class="row"><span>آخرین سفارش</span><b>${st.last ? "#" + fa(st.last.id) + " — " + dateFa(st.last.createdAt) : "—"}</b></div>
        </div>`);
      break;
    }
  }
});
/* کلیک روی پس‌زمینه مودال = بستن */
$("#modalRoot").addEventListener("click", e => { if (e.target === $("#modalRoot")) closeModal(); });
window.addEventListener("storage", () => { DB = dbLoad(); if (currentSec) renderSec(currentSec); });

/* ---------- شروع ---------- */
checkLogin();