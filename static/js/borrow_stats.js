(() => {
  const $ = (s) => document.querySelector(s);

  const from = $("#dateFrom");
  const to = $("#dateTo");
  const btnExcel = $("#btnExcel");
  const btnPdf = $("#btnPdf");
  const btnDocx = $("#btnDocx");
  const btnPrint = $("#btnPrint");
  const tbody = $("#tbl tbody");
  const sumCell = $("#sumCell");
  const monthTitle = $("#monthTitle");

  let chart;

  // ===== Utilities =====
  function firstDayOfMonth(d = new Date()) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }
  function lastDayOfMonth(d = new Date()) {
    return new Date(d.getFullYear(), d.getMonth() + 1, 0);
  }
  function toISODate(d) {
    const m = d.getMonth() + 1;
    const day = d.getDate();
    return `${d.getFullYear()}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  function monthTH(d) {
    const THAI_MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
    return `${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
  }
  // สีกลุ่มพาสเทล
  function colors(n) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(`hsl(${(i * 40) % 360} 70% 70%)`);
    return out;
  }
  // วาดตัวเลขรวมตรงกลางโดนัท
  const centerText = {
    id: "centerText",
    beforeDraw(chart, args, opts) {
      const { ctx, chartArea } = chart;
      if (!chartArea) return;
      const total = chart.config.data.datasets[0]?.data?.reduce((a, b) => a + b, 0) || 0;

      ctx.save();
      ctx.font = "600 18px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
      ctx.fillStyle = "#3a2b84";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(total.toLocaleString(), (chartArea.left + chartArea.right) / 2, (chartArea.top + chartArea.bottom) / 2);
      ctx.restore();
    },
  };

  // ===== fetch helper =====
  function q(url, params) {
    const u = new URL(url, location.origin);
    Object.entries(params || {}).forEach(([k, v]) => u.searchParams.set(k, v));
    return fetch(u).then((r) => r.json());
  }

  async function load() {
    // อัปเดตหัวข้อเดือน
    const f = new Date(from.value);
    monthTitle.textContent = `สถิติการยืม–คืน · ${monthTH(f)}`;

    const data = await q(window.STATS_API, {
      from: from.value,
      to: to.value,
      action: "borrow",
    });

    // เติมตาราง
    tbody.innerHTML = "";
    (data.rows || []).forEach((r, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${r.equipment}</td>
        <td style="text-align:right">${(r.qty || 0).toLocaleString()}</td>
      `;
      tbody.appendChild(tr);
    });
    sumCell.textContent = (data.total || 0).toLocaleString();

    // ข้อมูลกราฟ
    const labels = (data.rows || []).map((r) => r.equipment);
    const values = (data.rows || []).map((r) => r.qty || 0);

    // สร้างกราฟ
    const ctx = document.getElementById("chart");
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: colors(values.length),
            borderColor: "#fff",
            borderWidth: 2,
            hoverBorderWidth: 3,
          },
        ],
      },
      options: {
        animation: { duration: 600 },
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: "#3a2b84", font: { size: 13, weight: "600" }, padding: 12 },
          },
          tooltip: {
            backgroundColor: "#3a2b84",
            titleColor: "#fff",
            bodyColor: "#fff",
            cornerRadius: 8,
            boxPadding: 6,
            callbacks: {
              label: (ctx) => `${ctx.label}: ${Number(ctx.raw || 0).toLocaleString()} ครั้ง`,
            },
          },
        },
        cutout: "64%",
        layout: { padding: 10 },
      },
      plugins: [centerText],
    });

    // (ถ้าจะเปิดใช้ CSV ในอนาคต) อัปเดตลิงก์
    const u = new URL(window.EXPORT_CSV, location.origin);
    u.searchParams.set("from", from.value);
    u.searchParams.set("to", to.value);
    u.searchParams.set("action", "borrow");
    btnExcel.href = u.toString();
  }

  // ===== Initial date range: 1 → last day of current month =====
  function initMonthRange() {
    const now = new Date();
    const f = firstDayOfMonth(now);
    const l = lastDayOfMonth(now);
    from.value = toISODate(f);
    to.value = toISODate(l);
  }

  // เมื่อผู้ใช้แก้วันที่ "จาก" ให้ล็อก "ถึง" เป็นวันสุดท้ายเดือนเดียวกัน
  from.addEventListener("change", () => {
    const f = new Date(from.value);
    if (!isNaN(f)) {
      to.value = toISODate(lastDayOfMonth(f));
      load();
    }
  });
  // ถ้าผู้ใช้แก้ "ถึง" แล้วเลยเดือน ให้ดึงกลับมาสุดท้ายของเดือนเดียวกับ "จาก"
  to.addEventListener("change", () => {
    const f = new Date(from.value);
    const t = new Date(to.value);
    if (!isNaN(f) && !isNaN(t)) {
      const last = lastDayOfMonth(f);
      if (t.getMonth() !== f.getMonth() || t.getFullYear() !== f.getFullYear()) {
        to.value = toISODate(last);
      }
      load();
    }
  });

  // ===== “PDF แบบหน้าเช็คอิน”: ใช้พิมพ์หน้าเป็น PDF =====
  btnPdf.addEventListener("click", () => window.print());
  btnPrint.addEventListener("click", () => window.print());

  // ซ่อนปุ่มที่ไม่ใช้ (คงโครง html แต่แสดงเฉพาะ PDF)
  btnExcel.style.display = "none";
  btnDocx.style.display = "none";

  // init
  initMonthRange();
  load();
})();