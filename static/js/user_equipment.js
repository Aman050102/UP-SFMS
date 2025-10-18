// static/js/user_equipment.js (Logic updated to remember first faculty choice)
(() => {
  const PAGE = document.body?.dataset?.page || "equipment";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  // ========= CSRF & Fetch helper =========
  function getCookie(name) {
    const m = document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)");
    return m ? decodeURIComponent(m.pop()) : "";
  }
  const CSRF = getCookie("csrftoken");

  async function postJSON(url, payload) {
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

  // ========= TABs =========
  function initTabs() {
    const tabBorrow = $("#tabBorrow");
    const tabReturn = $("#tabReturn");
    const borrowSection = $("#borrowSection");
    const returnSection = $("#returnSection");
    if (!tabBorrow || !tabReturn || !borrowSection || !returnSection) return;

    const showBorrow = () => {
      tabBorrow.classList.add("active");
      tabReturn.classList.remove("active");
      tabBorrow.setAttribute("aria-selected", "true");
      tabReturn.setAttribute("aria-selected", "false");
      borrowSection.style.display = "";
      returnSection.style.display = "none";
    };
    const showReturn = () => {
      tabReturn.classList.add("active");
      tabBorrow.classList.remove("active");
      tabReturn.setAttribute("aria-selected", "true");
      tabBorrow.setAttribute("aria-selected", "false");
      borrowSection.style.display = "none";
      returnSection.style.display = "";
    };

    tabBorrow.addEventListener("click", showBorrow);
    tabReturn.addEventListener("click", showReturn);
  }

  // ========= Borrow (โหมดยืม) =========
  function initBorrowPage() {
    const form = $("#borrowForm");
    const sel = $("#equipment");
    const qty = $("#qty");
    const btnConfirm = $("#confirmBtn");
    const sheetBorrow = $("#sheetBorrow");
    const inputSID = $("#studentId");
    const inputFAC = $("#faculty");
    const studentErr = $("#studentError");

    if (!form || !btnConfirm) return;

    // START: แก้ไข Event Listener เพื่อให้ปุ่ม Logout ทำงานได้
    document.addEventListener("submit", (e) => {
      // ตรวจสอบว่าฟอร์มที่ถูก submit ไม่ใช่ฟอร์ม logout
      if (!e.target.classList.contains('logout-form')) {
        e.preventDefault(); // ถ้าไม่ใช่ ให้หยุดการทำงาน
      }
      // ถ้าใช่ฟอร์ม logout ก็ปล่อยให้มันทำงานตามปกติ
    });
    // END: แก้ไข Event Listener

    form.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.tagName !== "BUTTON") {
        e.preventDefault();
        btnConfirm.click();
      }
    });

    try {
      const sid = localStorage.getItem("sfms_sid");
      const fac = localStorage.getItem("sfms_fac");
      if (sid && inputSID && !inputSID.value) inputSID.value = sid;
      if (fac && inputFAC && !inputFAC.value) inputFAC.value = fac;
    } catch {}

    const stock = {};
    $$("#stockList li").forEach((li) => {
      const name = $("span", li)?.textContent.trim() || "";
      const left =
        parseInt(($("b", li)?.textContent || "").replace(/,/g, ""), 10) || 0;
      if (name) stock[name] = left;
    });

    const updateStockRow = (name, newLeft) => {
      const li = $$("#stockList li").find(
        (el) => $("span", el)?.textContent.trim() === name,
      );
      if (li) $("b", li).textContent = Number(newLeft).toLocaleString();
    };

    const clampQty = () => {
      let v = parseInt(qty.value, 10);
      if (!Number.isFinite(v) || v < 1) v = 1;
      qty.value = String(v);
    };

    $$(".qty-btn").forEach((b) => {
      b.addEventListener("click", () => {
        const d = parseInt(b.dataset.delta, 10) || 0;
        clampQty();
        qty.value = String(Math.max(1, (parseInt(qty.value, 10) || 1) + d));
      });
    });
    
    // --- START: LOGIC ใหม่สำหรับตรวจสอบและล็อกคณะ ---
    const checkFacultyForStudent = async () => {
        const sid = inputSID.value.trim();
        if (!/^6\d{7}$/.test(sid)) {
            inputFAC.disabled = false; // ปลดล็อกถ้า SID ไม่ถูกต้อง
            return;
        }

        inputFAC.disabled = true;

        try {
            const url = `${window.FACULTY_CHECK_API}?student_id=${sid}`;
            const response = await fetch(url);

            if (!response.ok) throw new Error('API request failed');
            
            const data = await response.json();

            if (data.faculty) {
                inputFAC.value = data.faculty;
                inputFAC.disabled = true;
            } else {
                inputFAC.disabled = false;
            }
        } catch (error) {
            console.warn("Could not check faculty from history, enabling manual selection.", error);
            inputFAC.disabled = false;
        }
    };
    
    inputSID?.addEventListener("input", (e) => {
      const digits = (e.target.value || "").replace(/\D/g, "").slice(0, 8);
      e.target.value = digits;
      studentErr.style.display =
        digits.length === 8 && !/^6\d{7}$/.test(digits) ? "block" : "none";
      if (digits.length === 0) {
        inputFAC.disabled = false;
        if(inputFAC.options.length > 0) inputFAC.selectedIndex = 0;
      }
    });

    inputSID?.addEventListener("blur", checkFacultyForStudent);

    inputSID?.addEventListener("keydown", (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            checkFacultyForStudent();
            sel.focus();
        }
    });
    // --- END: LOGIC ใหม่ ---

    function upsertReturnRow({ student_id, faculty, equipment, addQty }) {
      const tbody = $("#returnTableBody");
      if (!tbody) return;

      const emptyRow = $$("tr", tbody).find((tr) => tr.children.length === 1);
      if (emptyRow) emptyRow.remove();

      const rows = $$("tr", tbody);
      let target = rows.find((tr) => {
        const sid = tr.children[1]?.textContent?.trim() || "";
        const eq = tr.children[3]?.textContent?.trim() || "";
        return sid === student_id && eq === equipment;
      });

      if (!target) {
        const tr = document.createElement("tr");
        const today = new Date().toISOString().split("T")[0];
        tr.dataset.borrowDate = today;
        
        // START: แก้ไขโครงสร้าง HTML ของแถวใหม่ให้ถูกต้อง
        tr.innerHTML = `
          <td>${rows.length + 1}</td>
          <td>${student_id}</td>
          <td>${faculty}</td>
          <td>${equipment}</td>
          <td>${addQty}</td>
          <td>${addQty}</td>
          <td><input type="number" min="1" max="${addQty}" value="1" /></td>
          <td><button type="button" class="btn-return">คืน</button></td>
        `;
        // END: แก้ไขโครงสร้าง HTML ของแถวใหม่ให้ถูกต้อง
        
        tbody.appendChild(tr);
        renumberReturnRows();
        bindReturnButton(tr);
        return;
      }

      const borrowedTd = target.children[4];
      const pendingTd = target.children[5];
      const inputBox = target.children[6]?.querySelector("input");
      const newBorrow = (parseInt(borrowedTd.textContent, 10) || 0) + addQty;
      const newPend = (parseInt(pendingTd.textContent, 10) || 0) + addQty;
      borrowedTd.textContent = String(newBorrow);
      pendingTd.textContent = String(newPend);
      if (inputBox) {
        inputBox.max = String(newPend);
        if ((parseInt(inputBox.value || "1", 10) || 1) > newPend)
          inputBox.value = String(newPend);
      }
    }

    btnConfirm.addEventListener("click", async () => {
      clampQty();
      const sid = (inputSID?.value || "").trim();
      const fac = (inputFAC?.value || "").trim();
      const name = sel?.value?.trim();
      const n = parseInt(qty?.value, 10) || 1;

      if (!name) return alert("กรุณาเลือกอุปกรณ์");
      if (!/^6\d{7}$/.test(sid)) {
        alert("รหัสนิสิตต้องเป็นตัวเลข 8 หลัก และขึ้นต้นด้วยเลข 6 เท่านั้น");
        inputSID?.focus();
        studentErr && (studentErr.style.display = "block");
        return;
      }

      try {
        localStorage.setItem("sfms_sid", sid);
        localStorage.setItem("sfms_fac", fac);
      } catch {}

      if (btnConfirm.disabled) return;
      btnConfirm.disabled = true;

      try {
        const res = await postJSON(window.BORROW_API, {
            equipment: name,
            qty: n,
            student_id: sid,
            faculty: fac,
        });
        
        const newStock = typeof res.stock === "number" ? res.stock : Math.max(0, (stock[name] ?? 0) - n);
        stock[name] = newStock;
        updateStockRow(name, newStock);

        sheetBorrow?.setAttribute("aria-hidden", "false");
        setTimeout(() => sheetBorrow?.setAttribute("aria-hidden", "true"), 900);

        $("#tabReturn")?.click();
        upsertReturnRow({
          student_id: sid,
          faculty: fac || "-",
          equipment: name,
          addQty: n,
        });

        $("#returnTableBody tr:last-child input")?.focus();
      } catch (err) {
        console.error(err);
        alert(err.message || "ไม่สามารถทำรายการยืมได้");
      } finally {
        btnConfirm.disabled = false;
      }
    });
  }

  // ========= Return (ตารางคืน + ปุ่มคืน) =========
  function renumberReturnRows() {
    const visibleRows = $$("#returnTableBody tr").filter(
      (tr) =>
        tr.style.display !== "none" &&
        !tr.classList.contains("no-results") &&
        tr.children.length > 1,
    );
    visibleRows.forEach((tr, i) => {
      const c0 = tr.children[0];
      if (c0) c0.textContent = String(i + 1);
    });
  }

  function bindReturnButton(tr) {
    const btn = tr.querySelector(".btn-return");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      const sid = tr.children[1]?.textContent?.trim() || "";
      const fac = tr.children[2]?.textContent?.trim() || "";
      const eq = tr.children[3]?.textContent?.trim() || "";
      const remainTd = tr.children[5];
      const input = tr.children[6]?.querySelector("input");

      const remain = parseInt(remainTd.textContent || "0", 10) || 0;
      const qty = Math.max(
        1,
        Math.min(remain, parseInt(input?.value || "1", 10) || 1),
      );

      if (!window.RETURN_API) return alert("ยังไม่ได้ตั้งค่า RETURN_API");
      try {
        await postJSON(window.RETURN_API, {
          equipment: eq,
          qty,
          student_id: sid,
          faculty: fac,
        });
        const newRemain = Math.max(0, remain - qty);
        remainTd.textContent = String(newRemain);
        if (input) input.max = String(newRemain);
        if (newRemain === 0) {
          tr.remove();
          const tbody = $("#returnTableBody");
          const remainingDataRows = $$("tr", tbody).filter(
            (r) => r.children.length > 1,
          ).length;

          if (tbody && remainingDataRows === 0) {
            tbody.innerHTML =
              '<tr><td colspan="8" style="text-align: center;">ยังไม่มีรายการค้างคืน</td></tr>';
          } else {
            renumberReturnRows();
          }
        } else if (input && parseInt(input.value || "1", 10) > newRemain) {
          input.value = String(newRemain);
        }
      } catch (e) {
        alert(e?.message || "คืนอุปกรณ์ไม่สำเร็จ");
      }
    });
  }

  function initReturnTable() {
    $$("#returnTableBody tr").forEach((tr) => bindReturnButton(tr));
  }

  // ========= NEW: Filter Pending Returns List =========
  function initPendingFilters() {
    const returnSection = $("#returnSection");
    if (!returnSection) return;

    const sidInput = $("#searchStudentId", returnSection);
    const dateInput = $("#datePick", returnSection);
    const btnSearch = $("#btnSearch", returnSection);
    const btnClear = $("#btnToday", returnSection);
    const tbody = $("#returnTableBody", returnSection);

    if (!sidInput || !dateInput || !tbody) return;

    let noResultsRow = $(".no-results", tbody);
    if (!noResultsRow) {
      noResultsRow = document.createElement("tr");
      noResultsRow.className = "no-results";
      noResultsRow.style.display = "none";
      noResultsRow.innerHTML = `<td colspan="8" style="text-align:center;">ไม่พบรายการที่ตรงกับเงื่อนไข</td>`;
      tbody.appendChild(noResultsRow);
    }

    const runFilter = () => {
      const sidTerm = sidInput.value.trim();
      const dateTerm = dateInput.value;
      const allRows = $$("tr", tbody);
      let visibleCount = 0;
      let hasItems = false;

      allRows.forEach((tr) => {
        if (tr.classList.contains("no-results")) return;

        if (tr.children.length > 1) {
          hasItems = true;
          const rowSid = tr.children[1]?.textContent?.trim() || "";
          const rowDate = tr.dataset.borrowDate || "";

          const sidMatch = !sidTerm || rowSid.includes(sidTerm);
          const dateMatch = !dateTerm || rowDate === dateTerm;

          if (sidMatch && dateMatch) {
            tr.style.display = "";
            visibleCount++;
          } else {
            tr.style.display = "none";
          }
        } else {
          tr.style.display = sidTerm || dateTerm ? "none" : "";
        }
      });

      const hasFilter = sidTerm || dateTerm;
      noResultsRow.style.display =
        visibleCount === 0 && hasFilter && hasItems ? "" : "none";

      renumberReturnRows();
    };

    // --- Event Listeners ---
    sidInput.addEventListener("input", runFilter);
    dateInput.addEventListener("change", runFilter);
    btnSearch.addEventListener("click", runFilter);
    sidInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        runFilter();
      }
    });

    btnClear.addEventListener("click", () => {
      sidInput.value = "";
      dateInput.value = "";
      runFilter();
    });
  }


  // ========= Boot =========
  if (PAGE === "equipment") {
    initTabs();
    initBorrowPage();
    initReturnTable();
    initPendingFilters();
  } else if (PAGE === "equipment-return") {
    initReturnTable();
    initPendingFilters();
  }
})();