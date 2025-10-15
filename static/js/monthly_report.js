// กล่องข้อมูล PDF ต้นฉบับ
(function setupPdfInfo() {
  var pdfUrl = "{{ source_pdf_url|escapejs }}";
  var infoUrl = "{{ source_pdf_info_url|escapejs }}";
  var t = document.getElementById("pdfInfoText");
  var p = document.getElementById("btnPrintOriginal");
  if (p) {
    p.addEventListener("click", function () {
      var f = document.createElement("iframe");
      f.style.position = "fixed";
      f.style.right = 0;
      f.style.bottom = 0;
      f.style.width = 0;
      f.style.height = 0;
      f.style.border = 0;
      f.src = pdfUrl;
      document.body.appendChild(f);
      f.onload = function () {
        try {
          f.contentWindow.focus();
          f.contentWindow.print();
        } catch (e) {
          window.open(pdfUrl, "_blank");
        }
      };
    });
  }
  fetch(infoUrl)
    .then(function (r) {
      return r.json();
    })
    .then(function (j) {
      if (!j.file_exists) {
        t.textContent = "ยังไม่พบไฟล์ PDF ต้นฉบับสำหรับเดือนนี้";
        return;
      }
      t.innerHTML =
        "<b>ไฟล์ PDF ต้นฉบับ</b> · ขนาด " +
        j.file_size_label +
        " · สร้าง " +
        j.created_at +
        " · แก้ไข " +
        j.modified_at +
        "<br>" +
        "<b>ช่วงข้อมูล:</b> " +
        j.report_scope.month_label +
        " · <b>สนาม:</b> " +
        (j.report_scope.venues || []).join(" / ") +
        "<br>" +
        "<b>ประกอบด้วย:</b> " +
        (j.sections || [])
          .map(function (s) {
            return s.title;
          })
          .join(" · ");
    })
    ["catch"](function () {
      t.textContent = "โหลดข้อมูลไฟล์ไม่สำเร็จ";
    });
})();

// ===== กราฟ + ตาราง =====
var DATA_URL = "{{ data_url|escapejs }}";
var COLORS = {
  pool: "#1f78b4",
  track: "#33a02c",
  outdoor: "#6baed6",
  badminton: "#60a5fa",
};

function keyByThai(name) {
  if (name.indexOf("สระ") > -1) return "pool";
  if (name.indexOf("ลู่") > -1) return "track";
  if (name.indexOf("กลางแจ้ง") > -1) return "outdoor";
  return "badminton";
}

(function () {
  fetch(DATA_URL, { headers: { Accept: "application/json" } })
    .then(function (r) {
      return r.json();
    })
    .then(function (data) {
      var totals = data.totals_by_venue || [];
      var labelsVenue = totals.map(function (x) {
        return x.venue;
      });
      var totalsAll = totals.map(function (x) {
        return (x.student || 0) + (x.staff || 0);
      });

      new Chart(document.getElementById("pieByVenue"), {
        type: "pie",
        data: {
          labels: labelsVenue,
          datasets: [
            {
              data: totalsAll,
              backgroundColor: [
                COLORS.pool,
                COLORS.track,
                COLORS.outdoor,
                COLORS.badminton,
              ],
            },
          ],
        },
        options: { legend: { display: false } },
      });

      new Chart(document.getElementById("barStudentStaff"), {
        type: "bar",
        data: {
          labels: labelsVenue,
          datasets: [
            {
              label: "บุคลากร",
              data: totals.map(function (x) {
                return x.staff;
              }),
              backgroundColor: COLORS.pool,
            },
            {
              label: "นิสิต",
              data: totals.map(function (x) {
                return x.student;
              }),
              backgroundColor: COLORS.badminton,
            },
          ],
        },
        options: {
          scales: { yAxes: [{ ticks: { beginAtZero: true } }] },
          legend: { display: true },
        },
      });

      var days = (data.day_rows || []).map(function (r) {
        return r.day;
      });
      function series(k, color, label) {
        return {
          label: label || k,
          data: (data.day_rows || []).map(function (r) {
            return ((r[k] && r[k].student) || 0) + ((r[k] && r[k].staff) || 0);
          }),
          borderColor: color,
          fill: false,
          lineTension: 0.25,
          pointRadius: 0,
        };
      }
      new Chart(document.getElementById("lineAll"), {
        type: "line",
        data: {
          labels: days,
          datasets: [
            series("pool", COLORS.pool, "สระว่ายน้ำ"),
            series("track", COLORS.track, "ลู่ - ลาน"),
            series("outdoor", COLORS.outdoor, "สนามกีฬากลางแจ้ง"),
            series("badminton", COLORS.badminton, "สนามแบดมินตัน"),
          ],
        },
        options: {
          legend: { display: false },
          scales: { yAxes: [{ ticks: { beginAtZero: true } }] },
        },
      });
      document.getElementById("legendLines").innerHTML =
        '<span class="badge"><span class="sw" style="background:' +
        COLORS.pool +
        '"></span>สระว่ายน้ำ</span>' +
        '<span class="badge"><span class="sw" style="background:' +
        COLORS.track +
        '"></span>ลู่ - ลาน</span>' +
        '<span class="badge"><span class="sw" style="background:' +
        COLORS.outdoor +
        '"></span>สนามกีฬากลางแจ้ง</span>' +
        '<span class="badge"><span class="sw" style="background:' +
        COLORS.badminton +
        '"></span>สนามแบดมินตัน</span>';

      // รายสนาม
      var venueSections = document.querySelectorAll(".venue");
      for (var i = 0; i < venueSections.length; i++) {
        var sec = venueSections[i];
        var th = sec.getAttribute("data-venue") || "";
        var k = keyByThai(th);
        var sum = totals.filter(function (x) {
          return x.venue === th;
        })[0] || { student: 0, staff: 0 };

        new Chart(sec.querySelector(".pie-venue"), {
          type: "pie",
          data: {
            labels: ["นิสิต", "บุคลากร"],
            datasets: [
              {
                data: [sum.student, sum.staff],
                backgroundColor: [COLORS.badminton, COLORS.pool],
              },
            ],
          },
          options: { legend: { display: false } },
        });

        new Chart(sec.querySelector(".line-venue"), {
          type: "line",
          data: {
            labels: days,
            datasets: [
              {
                label: th,
                data: (data.day_rows || []).map(function (r) {
                  return (
                    ((r[k] && r[k].student) || 0) + ((r[k] && r[k].staff) || 0)
                  );
                }),
                borderColor: COLORS[k] || COLORS.pool,
                fill: false,
                lineTension: 0.25,
                pointRadius: 0,
              },
            ],
          },
          options: {
            legend: { display: false },
            scales: { yAxes: [{ ticks: { beginAtZero: true } }] },
          },
        });
      }

      // ตารางรายวัน
      var tbody = document.querySelector("#daily tbody");
      var sum_pool_s = 0,
        sum_pool_t = 0,
        sum_track_s = 0,
        sum_track_t = 0,
        sum_out_s = 0,
        sum_out_t = 0,
        sum_badm_s = 0,
        sum_badm_t = 0,
        sum_all = 0;
      (data.day_rows || []).forEach(function (r) {
        var ps = r.pool.student || 0,
          pt = r.pool.staff || 0,
          ts = r.track.student || 0,
          tt = r.track.staff || 0,
          os = r.outdoor.student || 0,
          ot = r.outdoor.staff || 0,
          bs = r.badminton.student || 0,
          bt = r.badminton.staff || 0;
        var total = ps + pt + ts + tt + os + ot + bs + bt;

        sum_pool_s += ps;
        sum_pool_t += pt;
        sum_track_s += ts;
        sum_track_t += tt;
        sum_out_s += os;
        sum_out_t += ot;
        sum_badm_s += bs;
        sum_badm_t += bt;
        sum_all += total;

        var tr = document.createElement("tr");
        tr.innerHTML =
          "<td>" +
          r.day +
          "</td><td>" +
          ps +
          "</td><td>" +
          pt +
          "</td><td>" +
          ts +
          "</td><td>" +
          tt +
          "</td><td>" +
          os +
          "</td><td>" +
          ot +
          "</td><td>" +
          bs +
          "</td><td>" +
          bt +
          "</td><td>" +
          total +
          "</td>";
        tbody.appendChild(tr);
      });
      document.getElementById("sum_pool_s").textContent = sum_pool_s;
      document.getElementById("sum_pool_t").textContent = sum_pool_t;
      document.getElementById("sum_track_s").textContent = sum_track_s;
      document.getElementById("sum_track_t").textContent = sum_track_t;
      document.getElementById("sum_out_s").textContent = sum_out_s;
      document.getElementById("sum_out_t").textContent = sum_out_t;
      document.getElementById("sum_badm_s").textContent = sum_badm_s;
      document.getElementById("sum_badm_t").textContent = sum_badm_t;
      document.getElementById("sum_all").textContent = sum_all;
    });
})();

// โหมดพิมพ์อัตโนมัติ (สำหรับ wkhtmltopdf)
(function () {
  var p = new URLSearchParams(location.search);
  if (p.get("print") === "1") {
    setTimeout(function () {
      window.print();
    }, 600);
  }
})();
