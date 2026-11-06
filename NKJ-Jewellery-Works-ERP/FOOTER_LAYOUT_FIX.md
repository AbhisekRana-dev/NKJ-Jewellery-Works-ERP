# Shared Footer Consistency Fix

## What was wrong

1. `Footer.jsx` detected the public Home route and added a `jewellery-footer-home` modifier class.
2. `Home.css` used that modifier to change the footer grid and explicitly hide `.footer-developer`. As a result, Home displayed fewer footer sections and a different column arrangement from Login and the other pages.
3. `Footer.css` contained multiple overlapping owner-sidebar offset declarations, including older hard-coded widths (258px and 78px) and later variable-based declarations. The cascade made footer positioning difficult to reason about and maintain.

## What changed

- `Footer.jsx` now renders one consistent footer structure without route-specific variants.
- `Footer.css` now has one base footer layout and one owner-sidebar alignment rule using the shared sidebar-width CSS variable. Responsive layouts retain the same footer sections.
- `Home.css` no longer hides the developer attribution or changes the footer grid.
- The Home page content and invoice component/styles were not changed. The shared footer now renders on `/invoice` as requested, but the footer's print CSS hides it so the printed A4 invoice remains uncluttered.

## Files changed

- `frontend/src/shared/layouts/Footer.jsx`
- `frontend/src/shared/layouts/Footer.css`
- `frontend/src/features/home/Home.css`

The footer should now show the same brand, Quick Links, Contact Us, diamond decoration, developer attribution, and copyright sections on Home, Invoice, Login, setup, and owner pages. On owner pages only its horizontal start is offset to account for the fixed navigation sidebar.

## Validation

- The edited footer JSX passed a TypeScript JSX parser/transpilation check.
- The edited CSS files have balanced rule braces, and no Home-only footer modifier/override remains.
- A full Vite production build could not be run in this environment because `npm ci` did not finish and the Vite executable was therefore unavailable. On the local machine, run `npm ci` in `frontend/`, followed by `npm run build`.
