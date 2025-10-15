// static/js/login.js
(function () {
  // ===== ปลายทาง auth ของคุณ =====
  const BASE_AUTH_URL = "/auth"; // เดิมคือ route('auth.redirect')

  // ===== ตัวช่วย =====
  const qs = (s, el = document) => el.querySelector(s);
  const qsa = (s, el = document) => Array.from(el.querySelectorAll(s));
  const buildUrl = (base, params) => {
    const u = new URL(base, window.location.origin);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) u.searchParams.set(k, v);
    });
    return u.toString();
  };

  // ===== อ้างอิง element =====
  const tablist = qs(".segmented");
  const tabs = qsa('[role="tab"]', tablist);
  const indicator = qs(".segmented-indicator", tablist);
  const roleLabel = qs("#role-label");
  const btnGo = qs("#btn-continue");
  const forgotLink = qs("#forgot-link");

  // ===== สถานะปัจจุบัน =====
  let selectedRole = "staff"; // ค่าเริ่มต้น

  // วาง indicator ไว้ใต้ปุ่มที่เลือก
  function positionIndicator(activeTab) {
    if (!indicator || !activeTab) return;
    const { offsetLeft, offsetWidth } = activeTab;
    indicator.style.transform = `translateX(${offsetLeft}px)`;
    indicator.style.width = `${offsetWidth}px`;
  }

  // ล็อกบทบาท + อัปเดต aria + ป้ายสถานะ
  function lockTo(role) {
    selectedRole = role;
    tabs.forEach((tab) => {
      const active = tab.dataset.role === role;
      tab.setAttribute("aria-selected", active ? "true" : "false");
      if (active) positionIndicator(tab);
    });
    if (roleLabel) {
      roleLabel.textContent = `ล็อกบทบาท: ${role === "staff" ? "เจ้าหน้าที่" : "นิสิต/บุคคลทั่วไป"}`;
    }
  }

  // init วาง indicator ตามปุ่มที่เลือกเริ่มต้น
  window.addEventListener("load", () => {
    const active =
      tabs.find((t) => t.getAttribute("aria-selected") === "true") || tabs[0];
    lockTo(active?.dataset.role || "staff");
  });
  window.addEventListener("resize", () => {
    const active = tabs.find((t) => t.getAttribute("aria-selected") === "true");
    positionIndicator(active);
  });

  // เปลี่ยนบทบาทเมื่อคลิก tab
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => lockTo(tab.dataset.role));
  });

  // ปุ่ม “ดำเนินการต่อ”
  btnGo?.addEventListener("click", () => {
    const next = window.location.href;
    const url = buildUrl(BASE_AUTH_URL, { role: selectedRole, next });
    window.location.href = url;
  });

  // ลืมรหัสผ่าน
  forgotLink?.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = "https://password.up.ac.th/";
  });
})();
