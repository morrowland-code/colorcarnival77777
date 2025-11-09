// 🍓 Strawbebby random tips + popup messages

// cute list of random tips!
const bebbyTips = [
  "🎨 Use soft pressure for lighter shades!",
  "🍓 Save your palette often — she gets worried if you forget!",
  "✨ You’re doing amazing, sweet artist!",
  "🎠 Try matching your colors with the carnival theme!",
  "🌈 Don’t forget to hydrate and stretch!",
  "💖 Pink always makes things pop!",
  "🧁 Mix two colors for unique effects!",
  "🎢 Build color with gentle layers for perfect saturation!",
  "🌟 Keep your pencils sharp for clean edges!",
  "🎡 Remember: art is fun, not perfect!",
  "🍭 Don’t rush — even candy takes time to make!",
];

// 🎀 main function to show random bubble
function randomBebbyTip() {
  const tip = bebbyTips[Math.floor(Math.random() * bebbyTips.length)];
  const bebby = document.getElementById("strawbebby");

  if (!bebby) return console.warn("Strawbebby image not found!");

  // little wiggle
  bebby.classList.add("bebby-wiggle");
  setTimeout(() => bebby.classList.remove("bebby-wiggle"), 600);

  // popup message
  const bubble = document.createElement("div");
  bubble.innerText = tip;
  bubble.style.position = "fixed";
  bubble.style.bottom = "130px";
  bubble.style.right = "40px";
  bubble.style.padding = "10px 14px";
  bubble.style.borderRadius = "14px";
  bubble.style.background = "rgba(255, 255, 255, 0.95)";
  bubble.style.color = "#ff4d88";
  bubble.style.fontWeight = "600";
  bubble.style.fontSize = "13px";
  bubble.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
  bubble.style.maxWidth = "220px";
  bubble.style.textAlign = "center";
  bubble.style.zIndex = "9999";
  bubble.style.opacity = "0";
  bubble.style.transition = "opacity 0.3s ease";
  document.body.appendChild(bubble);

  // fade in
  setTimeout(() => (bubble.style.opacity = "1"), 50);

  // fade out and remove
  setTimeout(() => {
    bubble.style.opacity = "0";
    setTimeout(() => bubble.remove(), 800);
  }, 3500);
}

// optional: auto show a random tip every few minutes
setInterval(() => {
  if (Math.random() < 0.25) randomBebbyTip(); // 25% chance every 2 min
}, 120000);