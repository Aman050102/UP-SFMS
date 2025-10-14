(() => {
  console.log('UE JS v2 loaded');

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  const form = $("#borrowForm");
  const sel = $("#equipment");
  const qty = $("#qty");
  const btnConfirm = $("#confirmBtn");
  const sheetBorrow = $("#sheetBorrow");
  const inputSID = $("#studentId");
  const inputFAC = $("#faculty");
  const studentError = $("#studentError");

  // ป้องกันปุ่มเป็น submit
  if (btnConfirm && btnConfirm.getAttribute("type") !== "button") {
    btnConfirm.setAttribute("type", "button");
  }

  // กันการ submit ของฟอร์มทั้งหมด
  document.addEventListener("submit", (e) => {
    e.preventDefault();
  });

  // กันกด Enter ในช่องรหัสถ้ายังไม่ผ่านรูปแบบ
  inputSID?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const v = (inputSID.value || "").trim();
      if (!/^6\d{7}$/.test(v)) {
        e.preventDefault();
      }
    }
  });

  // กัน Enter ส่งฟอร์ม (ทุกช่องในฟอร์ม)
  form?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      // ใช้ปุ่มยืนยันแทนการ submit ตรง
      e.preventDefault();
      btnConfirm?.click();
    }
  });

  // ===== Prefill (เดิม) =====
  (() => {
    try {
      const sid = localStorage.getItem("sfms_sid");
      const fac = localStorage.getItem("sfms_fac");
      if (sid && inputSID && !inputSID.value) inputSID.value = sid;
      if (fac && inputFAC && !inputFAC.value) inputFAC.value = fac;
    } catch (_) {}
  })();

  // ===== อ่านสต็อกจากตาราง =====
  const stock = {};
  $$("#stockList li").forEach((li) => {
    const name = $("span", li)?.textContent.trim() || "";
    const left = parseInt(($("b", li)?.textContent || "").replace(/,/g, ""), 10) || 0;
    if (name) stock[name] = left;
  });

  // ===== CSRF =====
  function getCookie(name) {
    const m = document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)");
    return m ? decodeURIComponent(m.pop()) : "";
  }
  const CSRF = getCookie("csrftoken");

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

  function clampQtyOnBlur() {
    let v = parseInt(qty.value, 10);
    if (!Number.isFinite(v) || v < 1) v = 1;
    qty.value = String(v);
  }

  // กรองตัวเลข/จำกัด 3 หลัก
  qty?.addEventListener("input", () => {
    const pos = qty.selectionStart;
    const digits = (qty.value || "").replace(/\D/g, "").slice(0, 3);
    if (digits !== qty.value) {
      qty.value = digits;
      try { qty.setSelectionRange(pos, pos); } catch (_) {}
    }
  });
  qty?.addEventListener("blur", clampQtyOnBlur);

  // ปุ่ม +/- จำนวน
  $$(".qty-btn").forEach((b) => {
    b.addEventListener("click", () => {
      const delta = parseInt(b.dataset.delta, 10) || 0;
      const cur = parseInt(qty.value, 10);
      const next = Number.isFinite(cur) ? cur + delta : 1 + Math.max(delta, 0);
      qty.value = String(Math.max(1, next));
    });
  });

  // แสดง/ซ่อน error ระหว่างพิมพ์รหัสนิสิต
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
    if (studentError) studentError.style.display = /^6\d{7}$/.test(v) ? "none" : "block";
  });

  // ===== ทำการยืม =====
  btnConfirm?.addEventListener("click", async (e) => {
    e.preventDefault(); // กัน default ทุกกรณี
    clampQtyOnBlur();

    const sid = (inputSID?.value || "").trim();
    const fac = (inputFAC?.value || "").trim();
    const name = sel?.value?.trim();
    const n = parseInt(qty.value, 10) || 1;

    if (!name) {
      alert("กรุณาเลือกอุปกรณ์");
      return;
    }

    // ✅ ด่านสุดท้าย: ไม่ผ่าน regex → ไม่ทำรายการ
    if (!/^6\d{7}$/.test(sid)) {
      alert("รหัสนิสิตต้องเป็นตัวเลข 8 หลัก และขึ้นต้นด้วยเลข 6 เท่านั้น");
      if (studentError) studentError.style.display = "block";
      inputSID?.focus();
      return;
    }

    try {
      localStorage.setItem("sfms_sid", sid);
      localStorage.setItem("sfms_fac", fac);
    } catch (_) {}

    if (btnConfirm.disabled) return;
    btnConfirm.disabled = true;

    try {
      if (!window.BORROW_API) {
        if (n > (stock[name] ?? 0))
          throw new Error(`สต็อก "${name}" คงเหลือ ${stock[name] ?? 0} ชิ้น`);
        stock[name] = (stock[name] ?? 0) - n;
        updateRow(name, stock[name]);
        openSheet(sheetBorrow);
      } else {
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
    } catch (err) {
      console.error(err);
      alert(err.message || "ไม่สามารถทำรายการยืมได้");
    } finally {
      btnConfirm.disabled = false;
    }
  });

  // ปุ่มไปหน้า "คืนอุปกรณ์"
  $("#btnReturn")?.addEventListener("click", () => {
    location.href =
      document.querySelector('a[href*="user_equipment/return"]')?.href ||
      "/user/equipment/return/";
  });
})();
