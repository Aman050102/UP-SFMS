// ---------- helpers ----------
const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => Array.from(p.querySelectorAll(s));
function getCss(v) {
  return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
}
// yyyy-mm-dd แบบ local (กันโดน UTC เลื่อนวัน)
function ymdLocal(d) {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ชื่อสนาม + สีหลัก (อ่านจาก CSS variable เพื่อเข้าโทนเข้ม)
const FAC_NAME = {
  outdoor: "สนามกลางแจ้ง",
  badminton: "สนามแบดมินตัน",
  pool: "สระว่ายน้ำ",
  track: "ลู่และลาน",
};
const COLORS = {
  outdoor: getCss("--outdoor") || "#2e7d32",
  badminton: getCss("--badminton") || "#1565c0",
  pool: getCss("--pool") || "#0f766e",
  track: getCss("--track") || "#ef6c00",
};

// โทนมืออาชีพ (เข้ม): พาเล็ตสำหรับ datasets
const PALETTE = {
  gold: "#C8A44D",
  gold50: "rgba(200,164,77,.45)",
  purple: "#5D4B9C",
  purple50: "rgba(93,75,156,.45)",
  gray: "#7B7A85",
  gray50: "rgba(123,122,133,.35)",
  cyan: "#5FA3B4",
  cyan50: "rgba(95,163,180,.45)",
};

// เส้นตาราง/ตัวอักษรให้เข้ากับธีม
function chartTextColor() {
  return getCss("--text") || "#e9e6f5";
}
function chartGridColor() {
  return "rgba(230,225,255,.14)";
}

// ---------- initial ----------
document.addEventListener("DOMContentLoaded", () => {
  const mainEl = document.querySelector("main");
  const API_CHECKINS = mainEl.dataset.apiCheckinsUrl;

  // เริ่มต้นช่วงวันที่ = 1 -> วันสุดท้ายของเดือนปัจจุบัน
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  $("#from").value = ymdLocal(firstDay);
  $("#to").value = ymdLocal(lastDay);

  // สถานะ UI
  let facilityFilter = "all"; // all | outdoor | badminton | pool | track
  let viewMode = "pie"; // pie | bar | line
  let rows = []; // ข้อมูลจาก API (normalize แล้ว)
  let chartInstance;

  // ------------ fetch + normalize + ตารางสรุป ------------
  async function fetchRows() {
    const qs = new URLSearchParams({
      from: $("#from").value,
      to: $("#to").value,
      facility: facilityFilter === "all" ? "" : facilityFilter,
    }).toString();

    const res = await fetch(API_CHECKINS + "?" + qs, {
      credentials: "same-origin",
    });
    if (!res.ok) return [];

    const data = await res.json();

    // normalize ให้ทุกแถวมี student_count / staff_count (ถ้า API ยังไม่ส่งมา)
    // ถ้า API ส่ง user_count มา จะไม่ใช้ (เราแยกนิสิต/บุคลากรเอง)
    return data.map((r) => {
      const sc = Number(r.student_count ?? (r.role === "student" ? 1 : 0) ?? 0);
      const tc = Number(r.staff_count ?? (r.role === "staff" ? 1 : 0) ?? 0);
      return {
        ts: r.ts,
        session_date: r.session_date,
        facility: r.facility,
        sub_facility: r.sub_facility || "",
        action: r.action || "in",
        student_count: isNaN(sc) ? 0 : sc,
        staff_count: isNaN(tc) ? 0 : tc,
      };
    });
  }

  function countByFacility(list) {
    const c = { outdoor: 0, badminton: 0, pool: 0, track: 0 };
    list.forEach((r) => {
      const total = Number(r.student_count || 0) + Number(r.staff_count || 0);
      if (c[r.facility] !== undefined) c[r.facility] += total;
    });
    return { ...c, total: c.outdoor + c.badminton + c.pool + c.track };
  }

  function updateTableHeader() {
  $("#thead").innerHTML = `
    <tr>
      <th scope="col">เวลา</th>
      <th scope="col">วันที่</th>
      <th scope="col">สนาม</th>
      <th scope="col">สนามย่อย</th>
      <th scope="col">นิสิต</th>
      <th scope="col">บุคลากร</th>
      <th scope="col" style="text-align:right;">รวม</th>
    </tr>`;
  $("#tableHeadText").textContent =
    "เวลา · วันที่ · สนาม · สนามย่อย · นิสิต · บุคลากร · รวม";
}

function renderCountsAndTable() {
  updateTableHeader();
  const tb = $("#table tbody");
  tb.innerHTML = "";

  rows.forEach((r) => {
    const sc = Number(r.student_count || 0);
    const tc = Number(r.staff_count || 0);
    const total = sc + tc;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fmtTime(r.ts)}</td>
      <td>${r.session_date}</td>
      <td>${FAC_NAME[r.facility] || r.facility}</td>
      <td>${r.sub_facility || "-"}</td>
      <td style="text-align:center;">${sc.toLocaleString()}</td>
      <td style="text-align:center;">${tc.toLocaleString()}</td>
      <td style="text-align:right;font-weight:700;color:var(--primary-700)">${total.toLocaleString()}</td>`;
    tb.appendChild(tr);
  });

  // รวมต่อสนาม (ใช้เป็นกล่อง summary ด้านบน)
  const summary = countByFacility(rows);
  $("#bigcount").textContent = summary.total;
  $("#st-total").textContent = summary.total;
  $("#st-outdoor").textContent = summary.outdoor;
  $("#st-badminton").textContent = summary.badminton;
  $("#st-pool").textContent = summary.pool;
  $("#st-track").textContent = summary.track;
}

  // ------------ สรุปเพื่อทำกราฟ (ใช้จำนวนจริงจาก API) ------------
  // รวมเป็นผลรวม (นิสิต/บุคลากร) จากรายการทั้งหมดใน list
  function tallyRole(list) {
    let student = 0,
      staff = 0;
    list.forEach((r) => {
      student += Number(r.student_count || 0);
      staff += Number(r.staff_count || 0);
    });
    return { student, staff, total: student + staff };
  }

  // แยกตามสนาม -> {outdoor:{student,staff}, ...}
  function tallyByFacilityAndRole(list) {
    const m = {
      outdoor: { student: 0, staff: 0 },
      badminton: { student: 0, staff: 0 },
      pool: { student: 0, staff: 0 },
      track: { student: 0, staff: 0 },
    };
    list.forEach((r) => {
      if (!m[r.facility]) return;
      m[r.facility].student += Number(r.student_count || 0);
      m[r.facility].staff += Number(r.staff_count || 0);
    });
    return m;
  }

  // เฉพาะสนาม กลุ่มตาม sub_facility -> Map(sub, {student, staff})
  function tallyBySubFacility(list) {
    const m = new Map();
    list.forEach((r) => {
      const sub = r.sub_facility || "ไม่ระบุ";
      if (!m.has(sub)) m.set(sub, { student: 0, staff: 0 });
      const x = m.get(sub);
      x.student += Number(r.student_count || 0);
      x.staff += Number(r.staff_count || 0);
    });
    return m;
  }

  // 30 วันล่าสุด: {labels, student[], staff[]}
  function tallyLastNDays(list, n = 30) {
    const today = new Date();
    const days = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push(ymdLocal(d)); // yyyy-mm-dd
    }
    const map = new Map(days.map((k) => [k, { student: 0, staff: 0 }]));
    list.forEach((r) => {
      const k = r.session_date; // yyyy-mm-dd
      if (!map.has(k)) return;
      const o = map.get(k);
      o.student += Number(r.student_count || 0);
      o.staff += Number(r.staff_count || 0);
    });
    const labels = days.map((k) => {
      const [y, m, d] = k.split("-");
      return `${d}/${m}`;
    });
    const student = days.map((k) => map.get(k).student);
    const staff = days.map((k) => map.get(k).staff);
    return { labels, student, staff };
  }

  // ------------ วาดกราฟ ------------
  function makeChart(ctx, cfg) {
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, cfg);
  }

  function renderPie(ctx) {
    // all: วงกลม “สัดส่วนรวมต่อสนาม” (รวม นิสิต+บุคลากร)
    // เฉพาะสนาม: วงกลม “นิสิต vs บุคลากร” ภายในสนามนั้น
    if (facilityFilter === "all") {
      const byFac = tallyByFacilityAndRole(rows);
      const labels = [
        FAC_NAME.outdoor,
        FAC_NAME.badminton,
        FAC_NAME.pool,
        FAC_NAME.track,
      ];
      const data = [
        byFac.outdoor.student + byFac.outdoor.staff,
        byFac.badminton.student + byFac.badminton.staff,
        byFac.pool.student + byFac.pool.staff,
        byFac.track.student + byFac.track.staff,
      ];
      makeChart(ctx, {
        type: "pie",
        data: {
          labels,
          datasets: [
            {
              data,
              backgroundColor: [
                COLORS.outdoor,
                COLORS.badminton,
                COLORS.pool,
                COLORS.track,
              ],
              borderColor: "#201936",
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "right",
              labels: { color: chartTextColor(), usePointStyle: true },
            },
            tooltip: {
              callbacks: {
                label: (tt) => `${tt.label}: ${tt.raw.toLocaleString()}`,
              },
            },
          },
        },
      });
      return;
    }

    // เฉพาะสนาม
    const list = rows.filter((r) => r.facility === facilityFilter);
    const t = tallyRole(list);
    makeChart(ctx, {
      type: "doughnut",
      data: {
        labels: ["นิสิต", "บุคลากร"],
        datasets: [
          {
            data: [t.student, t.staff],
            backgroundColor: [PALETTE.purple, PALETTE.gold],
            borderColor: "#201936",
            borderWidth: 2,
          },
        ],
      },
      options: {
        cutout: "55%",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "right", labels: { color: chartTextColor() } },
          tooltip: {
            callbacks: {
              label: (tt) => `${tt.label}: ${tt.raw.toLocaleString()}`,
            },
          },
        },
      },
    });
  }

  function renderBar(ctx) {
    // all: stacked เปรียบเทียบ “นิสิต/บุคลากร” ของแต่ละสนาม
    // เฉพาะสนาม: grouped แยกตามสนามย่อย
    if (facilityFilter === "all") {
      const byFac = tallyByFacilityAndRole(rows);
      const labels = [
        FAC_NAME.outdoor,
        FAC_NAME.badminton,
        FAC_NAME.pool,
        FAC_NAME.track,
      ];
      const student = [
        byFac.outdoor.student,
        byFac.badminton.student,
        byFac.pool.student,
        byFac.track.student,
      ];
      const staff = [
        byFac.outdoor.staff,
        byFac.badminton.staff,
        byFac.pool.staff,
        byFac.track.staff,
      ];
      makeChart(ctx, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "นิสิต",
              data: student,
              backgroundColor: PALETTE.purple50,
              borderColor: PALETTE.purple,
              borderWidth: 2,
            },
            {
              label: "บุคลากร",
              data: staff,
              backgroundColor: PALETTE.gold50,
              borderColor: PALETTE.gold,
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              stacked: true,
              ticks: { color: chartTextColor() },
              grid: { color: chartGridColor() },
            },
            y: {
              stacked: true,
              ticks: { color: chartTextColor() },
              grid: { color: chartGridColor() },
            },
          },
          plugins: { legend: { labels: { color: chartTextColor() } } },
        },
      });
      return;
    }

    // เฉพาะสนาม -> group ตาม sub_facility
    const list = rows.filter((r) => r.facility === facilityFilter);
    const map = tallyBySubFacility(list);
    const labels = Array.from(map.keys());
    const student = labels.map((k) => map.get(k).student);
    const staff = labels.map((k) => map.get(k).staff);
    makeChart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "นิสิต",
            data: student,
            backgroundColor: PALETTE.purple50,
            borderColor: PALETTE.purple,
            borderWidth: 2,
          },
          {
            label: "บุคลากร",
            data: staff,
            backgroundColor: PALETTE.gold50,
            borderColor: PALETTE.gold,
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            stacked: false,
            ticks: { color: chartTextColor() },
            grid: { color: chartGridColor() },
          },
          y: {
            stacked: false,
            ticks: { color: chartTextColor() },
            grid: { color: chartGridColor() },
          },
        },
        plugins: { legend: { labels: { color: chartTextColor() } } },
      },
    });
  }

  function renderLine(ctx) {
    // เส้นแยกนิสิต/บุคลากร 30 วันล่าสุด (all หรือ เฉพาะสนาม)
    const list =
      facilityFilter === "all"
        ? rows
        : rows.filter((r) => r.facility === facilityFilter);
    const daily = tallyLastNDays(list, 30);
    makeChart(ctx, {
      type: "line",
      data: {
        labels: daily.labels,
        datasets: [
          {
            label: "นิสิต",
            data: daily.student,
            tension: 0.25,
            borderWidth: 2,
            borderColor: PALETTE.cyan,
            backgroundColor: PALETTE.cyan50,
            pointRadius: 0,
            fill: true,
          },
          {
            label: "บุคลากร",
            data: daily.staff,
            tension: 0.25,
            borderWidth: 2,
            borderColor: PALETTE.purple,
            backgroundColor: PALETTE.purple50,
            pointRadius: 0,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            ticks: { color: chartTextColor(), maxRotation: 0 },
            grid: { color: chartGridColor() },
          },
          y: {
            ticks: { color: chartTextColor() },
            grid: { color: chartGridColor() },
          },
        },
        plugins: { legend: { labels: { color: chartTextColor() } } },
      },
    });
  }

  function renderChart() {
    const ctx = $("#chart").getContext("2d");
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    if (viewMode === "pie") return renderPie(ctx);
    if (viewMode === "bar") return renderBar(ctx);
    if (viewMode === "line") return renderLine(ctx);
  }

  async function load() {
    rows = await fetchRows();
    renderCountsAndTable();
    renderChart();
  }

  // ---------- events ----------
  $("#from").addEventListener("change", load);
  $("#to").addEventListener("change", load);
  $("#timeMode").addEventListener("change", load);
  $("#q").addEventListener("input", load);

  $("#chips").addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    $$(".chip", $("#chips")).forEach((x) => {
      x.classList.remove("selected");
      x.setAttribute("aria-selected", "false");
    });
    btn.classList.add("selected");
    btn.setAttribute("aria-selected", "true");
    facilityFilter = btn.dataset.k;
    load();
  });

  // ปุ่มสลับมุมมองกราฟ
  $("#viewToggle")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-view]");
    if (!b) return;
    viewMode = b.dataset.view;
    $$("#viewToggle [data-view]").forEach((x) =>
      x.classList.toggle("active", x.dataset.view === viewMode),
    );
    renderChart();
  });

  // โหลดครั้งแรก
  load();
});
