---
name: generate-3d-models
description: Generate 3D assets for the raft-game project using Meshy T2 smart topology, targeting roughly 4,000 polygons per asset with 2K textures. Use when creating new models from reference images or asset descriptions.
---

# How to generate 3D models

## Project defaults

- Use Meshy T2: `ai_model: "meshy-t2"` and `model_type: "smart-topology"`.
- Target approximately **4,000 polygons per complete asset**, across all parts: `target_polycount: 4000`. This is a target, not a guaranteed output count.
- Generate textures in the same request: `should_texture: true` and `texture_resolution: "2k"` (2048 × 2048).
- Request `target_formats: ["glb"]` for this Decentraland project.
- Keep these defaults unless the user explicitly requests an exception. Do not silently substitute `latest`, a different Meshy model, or higher texture resolution.

## Workflow

1. Identify the requested asset and inspect any supplied reference image. Smart topology is a **single-image-to-3D** workflow; text-to-3D and multi-image-to-3D do not provide this mode. If only a description is supplied, create a suitable reference using the available image-generation workflow, or obtain an image from the user. Favor one isolated object, a clear silhouette, and a view that shows its shape without cropping.
2. Discover the current Meshy tools and read the image-to-3D schema. The project's `.codex/config.toml` configures the Meshy MCP server; never copy its API key into the skill, asset records, or output.
3. Present the concrete generation plan and credit cost before a paid request, honoring Meshy's tool requirements and any existing explicit cost approval. At authoring time, T2 geometry plus standard textures costs **15 credits per asset** (5 geometry + 10 textures); verify against the current tool description. Include any separately paid reference-image generation in the plan. Writing or invoking this skill alone does not authorize spending credits.
4. Call `meshy_image_to_3d` with the parameters below. Supply exactly one image source: an absolute `file_path` or an `image_url`. Do not manually encode the image as base64.

   ```json
   {
     "file_path": "/absolute/path/to/reference.png",
     "ai_model": "meshy-t2",
     "model_type": "smart-topology",
     "target_polycount": 4000,
     "should_texture": true,
     "texture_resolution": "2k",
     "target_formats": ["glb"]
   }
   ```

5. Record the returned task ID and poll with `meshy_get_task_status` using `task_type: "image-to-3d"`. Image-to-3D includes texturing; it does not need the text-to-3D refine step. If a request times out ambiguously, look for the existing task before submitting another paid generation. Stop on terminal failure and report the cause; additional paid attempts need coverage by the approved budget.
6. Download the successful GLB with `meshy_download_model` into the project's existing model asset directory, using a descriptive filename. Avoid overwriting an existing asset unless replacement was requested. Do not add a paid remesh, retexture, rig, or animation step unless needed for the request and covered by cost approval.
7. Inspect the downloaded model: check its appearance, total geometry count across parts, and actual texture dimensions. Report triangle counts separately from polygon/face counts when triangulation changes the number. Confirm textures are 2048 × 2048; flag any discrepancy instead of assuming the request was honored. Report the file path, task ID, measured counts, and any unverified properties. If scene integration is requested, follow the project's SDK/model-loading skills for placement, scale, and colliders.
