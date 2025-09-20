// static/js/borrow_stats.js
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

  let chart;

  function q(url, params) {
    const u = new URL(url, location.origin);
    Object.entries(params || {}).forEach(([k, v]) => u.searchParams.set(k, v));
    return fetch(u).then((r) => r.json());
  }

  function colors(n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      // พาเลตแบบนุ่ม
      out.push(`hsl(${(i * 57) % 360} 70% 70%)`);
    }
    return out;
  }

  async function load() {
    const data = await q(window.STATS_API, {
      from: from.value,
      to: to.value,
      action: "borrow",
    });

    // เติมตาราง
    tbody.innerHTML = "";
    data.rows.forEach((r, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${r.equipment}</td>
        <td style="text-align:right">${r.qty.toLocaleString()}</td>
      `;
      tbody.appendChild(tr);
    });
    sumCell.textContent = (data.total || 0).toLocaleString();

    // วาดกราฟ
    const labels = data.rows.map((r) => r.equipment);
    const values = data.rows.map((r) => r.qty);
    const ctx = document.getElementById("chart");

    if (chart) chart.destroy();
    chart = new Chart(ctx, {
      type: "pie",
      data: {
        labels,
        datasets: [{ data: values, backgroundColor: colors(values.length) }],
      },
      options: {
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${ctx.raw.toLocaleString()}`,
            },
          },
        },
      },
    });

    // อัปเดตลิงก์ CSV
    const u = new URL(window.EXPORT_CSV, location.origin);
    u.searchParams.set("from", from.value);
    u.searchParams.set("to", to.value);
    u.searchParams.set("action", "borrow");
    btnExcel.href = u.toString();
  }

  // events
  from.addEventListener("change", load);
  to.addEventListener("change", load);
  btnPrint.addEventListener("click", () => window.print());

  // PDF / DOCX ตอนนี้ทำผ่าน print / placeholder
  btnPdf.addEventListener("click", () => window.print());
  btnDocx.addEventListener("click", () =>
    alert(
      "ฟังก์ชัน DOCX สามารถทำได้ภายหลัง (server-side) — ขณะนี้ใช้พิมพ์เป็น PDF แทนได้",
    ),
  );

  // init
  load();
})();
