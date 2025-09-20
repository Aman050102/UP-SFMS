// static/js/user_equipment.js
(() => {
  const $  = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  // ===== Elements =====
  const sel         = $("#equipment");
  const qty         = $("#qty");
  const btnInc      = $$('.qty-btn[data-delta="1"]');
  const btnDec      = $$('.qty-btn[data-delta="-1"]');
  const btnConfirm  = $("#confirmBtn");
  const sheetBorrow = $("#sheetBorrow");

  // ช่องผู้ใช้ (ต้องมี id="studentId" และ id="faculty" ใน HTML)
  const inputSID = $("#studentId");
  const inputFAC = $("#faculty");

  // ===== Prefill จากครั้งก่อน =====
  (() => {
    try {
      const sid = localStorage.getItem("sfms_sid");
      const fac = localStorage.getItem("sfms_fac");
      if (sid && inputSID) inputSID.value = sid;
      if (fac && inputFAC) inputFAC.value = fac;
    } catch (_) {}
  })();

  // ===== Stock map จากตารางด้านขวา =====
  const stock = {};
  $$("#stockList li").forEach((li) => {
    const name = $("span", li)?.textContent.trim();
    const left = parseInt($("b", li)?.textContent.replace(/,/g, ""), 10) || 0;
    if (name) stock[name] = left;
  });

  // ===== CSRF =====
  function getCookie(name) {
    const m = document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)");
    return m ? decodeURIComponent(m.pop()) : "";
  }
  const CSRF = getCookie("csrftoken");

  // ===== Helpers =====
  function clampQty() {
    let v = parseInt(qty.value, 10);
    if (!Number.isFinite(v) || v < 1) v = 1;
    qty.value = String(v);
  }
  function updateRow(name, newLeft) {
    const li = $$("#stockList li").find(
      (el) => $("span", el)?.textContent.trim() === name
    );
    if (li) $("b", li).textContent = Number(newLeft).toLocaleString();
  }
  function openSheet(el) {
    if (!el) return;
    el.setAttribute("aria-hidden", "false");
    setTimeout(() => el.setAttribute("aria-hidden", "true"), 1200);
  }
  async function callAPI(url, payload) {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": CSRF,
        "X-Requested-With": "XMLHttpRequest",
      },
      credentials: "same-origin",
      body: JSON.stringify(payload),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data?.message || data?.error || `HTTP ${resp.status}`);
    return data;
  }
  function saveLastBorrowToSession({ sid, fac, itemName, qtyBorrow }) {
    // เก็บ “การยืมล่าสุด” เพื่อให้หน้าคืนไปดึงได้
    try {
      const raw = sessionStorage.getItem("lastBorrow");
      const data = raw ? JSON.parse(raw) : { student_id: sid, faculty: fac, items: [] };
      if (!data.student_id && sid) data.student_id = sid;
      if (!data.faculty && fac)   data.faculty = fac;

      const idx = data.items.findIndex((x) => x.name === itemName);
      if (idx >= 0) data.items[idx].qty += qtyBorrow;
      else data.items.push({ name: itemName, qty: qtyBorrow });

      sessionStorage.setItem("lastBorrow", JSON.stringify(data));
    } catch (_) {}
  }

  // ===== Events: + / - / validate =====
  btnInc.forEach((b) => b.addEventListener("click", () => {
    qty.value = String((parseInt(qty.value, 10) || 1) + 1);
  }));
  btnDec.forEach((b) => b.addEventListener("click", () => {
    qty.value = String(Math.max(1, (parseInt(qty.value, 10) || 1) - 1));
  }));
  qty.addEventListener("input", clampQty);
  qty.addEventListener("blur", clampQty);

  // ===== Confirm Borrow (ตัวเดียวพอ ไม่ซ้ำ) =====
  btnConfirm?.addEventListener("click", async () => {
    clampQty();

    const sid  = inputSID?.value?.trim() || "";
    const fac  = inputFAC?.value?.trim() || "";
    const name = sel?.value?.trim();
    const n    = parseInt(qty.value, 10) || 1;

    if (!name) return alert("กรุณาเลือกอุปกรณ์");
    if (!sid)  return alert("กรุณากรอกรหัสนิสิต");

    // จำข้อมูลผู้ใช้ไว้ครั้งถัดไป
    try {
      localStorage.setItem("sfms_sid", sid);
      localStorage.setItem("sfms_fac", fac);
    } catch (_) {}

    btnConfirm.disabled = true;
    try {
      if (!window.BORROW_API) {
        // โหมดออฟไลน์ (เดโม่)
        if (n > (stock[name] ?? 0))
          throw new Error(`สต็อก "${name}" คงเหลือ ${stock[name] ?? 0} ชิ้น`);
        stock[name] = (stock[name] ?? 0) - n;
        updateRow(name, stock[name]);
        openSheet(sheetBorrow);
      } else {
        // เรียก API จริง — ส่ง faculty ด้วย (ฝั่ง backend จะเก็บไว้ใน session)
        const res = await callAPI(window.BORROW_API, {
          equipment: name,
          qty: n,
          student_id: sid,
          faculty: fac,
        });

        stock[name] =
          typeof res.stock === "number" ? res.stock : Math.max(0, (stock[name] ?? 0) - n);
        updateRow(name, stock[name]);
        openSheet(sheetBorrow);
      }

      // บันทึก “รายการยืมล่าสุด” ให้หน้าคืนดึงต่อได้
      saveLastBorrowToSession({ sid, fac, itemName: name, qtyBorrow: n });

    } catch (err) {
      console.error(err);
      alert(err.message || "ไม่สามารถทำรายการยืมได้");
    } finally {
      btnConfirm.disabled = false;
    }
  });

  // ปุ่มไปหน้า "คืนอุปกรณ์" (ถ้ามี)
  $("#btnReturn")?.addEventListener("click", () => {
    location.href =
      document.querySelector('a[href*="user_equipment/return"]')?.href ||
      "/user/equipment/return/";
  });
})();