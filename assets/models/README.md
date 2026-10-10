# Architectural model (optional)

The interactive viewer at `explore-3d.html` renders a **real** 3D model of the residence.
No model has been supplied yet, so that page currently shows a setup notice.

The film tour (`realestate.mp4`) is a video, not a 3D model. It cannot be converted into one.

## Adding a model

1. Export the architect's model as **GLB** (preferred) or GLTF.
   - Draco-compressed GLBs are supported.
   - Aim for under ~25 MB, with textures at 2K or less.
   - Use real-world scale with Y as the up axis.
2. Copy it here, e.g. `assets/models/residence.glb`.
3. In `js/config.js`, set:
   ```js
   model: { url: 'assets/models/residence.glb' },
   ```
4. Reload `explore-3d.html`. The camera frames the model automatically.
