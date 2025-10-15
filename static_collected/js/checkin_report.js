// ---------- helpers ----------
const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => Array.from(p.querySelectorAll(s));
function getCss(v) {
  return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
}
function ymd(d) {
  return new Date(d).toISOString().slice(0, 10);
}
function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const FAC_NAME = {
  outdoor: "สนามกลางแจ้ง",
  badminton: "สนามแบดมินตัน",
  pool: "สระว่ายน้ำ",
  track: "ลู่และลาน",
};
const COLORS = {
  outdoor: getCss("--outdoor"),
  badminton: getCss("--badminton"),
  pool: getCss("--pool"),
  track: getCss("--track"),
};

// ---------- initial ----------
document.addEventListener("DOMContentLoaded", () => {
  const mainEl = document.querySelector("main");
  const API_CHECKINS = mainEl.dataset.apiCheckinsUrl;
  const REPORT_PAGE_URL = mainEl.dataset.reportPageUrl;

  const today = ymd(new Date());
  $("#from").value = today;
  $("#to").value = today;

  let facilityFilter = "all";
  let rows = [];
  let chartInstance;

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
    return data.map((r) => ({
      ...r,
      role: r.role || "student",
      sub_facility: r.sub_facility || "",
    }));
  }

  function countByFacility(list) {
    const c = { outdoor: 0, badminton: 0, pool: 0, track: 0 };
    list.forEach((r) => {
      if (c[r.facility] !== undefined) c[r.facility]++;
    });
    return { ...c, total: c.outdoor + c.badminton + c.pool + c.track };
  }

  function updateTableHeader() {
    $("#thead").innerHTML = `
      <tr>
        <th scope="col">เวลา</th>
        <th scope="col">วันที่ (session)</th>
        <th scope="col">สนาม</th>
        <th scope="col">สนามย่อย</th>
        <th scope="col">กลุ่มผู้ใช้</th>
      </tr>`;
    $("#tableHeadText").textContent =
      "เวลา · วันที่ (session) · สนาม · สนามย่อย · กลุ่มผู้ใช้";
  }

  function renderCountsAndTable() {
    updateTableHeader();
    const tb = $("#table tbody");
    tb.innerHTML = "";
    rows.forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${fmtTime(r.ts)}</td>
        <td>${r.session_date}</td>
        <td>${FAC_NAME[r.facility] || r.facility}</td>
        <td>${r.sub_facility || "-"}</td>
        <td>${r.role === "staff" ? "บุคลากร" : "นิสิต"}</td>`;
      tb.appendChild(tr);
    });

    const c = countByFacility(rows);
    $("#bigcount").textContent = c.total;
    $("#st-total").textContent = c.total;
    $("#st-outdoor").textContent = c.outdoor;
    $("#st-badminton").textContent = c.badminton;
    $("#st-pool").textContent = c.pool;
    $("#st-track").textContent = c.track;
  }

  function tallyByRole(list) {
    let s = 0,
      t = 0;
    list.forEach((r) => (r.role === "staff" ? t++ : s++));
    return { student: s, staff: t };
  }
  function tallyOutdoorBySub(list) {
    const m = new Map();
    list.forEach((r) => {
      const sub = r.sub_facility || "อื่น ๆ";
      if (!m.has(sub)) m.set(sub, { total: 0, student: 0, staff: 0 });
      const x = m.get(sub);
      x.total += 1;
      if (r.role === "staff") x.staff += 1;
      else x.student += 1;
    });
    return m;
  }

  function renderChart() {
    const ctx = $("#chart").getContext("2d");
    if (chartInstance) chartInstance.destroy();

    if (facilityFilter === "all") {
      const c = countByFacility(rows);
      chartInstance = new Chart(ctx, {
        type: "pie",
        data: {
          labels: [
            FAC_NAME.outdoor,
            FAC_NAME.badminton,
            FAC_NAME.pool,
            FAC_NAME.track,
          ],
          datasets: [
            {
              data: [c.outdoor, c.badminton, c.pool, c.track],
              backgroundColor: [
                COLORS.outdoor,
                COLORS.badminton,
                COLORS.pool,
                COLORS.track,
              ],
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "right", labels: { usePointStyle: true } },
          },
        },
      });
      return;
    }

    const rowsFacility = rows.filter((r) => r.facility === facilityFilter);
    if (facilityFilter === "outdoor") {
      const map = tallyOutdoorBySub(rowsFacility);
      const labels = Array.from(map.keys());
      const totals = labels.map((k) => map.get(k).total);
      chartInstance = new Chart(ctx, {
        type: "pie",
        data: {
          labels,
          datasets: [
            {
              data: totals,
              backgroundColor: labels.map(
                (_, i) => `hsl(${(i * 57) % 360} 70% 60%)`,
              ),
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "right" },
            tooltip: {
              callbacks: {
                label: (tt) => {
                  const sub = labels[tt.dataIndex];
                  const r = map.get(sub);
                  return [
                    `${sub}: ${r.total}`,
                    `  • นิสิต: ${r.student}`,
                    `  • บุคลากร: ${r.staff}`,
                  ];
                },
              },
            },
          },
        },
      });
      return;
    }

    const rc = tallyByRole(rowsFacility);
    chartInstance = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["นิสิต", "บุคลากร"],
        datasets: [
          {
            data: [rc.student, rc.staff],
            backgroundColor: ["#8ab6ff", "#ffcf6e"],
          },
        ],
      },
      options: {
        cutout: "55%",
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "right" } },
      },
    });
  }

  async function load() {
    rows = await fetchRows();
    renderCountsAndTable();
    renderChart();
  }

  // events
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

  // PDF buttons -> เปิดหน้า monthly_report.html แล้วสั่ง print
  $("#btnDownloadPdf")?.addEventListener("click", () => {
    if (!REPORT_PAGE_URL) return;
    window.open(REPORT_PAGE_URL + "?print=1", "_blank", "noopener");
  });
  $("#btnPrintPdf")?.addEventListener("click", () => {
    if (!REPORT_PAGE_URL) return;
    window.open(REPORT_PAGE_URL + "?print=1", "_blank", "noopener");
  });

  load();
});
