// ===== helpers =====
const $id = (id) => document.getElementById(id);
function getCookie(name) {
  const v = `; ${document.cookie}`;
  const p = v.split(`; ${name}=`);
  return p.length === 2 ? p.pop().split(";").shift() : null;
}
const CSRFTOKEN = getCookie("csrftoken");

// ปุ่มชั้นบน / ชนิดสนาม
const TOP = [
  { k: "outdoor", name: "สนามกลางแจ้ง", isOutdoor: true },
  { k: "badminton", name: "สนามแบดมินตัน" },
  { k: "track", name: "สนามลู่-ลาน" },
  { k: "pool", name: "สระว่ายน้ำ" },
];
const OUTDOOR_SUBS = [
  { k: "tennis", name: "เทนนิส" },
  { k: "basketball", name: "บาสเกตบอล" },
  { k: "futsal", name: "ฟุตซอล" },
  { k: "football", name: "ฟุตบอล" },
  { k: "volleyball", name: "วอลเลย์บอล" },
  { k: "sepak_takraw", name: "เซปักตะกร้อ" },
  { k: "badminton", name: "แบดมินตัน" },
];
const SINGLE_FACILITY_NAMES = {
  badminton: "สนามแบดมินตัน",
  track: "สนามลู่-ลาน",
  pool: "สระว่ายน้ำ",
};

// state
let currentFacility = null; // 'outdoor' | 'badminton' | 'track' | 'pool' | null
let selectedSub = null; // เฉพาะกลางแจ้ง

function setTitle(text) {
  const el = $id("facilityTitle");
  if (!el) return;
  if (text && text.trim()) {
    el.textContent = text;
    el.style.display = "inline-block";
  } else {
    el.textContent = "";
    el.style.display = "none";
  }
}

function renderOutdoorButtons() {
  const grid = $id("grid-outdoor");
  if (!grid) return;
  grid.innerHTML = "";
  OUTDOOR_SUBS.forEach((s) => {
    const b = document.createElement("button");
    b.className = "btn sport-btn";
    b.type = "button";
    b.textContent = s.name;
    if (selectedSub?.k === s.k) b.classList.add("active");
    b.onclick = () => {
      selectedSub = s;
      setTitle(s.name);
      renderOutdoorButtons();
      updateFormUI();
    };
    grid.appendChild(b);
  });
}

// ตรวจค่าฟอร์ม (จำนวนเต็ม ≥ 0)
function validCounts() {
  const s = $id("students"),
    t = $id("staff");
  const sv = (s?.value ?? "").trim(),
    tv = (t?.value ?? "").trim();
  const si = Number(sv),
    ti = Number(tv);
  const okInt = (v) => Number.isInteger(v) && v >= 0;
  return s && t && sv !== "" && tv !== "" && okInt(si) && okInt(ti);
}

function updateFormUI() {
  const wrap = $id("selectedWrap"),
    name = $id("selectedName"),
    err = $id("formError"),
    submit = $id("submitBtn");
  if (wrap && name) {
    if (currentFacility === "outdoor") {
      if (selectedSub) {
        wrap.style.display = "block";
        name.textContent = selectedSub.name;
      } else {
        wrap.style.display = "none";
        name.textContent = "";
      }
    } else {
      wrap.style.display = "none";
      name.textContent = "";
    }
  }
  if (err) {
    err.style.display = "none";
    err.textContent = "";
  }
  let ok = validCounts();
  if (currentFacility === "outdoor") ok = ok && !!selectedSub;
  if (submit) submit.disabled = !ok;
}

// เรียก API (ตัวอย่าง: ถ้าไม่มี backend จะโชว์ overlay เฉย ๆ)
// เรียก API จริง, ล้างช่อง, ไม่ redirect
async function checkin(facility, sub = null) {
  const submitBtn = $id("submitBtn");
  const err = $id("formError");

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.dataset.loading = "1";
    submitBtn.textContent = "กำลังบันทึก…";
  }
  if (err) {
    err.style.display = "none";
    err.textContent = "";
  }

  // เอา URL จาก <main data-api-check-url="...">
  const mainEl = document.querySelector("main");
  const API_CHECK_URL = mainEl?.dataset.apiCheckUrl;
  if (!API_CHECK_URL) {
    if (err) {
      err.textContent = "ไม่พบ URL ของ API (data-api-check-url)";
      err.style.display = "block";
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.removeAttribute("data-loading");
      submitBtn.textContent = "ตกลง";
    }
    return;
  }

  const studentsVal = String(parseInt($id("students")?.value || "0", 10));
  const staffVal    = String(parseInt($id("staff")?.value || "0", 10));

  const body = new URLSearchParams();
  body.set("facility", facility);
  body.set("action", "in");
  if (sub) body.set("sub", sub);
  body.set("students", studentsVal);
  body.set("staff", staffVal);

  let ok = false;
  try {
    const res = await fetch(API_CHECK_URL, {
      method: "POST",
      headers: {
        "X-CSRFToken": CSRFTOKEN || "",
        "X-Requested-With": "XMLHttpRequest",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: body.toString(),
      credentials: "same-origin",
    });

    const ct = res.headers.get("content-type") || "";
    if (!res.ok || !ct.includes("application/json")) {
      throw new Error(`HTTP ${res.status} - ไม่สามารถบันทึกได้`);
    }

    const data = await res.json();
    if (data.ok === false) {
      const msg = data.message || data.error || "ไม่สามารถบันทึกได้";
      throw new Error(msg);
    }

    // แสดง overlay สำเร็จ
    showDone(data.action || "in");
    ok = true;

    // ✅ ล้างช่องอินพุต + รีเฟรชปุ่ม
    if ($id("students")) $id("students").value = "";
    if ($id("staff")) $id("staff").value = "";
    updateFormUI();

    // (ตัวเลือก) ดึงข้อมูล “วันนี้” แบบเบา ๆ ไว้ใช้ต่อ (แค่ log ไว้ก่อน)
    try {
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, "0");
      const d = String(today.getDate()).padStart(2, "0");
      const ymd = `${y}-${m}-${d}`;

      const apiRowsUrl =
        mainEl?.dataset.apiCheckinsUrl || // ถ้าคุณฝัง data-api-checkins-url ไว้
        (window.API_CHECKINS_URL ?? null); // หรือประกาศ global อื่น ๆ

      if (apiRowsUrl) {
        const qs = new URLSearchParams({
          from: ymd,
          to: ymd,
          facility: "", // เว้นว่าง = ทุกสนาม; จะกรองเฉพาะก็ใส่ facility ได้
        }).toString();
        const r = await fetch(`${apiRowsUrl}?${qs}`, { credentials: "same-origin" });
        if (r.ok) {
          const rows = await r.json();
          console.log("ยอดเช็คอินวันนี้:", rows.length, rows);
          // ถ้าจะอัปเดต UI ตรงไหน ก็ทำต่อจากตรงนี้ได้เลย
          // เช่น: $id("todayCount")?.textContent = rows.length;
        }
      }
    } catch (_) {
      // เงียบไว้ ไม่ให้รบกวน UX
    }
  } catch (e) {
    if (err) {
      err.textContent = (e && e.message) || "บันทึกไม่สำเร็จ ลองอีกครั้งได้เลย";
      err.style.display = "block";
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.removeAttribute("data-loading");
      submitBtn.textContent = ok ? "ตกลง" : "ลองอีกครั้ง";
    }
  }
}

function tinyBurst(node) {
  try {
    const n = 10,
      rect = node.getBoundingClientRect(),
      cx = rect.left + rect.width / 2,
      cy = rect.top + rect.height / 2;
    for (let i = 0; i < n; i++) {
      const dot = document.createElement("i");
      dot.style.position = "fixed";
      dot.style.left = cx + "px";
      dot.style.top = cy + "px";
      dot.style.width = dot.style.height = "6px";
      dot.style.borderRadius = "50%";
      dot.style.background = i % 2 ? "#b786f4" : "#ffd782";
      dot.style.pointerEvents = "none";
      dot.style.opacity = ".85";
      document.body.appendChild(dot);
      const ang = Math.PI * 2 * (i / n),
        dist = 40 + Math.random() * 30,
        tx = Math.cos(ang) * dist,
        ty = Math.sin(ang) * dist;
      dot.animate(
        [
          { transform: "translate(0,0)", opacity: 0.95 },
          { transform: `translate(${tx}px,${ty}px)`, opacity: 0 },
        ],
        {
          duration: 550 + Math.random() * 200,
          easing: "cubic-bezier(.2,.7,.2,1)",
          fill: "forwards",
        },
      );
      setTimeout(() => dot.remove(), 820);
    }
  } catch {}
}

function showDone(action = "in") {
  const title = $id("overlay")?.querySelector(".ok-title");
  if (title) {
    title.innerHTML =
      action === "out" ? "เช็คเอาต์<br>เสร็จสิ้น" : "เช็คอิน<br>เสร็จสิ้น";
  }
  $id("overlay")?.classList.add("show");
  setTimeout(() => $id("overlay")?.classList.remove("show"), 900);
  const card = document.querySelector(".card-ok");
  if (card) tinyBurst(card);
}

function onTopClick(f) {
  currentFacility = f.k;
  $id("panel-top").classList.add("hidden");
  $id("panel-outdoor").classList.remove("hidden");
  const grid = $id("grid-outdoor");
  if (f.isOutdoor) {
    if (grid) grid.style.display = "grid";
    selectedSub = null;
    setTitle("");
    renderOutdoorButtons();
  } else {
    if (grid) grid.style.display = "none";
    selectedSub = null;
    setTitle(SINGLE_FACILITY_NAMES[currentFacility] || "");
  }
  const s = $id("students"),
    t = $id("staff");
  if (s) s.value = "";
  if (t) t.value = "";
  updateFormUI();
}

function init() {
  // สร้างปุ่มชั้นบน
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

  // input events
  $id("students")?.addEventListener("input", updateFormUI);
  $id("staff")?.addEventListener("input", updateFormUI);

  // ปุ่มตกลง
  $id("submitBtn")?.addEventListener("click", () => {
    if (!validCounts()) {
      const err = $id("formError");
      if (err) {
        err.textContent = "กรุณากรอกจำนวนนิสิตและบุคลากร (จำนวนเต็มไม่ติดลบ)";
        err.style.display = "block";
      }
      return;
    }
    if (currentFacility === "outdoor") {
      if (!selectedSub) {
        const err = $id("formError");
        if (err) {
          err.textContent = "กรุณาเลือกชนิดสนาม";
          err.style.display = "block";
        }
        return;
      }
      checkin("outdoor", selectedSub.k);
    } else if (currentFacility) {
      checkin(currentFacility, null);
    }
  });

  // ปุ่มกลับ
  $id("btnBack")?.addEventListener("click", () => {
    currentFacility = null;
    selectedSub = null;
    setTitle("");
    const grid = $id("grid-outdoor");
    if (grid) grid.style.display = "grid";
    $id("panel-outdoor")?.classList.add("hidden");
    $id("panel-top")?.classList.remove("hidden");
  });

  // เตรียมกลางแจ้ง + เริ่มต้น
  renderOutdoorButtons();
  setTitle("");
  updateFormUI();

  // กัน scroll-wheel/อักขระที่ไม่ใช่ตัวเลข
  ["students", "staff"].forEach((id) => {
    const el = $id(id);
    if (!el) return;
    el.addEventListener(
      "wheel",
      (e) => (el === document.activeElement ? null : e.preventDefault()),
      { passive: false },
    );
    el.addEventListener("keydown", (e) => {
      if (["e", "E", "+", "-", ".", ","].includes(e.key)) e.preventDefault();
    });
  });

  // คืนค่าเดิม
  (function restoreLast() {
    const ls = (k, d = null) => localStorage.getItem(k) ?? d;
    const lastS = ls("lastStudents"),
      lastT = ls("lastStaff");
    if ($id("students") && lastS !== null) $id("students").value = lastS;
    if ($id("staff") && lastT !== null) $id("staff").value = lastT;

    const lf = ls("lastFacility"),
      lsub = ls("lastSubFacility");
    const top = TOP.find((t) => t.k === lf);
    if (top) {
      onTopClick(top);
      if (lf === "outdoor" && lsub) {
        const sub = OUTDOOR_SUBS.find((s) => s.k === lsub);
        if (sub) {
          selectedSub = sub;
          setTitle(sub.name);
          renderOutdoorButtons();
        }
      }
      updateFormUI();
    }
  })();

  // overlay: ปิดด้วยคลิกพื้นหลัง + Esc
  (function enhanceOverlay() {
    const overlay = $id("overlay");
    if (!overlay) return;
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.classList.remove("show");
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") overlay.classList.remove("show");
    });
  })();
}

document.addEventListener("DOMContentLoaded", init);

// วันที่ไทย + พ.ศ.
(function showThaiDate() {
  const el = document.getElementById("todayDate");
  if (!el) return;
  const now = new Date();
  const parts = new Intl.DateTimeFormat("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).formatToParts(now);
  const thaiYear = now.getFullYear() + 543;
  el.textContent = parts
    .map((p) => (p.type === "year" ? thaiYear : p.value))
    .join("");
  setTimeout(showThaiDate, 60000);
})();

// เมนู <details>: ปิดอันอื่นเมื่อเปิด + ปิดเมื่อคลิคนอก/กด Esc
(function enhanceDetailsMenu() {
  const menus = Array.from(document.querySelectorAll(".has-sub > details"));
  if (!menus.length) return;
  menus.forEach((d) => {
    d.addEventListener("toggle", () => {
      const sum = d.querySelector("summary.toplink");
      if (d.open) {
        menus.forEach((o) => {
          if (o !== d) o.open = false;
        });
        if (sum) sum.setAttribute("aria-expanded", "true");
      } else if (sum) {
        sum.setAttribute("aria-expanded", "false");
      }
    });
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".has-sub")) menus.forEach((d) => (d.open = false));
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") menus.forEach((d) => (d.open = false));
  });
})();
// --- หลังบันทึกสำเร็จ ---
ok = true;

// ✅ เก็บค่าไว้ (ไม่ล้าง) + จำลง localStorage เพื่อให้เปิดมารอบหน้าเห็นตัวเลขเดิม
localStorage.setItem("lastStudents", studentsVal);
localStorage.setItem("lastStaff", staffVal);
localStorage.setItem("lastFacility", facility);
if (sub) localStorage.setItem("lastSubFacility", sub);

// ✅ แจ้งทุกแท็บ/หน้ารายงานให้รีเฟรช (BroadcastChannel)
try {
  const ch = new BroadcastChannel("checkins");
  ch.postMessage({
    type: "checkin:created",
    payload: {
      ts: data.ts,
      session_date: data.session_date,
      facility: data.facility,
      sub_facility: data.sub_facility || "",
      student_count: Number(data.student_count || studentsVal || 0),
      staff_count:   Number(data.staff_count   || staffVal   || 0),
    },
  });
  ch.close();
} catch {}
