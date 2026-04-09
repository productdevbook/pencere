import { PencereViewer } from "../src"
import type { ImageItem } from "../src"

const items: ImageItem[] = [
  {
    type: "image",
    src: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600",
    thumb: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=300",
    alt: "Mountain lake",
    width: 1600,
    height: 1067,
  },
  {
    type: "image",
    src: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1600",
    thumb: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=300",
    alt: "River valley",
    width: 1600,
    height: 1067,
  },
  {
    type: "image",
    src: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1600",
    thumb: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=300",
    alt: "Starry mountains",
    width: 1600,
    height: 1067,
  },
  {
    type: "image",
    src: "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=1600",
    thumb: "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=300",
    alt: "Forest lake",
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
