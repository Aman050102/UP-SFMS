// static/js/user_equipment.js  (UE JS v2 merged)
(() => {
  console.log("UE JS v2 loaded");

  // ===== Utils =====
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  // ===== Elements =====
  const form = $("#borrowForm");
  const sel = $("#equipment");
  const qty = $("#qty");
  const btnConfirm = $("#confirmBtn");
  const sheetBorrow = $("#sheetBorrow");

  const inputSID = $("#studentId");
  const inputFAC = $("#faculty");
  const studentError = $("#studentError");

  // ===== Safety: ปุ่มยืนยันต้องเป็น type="button" =====
  if (btnConfirm && btnConfirm.getAttribute("type") !== "button") {
    btnConfirm.setAttribute("type", "button");
  }

  // ===== กันการ submit ทุกรูปแบบ (กด Enter จะไม่ยิงฟอร์ม) =====
  document.addEventListener("submit", (e) => e.preventDefault());
  form?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      btnConfirm?.click();
    }
  });
  // กันกด Enter ในช่องรหัสถ้ายังไม่ผ่านรูปแบบ
  inputSID?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !/^6\d{7}$/.test((inputSID.value || "").trim())) {
      e.preventDefault();
    }
  });

  // ===== Prefill จาก localStorage =====
  (() => {
    try {
      const sid = localStorage.getItem("sfms_sid");
      const fac = localStorage.getItem("sfms_fac");
      if (sid && inputSID && !inputSID.value) inputSID.value = sid;
      if (fac && inputFAC && !inputFAC.value) inputFAC.value = fac;
    } catch (_) {}
  })();

  // ===== อ่านสต็อกจากตารางด้านขวา =====
  const stock = {};
  $$("#stockList li").forEach((li) => {
    const name = $("span", li)?.textContent.trim() || "";
    const left =
      parseInt(($("b", li)?.textContent || "").replace(/,/g, ""), 10) || 0;
    if (name) stock[name] = left;
  });

  // ===== CSRF =====
  function getCookie(name) {
    const m = document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)");
    return m ? decodeURIComponent(m.pop()) : "";
  }
  const CSRF = getCookie("csrftoken");

  // ===== Helpers =====
  function sanitizeQtyOnInput() {
    const pos = qty.selectionStart;
    const raw = qty.value || "";
    const digits = raw.replace(/\D/g, "").slice(0, 3);
    if (digits !== raw) {
      qty.value = digits;
      try {
        qty.setSelectionRange(pos, pos);
      } catch (_) {}
    }
  }
  function clampQtyOnBlur() {
    let v = parseInt(qty.value, 10);
    if (!Number.isFinite(v) || v < 1) v = 1;
    qty.value = String(v);
  }
  function updateRow(name, newLeft) {
    const li = $$("#stockList li").find(
      (el) => $("span", el)?.textContent.trim() === name,
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
    if (!resp.ok)
      throw new Error(data?.message || data?.error || `HTTP ${resp.status}`);
    return data;
  }
  function saveLastBorrowToSession({ sid, fac, itemName, qtyBorrow }) {
    // เก็บ “การยืมล่าสุด” ไว้ให้หน้าคืนสามารถดึงได้
    try {
      const raw = sessionStorage.getItem("lastBorrow");
      const data = raw
        ? JSON.parse(raw)
        : { student_id: sid, faculty: fac, items: [] };
      if (!data.student_id && sid) data.student_id = sid;
      if (!data.faculty && fac) data.faculty = fac;

      const idx = data.items.findIndex((x) => x.name === itemName);
      if (idx >= 0) data.items[idx].qty += qtyBorrow;
      else data.items.push({ name: itemName, qty: qtyBorrow });

      sessionStorage.setItem("lastBorrow", JSON.stringify(data));
    } catch (_) {}
  }

  // ===== Events: จำนวน =====
  qty?.addEventListener("input", sanitizeQtyOnInput);
  qty?.addEventListener("blur", clampQtyOnBlur);
  $$(".qty-btn").forEach((b) => {
    b.addEventListener("click", () => {
      const delta = parseInt(b.dataset.delta, 10) || 0;
      const cur = parseInt(qty.value, 10);
      const next = Number.isFinite(cur) ? cur + delta : 1 + Math.max(delta, 0);
      qty.value = String(Math.max(1, next));
    });
  });

  // ===== Events: รหัสนิสิต (แสดง/ซ่อน error) =====
  inputSID?.addEventListener("input", (e) => {
    const raw = e.target.value || "";
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    if (digits !== raw) e.target.value = digits;

    if (studentError) {
      if (digits.length === 8) {
        studentError.style.display = /^6\d{7}$/.test(digits) ? "none" : "block";
      } else {
        studentError.style.display = "none";
      }
    }
  });
  inputSID?.addEventListener("blur", (e) => {
    const v = e.target.value || "";
    if (studentError)
      studentError.style.display = /^6\d{7}$/.test(v) ? "none" : "block";
  });

  // ===== ยืนยันการยืม =====
  btnConfirm?.addEventListener("click", async (e) => {
    e.preventDefault();
    clampQtyOnBlur();

    const sid = (inputSID?.value || "").trim();
    const fac = (inputFAC?.value || "").trim();
    const name = sel?.value?.trim();
    const n = parseInt(qty.value, 10) || 1;

    if (!name) {
      alert("กรุณาเลือกอุปกรณ์");
      return;
    }

    // ✅ ด่านสุดท้าย: ต้องขึ้นต้นด้วย 6 และมีทั้งหมด 8 หลัก
    if (!/^6\d{7}$/.test(sid)) {
      alert("รหัสนิสิตต้องเป็นตัวเลข 8 หลัก และขึ้นต้นด้วยเลข 6 เท่านั้น");
      if (studentError) studentError.style.display = "block";
      inputSID?.focus();
      return;
    }

    try {
      // จำ sid/fac ไว้ในเครื่อง
      localStorage.setItem("sfms_sid", sid);
      localStorage.setItem("sfms_fac", fac);
    } catch (_) {}

    if (btnConfirm.disabled) return; // กันดับเบิลคลิก
    btnConfirm.disabled = true;

    try {
      if (!window.BORROW_API) {
        // โหมด DEMO (ไม่มี API) — ตัดสต็อกจากหน้า
        if (n > (stock[name] ?? 0))
          throw new Error(`สต็อก "${name}" คงเหลือ ${stock[name] ?? 0} ชิ้น`);
        stock[name] = (stock[name] ?? 0) - n;
        updateRow(name, stock[name]);
        openSheet(sheetBorrow);
      } else {
        // โหมดจริง — เรียก API
        const res = await callAPI(window.BORROW_API, {
          equipment: name,
          qty: n,
          student_id: sid,
          faculty: fac,
        });
        stock[name] =
          typeof res.stock === "number"
            ? res.stock
            : Math.max(0, (stock[name] ?? 0) - n);
        updateRow(name, stock[name]);
        openSheet(sheetBorrow);
      }

      // เก็บรายการยืมล่าสุดไว้ให้หน้าคืนใช้ต่อ
      saveLastBorrowToSession({ sid, fac, itemName: name, qtyBorrow: n });
    } catch (err) {
      console.error(err);
      alert(err.message || "ไม่สามารถทำรายการยืมได้");
    } finally {
      btnConfirm.disabled = false;
    }
  });

  // ===== ปุ่มไปหน้า "คืนอุปกรณ์" =====
  $("#btnReturn")?.addEventListener("click", () => {
    location.href =
      document.querySelector('a[href*="user_equipment/return"]')?.href ||
      "/user/equipment/return/";
  });
})();
