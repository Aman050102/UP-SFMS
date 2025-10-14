// ---- CSRF helper (Django) ----
function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== "") {
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.startsWith(name + "=")) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}
const csrftoken = getCookie("csrftoken");

// ---- API: ขอเช็คเอาต์สระ ----
async function poolCheckout() {
  const resp = await fetch("/pool/checkout/", {
    method: "POST",
    headers: { "X-CSRFToken": csrftoken },
    credentials: "same-origin",
  });
  return resp.json();
}

(function () {
  // ปุ่มเปิดจากไทล์ + ปุ่มเปิดจากเมนู (มีอาจไม่มีได้)
  const openBtn = document.getElementById("btn-open-checkout");
  const menuOpenBtn = document.getElementById("menu-open-checkout");

  // โมดัล + ปุ่มในโมดัล + แผ่น ok
  const modal = document.getElementById("checkout-modal");
  const okBtn = document.getElementById("btn-confirm");
  const cancelBtn = document.getElementById("btn-cancel");
  const sheet = document.getElementById("sheet-ok");

  // อ่านสถานะล็อกจาก data-attribute บน <body>
  const body = document.body;
  const isLocked = () => body.dataset.poolLocked === "1";

  function openModal() {
    modal?.setAttribute("aria-hidden", "false");
  }
  function closeModal() {
    modal?.setAttribute("aria-hidden", "true");
  }
  function showOk() {
    sheet?.setAttribute("aria-hidden", "false");
    setTimeout(() => sheet?.setAttribute("aria-hidden", "true"), 1400);
  }

  // เปิดโมดัลได้เฉพาะตอน “ล็อกจากสระ” เท่านั้น
  function handleOpenClick(e) {
    if (!isLocked()) {
      // ยังไม่เช็คอินสระ → ไม่ทำอะไรเลย (ตามสเปค)
      e?.preventDefault?.();
      return;
    }
    openModal();
  }

  openBtn?.addEventListener("click", handleOpenClick);
  menuOpenBtn?.addEventListener("click", handleOpenClick);

  cancelBtn?.addEventListener("click", closeModal);

  okBtn?.addEventListener("click", async () => {
    try {
      const data = await poolCheckout();

      // ปิดโมดัลเสมอ
      closeModal();

      if (data.status === "ok") {
        // เช็คเอาต์สำเร็จ → อัปเดตสถานะหน้าให้ปลดล็อกทันที
        body.dataset.poolLocked = "0";
        showOk();
      }
      // status === "noop" (ยังไม่ได้เช็คอิน) → เงียบไว้ตามสเปค
      // status === "error" → ถ้าอยากโชว์ก็ใช้ alert(data.message)
    } catch (err) {
      // dev log; โปรดปิดตอน production ถ้าอยากเงียบจริง ๆ
      // console.error("Checkout error:", err);
    }
  });

  // ปิดเมื่อคลิกนอกการ์ด
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
  // ปิดด้วย Esc
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
})();
