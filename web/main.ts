import { PencereViewer } from "../src"
import type { ImageItem } from "../src"

const items: ImageItem[] = [
  {
    type: "image",
    src: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600",
    thumb: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=300",
    alt: "Mountain lake at sunrise",
    caption: "Yosemite Valley — photo by Bailey Zindel",
    width: 1600,
    height: 1067,
  },
  {
    type: "image",
    src: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1600",
    thumb: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=300",
    alt: "Rowboat on a turquoise alpine lake",
    caption: "Lago di Braies, Italy — photo by Luca Bravo",
    width: 1600,
    height: 1067,
  },
  {
    type: "image",
    src: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1600",
    thumb: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=300",
    alt: "Milky way over mountain silhouettes",
    caption: "Astrophotography — photo by Benjamin Voros",
    width: 1600,
    height: 1067,
  },
  {
    type: "image",
    src: "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=1600",
    thumb: "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=300",
    alt: "Wooden cabin reflected in a lake",
    caption: "Hallstatt-style cabin — photo by Eberhard Grossgasteiger",
    width: 1600,
    height: 1067,
  },
]

const viewer = new PencereViewer({ items, loop: true })

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
    void viewer.open(i)
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
