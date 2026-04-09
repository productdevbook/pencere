import { bindPencere, PencereViewer } from "../src"
import type { ImageItem, Item } from "../src"
import type { Renderer } from "../src/dom/renderers"

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

// ─── Media & custom renderers ─────────────────────────────────────
// Second viewer that mixes a public-domain video, a sandboxed
// iframe, and a `custom:text` item driven by a user-supplied
// renderer. Wired to the buttons in the "More features" section so
// reviewers can click through each renderer path live.

const textRenderer: Renderer = {
  canHandle(item): item is Item {
    return item.type === "custom:text"
  },
  mount(item, { document: doc }) {
    const wrap = doc.createElement("article")
    wrap.style.cssText = "max-width:60ch;padding:2rem;color:inherit;font:inherit;text-align:center;"
    const data = (item as { data: { title: string; body: string } }).data
    const h = doc.createElement("h2")
    h.textContent = data.title
    h.style.marginTop = "0"
    const p = doc.createElement("p")
    p.textContent = data.body
    wrap.append(h, p)
    return wrap
  },
}

const mediaItems: Item[] = [
  {
    type: "video",
    src: "https://cdn.jsdelivr.net/gh/mediaelement/mediaelement-files@master/big_buck_bunny.mp4",
    poster: "https://images.unsplash.com/photo-1535016120720-40c646be5580?w=1200",
    alt: "Big Buck Bunny (Blender open movie) — public domain clip",
    caption: "Big Buck Bunny — open-movie project, public domain",
  },
  {
    type: "iframe",
    src: "https://en.wikipedia.org/wiki/Lightbox_(JavaScript)",
    alt: "Wikipedia article: Lightbox (JavaScript)",
    caption: "Embedded with sandbox + strict-origin referrer",
  } as Item,
  {
    type: "custom:text",
    data: {
      title: "Custom renderers",
      body: "This slide is not an image, video, or iframe — it is a plain <article> element produced by a user-supplied renderer passed to PencereViewer({ renderers: [...] }). Any HTMLElement works.",
    },
    alt: "Custom renderer demo",
    caption: "custom:text rendered via user Renderer",
  } as Item,
]

const mediaViewer = new PencereViewer<Item>({
  items: mediaItems,
  loop: true,
  renderers: [textRenderer],
})

for (const id of ["open-video", "open-iframe", "open-custom"]) {
  const index = { "open-video": 0, "open-iframe": 1, "open-custom": 2 }[id]!
  document.getElementById(id)?.addEventListener("click", () => {
    void mediaViewer.open(index)
  })
}

// ─── Per-feature live demos under "More features" ────────────────
// Each snippet in the docs gets a runnable button so reviewers can
// trigger the behaviour being described without having to build
// their own test harness.

// 1) bindPencere() — render two declarative anchors then scan.
const bindStrip = document.getElementById("bind-demo")
if (bindStrip) {
  bindStrip.innerHTML = `
    <a href="${items[0]!.src}" data-pencere data-gallery="bind-demo"
       data-alt="${items[0]!.alt}" data-caption="${items[0]!.caption ?? ""}">
      <img src="${items[0]!.thumb}" alt="${items[0]!.alt}" loading="lazy" />
    </a>
    <a href="${items[1]!.src}" data-pencere data-gallery="bind-demo"
       data-alt="${items[1]!.alt}" data-caption="${items[1]!.caption ?? ""}">
      <img src="${items[1]!.thumb}" alt="${items[1]!.alt}" loading="lazy" />
    </a>
  `
  bindPencere("#bind-demo [data-pencere]")
}

// 2) Hash routing — write #p3 then let openFromLocation pick it up.
document.getElementById("open-hash")?.addEventListener("click", () => {
  location.hash = "#p3"
  void viewer.openFromLocation()
})

// 3) Thumbnail → lightbox morph — reuse the main viewer but pass
//    the dedicated big thumbnail as the trigger so the UA morph
//    animates visibly from this spot on the page instead of the
//    small gallery thumbnails above.
const morphBtn = document.getElementById("open-morph") as HTMLButtonElement | null
morphBtn?.addEventListener("click", () => {
  void viewer.open(0, morphBtn)
})

// 4) Fullscreen — a second viewer opted into fullscreen so enabling
//    it in the main gallery doesn't surprise first-time visitors.
const fullscreenViewer = new PencereViewer({ items, loop: true, fullscreen: true })
document.getElementById("open-fullscreen")?.addEventListener("click", async () => {
  await fullscreenViewer.open(0)
  await fullscreenViewer.toggleFullscreen()
})

// 5) Responsive picture with AVIF/WebP sources — dedicated viewer.
// The `sources` array triggers the <picture> wrapper in
// image-loader.ts so reviewers can inspect the real AVIF/WebP
// fallback chain in devtools → Network / Elements.
const responsiveViewer = new PencereViewer({
  items: [
    {
      type: "image",
      src: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600&fm=jpg",
      srcset:
        "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&fm=jpg 800w, https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600&fm=jpg 1600w",
      sizes: "100vw",
      sources: [
        {
          type: "image/avif",
          srcset:
            "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&fm=avif 800w, https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600&fm=avif 1600w",
        },
        {
          type: "image/webp",
          srcset:
            "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&fm=webp 800w, https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600&fm=webp 1600w",
        },
      ],
      alt: "Responsive Yosemite",
      caption: "Served via <picture> with AVIF / WebP fallbacks",
    } as ImageItem,
  ],
})
document.getElementById("open-responsive")?.addEventListener("click", () => {
  void responsiveViewer.open(0)
})

// 6) Placeholder cross-fade — force a visible gradient placeholder
//    and throttle via a tiny delay so the cross-fade is observable
//    even on fast connections.
const placeholderViewer = new PencereViewer({
  items: [
    {
      type: "image",
      src: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1600",
      alt: "Milky way placeholder demo",
      caption: "Watch the gradient cross-fade into the decoded image",
      placeholder: "radial-gradient(circle at 30% 20%, #312e81 0%, #0f172a 60%, #020617 100%)",
    },
  ],
})
document.getElementById("open-placeholder")?.addEventListener("click", () => {
  void placeholderViewer.open(0)
})

// Tear every viewer down on page unload so HMR and Back-forward
// cache transitions don't leak listeners or constructable
// stylesheets attached to the host document.
window.addEventListener("beforeunload", () => {
  for (const v of [viewer, mediaViewer, fullscreenViewer, responsiveViewer, placeholderViewer]) {
    v.destroy()
  }
})
