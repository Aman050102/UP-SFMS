(() => {
  const $ = (s, el = document) => el.querySelector(s);

  // -----------------------------
  // API URLs
  // -----------------------------
  const API_LIST = "/api/staff/equipments/";
  const API_ITEM = (id = 0) => `/api/staff/equipment/${id}/`;

  // -----------------------------
  // CSRF from cookie
  // -----------------------------
  function csrftoken() {
    const m = document.cookie.match(/(?:^|;)\s*csrftoken=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : "";
  }

  // -----------------------------
  // Elements
  // -----------------------------
  const listEl = $("#equipList");
  const inputName = $("#equipName");
  const inputStock = $("#equipStock");
  const btnAdd = $("#btnAdd");
  const sheetOk = $("#sheetOk");

  // -----------------------------
  // UI helpers
  // -----------------------------
  function openSheet() {
    if (!sheetOk) return;
    sheetOk.setAttribute("aria-hidden", "false");
    setTimeout(() => sheetOk.setAttribute("aria-hidden", "true"), 1200);
  }

  function clampInt(n) {
    const x = Number.isFinite(+n) ? +n : 0;
    return Math.max(0, Math.floor(x));
  }

  function toKeyName(s) {
    return (s || "").trim().toLowerCase();
  }

  // -----------------------------
  // Row template
  // -----------------------------
  function rowTemplate(item) {
    const li = document.createElement("li");
    li.className = "row";
    li.dataset.id = item.id;
    li.dataset.total = String(item.total ?? 0); // เก็บ total ปัจจุบันไว้ใน DOM

    li.innerHTML = `
      <div class="name-wrap">
        <span class="name" title="ดับเบิลคลิกเพื่อแก้ชื่อ">${item.name}</span>
        <input class="name-edit" type="text" value="${item.name}" aria-label="แก้ไขชื่อ" />
      </div>

      <div class="inline-edit">
        <button class="icon-btn steper dec" title="ลดลง">−</button>
        <input class="stock" type="number" min="0" value="${item.stock}" />
        <button class="icon-btn steper inc" title="เพิ่มขึ้น">+</button>
      </div>

      <div class="actions">
        <button class="icon-btn save" title="บันทึก">💾</button>
        <button class="icon-btn danger del" title="ลบ">🗑️</button>
      </div>
    `;
    return li;
  }

  // -----------------------------
  // Fetch list
  // -----------------------------
  async function fetchList() {
    const res = await fetch(API_LIST, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return alert("โหลดรายการไม่สำเร็จ");
    const data = await res.json();
    listEl.innerHTML = "";

    const rows = (data && (data.rows || data.data || [])) || [];
    // เก็บ Map ชื่อ → li เพื่อหา duplicate ได้เร็ว (เทียบ lower-case)
    const byName = new Map();
    rows.forEach((it) => {
      const li = rowTemplate(it);
      listEl.appendChild(li);
      byName.set(toKeyName(it.name), li);
    });
    listEl._byName = byName;
  }

  // -----------------------------
  // Helpers: find existing item by (case-insensitive) name
  // -----------------------------
  function findRowByName(name) {
    const key = toKeyName(name);
    return listEl?._byName?.get(key) || null;
  }

  // -----------------------------
  // Create or Merge (ถ้าชื่อซ้ำ → บวกสต็อก)
  // -----------------------------
  async function addItem() {
    const name = (inputName.value || "").trim();
    if (!name) return alert("กรุณากรอกชื่ออุปกรณ์");

    const addStock = clampInt(inputStock?.value ?? "0");
    if (addStock <= 0) return alert("จำนวนสต็อกต้องมากกว่า 0");

    const existLi = findRowByName(name);

    // กรณีมีชื่อซ้ำ → บวกสต็อกเดิม (PATCH)
    if (existLi) {
      const id = existLi.dataset.id;
      const curStock = clampInt($(".stock", existLi).value || "0");
      const curTotal = clampInt(existLi.dataset.total || "0");

      const newStock = curStock + addStock;
      const newTotal = Math.max(curTotal, newStock); // กันโดนฝั่ง server clamp

      const res = await fetch(API_ITEM(id), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrftoken(),
          Accept: "application/json",
        },
        body: JSON.stringify({ stock: newStock, total: newTotal }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok)
        return alert(data.message || "อัปเดตสต็อกไม่สำเร็จ");

      // sync UI
      $(".stock", existLi).value = data.row?.stock ?? newStock;
      existLi.dataset.total = String(data.row?.total ?? newTotal);

      openSheet();
    } else {
      // สร้างใหม่ (POST) → ตั้ง total = stock เริ่มต้น
      const stock = addStock;
      const total = stock;

      const res = await fetch(API_ITEM(0), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrftoken(),
          Accept: "application/json",
        },
        body: JSON.stringify({ name, total, stock }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok)
        return alert(data.message || "เพิ่มรายการไม่สำเร็จ");
      openSheet();
    }

    // เคลียร์/โฟกัส เพื่อเพิ่มได้ต่อเนื่อง
    inputName.value = "";
    inputStock.value = "10";
    inputName.focus();

    await fetchList();
  }

  // -----------------------------
  // Update (name/stock) — ยอมให้ stock > total โดยส่ง total ≥ stock
  // -----------------------------
  async function saveItem(li) {
    const id = li.dataset.id;
    const stock = clampInt($(".stock", li).value || "0");

    const nameEl = $(".name", li);
    const nameField = $(".name-edit", li);
    const name = (
      nameField.classList.contains("show")
        ? nameField.value
        : nameEl.textContent
    ).trim();

    const curTotal = clampInt(li.dataset.total || "0");
    const patchBody = { name, stock };

    // ถ้า stock ใหม่มากกว่า total เดิม → อัปเดต total ให้ตาม
    if (stock > curTotal) {
      patchBody.total = stock;
    }

    const res = await fetch(API_ITEM(id), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrftoken(),
        Accept: "application/json",
      },
      body: JSON.stringify(patchBody),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) return alert(data.message || "บันทึกไม่สำเร็จ");

    // sync UI
    nameEl.textContent = data.row?.name ?? name;
    nameField.value = data.row?.name ?? name;
    $(".stock", li).value = data.row?.stock ?? stock;
    li.dataset.total = String(data.row?.total ?? patchBody.total ?? curTotal);

    // ออกจากโหมดแก้ชื่อ
    nameField.classList.remove("show");
    nameEl.classList.remove("hide");

    openSheet();

    // refresh map ชื่อ
    await refreshNameMap();
  }

  async function refreshNameMap() {
    // สร้าง Map ชื่อใหม่อีกครั้ง (หลัง rename)
    const byName = new Map();
    listEl.querySelectorAll(".row").forEach((li) => {
      const key = toKeyName($(".name", li).textContent);
      byName.set(key, li);
    });
    listEl._byName = byName;
  }

  // -----------------------------
  // Delete
  // -----------------------------
  async function deleteItem(li) {
    const id = li.dataset.id;
    if (!confirm("ต้องการลบรายการนี้หรือไม่?")) return;

    const res = await fetch(API_ITEM(id), {
      method: "DELETE",
      headers: { "X-CSRFToken": csrftoken(), Accept: "application/json" },
    });

    let data = {};
    try {
      data = await res.json();
    } catch (e) {}

    if (!res.ok || data.ok === false) {
      return alert((data && data.message) || "ลบไม่สำเร็จ");
    }
    li.remove();
    openSheet();
    await refreshNameMap();
  }

  // -----------------------------
  // Inline events
  // -----------------------------
  function enterEditName(li, focus = true) {
    const name = $(".name", li);
    const edit = $(".name-edit", li);
    name.classList.add("hide");
    edit.classList.add("show");
    if (focus) {
      edit.focus();
      edit.setSelectionRange(0, edit.value.length);
    }
  }

  function exitEditName(li, revert = false) {
    const name = $(".name", li);
    const edit = $(".name-edit", li);
    if (revert) edit.value = name.textContent.trim();
    name.classList.remove("hide");
    edit.classList.remove("show");
  }

  // -----------------------------
  // Global events
  // -----------------------------
  btnAdd?.addEventListener("click", addItem);
  inputName?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addItem();
  });
  inputStock?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addItem();
  });

  // คลิกในแต่ละแถว
  listEl?.addEventListener("click", (e) => {
    const li = e.target.closest(".row");
    if (!li) return;

    // stepers — ปรับค่าเฉย ๆ (ยังไม่บันทึก)
    if (e.target.classList.contains("inc")) {
      const fld = $(".stock", li);
      fld.value = clampInt(+fld.value + 1);
      return;
    }
    if (e.target.classList.contains("dec")) {
      const fld = $(".stock", li);
      fld.value = Math.max(0, clampInt(+fld.value - 1));
      return;
    }

    if (e.target.classList.contains("save")) return void saveItem(li);
    if (e.target.classList.contains("del")) return void deleteItem(li);

    if (e.target.classList.contains("name")) enterEditName(li);
  });

  // คีย์ลัดในตาราง
  listEl?.addEventListener("keydown", (e) => {
    const li = e.target.closest(".row");
    if (!li) return;

    // กรณีแก้ชื่อ
    if (e.target.classList.contains("name-edit")) {
      if (e.key === "Enter") {
        e.preventDefault();
        return void saveItem(li);
      } else if (e.key === "Escape") {
        return void exitEditName(li, true);
      }
    }

    // กรณีแก้สต็อก
    if (e.target.classList.contains("stock")) {
      if (e.key === "Enter") {
        e.preventDefault();
        return void saveItem(li);
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.target.blur();
      }
    }
  });

  // กันค่าติดลบ/ทศนิยมขณะพิมพ์
  listEl?.addEventListener("input", (e) => {
    if (!e.target.classList.contains("stock")) return;
    const n = clampInt(e.target.value);
    if (String(n) !== e.target.value) e.target.value = String(n);
  });

  // ออกจากช่องชื่อโดยไม่บันทึก → revert
  listEl?.addEventListener(
    "blur",
    (e) => {
      const li = e.target.closest(".row");
      if (!li) return;
      if (e.target.classList.contains("name-edit")) {
        exitEditName(li, true);
      }
    },
    true,
  );

  // init
  fetchList();
})();
