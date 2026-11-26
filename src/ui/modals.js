import { assetUrl } from "../utils/assetUrl.js";

// Interactive Scratch Paper Pad & Two-Sided Keepsake Postcard Exporter

export function initScratchPad(dialogEl, getCopy) {
  const canvas = dialogEl.querySelector("#scratch-canvas");
  const ctx = canvas.getContext("2d");
  let drawing = false;
  let color = "#422c41";
  let strokes = [];
  let current = null;
  let wordIndex = 0;

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw();
  }

  function redraw() {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    for (const s of strokes) {
      if (s.type === "word") {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.angle);
        ctx.fillStyle = s.color;
        ctx.font = 'italic 600 22px Georgia, "Frank Ruhl Libre", serif';
        ctx.fillText(s.text, 0, 0);
        ctx.restore();
      } else {
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.width;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        s.pts.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
      }
    }
  }

  function getPos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    drawing = true;
    const pt = getPos(e);
    current = { type: "line", color, width: color === "#b56982" ? 3.5 : 2.3, pts: [pt] };
    strokes.push(current);
    redraw();
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!drawing || !current) return;
    current.pts.push(getPos(e));
    redraw();
  });

  canvas.addEventListener("pointerup", () => {
    drawing = false;
    current = null;
  });

  dialogEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-tool]");
    if (!btn) return;
    const tool = btn.dataset.tool;
    if (tool === "graphite" || tool === "berry" || tool === "rose") {
      color = tool === "graphite" ? "#463e44" : tool === "berry" ? "#7d3251" : "#b56982";
      dialogEl.querySelectorAll("button[data-ink]").forEach((b) => {
        b.setAttribute("aria-pressed", String(b === btn));
      });
    } else if (tool === "stamp") {
      const words = getCopy().scratch.words;
      const word = words[wordIndex % words.length];
      wordIndex++;
      const r = canvas.getBoundingClientRect();
      strokes.push({
        type: "word",
        text: word,
        color: "#7d3251",
        x: 34 + Math.random() * Math.max(80, r.width - 140),
        y: 44 + Math.random() * Math.max(80, r.height - 70),
        angle: (Math.random() - 0.5) * 0.24,
      });
      redraw();
    } else if (tool === "undo") {
      strokes.pop();
      redraw();
    } else if (tool === "clear") {
      strokes = [];
      redraw();
    }
  });

  return {
    open() {
      dialogEl.showModal();
      requestAnimationFrame(resizeCanvas);
    },
  };
}

export async function exportPostcardPng({ lang, copy, stops, stampSrc }) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 1600;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#fff5dd";
  ctx.fillRect(0, 0, 1200, 1600);

  const loadImage = (src) =>
    new Promise((res, rej) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = src;
    });

  const [frontImg, stampImg] = await Promise.all([
    loadImage(assetUrl("assets/prints/postcard-front.jpg")),
    loadImage(assetUrl(stampSrc || "assets/prints/miloolita.jpg")),
  ]);

  ctx.drawImage(frontImg, 20, 20, 1160, 760);

  ctx.strokeStyle = "#b6a084";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 7]);
  ctx.beginPath();
  ctx.moveTo(0, 800);
  ctx.lineTo(1200, 800);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.moveTo(715, 865);
  ctx.lineTo(715, 1520);
  ctx.stroke();

  ctx.fillStyle = "#422c41";
  ctx.textAlign = "left";
  ctx.font = '700 48px "Bricolage Grotesque", "Rubik", sans-serif';
  ctx.fillText(copy.postcard.title, 64, 945);

  ctx.font = '24px "DM Sans", "Heebo", sans-serif';
  ctx.fillStyle = "#5c4b59";
  ctx.fillText(copy.postcard.stopsLabel, 66, 1005);

  ctx.fillStyle = "#422c41";
  ctx.font = '32px "DM Sans", "Heebo", sans-serif';
  const rows = stops.length ? stops.slice(-5) : [copy.postcard.defaultStop];
  rows.forEach((label, idx) => {
    const y = 1090 + idx * 78;
    ctx.fillText(label, 66, y, 600);
    ctx.fillStyle = "#c8b59b";
    ctx.fillRect(66, y + 16, 590, 1.5);
    ctx.fillStyle = "#422c41";
  });

  // Stamp
  const side = Math.min(stampImg.naturalWidth, stampImg.naturalHeight);
  ctx.drawImage(
    stampImg,
    (stampImg.naturalWidth - side) / 2,
    (stampImg.naturalHeight - side) / 2,
    side,
    side,
    972,
    860,
    160,
    160
  );
  ctx.strokeStyle = "#d9c5a6";
  ctx.lineWidth = 4;
  ctx.strokeRect(972, 860, 160, 160);

  const hour = new Date().getHours();
  const recipient =
    hour < 5 || hour >= 22
      ? copy.postcard.toNight
      : hour < 10
      ? copy.postcard.toMorning
      : copy.postcard.toDay;

  ctx.fillStyle = "#422c41";
  ctx.font = '600 34px "Bricolage Grotesque", "Rubik", sans-serif';
  ctx.fillText(recipient, 760, 1110, 380);
  ctx.font = '24px "DM Sans", "Heebo", sans-serif';
  ctx.fillStyle = "#5c4b59";
  ctx.fillText(copy.location, 760, 1168, 380);
  ctx.font = '20px "IBM Plex Mono", monospace';
  const stampDate = new Date().toLocaleTimeString(lang === "he" ? "he-IL" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  ctx.fillText(`${stampDate} · ORIN WINBERG`, 760, 1485, 380);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "postcard-from-orins-desk.png";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}
