(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  // Elements
  const sel = $("#equipment");
  const qty = $("#qty");
  const btnInc = $$('.qty-btn[data-delta="1"]');
  const btnDec = $$('.qty-btn[data-delta="-1"]');
  const btnConfirm = $("#confirmBtn");
  const sheetBorrow = $("#sheetBorrow");

  // Stock map from UI (right side list)
  const stock = {};
  $$("#stockList li").forEach((li) => {
    const name = $("span", li)?.textContent.trim();
    const left = parseInt($("b", li)?.textContent.replace(/,/g, ""), 10) || 0;
    if (name) stock[name] = left;
  });

  // CSRF (Django)
  function getCookie(name) {
    const m = document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)");
    return m ? decodeURIComponent(m.pop()) : "";
  }
  const CSRF = getCookie("csrftoken");

  // Helpers
  function clampQty() {
    let v = parseInt(qty.value, 10);
    if (!Number.isFinite(v) || v < 1) v = 1;
    qty.value = String(v);
  }
  function updateRow(name, newLeft) {
    const li = $$("#stockList li").find(
      (li) => $("span", li)?.textContent.trim() === name,
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
    let data = {};
    try {
      data = await resp.json();
    } catch (_) {}
    if (!resp.ok) {
      throw new Error(data?.message || data?.error || `HTTP ${resp.status}`);
    }
    return data;
  }

  // Events
  btnInc.forEach((b) =>
    b.addEventListener("click", () => {
      qty.value = String((parseInt(qty.value, 10) || 1) + 1);
    }),
  );
  btnDec.forEach((b) =>
    b.addEventListener("click", () => {
      qty.value = String(Math.max(1, (parseInt(qty.value, 10) || 1) - 1));
    }),
  );
  qty.addEventListener("input", clampQty);
  qty.addEventListener("blur", clampQty);

  btnConfirm?.addEventListener("click", async () => {
    clampQty();
    const name = sel?.value?.trim();
    const n = parseInt(qty.value, 10) || 1;
    if (!name) return alert("กรุณาเลือกอุปกรณ์");

    btnConfirm.disabled = true;
    try {
      if (!window.BORROW_API) {
        // offline mock: update client-side only
        if (n > (stock[name] ?? 0))
          throw new Error(`สต็อก "${name}" คงเหลือ ${stock[name] ?? 0} ชิ้น`);
        stock[name] = (stock[name] ?? 0) - n;
        updateRow(name, stock[name]);
        openSheet(sheetBorrow);
        return;
      }

      const res = await callAPI(window.BORROW_API, { equipment: name, qty: n });
      stock[name] =
        typeof res.stock === "number"
          ? res.stock
          : Math.max(0, (stock[name] ?? 0) - n);
      updateRow(name, stock[name]);
      openSheet(sheetBorrow);
    } catch (err) {
      console.error(err);
      alert(err.message || "ไม่สามารถทำรายการยืมได้");
    } finally {
      btnConfirm.disabled = false;
    }
  });

  // Switch to Return page
  $("#btnReturn")?.addEventListener("click", () => {
    location.href =
      document.querySelector('a[href*="user_equipment/return"]')?.href ||
      "/user/equipment/return/";
  });
})();
