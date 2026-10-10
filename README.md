# The Aurelia Residence — cinematic scroll tour

A scroll-controlled architectural film built from `realestate.mp4`. Scrolling down plays the walkthrough forward and scrolling up plays it in reverse. Text overlays for eight scenes are synced to the footage. Below the tour are property sections, a gallery, an enquiry form and an optional 3D model viewer.

It is a static site: plain HTML, CSS and ES modules. There is no build step and no npm dependencies.

## Run locally

The site uses ES modules, so it must be served over HTTP. Opening `index.html` from disk will not work.

**Windows (no install needed):** double-click `start.cmd`, or run:

```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1 -Port 8080
```

Then open http://localhost:8080/.

**Any other static server also works**, for example:
- `npx serve .`
- `python -m http.server 8080`

The server must support HTTP Range requests (all common servers do).

## Tests

With the server running, open http://localhost:8080/tests/scrub-test.html.

The test scrolls the tour forward and then backward. At each step it checks:
- that `video.currentTime` matches the scene map;
- that exactly the right caption is visible;
- seek latency;
- the scene-nav links.

The test shows **PASS** when everything checks out.

## Files

| Path | Purpose |
|---|---|
| `index.html` | Page structure |
| `js/config.js` | **Edit this.** Property name, specs, contact, scene timings, gallery |
| `js/tour.js` | Scroll → video controller (`ScrollTour`) |
| `js/carousel.js` | Room-by-room drag carousel (`Rail`) and gallery slideshow (`Slideshow`) |
| `js/main.js` | Smooth scroll, preloader, cursor, reveals, parallax, marquee, tabs, form and lightbox |
| `css/styles.css` | All styling (bone and copper theme) |
| `explore-3d.html`, `js/three-viewer.js` | Optional Three.js GLB viewer, separate from the film |
| `assets/video/tour-1080.mp4`, `tour-720.mp4` | Scrub-optimised encodes of `realestate.mp4` |
| `assets/images/` | Poster and stills extracted from the film |
| `tools/optimize-video.ps1` | Regenerates the videos and stills from `realestate.mp4` (needs ffmpeg) |
| `serve.ps1`, `start.cmd` | Local dev server with Range support |

## Video notes

The source `realestate.mp4` is 1920×1080, 30 fps, 37.0 s and 97.5 MB. It is unsuitable for scrubbing as delivered:
- **Sparse keyframes.** It has a keyframe only every ~5 s (8 in total), so each backward seek would decode up to ~150 frames.
- **No faststart.** The `moov` index sits at the end of the file.

`tools/optimize-video.ps1` re-encodes the source with these settings:
- a keyframe every 6 frames;
- no B-frames;
- `+faststart`;
- audio removed.

The result is 42 MB at 1080p (CRF 21) and 18 MB at 720p. In testing, seeks complete in roughly 4–16 ms.

The script also extracts the stills as lightly sharpened WebP files at quality 90, in three sizes (1920, 1280 and 800 px wide). The site serves them with `srcset`, so each screen downloads the right size. To regenerate only the images, add `-SkipVideo`.

At runtime the tour fetches the whole file into memory (a Blob URL), so seeks never wait on the network:
- 1080p is used on wide screens.
- 720p is used on phones and when Save-Data is on.

### Frame sequences

Pre-extracted image frames were evaluated and not used. 1,047 frames at 1080p WebP would be about 100–150 MB to download and over 8 GB as decoded bitmaps. The keyframe-dense MP4 gives smooth scrubbing at a fraction of the cost.

### The final shot

From **34.95 s to the end**, the source film cuts to a **different house**. It has a hipped roof, white render and a grey garage door. The tour therefore stops at 34.9 s on the balcony. Scene 08 ("The Final Reveal") then cross-fades to a still of the opening exterior, so the visitor finishes on the same bungalow.

If you re-render the film with a matching final exterior, re-run the optimiser with a larger `-TourEnd` value. Then update `MEDIA.duration` and the scene-08 timing in `js/config.js`.

## Scene map (verified against the footage)

| # | Scene | Video time | Scroll range |
|---|---|---|---|
| 01 | Arrival: exterior, garden, path | 0 – 7.6 s | 0 – 18 % |
| 02 | Entrance: steps, door dissolve (~9.1 s), foyer | 7.6 – 11.6 s | 18 – 30 % |
| 03 | Living & dining | 11.6 – 16.0 s | 30 – 42 % |
| 04 | Kitchen & marble island | 16.0 – 18.3 s | 42 – 51 % |
| 05 | Staircase & upper landing | 18.3 – 23.0 s | 51 – 63 % |
| 06 | Master bedroom → bathroom (~27.3 s) | 23.0 – 30.6 s | 63 – 78 % |
| 07 | Suite → balcony & garden | 30.6 – 34.85 s | 78 – 90 % |
| 08 | Final reveal (still of the opening exterior) | holds 34.85 s | 90 – 100 % |

To change a timing, edit `time` or `scroll` for that scene in `SCENES` in `js/config.js`. Deep links work too: `#scene-3` jumps to the living room.

## Property data

The site does **not** invent any property data. Every price, measurement, room count, address, contact detail, amenity and floor plan is `null` or empty in `js/config.js`. Each one renders as a dashed **To be confirmed** placeholder until you fill it in.

The "As seen in the film" list only describes what is visible on screen.

Two things are not connected yet:
- **Enquiry form.** Set `PROPERTY.enquiry.endpoint` to a JSON POST endpoint, such as Formspree or your own API. Until then, the form validates input and tells the visitor that online enquiries are not yet connected.
- **3D model.** See `assets/models/README.md`.

## Design and interaction

- **Preloader:** a counter driven by the real download progress of the film. It never holds visitors for more than 6 s; if the film is still loading, the tour starts with stills and switches to the video when it arrives.
- **Smooth scrolling:** [Lenis](https://github.com/darkroomengineering/lenis) 1.1.13, loaded from jsDelivr. If it can't load, the site falls back to native scrolling. It is disabled for reduced motion, and touch devices keep their native momentum.
- **Film:** the frame expands to full screen as you start scrolling. Headlines reveal word by word, tied to the scroll position. A rolling scene number, a timecode and scene dots sit over the footage.
- **After the film:** a statement that fills word by word, parallax images and a marquee that reacts to scroll speed.
- **Rooms carousel:** a draggable "Room by room" carousel. Each card's "Watch in the film" button jumps back to that scene.
- **Gallery:** a slideshow with directional wipes and autoplay. Autoplay pauses on hover, on focus and when off-screen. It also has thumbnails, swipe and a full-screen lightbox.
- **Feature list:** a cursor-following image preview on desktop, and inline thumbnails on touch screens.
- **Details:** accessible tabs (arrow keys, Home and End).
- **Pointer effects:** a custom cursor and magnetic buttons, on devices with a mouse only.

## Accessibility and performance

- **Scroll listener:** one passive listener drives one rAF loop, and the loop idles when nothing is changing. DOM writes only happen when a value changes.
- **Scrubbing:** the shown time eases toward the target at about 145 ms to 90 %. A new seek is only issued after the previous one completes.
- **Loading:** stills are shown while the film loads, so scrolling is never blocked.
- **Reduced motion:** with `prefers-reduced-motion`, the tour uses still frames per scene instead of scrubbing.
- **Video failure:** if the video can't load, the same still-frame fallback is used.
- **Keyboard:**
  - a "Skip the film tour" link;
  - focusable scene-nav buttons with `aria-current`;
  - a menu that handles focus and closes on Escape;
  - a dialog-based lightbox with arrow-key navigation.
- **Layout:** the sticky section is ordinary page scroll. It never captures the wheel, so visitors can't be trapped.
