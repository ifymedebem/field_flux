# Fieldflux

A browser-local workspace for manual closed-loop chamber measurements from a LI-COR LI-7810. It calculates CO₂ and CH₄ flux, manages field conditions and projects, matches GPS tracks, and exports charts and results.

## Run

Requires Node.js 18+ for the build and tests. There are no npm dependencies to install.

```sh
npm run build
npm test
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000. Use HTTP rather than opening `index.html` directly. Service workers work on localhost and HTTPS; other plain-HTTP hosts cannot provide offline installation.

## Deploy and use offline

Run `npm run build`, then serve the complete `dist/` directory from an HTTPS static host. No API, server-side database, secrets or paid processing service is required. Hosting terms are determined by the chosen provider.

The build regenerates `dist/sw.js` with a content-derived cache version. Run it after every source or asset change. Never deploy a changed app with an old service worker build.

Open online once, wait for **Offline ready**, then use **Install app** or the browser's installation menu. On iPhone/iPad use Safari → Share → Add to Home Screen. Imports, calculations, GPS matching, charts and exports work locally after the app files are cached. Online updates wait for **Apply update**. Browser support and installation behavior vary, and clearing site storage can remove saved projects and offline files. Export backups regularly.

This repository has no hosting-account binding. If deploying with a hosted-site service, create a new project and use its newly assigned identity; do not assume an existing deployment is linked to this repository.

## Workflow

1. Create or select a named project. Chamber geometry can start empty or be copied from another project.
2. Add one or more LI-COR `.data` recordings. New files append to the project. Duplicate filenames are skipped within the project; the same filename can be used in another project.
3. Enter chamber headspace, exposed collar headspace and tubing/loop volume in litres, plus soil surface area in m². Apply geometry to project readings, with per-reading overrides where needed.
4. Import Excel/CSV field conditions. Use `id, date, start_time, end_time, temperature, pressure`; `end_time` is optional. Temperature is chamber-air °C; pressure is absolute kPa. The template also offers an optional `source_file` column.
5. Import a timestamped GPS track or ID-based coordinates. Review estimates and matching evidence.
6. Inspect flux time series, single-closure concentrations, R², campaign summaries and the measurement register. Export CSV results or PNG/JPG visualizations.

## Two separate clocks

The field-condition timestamp places a measurement on its actual timeline. Its `.data` remark period identifies the concentration samples and elapsed duration used for regression. The analyser's absolute clock can differ from the field clock without changing which samples are fitted.

For example, a field start of 14:00 combined with a 200-second analyser remark period gives a plotted interval of 14:00–14:03:20. The field sheet's end time does not stretch or truncate the analyser samples.

Missing or malformed field times do not block conditions import or flux calculation. A reading needs a valid field time to appear on the actual-time timeline; no analyser-clock substitute is silently used.

## Repeated point IDs

Repeated visits remain separate measurements, each with its own sample window, conditions, flux and R². Users do not need an occurrence column.

Repeated rows are ordered by field timestamp when available, otherwise by spreadsheet row order, and paired with chronological `.data` remark periods. Optional `source_file` narrows the recording. An optional `occurrence` or `measurement` column remains supported for explicit overrides. Identical duplicate rows are skipped with a note; genuinely conflicting assignments and more field measurements than available remark periods require review.

Automatic pairing assumes the field sheet and recordings represent the same measurement sequence. Review the assigned source and sample window if records are missing or clocks/order differ between files.

## Flux calculation

Ordinary linear regression estimates concentration slope against elapsed seconds. Flux is:

`F = slope × P × V / (R × T × A)`

- CO₂ in ppm/s returns µmol m⁻² s⁻¹; CH₄ in ppb/s returns nmol m⁻² s⁻¹.
- kPa is converted to Pa, °C to K and litres to m³.
- Effective volume includes chamber headspace, collar headspace **above the soil**, and tubing/loop gas volume. Do not count buried collar volume.
- Positive flux is emission; negative flux is uptake.
- Analyser `CAVITY_T` and `CAVITY_P` are not substituted for field conditions.
- Complete readings calculate automatically. Unreviewed readings are marked provisional rather than blocked. Missing geometry, conditions or usable gas samples remain explicit calculation blockers.
- No extra water-vapour correction or nonlinear chamber fitting is applied.

Separate remark periods form separate measurement windows. Brief same-label gaps of at most two seconds may be joined and noted; short periods and incomplete closures still need inspection.

Summary cards follow project, recording and point filters. Campaign flux is the equal-weight mean of included reading fluxes; fit quality is the median of individual R² values, not a pooled regression. Hourly/daily timeline means do not imply continuous measurements or cumulative site emissions. Site totals would require defensible spatial and temporal weighting.

## GPS and spatial display

Track CSVs can omit IDs if they contain timestamps, latitude and longitude. Epoch timestamps in seconds, milliseconds, microseconds or nanoseconds are supported. UTC timestamps are converted to the field clock with an editable offset; the initial setting is UTC+2 and must be checked for the field campaign.

Stationary periods are detected from speed, spatial radius, time continuity and reported horizontal accuracy. Median coordinates of fixes overlapping the field-time measurement interval provide an estimated location. The report includes fix counts, overlap, spread and accuracy. Missing/ambiguous matches do not receive guessed coordinates. Tracks can be uploaded before conditions and rematched later.

Defaults: 15 m stop radius, 60 s minimum dwell, 25 m maximum reported GPS error, 0.5 m/s maximum stationary speed, and a 10 s continuity gap. These are configurable heuristics, not proof that a phone was beside the chamber.

The spatial view defaults to flux-coloured measured points, grouping repeated visits into one signed mean per point/collar. Field-time filters and individual-reading mode are available. Optional heatmap smoothing uses a normalized Gaussian mean; colour is linear in flux and does not use density-dependent opacity. The colour maximum stays fixed across time-window changes unless explicitly set. GPS uncertainty rings are separate indicative overlays, not statistical confidence intervals. Blank ground is not measured zero flux, and a smoothed surface is not confirmation of an emission hotspot.

## Data and privacy

Projects, parsed recordings, settings and GPS tracks are kept in this browser's IndexedDB, with migration support for the earlier local-storage workspace. There is no shared cloud workspace or automatic synchronization between devices. Export results and retain original files for recovery.

Manage project data can remove a recording and its readings, clear field conditions/GPS, or clear a project's measurements while keeping the project name and chamber setup. Other projects are preserved. No user recordings, GPS tracks, field-condition files, account credentials or deployment identifiers are bundled in this version.

## Source and validation

- `dist/app.js`: parsing, project management, regression, conditions import, charts, summaries, spatial view and persistence.
- `dist/gps-track.js`: timestamped GPS import, stationary periods and match reports.
- `dist/export-images.js`: local PNG/JPG exports with metadata and legends.
- `dist/offline-app.js`, `dist/manifest.webmanifest`, `scripts/prepare-offline.mjs`: offline installation and updates.
- `tests/`: synthetic analysis, repeated-ID, two-clock, GPS, spatial-colour and offline/cache checks.

Tests cover calculation and import logic and simulated browser/service-worker behavior. They do not replace browser/device installation testing or scientific review of chamber measurements. For field use, verify **Offline ready** on the intended device and test its installed app before departure.
