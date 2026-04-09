import { PencereViewer } from "../src"
import type { ImageItem } from "../src"

const items: ImageItem[] = [
  {
    type: "image",
    src: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600",
    thumb: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=300",
    alt: "Mountain lake at sunrise",
    caption: "Yosemite Valley — photo by Bailey Zindel",
    longDescription:
      "A wide, low-saturation view of Yosemite Valley at dawn: the Merced river curves through the foreground, Half Dome rises on the right, and morning mist softens the conifers along the floor of the valley.",
    width: 1600,
    height: 1067,
    // Tiny 4-color CSS gradient stands in for a ThumbHash decode so
    // the placeholder cross-fade is visible even without a build step.
    placeholder: "linear-gradient(135deg, #1e293b 0%, #64748b 50%, #e2e8f0 100%)",
  },
  {
    type: "image",
    src: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1600",
    thumb: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=300",
    alt: "Rowboat on a turquoise alpine lake",
    caption: "Lago di Braies, Italy — photo by Luca Bravo",
    width: 1600,
    height: 1067,
    placeholder: "linear-gradient(180deg, #0f766e 0%, #14b8a6 40%, #a7f3d0 100%)",
  },
  {
    type: "image",
    src: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1600",
    thumb: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=300",
    alt: "Milky way over mountain silhouettes",
    caption: "夜空の銀河 — photo by Benjamin Voros",
    // Per-slide lang attribute triggers Japanese font stack via
    // --pc-font-cjk-ja (consumer overrides the custom property).
    lang: "ja",
    width: 1600,
    height: 1067,
    placeholder: "radial-gradient(circle at 30% 20%, #312e81 0%, #0f172a 60%, #020617 100%)",
  },
  {
    type: "image",
    src: "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=1600",
    thumb: "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=300",
    alt: "Wooden cabin reflected in a lake",
    caption: "Hallstatt-style cabin — photo by Eberhard Grossgasteiger",
    width: 1600,
    height: 1067,
    placeholder: "linear-gradient(160deg, #1f2937 0%, #475569 60%, #e5e7eb 100%)",
  },
]

// Enable the full feature set in the demo so reviewers can exercise
// routing (#p1, #p2 …), the thumbnail → lightbox morph via View
// Transitions, and the placeholder cross-fade together.
const viewer = new PencereViewer({
  items,
  loop: true,
  routing: true,
  viewTransition: true,
})

// On load, honour a `#p{n}` fragment so sharing the URL opens the
// same slide that was visible when the link was copied.
void viewer.openFromLocation()

const gallery = document.getElementById("gallery")!
items.forEach((item, i) => {
  const btn = document.createElement("button")
  btn.type = "button"
  btn.setAttribute("aria-label", `Open ${item.alt ?? "image"}`)
  const img = document.createElement("img")
  img.src = item.thumb ?? item.src
  img.alt = item.alt ?? ""
  img.loading = "lazy"
  btn.appendChild(img)
  btn.addEventListener("click", () => {
    // Pass the clicked thumbnail as the view-transition trigger so
    // the UA morphs thumbnail → lightbox image on browsers that
    // support document.startViewTransition.
    void viewer.open(i, btn)
  })
  gallery.appendChild(btn)
})

// RTL toggle demo — flipping <html dir> is enough; pencere's `dir: "auto"`
// default will pick the new direction up the next time the viewer opens.
const rtlToggle = document.getElementById("toggle-rtl")
const rtlState = document.getElementById("rtl-state")
rtlToggle?.addEventListener("click", () => {
  const html = document.documentElement
  const next = html.dir === "rtl" ? "ltr" : "rtl"
  html.dir = next
  if (rtlState) rtlState.textContent = `currently: ${next}`
})

// Light analytics demo so the "Events" snippet in the docs has a
// corresponding live wiring that you can watch in DevTools.
viewer.core.events.on("change", ({ index }) => {
  console.info("[pencere] change →", index + 1)
})
viewer.core.events.on("close", ({ reason }) => {
  console.info("[pencere] closed via", reason)
})
