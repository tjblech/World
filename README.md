# TJ's World — Interactive Portfolio

A no-build, static, PWA-ready interactive portfolio. It is intentionally original: it uses the general idea of a walkable portfolio world, but none of Peter Oravec's artwork, map data, sprites, or written content.

## Run locally

Because the service worker needs HTTP, use a tiny local server instead of opening `index.html` directly:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Deploy to GitHub Pages

Upload the contents of this folder to a repository and enable GitHub Pages for the branch/folder you want to publish. There is no build step.

## Controls

- WASD / arrow keys: move
- E or Space: interact
- Escape: close modal
- Touch: virtual joystick + E button

## Current vertical slice

- Original 2400×1760 top-down city
- Smooth camera follow
- Building collisions
- Six interactive portfolio landmarks
- NPC dialogue
- Moving traffic
- Fountain/water animation
- Minimap
- Quick navigation
- Three collectible secrets
- PWA manifest + service worker
- Responsive mobile controls

## Good next upgrades

1. Replace procedural buildings with a custom pixel-art tileset.
2. Add indoor scenes for each landmark.
3. Turn Billiards Hall into a tiny playable pool challenge.
4. Add project screenshots and real project links.
5. Add audio/music with a mute control.
6. Add dialogue trees and more NPCs.
7. Add a larger map with a proper editor-driven tile pipeline.
