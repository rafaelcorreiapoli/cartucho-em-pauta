# Main cast resolution sources

All eight playable characters have eight unique sheets (idle shares walk), 72 frames each. `manifest.json` records original source hashes, native image dimensions, grids and restoration prompts. The 46 original masters were recovered from the original image exports; the remaining 18 were restored with ImageGen using the existing action sheet and the character's original walk as references. Inputs and masters are archived here; none are downloaded by the game.

Rebuild with `uv run --with pillow --with numpy --with scipy python dev/hires-cast/build.py` from `apps/sessao`. The script crops native source cells, fits each pose uniformly to its original frame/ground anchor, centers walking frames, removes detached neighboring-frame fragments in combat poses, clears frame margins and exports lossless WebP at 128, 256 and 512. All tiers come from the same fitted master. The 512 tier is a normalized delivery size, not a claim that every source has 512 native pixels per frame: most walk/combat masters have 362, larger action masters have about 443–640. No independent generation happens per delivery tier.

Phone breathing uses one canonical painted pose with the original frame anchors to prevent line/face drift. Inês's restored fall frame 7 is mirrored back to the original right-facing direction during export. Eight-frame actions use a four-column/two-row atlas; maximum adaptive texture width is 2048.

The runtime preloads only 128 and lazily requests 256/512 for visible poses when actual render demand requires it. Camera coverage and actor world size remain fixed. Failed optional variants retain the loaded lower tier.

Open `/sprites.html`, choose a player, and use **Arte** to compare **Anterior**, **128**, **256** and **512**. The green bounds and outside margins remain available. Review notes are separate per tier. The old assets and earlier Tiririca/Lula experiments remain available for comparison. Restoration can still introduce small painting differences between frames; the lab is the place to review those separately from resolution correctness.
