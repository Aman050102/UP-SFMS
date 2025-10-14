const frame = document.getElementById("frame");
document.getElementById("btnPrint").addEventListener("click", () => {
  const w = frame.contentWindow;
  if (!w) return;
  if (w.document && w.document.readyState === "complete") {
    w.focus();
    w.print();
  } else {
    frame.addEventListener(
      "load",
      () => {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      },
      { once: true },
    );
  }
});

document.getElementById("btnRegen").addEventListener("click", async (ev) => {
  const btn = ev.currentTarget;
  btn.disabled = true;
  btn.textContent = "กำลังสร้าง...";
  try {
    const r = await fetch("{{ build_url }}");
    const j = await r.json();
    if (!j.ok) alert(j.message || "สร้างไฟล์ไม่สำเร็จ");
    else frame.src = "{{ source_pdf_url }}" + "?t=" + Date.now(); // refresh PDF
  } catch (e) {
    alert("สร้างไฟล์ไม่สำเร็จ");
  } finally {
    btn.disabled = false;
    btn.textContent = "สร้างใหม่";
  }
});
