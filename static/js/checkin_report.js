// static/js/checkin_report.js
const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => Array.from(p.querySelectorAll(s));

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

const today = ymd(new Date());
$("#from").value = today;
$("#to").value = today;

let rows = []; // หลังกรองชื่อ
let facilityFilter = "all"; // all | outdoor | badminton | pool | track
let chart;

// ===== helpers: bucket (ยังคงไว้ตามเดิม เผื่อใช้ต่อ) =====
function pad2(n) {
  return String(n).padStart(2, "0");
}
function bucketKey(date, mode) {
  const y = date.getFullYear(),
    m = pad2(date.getMonth() + 1),
    d = pad2(date.getDate());
  if (mode === "hour") return `${pad2(date.getHours())}:00`;
  if (mode === "day") return `${y}-${m}-${d}`;
  if (mode === "month") return `${y}-${m}`;
  return String(y); // year
}
function sortedLabels(mode, fromISO, toISO) {
  const from = new Date(fromISO),
    to = new Date(toISO);
  const labels = [];
  const cur = new Date(from);
  if (mode === "hour") {
    for (let h = 0; h < 24; h++) labels.push(pad2(h) + ":00");
  } else if (mode === "day") {
    while (cur <= to) {
      labels.push(
        `${cur.getFullYear()}-${pad2(cur.getMonth() + 1)}-${pad2(cur.getDate())}`,
      );
      cur.setDate(cur.getDate() + 1);
    }
  } else if (mode === "month") {
    while (cur <= to) {
      labels.push(`${cur.getFullYear()}-${pad2(cur.getMonth() + 1)}`);
      cur.setMonth(cur.getMonth() + 1);
    }
  } else {
    while (cur.getFullYear() <= to.getFullYear()) {
      labels.push(String(cur.getFullYear()));
      cur.setFullYear(cur.getFullYear() + 1);
    }
  }
  return labels;
}

// ====== ดึงข้อมูลจาก API (แบบเดิม) ======
async function fetchRows() {
  const qs = new URLSearchParams({
    from: $("#from").value,
    to: $("#to").value,
    facility: facilityFilter === "all" ? "" : facilityFilter,
  }).toString();
  const res = await fetch("{% url 'api_checkins' %}?" + qs);
  const data = res.ok ? await res.json() : [];
  // คาดหวัง: { ts, session_date, facility, sub_facility?, action?, role? }
  // กันข้อมูลขาด: role/sub_facility ไม่มี → ใส่ค่า fallback
  return data.map((r) => ({
    ...r,
    role: r.role || "student", // ถ้าไม่ส่งมา ถือว่าเป็นนิสิต
    sub_facility: r.sub_facility || "",
  }));
}

async function load() {
  const q = ($("#q").value || "").toLowerCase();
  const raw = await fetchRows();

  rows = raw.filter((r) => {
    const name = (FAC_NAME[r.facility] || r.facility).toLowerCase();
    return !q || name.includes(q);
  });

  renderCountsAndTable();
  renderChart();
  updateBigBox();
}

function updateTableHeader() {
  const thead = $("#thead");
  const headText = $("#tableHeadText");
  thead.innerHTML = `
    <tr>
      <th scope="col">เวลา</th>
      <th scope="col">วันที่ (session)</th>
      <th scope="col">สนาม</th>
      <th scope="col">สนามย่อย</th>
      <th scope="col">กลุ่มผู้ใช้</th>
    </tr>`;
  headText.textContent =
    "เวลา     วันที่ (session)     สนาม     สนามย่อย     กลุ่มผู้ใช้";
}

function renderCountsAndTable() {
  updateTableHeader();
  const tb = $("#table tbody");
  tb.innerHTML = "";
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${fmtTime(r.ts)}</td>
                    <td>${r.session_date}</td>
                    <td>${FAC_NAME[r.facility] || r.facility}</td>
                    <td>${r.sub_facility || "-"}</td>
                    <td>${r.role === "staff" ? "บุคลากร" : "นิสิต"}</td>`;
    tb.appendChild(tr);
  });

  const c = countByFacility(rows);
  $("#st-outdoor").textContent = c.outdoor;
  $("#st-badminton").textContent = c.badminton;
  $("#st-pool").textContent = c.pool;
  $("#st-track").textContent = c.track;
  $("#st-total").textContent = c.total;
}

function countByFacility(list) {
  const c = { outdoor: 0, badminton: 0, pool: 0, track: 0 };
  list.forEach((r) => {
    if (c[r.facility] !== undefined) c[r.facility]++;
  });
  return { ...c, total: c.outdoor + c.badminton + c.pool + c.track };
}

function updateBigBox() {
  const title =
    facilityFilter === "all"
      ? "สนามทั้งหมด"
      : FAC_NAME[facilityFilter] || "สนาม";
  $("#bigbox").firstChild.nodeValue = " " + title + " ";
  const c = countByFacility(rows);
  $("#bigcount").textContent =
    facilityFilter === "all" ? c.total : c[facilityFilter] || 0;
}

// ====== กลุ่มนับตาม role/sub_facility ======
function tallyByRole(list) {
  let student = 0,
    staff = 0;
  list.forEach((r) => (r.role === "staff" ? staff++ : student++));
  return { student, staff };
}
function tallyOutdoorBySub(list) {
  // {sub: {total, student, staff}}
  const m = new Map();
  list.forEach((r) => {
    const sub = r.sub_facility || "อื่น ๆ";
    if (!m.has(sub)) m.set(sub, { total: 0, student: 0, staff: 0 });
    const x = m.get(sub);
    x.total++;
    r.role === "staff" ? x.staff++ : x.student++;
  });
  return m;
}

// ====== กราฟ (ปรับเฉพาะส่วนนี้ แต่ "คงรูปแบบหน้าเดิม") ======
function renderChart() {
  const ctx = $("#chart").getContext("2d");
  if (chart) chart.destroy();

  // 1) มุมมอง “ทั้งหมด” → PIe รวมต่อสนาม (เหมือนเดิม)
  if (facilityFilter === "all") {
    const c = countByFacility(rows);
    chart = new Chart(ctx, {
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

  // 2) เลือกสนามเฉพาะ
  const rowsFacility = rows.filter((r) => r.facility === facilityFilter);

  // 2.1 กรณี outdoor → วงกลม “ตามสนามย่อย” (ค่ารวม) และ tooltip แสดงแยก นิสิต/บุคลากร
  if (facilityFilter === "outdoor") {
    const map = tallyOutdoorBySub(rowsFacility); // Map(sub -> {total, student, staff})
    const labels = Array.from(map.keys());
    const totals = labels.map((k) => map.get(k).total);

    chart = new Chart(ctx, {
      type: "pie",
      data: {
        labels,
        datasets: [
          {
            data: totals,
            backgroundColor: labels.map(
              (_, i) => `hsl(${(i * 57) % 360} 70% 70%)`,
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
                  `${sub}: ${r.total.toLocaleString()}`,
                  `  • นิสิต: ${r.student.toLocaleString()}`,
                  `  • บุคลากร: ${r.staff.toLocaleString()}`,
                ];
              },
            },
          },
        },
      },
    });
    return;
  }

  // 2.2 สนามอื่น ๆ (badminton/track/pool) → วงกลม นิสิต vs บุคลากร
  const roleCount = tallyByRole(rowsFacility);
  chart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["นิสิต", "บุคลากร"],
      datasets: [
        {
          data: [roleCount.student, roleCount.staff],
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

// ===== Export (ตามเดิม) =====
function rowsForExport() {
  const map = new Map(); // key: date|facility|sub|role
  rows.forEach((r) => {
    const key = `${r.session_date}|${r.facility}|${r.sub_facility || ""}|${r.role || "student"}`;
    map.set(key, (map.get(key) || 0) + 1);
  });
  const arr = [];
  for (const [k, n] of map) {
    const [d, f, sub, role] = k.split("|");
    arr.push({
      "วันที่ (session)": d,
      สนาม: FAC_NAME[f] || f,
      สนามย่อย: sub || "-",
      กลุ่มผู้ใช้: role === "staff" ? "บุคลากร" : "นิสิต",
      จำนวน: n,
    });
  }
  arr.sort(
    (a, b) =>
      a["วันที่ (session)"].localeCompare(b["วันที่ (session)"]) ||
      a["สนาม"].localeCompare(b["สนาม"]) ||
      a["สนามย่อย"].localeCompare(b["สนามย่อย"]) ||
      a["กลุ่มผู้ใช้"].localeCompare(b["กลุ่มผู้ใช้"]),
  );
  return arr;
}

$("#btnExcel").addEventListener("click", () => {
  const ws = XLSX.utils.json_to_sheet(rowsForExport());
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Counts");
  XLSX.writeFile(
    wb,
    `checkins_${$("#from").value}_${$("#to").value}${facilitySuffix()}.xlsx`,
  );
});
$("#btnPDF").addEventListener("click", () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
  const data = rowsForExport();
  doc.setFont("Helvetica", "");
  doc.setFontSize(12);
  doc.text(
    `รายงานผู้เข้าใช้สนามกีฬา (ช่วง ${$("#from").value} - ${$("#to").value})`,
    40,
    40,
  );
  if (facilityFilter !== "all")
    doc.text(`สนาม: ${FAC_NAME[facilityFilter]}`, 40, 58);
  const head = [
    ["วันที่ (session)", "สนาม", "สนามย่อย", "กลุ่มผู้ใช้", "จำนวน"],
  ];
  const body = data.map((r) => [
    r["วันที่ (session)"],
    r["สนาม"],
    r["สนามย่อย"],
    r["กลุ่มผู้ใช้"],
    r["จำนวน"],
  ]);
  doc.autoTable({
    head,
    body,
    startY: facilityFilter === "all" ? 60 : 78,
    styles: { fontSize: 10 },
  });
  doc.save(
    `checkins_${$("#from").value}_${$("#to").value}${facilitySuffix()}.pdf`,
  );
});
$("#btnDoc").addEventListener("click", async () => {
  const {
    Document,
    Packer,
    Paragraph,
    Table,
    TableRow,
    TableCell,
    WidthType,
    HeadingLevel,
  } = docx;
  const arr = rowsForExport();
  const head = [
    "วันที่ (session)",
    "สนาม",
    "สนามย่อย",
    "กลุ่มผู้ใช้",
    "จำนวน",
  ].map((t) => new TableCell({ children: [new Paragraph({ text: t })] }));
  const trs = [new TableRow({ children: head })];
  arr.forEach((r) => {
    trs.push(
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph(String(r["วันที่ (session)"]))],
          }),
          new TableCell({ children: [new Paragraph(String(r["สนาม"]))] }),
          new TableCell({
            children: [new Paragraph(String(r["สนามย่อย"]))],
          }),
          new TableCell({
            children: [new Paragraph(String(r["กลุ่มผู้ใช้"]))],
          }),
          new TableCell({
            children: [new Paragraph(String(r["จำนวน"]))],
          }),
        ],
      }),
    );
  });
  const table = new Table({
    width: { size: 100, type: WidthType.PERCENT },
    rows: trs,
  });
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: "รายงานผู้เข้าใช้สนามกีฬา",
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph(
            `ช่วง ${$("#from").value} - ${$("#to").value}${facilityFilter === "all" ? "" : " · " + FAC_NAME[facilityFilter]}`,
          ),
          table,
        ],
      },
    ],
  });
  const blob = await Packer.toBlob(doc);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `checkins_${$("#from").value}_${$("#to").value}${facilitySuffix()}.docx`;
  a.click();
});
$("#btnPrint").addEventListener("click", () => window.print());
function facilitySuffix() {
  return facilityFilter === "all" ? "" : `_${facilityFilter}`;
}

// Events (เหมือนเดิม)
$("#from").addEventListener("change", load);
$("#to").addEventListener("change", load);
$("#timeMode").addEventListener("change", load);
$("#q").addEventListener("input", () => load());
$$("#chips .chip").forEach((ch) =>
  ch.addEventListener("click", () => {
    $$("#chips .chip").forEach((x) => x.classList.remove("selected"));
    ch.classList.add("selected");
    facilityFilter = ch.dataset.k;
    load();
  }),
);
document.addEventListener("DOMContentLoaded", load);
