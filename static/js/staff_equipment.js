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

  function numberClamp(n) {
    const x = Number.isFinite(+n) ? +n : 0;
    return Math.max(0, Math.floor(x));
  }

  // -----------------------------
  // Row template
  // -----------------------------
  function rowTemplate(item) {
    const li = document.createElement("li");
    li.className = "row";
    li.dataset.id = item.id;

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
    if (!res.ok) {
      alert("โหลดรายการไม่สำเร็จ");
      return;
    }
    const data = await res.json();
    listEl.innerHTML = "";

    const rows = (data && (data.rows || data.data || [])) || [];
    rows.forEach((it) => listEl.appendChild(rowTemplate(it)));
  }

  // -----------------------------
  // Create
  // -----------------------------
  async function addItem() {
    const name = (inputName.value || "").trim();
    if (!name) return alert("กรุณากรอกชื่ออุปกรณ์");

    const res = await fetch(API_ITEM(0), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrftoken(),
        Accept: "application/json",
      },
      body: JSON.stringify({ name, total: 10, stock: 10 }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok)
      return alert(data.message || "เพิ่มรายการไม่สำเร็จ");

    inputName.value = "";
    await fetchList();
    openSheet();
  }

  // -----------------------------
  // Update (name/stock)
  // -----------------------------
  async function saveItem(li) {
    const id = li.dataset.id;
    const stock = numberClamp($(".stock", li).value || "0");
    const nameEl = $(".name", li);
    const nameField = $(".name-edit", li);
    const name = (
      nameField.classList.contains("show")
        ? nameField.value
        : nameEl.textContent
    ).trim();

    const res = await fetch(API_ITEM(id), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrftoken(),
        Accept: "application/json",
      },
      body: JSON.stringify({ stock, name }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) return alert(data.message || "บันทึกไม่สำเร็จ");

    // sync UI
    nameEl.textContent = data.row?.name ?? name;
    nameField.value = data.row?.name ?? name;
    $(".stock", li).value = data.row?.stock ?? stock;

    // ออกจากโหมดแก้ชื่อ
    nameField.classList.remove("show");
    nameEl.classList.remove("hide");

    openSheet();
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
  }

  // -----------------------------
  // Inline events per row
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

  listEl?.addEventListener("click", (e) => {
    const li = e.target.closest(".row");
    if (!li) return;

    // stepers
    if (e.target.classList.contains("inc")) {
      const fld = $(".stock", li);
      fld.value = numberClamp(+fld.value + 1);
      return;
    }
    if (e.target.classList.contains("dec")) {
      const fld = $(".stock", li);
      fld.value = Math.max(0, numberClamp(+fld.value - 1));
      return;
    }

    if (e.target.classList.contains("save")) return void saveItem(li);
    if (e.target.classList.contains("del")) return void deleteItem(li);

    // double-click name to edit
    if (e.target.classList.contains("name")) {
      enterEditName(li);
    }
  });

  // blur/save/cancel name edit
  listEl?.addEventListener("keydown", (e) => {
    const li = e.target.closest(".row");
    if (!li) return;

    if (e.target.classList.contains("name-edit")) {
      if (e.key === "Enter") {
        e.preventDefault();
        saveItem(li);
      } else if (e.key === "Escape") {
        exitEditName(li, /*revert*/ true);
      }
    }
  });
  listEl?.addEventListener(
    "blur",
    (e) => {
      const li = e.target.closest(".row");
      if (!li) return;
      if (e.target.classList.contains("name-edit")) {
        // ออกจากโหมดแก้ ถ้ายังไม่บันทึกให้ revert
        exitEditName(li, true);
      }
    },
    true,
  );

  // init
  fetchList();
})();
