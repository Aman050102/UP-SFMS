// === helpers ===
const $id = (id) => document.getElementById(id);

// อ่าน CSRF จาก cookie (Django)
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
  return null;
}
const CSRFTOKEN = getCookie("csrftoken");

// ตัวเลือกระดับบน
const TOP = [
  { k: "outdoor", name: "สนามกลางแจ้ง", isOutdoor: true },
  { k: "badminton", name: "สนามแบดมินตัน" },
  { k: "track", name: "สนามลู่-ลาน" },
  { k: "pool", name: "สระว่ายน้ำ" },
];

// สนามย่อยของ outdoor (ส่งเป็น sub ไปเก็บใน DB)
const OUTDOOR_SUBS = [
  { k: "tennis", name: "เทนนิส" },
  { k: "basketball", name: "บาสเก็ตบอล" },
  { k: "futsal", name: "ฟุตซอล" },
  { k: "volleyball", name: "วอลเลย์บอล" },
  { k: "sepak_takraw", name: "เซปักตะกร้อ" },
];

// === format วัน–เวลาไทย (locked Asia/Bangkok) ===
function formatNow() {
  const currentDate = new Date();
  return currentDate.toLocaleString("th-TH", {
    dateStyle: "long",
    timeStyle: "medium",
    timeZone: "Asia/Bangkok",
  });
}

// === clock updater ===
function startClock() {
  const el = $id("session");
  if (!el) return;
  const tick = () => (el.textContent = formatNow());
  tick();
  setInterval(tick, 1000);
}

// === core: เรียก API Django ===
// หมายเหตุ: ไม่ต้องส่ง action แล้ว ให้ backend เป็นคนตัดสินใจ (toggle สำหรับ pool)
async function checkin(facility, sub = null) {
  const body = new URLSearchParams();
  body.set("facility", facility);
  if (sub) body.set("sub", sub);

  try {
    const res = await fetch("/api/check-event/", {
      method: "POST",
      headers: {
        "X-CSRFToken": CSRFTOKEN || "",
        "X-Requested-With": "XMLHttpRequest",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: body.toString(),
      credentials: "same-origin",
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error("checkin failed", res.status, txt);
      alert("เช็คอิน/เช็คเอาต์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      return;
    }

    const data = await res.json(); // { ok, action: 'in'|'out', ... }
    showDone(data.action);
  } catch (err) {
    console.error("checkin exception:", err);
    alert("เช็คอิน/เช็คเอาต์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
  }
}

function showDone(action = "in") {
  const overlay = $id("overlay");
  if (overlay) {
    const title = overlay.querySelector(".ok-title");
    if (title) {
      title.innerHTML =
        action === "out" ? "เช็คเอาต์<br>เสร็จสิ้น" : "เช็คอิน<br>เสร็จสิ้น";
    }
    overlay.classList.add("show");
  }
  setTimeout(() => {
    overlay?.classList.remove("show");
  }, 900);
}

// === UI handlers ===
function onTopClick(f) {
  if (f.isOutdoor) {
    $id("panel-top").classList.add("hidden");
    $id("panel-outdoor").classList.remove("hidden");
  } else {
    // สนามอื่น (badminton/track/pool)
    // - badminton/track → ฝั่ง server จะบันทึกเป็น action="in"
    // - pool → จะ toggle in/out อัตโนมัติ
    checkin(f.k, null);
  }
}

// === init UI ===
(function init() {
  startClock();

  // ปุ่มชั้นบน
  const gridTop = $id("grid-top");
  if (gridTop) {
    gridTop.innerHTML = "";
    TOP.forEach((f) => {
      const b = document.createElement("button");
      b.className = "btn";
      b.type = "button";
      b.textContent = f.name;
      b.onclick = () => onTopClick(f);
      gridTop.appendChild(b);
    });
  }

  // ปุ่มสนามย่อย outdoor
  const gridOutdoor = $id("grid-outdoor");
  if (gridOutdoor) {
    gridOutdoor.innerHTML = "";
    OUTDOOR_SUBS.forEach((s) => {
      const b = document.createElement("button");
      b.className = "btn";
      b.type = "button";
      b.textContent = s.name;
      b.onclick = () => checkin("outdoor", s.k);
      gridOutdoor.appendChild(b);
    });
  }

  // back
  const backBtn = $id("btnBack");
  if (backBtn) {
    backBtn.onclick = () => {
      $id("panel-outdoor").classList.add("hidden");
      $id("panel-top").classList.remove("hidden");
    };
  }
})();