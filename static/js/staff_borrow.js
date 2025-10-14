(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const main = $("main");
  const API = main?.dataset.apiRecordsUrl;

  const sidInput = $("#studentId");
  const dateInput = $("#datePick");
  const btnSearch = $("#btnSearch");
  const btnToday = $("#btnToday");
  const dayWrap = $("#dayGroups");
  const resultInfo = $("#resultInfo");

  // parse "dd/mm/YYYY HH:MM" -> Date (กันค่าพัง)
  function parseTH(dmyhm) {
    if (!dmyhm || typeof dmyhm !== "string") return new Date(NaN);
    const [d, m, rest] = dmyhm.split("/");
    if (!d || !m || !rest) return new Date(NaN);
    const [y, hm] = rest.split(" ");
    if (!y || !hm) return new Date(NaN);
    const [H, M] = hm.split(":");
    return new Date(+y, (+m || 1) - 1, +d, +H || 0, +M || 0);
  }
  const pad2 = (n) => String(n).padStart(2, "0");
  const ymd = (d) =>
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const hms = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

  function thaiDateLabel(d) {
    const thMonths = ["","ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
    return `${d.getDate()} ${thMonths[d.getMonth() + 1]} ${d.getFullYear() + 543}`;
  }

  async function fetchRows(student = "", pickDate = "") {
    const u = new URL(API, location.origin);
    if (student) u.searchParams.set("student", student);
    // ไม่บังคับ แต่ถ้า backend รองรับ ?date= จะได้ลด payload
    if (pickDate) u.searchParams.set("date", pickDate);
    const resp = await fetch(u, { credentials: "same-origin" });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || data.ok === false) {
      throw new Error(data.message || "โหลดข้อมูลไม่สำเร็จ");
    }
    return data.rows || [];
  }

  // จับคู่ “ยืม/คืน” ต่อ (วัน + รหัสนิสิต + คณะ + อุปกรณ์)
  function pairPerDay(rows, pickDate) {
    const days = new Map(); // dayKey -> { dateObj, items: Map }

    rows.forEach((r) => {
      const dt = parseTH(r.when);
      if (Number.isNaN(+dt)) return;

      const dayKey = ymd(dt);
      if (pickDate && dayKey !== pickDate) return; // กรองเฉพาะวันเลือก

      const fac = r.faculty || "-";
      const itemKey = `${dayKey}|${r.student_id || "-"}|${fac}|${r.equipment || "-"}`;

      if (!days.has(dayKey)) days.set(dayKey, { dateObj: dt, items: new Map() });
      const day = days.get(dayKey);

      if (!day.items.has(itemKey)) {
        day.items.set(itemKey, {
          student_id: r.student_id || "-",
          faculty: fac,
          equipment: r.equipment || "-",
          qtyBorrow: 0,
          qtyReturn: 0,
          borrowTimes: [],
          returnTimes: [],
        });
      }
      const it = day.items.get(itemKey);

      if (r.action === "borrow") {
        it.qtyBorrow += r.qty || 0;
        it.borrowTimes.push(hms(dt));
      } else if (r.action === "return") {
        it.qtyReturn += r.qty || 0;
        it.returnTimes.push(hms(dt));
      }
    });

    // flatten
    const out = [];
    [...days.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1)) // วันล่าสุดก่อน
      .forEach(([dayKey, val]) => {
        const list = [...val.items.values()].map((x) => ({
          dayKey,
          dateObj: val.dateObj,
          student_id: x.student_id,
          faculty: x.faculty,
          equipment: x.equipment,
          qtyBorrow: x.qtyBorrow,
          qtyReturn: x.qtyReturn,
          // เก็บเป็น "array" ให้ฟังก์ชันเรนเดอร์ไปจัดการ
          borrowList: x.borrowTimes,
          returnList: x.returnTimes,
        }));
        out.push({ dayKey, dateObj: val.dateObj, rows: list });
      });
    return out;
  }

  // แปลงเวลาเป็น badge: รองรับทั้ง array และ string (ป้องกัน .split พัง)
  function toBadges(val) {
    if (!val || (Array.isArray(val) && val.length === 0)) {
      return "<span class='muted'>-</span>";
    }
    const arr = Array.isArray(val)
      ? val
      : String(val).split(",").map((s) => s.trim()).filter(Boolean);
    return arr.map((t) => `<span class="time-badge">${t}</span>`).join(" ");
  }

  function renderDayGroups(groups) {
    dayWrap.innerHTML = "";
    const total = groups.reduce((s, g) => s + g.rows.length, 0);
    if (!total) {
      resultInfo.textContent = "ไม่พบข้อมูลในเงื่อนไขที่เลือก";
      return;
    }
    resultInfo.textContent = `พบ ${total.toLocaleString()} รายการ`;

    groups.forEach((g) => {
      const sec = document.createElement("section");
      sec.className = "day-card";

      const title = document.createElement("header");
      title.className = "day-title";
      title.textContent = thaiDateLabel(g.dateObj);
      sec.appendChild(title);

      const tbl = document.createElement("table");
      tbl.className = "ledger-table";
      tbl.innerHTML = `
        <thead>
          <tr>
            <th style="width: 160px">รหัสนิสิต</th>
            <th style="width: 180px">คณะ</th>
            <th>รายการ</th>
            <th style="width: 90px">ยืม</th>
            <th style="width: 160px">เวลา(ยืม)</th>
            <th style="width: 90px">คืน</th>
            <th style="width: 160px">เวลา(คืน)</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;
      const tb = $("tbody", tbl);

      g.rows
        .sort((a, b) =>
          (a.student_id + a.equipment).localeCompare(b.student_id + b.equipment)
        )
        .forEach((r) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td class="sid"><span class="mono">${r.student_id}</span></td>
            <td class="fac">${r.faculty}</td>
            <td class="equip">${r.equipment}</td>
            <td class="qty">${r.qtyBorrow || "-"}</td>
            <td class="time">${toBadges(r.borrowList)}</td>
            <td class="qty">${r.qtyReturn || "-"}</td>
            <td class="time">${toBadges(r.returnList)}</td>
          `;
          tb.appendChild(tr);
        });

      sec.appendChild(tbl);
      dayWrap.appendChild(sec);
    });
  }

  async function run() {
    try {
      const sid = (sidInput.value || "").trim();
      const pick = (dateInput.value || "").trim(); // YYYY-MM-DD
      const rows = await fetchRows(sid, pick);
      const groups = pairPerDay(rows, pick || null);
      renderDayGroups(groups);
    } catch (e) {
      console.error(e);
      resultInfo.textContent = e?.message || "เกิดข้อผิดพลาด";
      dayWrap.innerHTML = "";
    }
  }

  // events
  btnSearch?.addEventListener("click", run);
  btnToday?.addEventListener("click", () => {
    const t = new Date();
    dateInput.value = ymd(t);
    run();
  });
  dateInput?.addEventListener("change", run);
  sidInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") run();
  });

  // default: วันนี้
  document.addEventListener("DOMContentLoaded", () => {
    if (!dateInput.value) dateInput.value = ymd(new Date());
    run();
  });
})();
