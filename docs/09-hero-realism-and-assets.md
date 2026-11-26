# 09 – Hero v2: front-facing room, real assets

**Concept:** a front-facing architectural *section* of a living room. It opens as an empty concrete shell (one bulb, one window, sun patch) and is finished layer by layer on scroll. Camera dollies from a distant long-lens elevation (26°) into the doorway (42°).

| p | Layer |
|---|---|
| 0.00-0.10 | Empty shell: formwork concrete, raw screed, bare bulb, dust in the sun |
| 0.10-0.22 | Electrical & services: conduits draw in, switch boxes |
| 0.22-0.34 | False ceiling drops in with cove LEDs + downlights |
| 0.34-0.46 | Oak flooring sweeps front to back |
| 0.46-0.60 | Paint rolls up the walls; fluted oak wall built rib by rib (86 instanced ribs); skirting |
| 0.60-0.70 | Bronze-framed glazing; sheer curtain + drapes with real folds |
| 0.70-0.90 | Furniture, plants, art, pendants arrive |
| 0.88-1.00 | Lights on, CTA |

## Realism stack
- **Assets (CC0, Poly Haven):** 11 glTF models (armchair, lounge chair, marble coffee table, fluted credenza, pendant lamp, 2 plants, vases, basket) + PBR texture sets (oak laminate floor 2K, concrete formwork, plaster, oak veneer) + studio HDRI for image-based light. Compressed with `gltf-transform` (meshopt + WebP): **~9 MB total**, lazy-loaded behind a loader.
- **Modelled in code:** contemporary sofa (rounded, subdivided forms, sheen fabric), rug, curtains, cove ceiling, glazing, wall art, fluted wall.
- **Rendering:** physically-based lights, sun shadows through the window, ACES tone-mapping, ambient occlusion (GTAO), bloom, SMAA, contact shadows. Phones and low-core machines get a lighter path (no post-processing); the page also drops post-processing automatically if frame time is high. `?q=low` / `?q=high` forces a tier.

## Credits (CC0, no attribution required, listed as courtesy)
Poly Haven (polyhaven.com): modern_arm_chair_01, mid_century_lounge_chair, coffee_table_round_01, modern_wooden_cabinet, modern_ceiling_lamp_01, potted_plant_02, potted_plant_04, ceramic_vase_01/02, brass_vase_03, wicker_basket_01; textures laminate_floor_02, concrete_wall_008, plastered_wall_04, white_plaster_02, oak_veneer_01; HDRI brown_photostudio_02.

## Known limits / next
- The furniture set is stock CC0; some pieces (leather chairs) lean mid-century. A Homasm-specific set (Blender-modelled joinery, real swatches) is the path to a true brand look.
- Not yet tested on real phones/GPUs; tune `GTAOPass` samples and the adaptive threshold after device testing.
