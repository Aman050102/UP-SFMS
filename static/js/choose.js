// === helpers ===
const $id = (id) => document.getElementById(id);
function getCookie(name){ const v=`; ${document.cookie}`; const p=v.split(`; ${name}=`); return p.length===2?p.pop().split(';').shift():null; }
const CSRFTOKEN = getCookie("csrftoken");

// ปุ่มชั้นบน
const TOP = [
  { k: "outdoor",   name: "สนามกลางแจ้ง", isOutdoor: true },
  { k: "badminton", name: "สนามแบดมินตัน" },
  { k: "track",     name: "สนามลู่-ลาน" },
  { k: "pool",      name: "สระว่ายน้ำ" },
];

// ชนิดย่อยของกลางแจ้ง
const OUTDOOR_SUBS = [
  { k: "tennis",       name: "เทนนิส" },
  { k: "basketball",   name: "บาสเกตบอล" },
  { k: "futsal",       name: "ฟุตซอล" },
  { k: "football",     name: "ฟุตบอล" },
  { k: "volleyball",   name: "วอลเลย์บอล" },
  { k: "sepak_takraw", name: "เซปักตะกร้อ" },
  { k: "badminton",    name: "แบดมินตัน" },
];

// ชื่อสนามเดี่ยว (ไม่มีชนิดย่อย)
const SINGLE_FACILITY_NAMES = {
  badminton: "สนามแบดมินตัน",
  track: "สนามลู่-ลาน",
  pool: "สระว่ายน้ำ",
};

// state
let currentFacility = null; // 'outdoor' | 'badminton' | 'track' | 'pool' | null
let selectedSub = null;     // {k,name} เฉพาะกลางแจ้ง

// --- หัวชิปด้านบน (ดึง element แบบสดทุกครั้ง กัน null) ---
function setTitle(text) {
  const titleEl = $id('facilityTitle');
  if (!titleEl) return;
  if (text && text.trim()) {
    titleEl.textContent = text;
    titleEl.style.display = 'inline-block';
  } else {
    titleEl.textContent = '';
    titleEl.style.display = 'none';
  }
}

// --- เรนเดอร์ปุ่มชนิดกลางแจ้ง ---
function renderOutdoorButtons(){
  const grid = $id("grid-outdoor");
  if (!grid) return;
  grid.innerHTML = "";
  OUTDOOR_SUBS.forEach(s=>{
    const b = document.createElement("button");
    b.className = "btn sport-btn";
    b.type = "button";
    b.textContent = s.name;
    if (selectedSub?.k === s.k) b.classList.add("active");
    b.onclick = ()=>{
      selectedSub = s;
      setTitle(s.name);        // โชว์หัวข้อชื่อชนิดที่เลือก
      renderOutdoorButtons();  // อัปเดต active
      updateFormUI();
    };
    grid.appendChild(b);
  });
}

// --- ตรวจค่าฟอร์ม ---
function validCounts(){
  const s = $id("students"); const t = $id("staff");
  return s && t && s.value !== "" && t.value !== "" && +s.value >= 0 && +t.value >= 0;
}

// --- อัปเดตปุ่ม/ข้อความเตือน ---
function updateFormUI(){
  const wrap = $id("selectedWrap");
  const name = $id("selectedName");
  const err  = $id("formError");
  const submit = $id("submitBtn");

  if (wrap && name) {
    if (currentFacility === "outdoor") {
      if (selectedSub) { wrap.style.display = "block"; name.textContent = selectedSub.name; }
      else { wrap.style.display = "none"; name.textContent = ""; }
    } else {
      // สนามเดี่ยวไม่ต้องโชว์ wrap นี้
      wrap.style.display = "none";
      name.textContent = "";
    }
  }

  if (err) err.style.display = "none";

  let ok = validCounts();
  if (currentFacility === "outdoor") ok = ok && !!selectedSub;
  if (submit) submit.disabled = !ok;
}

// --- เรียก API (เงียบถ้าพลาด ไม่เด้ง alert) ---
async function checkin(facility, sub=null){
  const body = new URLSearchParams();
  body.set("facility", facility);
  if (sub) body.set("sub", sub);
  body.set("students", $id("students").value || "0");
  body.set("staff", $id("staff").value || "0");

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

  if (!res.ok) return; // เงียบไว้
  const data = await res.json().catch(()=>({action:"in"}));
  showDone(data.action || "in");
}

function showDone(action="in"){
  const title = $id("overlay")?.querySelector(".ok-title");
  if (title) title.innerHTML = action === "out" ? "เช็คเอาต์<br>เสร็จสิ้น" : "เช็คอิน<br>เสร็จสิ้น";
  $id("overlay")?.classList.add("show");
  setTimeout(()=> $id("overlay")?.classList.remove("show"), 900);
}

// --- คลิกปุ่มชั้นบน ---
function onTopClick(f){
  currentFacility = f.k;

  // เปิดแผงแบบฟอร์มเสมอ
  $id("panel-top").classList.add("hidden");
  $id("panel-outdoor").classList.remove("hidden");

  const grid = $id("grid-outdoor");

  if (f.isOutdoor){
    // โหมดกลางแจ้ง → โชว์กริดชนิดย่อย + ซ่อนหัวชิป
    if (grid) grid.style.display = "grid";
    selectedSub = null;
    setTitle('');
    renderOutdoorButtons();
  } else {
    // สนามเดี่ยว → ซ่อนกริดชนิดย่อย + โชว์หัวชิปเป็นชื่อสนาม
    if (grid) grid.style.display = "none";
    selectedSub = null;
    setTitle(SINGLE_FACILITY_NAMES[currentFacility] || '');
  }

  // ล้างค่าแบบฟอร์ม
  const s = $id("students"); const t = $id("staff");
  if (s) s.value = "";
  if (t) t.value = "";

  updateFormUI();
}

// --- init ---
function init(){
  // ปุ่มชั้นบน
  const gridTop = $id("grid-top");
  if (gridTop) {
    gridTop.innerHTML = "";
    TOP.forEach(f=>{
      const b = document.createElement("button");
      b.className = "btn";
      b.type = "button";
      b.textContent = f.name;
      b.onclick = ()=> onTopClick(f);
      gridTop.appendChild(b);
    });
  }

  // ฟิลด์นับคน
  $id("students")?.addEventListener("input", updateFormUI);
  $id("staff")?.addEventListener("input", updateFormUI);

  // ปุ่มตกลง
  $id("submitBtn")?.addEventListener("click", ()=>{
    if (!validCounts()){
      const err = $id("formError");
      if (err) { err.textContent = "กรุณากรอกจำนวนนิสิตและบุคลากร"; err.style.display = "block"; }
      return;
    }
    if (currentFacility === "outdoor") {
      if (!selectedSub){
        const err = $id("formError");
        if (err) { err.textContent = "กรุณาเลือกชนิดสนาม"; err.style.display = "block"; }
        return;
      }
      checkin("outdoor", selectedSub.k);
    } else if (currentFacility) {
      checkin(currentFacility, null);
    }
  });

  // ปุ่มกลับ
  $id("btnBack")?.addEventListener("click", ()=>{
    currentFacility = null;
    selectedSub = null;
    setTitle('');
    const grid = $id("grid-outdoor");
    if (grid) grid.style.display = "grid";
    $id("panel-outdoor")?.classList.add("hidden");
    $id("panel-top")?.classList.remove("hidden");
  });

  // เตรียมกริดกลางแจ้ง + ซ่อนหัวข้อเริ่มต้น
  renderOutdoorButtons();
  setTitle('');
  updateFormUI();
}

document.addEventListener("DOMContentLoaded", init);
