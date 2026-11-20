# Remaining world/UI high-resolution sources

This collection covers the nine visitors, both Federal officer animations, all nine fixed NPCs other than Donald Trump, furniture/equipment, inventory/shop images, project icons and the eight portraits used by the interface. Trump's sprite and portrait remain on their original paths without variants.

`manifest.json` archives the original image hashes, native dimensions, crop boxes and restoration prompts. Most art was recovered from the original larger exports. ImageGen restored the assets without suitable matching masters: Luciano Hang's three sheets, Nestor Cerveró's hit/fall, the Federal officer's breach animation, the terminal, extinguisher and incendiary icon. Marcos Valério's fall also corrects the older sheet's mismatched head using his canonical walk as reference. Restorations use the built-in image tool; inputs and selected masters are archived here.

Rebuild from `apps/sessao`:

```
uv run --with pillow --with numpy --with scipy python dev/hires-world/build.py
```

Optional positional prefixes restrict export, for example `project-` or `marcos-valerio-fall`. Sources remain independent of delivery resolution. `512` is a delivery size, not a claim of native 512 detail in every source: native sheet cells are mostly 320–362 pixels and project icon crops about 400 pixels. The exporter preserves aspect ratio and fits each image to its existing framing/ground anchor, removes detached neighboring-frame fragments in animations and adds transparent cell margins. Furniture is packed into two columns so every shipped texture stays within 2048×2048. Federal walk corrections are baked into the high tiers; its original 128 game texture retains the existing runtime correction.

Generated files live in `public/assets/world-hd`; `src/world-assets.json` registers shipped variants. Animated actors use the existing lazy Phaser selection. Static world art uses the same loader and preserves frame index, world size, origin and safe state. Only render demand above the original frame size requests a larger texture; off-camera static images are skipped. Browser images use native `srcset`/`sizes`; the portrait atlas uses CSS `image-set` for dense screens. Failing optional files retain the base art.

Open `/sprites.html` to inspect players, visitors, Federal, NPCs and **Objetos e interface**, comparing Anterior/128/256/512 with valid bounds and margins. Rectangular furniture and portrait atlases are shown as complete sheets. Original files remain available for comparison; artistic refinement is independent from resolution validation.
