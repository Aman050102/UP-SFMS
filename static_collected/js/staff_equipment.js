(() => {
  const $ = (s, el = document) => el.querySelector(s);

  // URLs
  const API_LIST = "/api/staff/equipments/";
  const API_ITEM = (id = 0) => `/api/staff/equipments/${id}/`;

  // CSRF from cookie
  function csrftoken() {
    const m = document.cookie.match(/(?:^|;)\s*csrftoken=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : "";
  }

  const listEl = $("#equipList");
  const inputName = $("#equipName");
  const btnAdd = $("#btnAdd");
  const sheetOk = $("#sheetOk");

  function rowTemplate(item) {
    const li = document.createElement("li");
    li.className = "row";
    li.dataset.id = item.id;
    li.innerHTML = `
      <div class="name">${item.name}</div>
      <div class="inline-edit">
        <input class="stock" type="number" min="0" value="${item.stock}" />
      </div>
      <div class="actions">
        <button class="icon-btn save" title="บันทึก">💾</button>
        <button class="icon-btn danger del" title="ลบ">🗑️</button>
      </div>
    `;
    return li;
  }

  async function fetchList() {
    const res = await fetch(API_LIST);
    const data = await res.json();
    listEl.innerHTML = "";
    (data.rows || []).forEach((it) => listEl.appendChild(rowTemplate(it)));
  }

  function openSheet() {
    sheetOk?.setAttribute("aria-hidden", "false");
    setTimeout(() => sheetOk?.setAttribute("aria-hidden", "true"), 1500);
  }

  async function addItem() {
    const name = (inputName.value || "").trim();
    if (!name) return alert("กรุณากรอกชื่ออุปกรณ์");

    const res = await fetch(API_ITEM(0), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrftoken(),
      },
      body: JSON.stringify({ name, total: 10, stock: 10 }),
    });
    const data = await res.json();
    if (!data.ok) return alert(data.message || "เกิดข้อผิดพลาด");

    inputName.value = "";
    await fetchList();
    openSheet();
  }

  async function saveItem(li) {
    const id = li.dataset.id;
    const stock = parseInt($(".stock", li).value || "0", 10);
    const name = $(".name", li).textContent.trim();

    const res = await fetch(API_ITEM(id), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrftoken(),
      },
      body: JSON.stringify({ stock, name }),
    });
    const data = await res.json();
    if (!data.ok) return alert(data.message || "บันทึกไม่สำเร็จ");
  }

  async function deleteItem(li) {
    const id = li.dataset.id;
    if (!confirm("ต้องการลบรายการนี้หรือไม่?")) return;
    const res = await fetch(API_ITEM(id), {
      method: "DELETE",
      headers: { "X-CSRFToken": csrftoken() },
    });
    const data = await res.json();
    if (!data.ok) return alert(data.message || "ลบไม่สำเร็จ");
    li.remove();
  }

  // events
  btnAdd?.addEventListener("click", addItem);
  listEl?.addEventListener("click", (e) => {
    const li = e.target.closest(".row");
    if (!li) return;
    if (e.target.classList.contains("save")) saveItem(li);
    if (e.target.classList.contains("del")) deleteItem(li);
  });

  // init
  fetchList();
})();
