"use strict";
/* ============================================================
   لایه دیتابیس مشترک کافه جیک و پیک
   ذخیره‌سازی: localStorage مرورگر (بدون سرور، بدون داده Mock)
   ============================================================ */
const DB_KEY = "jikopik_db_v1";

const ORDER_STATUSES = {
  pending:    { label: "در انتظار بررسی",    bg: "#fdf3e3", fg: "#8a5a17", dot: "🟡" },
  preparing:  { label: "در حال آماده‌سازی", bg: "#e8f0fe", fg: "#1d4ed8", dot: "🔵" },
  ready:      { label: "آماده شد",           bg: "#e5f6ec", fg: "#1d6b3c", dot: "🟢" },
  delivered:  { label: "تحویل داده شد",      bg: "#f3e8ff", fg: "#7c3aed", dot: "🟣" },
  canceled:   { label: "لغو شد",             bg: "#fdeaea", fg: "#9c2b2b", dot: "🔴" },
};

function uid(prefix) {
  return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function faNum(n) { return Number(n || 0).toLocaleString("fa-IR"); }
function faMoney(n) { return faNum(n) + " تومان"; }
function toEnDigits(s) {
  return String(s).replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
                  .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
}
function dateFa(ts) { return new Date(ts).toLocaleDateString("fa-IR"); }
function timeFa(ts) { return new Date(ts).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }); }
function isToday(ts) { return new Date(ts).toLocaleDateString("fa-IR") === new Date().toLocaleDateString("fa-IR"); }

function seedDB() {
  const C = (id, name, emoji, order) => ({ id, name, emoji, order });
  const P = (id, name, price, categoryId, order, desc) => ({
    id, name, price, categoryId, order, desc,
    image: "", available: true, createdAt: Date.now(), updatedAt: Date.now()
  });
  return {
    version: 1,
    categories: [
      C("c1", "قهوه‌های گرم", "☕", 1),
      C("c2", "آیس کافی", "🧊", 2),
      C("c3", "هات‌چاکلت و نوشیدنی گرم", "🍫", 3),
      C("c4", "شیک", "🥤", 4),
      C("c5", "کیک و دسر", "🍰", 5),
      C("c6", "نوشیدنی‌های سرد", "🍹", 6),
    ],
    products: [
      P("p1",  "اسپرسو سینگل", 75000, "c1", 1, "یک شات اسپرسو غلیظ از دانه‌های تازه‌برشت."),
      P("p2",  "اسپرسو دبل", 95000, "c1", 2, "دو شات اسپرسو پرانرژی برای عاشقان قهوه جدی."),
      P("p3",  "آمریکانو", 90000, "c1", 3, "اسپرسو با آب داغ؛ طعم خالص و تلخ‌مایه قهوه."),
      P("p4",  "لاته", 110000, "c1", 4, "اسپرسو با شیر بخارپز مخملی و لایه فوم لطیف."),
      P("p5",  "کاپوچینو", 110000, "c1", 5, "تعادل کامل اسپرسو، شیر و فوم غلیظ."),
      P("p6",  "موکا", 125000, "c1", 6, "ترکیب اسپرسو، شیر و شکلات تلخ."),
      P("p7",  "آیس آمریکانو", 95000, "c2", 1, "اسپرسو سرد روی یخ؛ خنک و پرطراوت."),
      P("p8",  "آیس لاته", 115000, "c2", 2, "لاته خنک با شیر سرد و یخ فراوان."),
      P("p9",  "آیس موکا", 130000, "c2", 3, "قهوه سرد با شکلات و خامه."),
      P("p10", "آیس کارامل ماکیاتو", 135000, "c2", 4, "شیر وانیلی، اسپرسو و سس کارامل روی یخ."),
      P("p11", "هات چاکلت", 110000, "c3", 1, "شکلات داغ غلیظ و لذیذ با خامه."),
      P("p12", "هات چاکلت کارامل", 125000, "c3", 2, "هات چاکلت با سس کارامل خانگی."),
      P("p13", "شیر کاکائو", 90000, "c3", 3, "نوشیدنی گرم و ساده؛ محبوب همیشه."),
      P("p14", "ماسالا", 100000, "c3", 4, "چای هندی با شیر و ادویه‌های معطر."),
      P("p15", "چای سیاه", 65000, "c3", 5, "چای دم‌کشیده کلاسیک."),
      P("p16", "چای سبز", 70000, "c3", 6, "چای سبز خنثی و آرام‌بخش."),
      P("p17", "چای دارچین", 75000, "c3", 7, "چای با عطر دارچین گرم."),
      P("p18", "چای زعفران", 85000, "c3", 8, "چای زعفران اصیل با عطر بهشتی."),
      P("p19", "شیک شکلات", 150000, "c4", 1, "شیک سرد و غلیظ با بستنی و سس شکلات."),
      P("p20", "شیک وانیل", 140000, "c4", 2, "شیک وانیلی خامه‌ای با بستنی."),
      P("p21", "شیک کارامل", 150000, "c4", 3, "شیک با سس کارامل و بستنی وانیل."),
      P("p22", "شیک نوتلا", 170000, "c4", 4, "شیک شکلاتی خنک با بستنی، شیر و نوتلا."),
      P("p23", "کیک شکلاتی", 120000, "c5", 1, "برش کیک شکلاتی تازه و خیس."),
      P("p24", "کیک خیس شکلاتی", 130000, "c5", 2, "کیک خیس با گاناش شکلات."),
      P("p25", "کیک هویج", 115000, "c5", 3, "کیک هویج با کشمش و کرم پنیر."),
      P("p26", "پنکیک", 150000, "c5", 4, "پنکیک سه‌لایه با عسل و کره."),
      P("p27", "موهیتو", 120000, "c6", 1, "نوشیدنی خنک نعنا و لیموترش."),
      P("p28", "لیموناد", 120000, "c6", 2, "لیموناد خانگی با یخ فراوان."),
    ],
    qrCodes: Array.from({ length: 8 }, (_, i) => ({ id: i + 1, active: true })),
    orders: [],
    reviews: [
      { id: uid("rv"), productId: "p4",  name: "سارا",  rating: 5, text: "لاته‌ش فوق‌العاده بود، فومش عالی.", status: "approved", createdAt: Date.now() - 86400000 * 3 },
      { id: uid("rv"), productId: "p4",  name: "امید",  rating: 4, text: "خوب بود، فقط کمی شیرین‌تر از حد انتظار.", status: "approved", createdAt: Date.now() - 86400000 * 2 },
      { id: uid("rv"), productId: "p22", name: "نگار",  rating: 5, text: "شیک نوتلا حتماً امتحان کنید!", status: "approved", createdAt: Date.now() - 86400000 },
    ],
    settings: {
      cafeName: "کافه جیک و پیک",
      logo: "☕",
      phone: "",
      address: "",
      desc: "سفارش خود را انتخاب کنید، به سبد اضافه کنید و ثبت بزنید — ما آماده می‌کنیم.",
      instagram: "",
      telegram: "",
      adminUser: "admin",
      adminPass: "jikopik123",
    },
  };
}

function dbLoad() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const db = JSON.parse(raw);
      if (db && db.products && db.qrCodes && db.settings) return db;
    }
  } catch (e) { /* داده خراب — از نو ساخته می‌شود */ }
  const fresh = seedDB();
  dbSave(fresh);
  return fresh;
}
function dbSave(db) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    return true;
  } catch (e) {
    console.error("خطای ذخیره‌سازی دیتابیس (فضای مرورگر پر است):", e);
    return false;
  }
}

/* میانگین امتیاز تأییدشده یک محصول */
function productRating(db, pid) {
  const rs = db.reviews.filter(r => r.productId === pid && r.status === "approved");
  if (!rs.length) return { avg: 0, count: 0 };
  return { avg: rs.reduce((s, r) => s + r.rating, 0) / rs.length, count: rs.length };
}
/* آمار هر QR */
function qrStats(db, qrId) {
  const os = db.orders.filter(o => o.qrId === qrId && o.status !== "canceled");
  const last = db.orders.filter(o => o.qrId === qrId).sort((a, b) => b.createdAt - a.createdAt)[0];
  return {
    count: os.length,
    sum: os.reduce((s, o) => s + o.total, 0),
    last: last || null,
  };
}