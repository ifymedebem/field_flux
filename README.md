# field_flux
Fieldflux is a browser-local workspace for analysing CO₂ and CH₄ measurements from a LI-COR LI-7810 with a manual closed-loop chamber.

## Run locally

No build or dependency installation is required. From the repository root:

```sh
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000. Serve over HTTP rather than opening index.html directly, so the sample recording can load.

## Current version

- LI-COR `.data` upload with CO₂ in ppm and CH₄ in ppb.
- Separate chamber closure intervals with an initial mixing exclusion.
- Per-reading temperature, absolute pressure, chamber headspace, exposed collar headspace, tubing volume, and soil area.
- Excel/CSV metadata import matched on `id`; download the metadata template in the interface for column names.
- GPS import from Excel, CSV, or GeoJSON Point features matched on `id`.
- Ordinary linear regression, R², CO₂ and CH₄ flux, concentration traces, project filtering, spatial point maps, and CSV export.
- The original uploaded LI-COR recording is bundled as `dist/example.data` for the Load your sample action.

Flux uses slope × P × V / (R × T × A). CO₂ is reported in µmol m⁻² s⁻¹ and CH₄ in nmol m⁻² s⁻¹. Use chamber air measurements, not analyser cavity temperature or pressure. Collar volume includes only headspace above the soil. Times use the recording's local clock in `YYYY-MM-DD HH:mm:ss` format.

Data is saved in the current browser's local storage. Export results for backup. The workspace holds one gas recording at a time; replacing it clears existing reading intervals. GPS points are coloured and sized by measured flux; no spatial interpolation is applied. Map tiles require internet access. This version does not automatically detect closures, apply extra water-vapour corrections, or fit nonlinear models. Review each concentration trace, fit and instrument diagnostics before reporting flux.

## Files

- `dist/index.html`: responsive interface and styles.
- `dist/app.js`: parsing, regression, metadata import, mapping, persistence, and export.
- `dist/vendor/`: bundled SheetJS 0.20.3 and Leaflet 1.9.4 libraries.
- `dist/example.data`: supplied LI-COR recording.

The existing hosted private workspace is https://fieldflux-licor-lab.marvelousoffer1.chatgpt.site. This repository is a source snapshot; pushing here does not automatically deploy to that Site.

## Validation

JavaScript syntax and synthetic calculation checks passed for slope, flux units, uptake signs, mixing exclusion, R² and missing-input blocking. The supplied recording parsed as 8,484 records, including 7,294 valid concentrations per gas. Visual browser verification was unavailable because the preview relay failed.
