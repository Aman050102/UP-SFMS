// static/js/equipment_return.js
(() => {
  const $ = (s, el = document) => el.querySelector(s);

  // ===== Elements =====
  const list  = $("#retTable");
  const empty = $("#retEmpty");
  const hint  = $("#autoHint");
  const sheet = $("#sheetReturn");

  // ===== CSRF =====
  function getCookie(name) {
    const m = document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)");
    return m ? decodeURIComponent(m.pop()) : "";
  }
  const CSRF = getCookie("csrftoken");

  // ===== Overlay sheet =====
  function openSheet(el) {
    if (!el) return;
    el.setAttribute("aria-hidden", "false");
    setTimeout(() => el.setAttribute("aria-hidden", "true"), 1200);
  }

  // ---------- Client cache (จากตอนยืม) ----------
  function readLastBorrow() {
    try {
      const raw = sessionStorage.getItem("lastBorrow");
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.items)) return null;
      return data;
    } catch {
      return null;
    }
  }
  function writeLastBorrow(data) {
    try {
      if (!data || !Array.isArray(data.items) || data.items.length === 0) {
        sessionStorage.removeItem("lastBorrow");
      } else {
        sessionStorage.setItem("lastBorrow", JSON.stringify(data));
      }
    } catch {}
  }

  // ---------- ดัชนีลำดับต่อเนื่องต่อ SID ----------
  function idxKey(sid) { return `ret_idx::${sid}`; }
  function seqKey(sid) { return `ret_seq::${sid}`; }

  function loadIndexMap(sid) {
    try {
      return JSON.parse(sessionStorage.getItem(idxKey(sid)) || "{}");
    } catch { return {}; }
  }
  function saveIndexMap(sid, map) {
    try { sessionStorage.setItem(idxKey(sid), JSON.stringify(map || {})); } catch {}
  }
  function loadSeq(sid) {
    const v = parseInt(sessionStorage.getItem(seqKey(sid) || "0"), 10);
    return Number.isFinite(v) && v > 0 ? v : 0;
  }
  function saveSeq(sid, v) {
    try { sessionStorage.setItem(seqKey(sid), String(v)); } catch {}
  }
  function ensureIndex(sid, map, name) {
    if (map[name] != null) return map[name];
    const next = loadSeq(sid) + 1;
    map[name] = next;
    saveSeq(sid, next);
    return next;
  }
  function pruneMapTo(rows, map) {
    // คงเฉพาะที่ยังค้างคืนอยู่
    const still = new Set(rows.map(r => r.equipment));
    Object.keys(map).forEach(k => { if (!still.has(k)) delete map[k]; });
  }
  function resetIfEmpty(sid, map) {
    if (Object.keys(map).length === 0) {
      saveSeq(sid, 0);
    }
  }

  // ---------- Server pending (ดึงอัตโนมัติ) ----------
  async function fetchServerPending() {
    const resp = await fetch(window.PENDING_RETURNS_API, { credentials: "same-origin" });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok) {
      throw new Error(data.message || "โหลดข้อมูลจากเซิร์ฟเวอร์ไม่สำเร็จ");
    }
    // shape: { ok, rows, student_id }
    return data;
  }

  // ---------- Render ตารางรายการรอคืน (ลำดับต่อเนื่อง) ----------
  function renderRows(student_id, faculty, rows) {
    const sid = student_id || "-";
    let map = loadIndexMap(sid);

    // จัดการดัชนี: ลบรายการที่ไม่อยู่แล้ว และกำหนด index ให้รายการใหม่
    pruneMapTo(rows, map);
    rows.forEach(r => { ensureIndex(sid, map, r.equipment); });
    saveIndexMap(sid, map);
    resetIfEmpty(sid, map);

    // เรียงตามเลขลำดับเดิม (ต่อเนื่อง)
    rows.sort((a, b) => (map[a.equipment] || 0) - (map[b.equipment] || 0));

    list.innerHTML = "";
    rows.forEach((r) => {
      const tr = document.createElement("tr");
      const fac = r.faculty || faculty || "-";
      const remain = r.remaining ?? r.qty ?? 0;
      const order = map[r.equipment];

      tr.dataset.equipment = r.equipment;

      tr.innerHTML = `
        <td class="col-order">${order}</td>
        <td>${sid}</td>
        <td>${fac}</td>
        <td>${r.equipment}</td>
        <td>${r.borrowed ?? "-"}</td>
        <td class="col-remaining">${remain}</td>
        <td>
          <input type="number" min="1" max="${remain}" value="${remain}" style="width:80px" />
        </td>
        <td><button class="returnBtn">คืน</button></td>
      `;

      tr.querySelector(".returnBtn").addEventListener("click", async () => {
        const qty = parseInt(tr.querySelector("input").value, 10);
        if (!qty || qty < 1) return alert("กรุณาใส่จำนวนที่จะคืน");

        try {
          const resp = await fetch(window.RETURN_API, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-CSRFToken": CSRF,
              "X-Requested-With": "XMLHttpRequest",
            },
            credentials: "same-origin",
            body: JSON.stringify({ equipment: r.equipment, qty, student_id: sid }),
          });
          const res = await resp.json().catch(() => ({}));
          if (!resp.ok) throw new Error(res.message || "ไม่สามารถคืนอุปกรณ์ได้");

          openSheet(sheet);

          // อัปเดตจำนวนค้างคืนในแถว
          const remEl = tr.querySelector(".col-remaining");
          let remainNow = parseInt(remEl.textContent, 10) || 0;
          remainNow = Math.max(0, remainNow - qty);
          remEl.textContent = remainNow;
          tr.querySelector("input").max = String(remainNow);
          if (parseInt(tr.querySelector("input").value, 10) > remainNow) {
            tr.querySelector("input").value = String(Math.max(1, remainNow));
          }

          // อัปเดต client cache ของหน้า “ยืม” ถ้ามี
          const cache = readLastBorrow();
          if (cache && cache.student_id === sid) {
            const idx = cache.items.findIndex(x => x.name === r.equipment);
            if (idx >= 0) {
              cache.items[idx].qty -= qty;
              if (cache.items[idx].qty <= 0) cache.items.splice(idx, 1);
              writeLastBorrow(cache);
            }
          }

          // ถ้าคืนครบ → ลบแถวนี้ + ลบ index ของมัน (แต่ไม่รีเซ็ตตัวนับรวม)
          if (remainNow === 0) {
            tr.remove();
            map = loadIndexMap(sid);
            delete map[r.equipment];
            saveIndexMap(sid, map);
            // ถ้าไม่มีรายการหลงเหลือ → รีเซ็ตตัวนับรวมให้เริ่มใหม่รอบหน้า
            resetIfEmpty(sid, map);
          }

          // ถ้าอยาก “รีโหลดจากเซิร์ฟเวอร์” เพื่อความแม่นยำทุกครั้ง ให้เรียก:
          // loadAuto();
          // แต่ตอนนี้เราอัปเดต DOM + map แล้ว จึงไม่จำเป็นต้องรีเฟรชทั้งตาราง
          empty.style.display = list.children.length ? "none" : "block";
        } catch (err) {
          alert(err.message || "เกิดข้อผิดพลาด");
        }
      });

      list.appendChild(tr);
    });

    empty.style.display = rows.length ? "none" : "block";
  }

  // ---------- Auto load ----------
  async function loadAuto() {
    if (hint) hint.textContent = "กำลังดึงรายการรอคืนของคุณ…";
    empty.style.display = "none";
    list.innerHTML = "";

    // 1) เซิร์ฟเวอร์ก่อน
    try {
      const server = await fetchServerPending(); // { rows, student_id }
      if (server.rows && server.rows.length) {
        renderRows(server.student_id || "", server.rows[0]?.faculty || "", server.rows);
        if (hint) hint.textContent = "";
        return;
      }
    } catch (e) {
      console.warn(e);
    }

    // 2) Fallback: sessionStorage
    const cache = readLastBorrow();
    if (cache && cache.items.length) {
      const rows = cache.items.map((it) => ({
        equipment: it.name,
        borrowed: it.qty,
        remaining: it.qty,
        faculty: cache.faculty || "",
      }));
      renderRows(cache.student_id || "", cache.faculty || "", rows);
      if (hint) hint.textContent = "";
      return;
    }

    if (hint) hint.textContent = "";
    empty.style.display = "block";
  }

  document.addEventListener("DOMContentLoaded", loadAuto);
})();

// ===== Fancy modebar slider (ใช้ได้ทั้ง equipment / equipment-return) =====
(() => {
  document.addEventListener("DOMContentLoaded", () => {
    const bar = document.querySelector(".modebar");
    if (!bar) return;

    let slider = bar.querySelector(".mode-slider");
    if (!slider) {
      slider = document.createElement("span");
      slider.className = "mode-slider";
      slider.setAttribute("aria-hidden", "true");
      bar.appendChild(slider);
    }

    const modes = [...bar.querySelectorAll(".mode")];

    function moveSlider(target) {
      if (!slider || !target) return;
      const r = target.getBoundingClientRect();
      const p = bar.getBoundingClientRect();
      slider.style.left = r.left - p.left + "px";
      slider.style.width = r.width + "px";
    }

    moveSlider(bar.querySelector(".mode.active") || modes[0]);
    window.addEventListener("resize", () => {
      moveSlider(bar.querySelector(".mode.active") || modes[0]);
    });

    bar.addEventListener("click", (e) => {
      const a = e.target.closest(".mode");
      if (!a) return;
      modes.forEach((m) => m.classList.remove("active"));
      a.classList.add("active");
      moveSlider(a);
    });
  });
})();