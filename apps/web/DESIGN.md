# CarShare interface

Approved 3 November 2026: light surfaces, deep forest green, finding and renting cars first.

Direction reference: achromatic-ledger, seed 148200435; palette and typography adapted to the approved forest green direction. Vehicle photography and daily pricing are the signature elements. Search answers which car to choose; detail/checkout answer availability and total cost; trips answer the next action; owner screens answer which requests need attention; KYC answers what information is required. Production uses the existing API. Sample users and vehicles live only in `test-ui/redesign.spec.ts`.

## Foundation

- Local Be Vietnam Pro, Vietnamese glyphs included; font license in `public/fonts/OFL.txt`. No font request at build time.
- Canvas `#f6f8f6`, surface white, text `#17251e`, secondary `#536359`, primary `#176447`, hover `#104e37`, light primary `#edf4ef`.
- Tailwind `brand-*` and `slate-*` tokens live in `src/app/globals.css`. Inline styles use the same CSS variables. Amber marks pending work; red marks errors; green marks progress/success. Include a written status.
- Spacing: 4, 8, 16, 24, 32, 48, 64px. Panels 16px radius; controls 8px. Quiet borders; shadows reserved for menus and dialogs.
- One font family; headings 24–32px in app screens. The public rental introduction intentionally uses 48px desktop / 30px mobile, with a two-line headline.

## Structure

`SiteHeader` owns navigation for every route, including loading/error/anonymous states. Owner routes add a second navigation row. Pages have a `main-content` skip target.

The search page shows the actual supported filters (city, car type, Keyless). Filter requests guard against stale responses. Failed requests do not display zero results. Cards separate vehicle specs, review count and daily price.

Vehicle detail places the quote alongside the gallery on desktop; smaller layouts move it after the gallery/title, before secondary information. Preserve every backend price, fee and deposit line.

Dialogs use `useDialog` for Escape, focus containment, focus return and scroll locking. Their surfaces scroll within the viewport. Shared SVG `Icon` replaces decorative emoji. Controls have visible keyboard focus. Motion uses 160–220ms easing and respects reduced motion.

## Development and checks

Run `pnpm --filter @carsharing/web typecheck`, `pnpm --filter @carsharing/web build`, then `pnpm --filter @carsharing/web test:ui`.

`test-ui` intercepts API responses only inside the browser tests, never in production. It exercises search, races, pagination, account navigation, dialogs and responsive layouts. Existing `test:smoke` remains the integration suite and requires the API/database/media services. UI fixtures are not evidence of backend integration.

Keep API contracts, authorization, booking state changes and pricing calculations in their existing modules. Do not add simulated data or online/verification claims to hide connection errors.

## Rental flow refinement — 4 November 2026

Date errors belong beside the date inputs and block quoting until the range is valid. Insurance and trip filters announce selection. Checkout keeps its trip summary on submission failure and offers login/KYC prerequisites in context. Total amounts do not break across lines on phones. License forms start with empty personal dates and explain optional uploads. Errors support retry; status updates are announced without moving keyboard focus. Browser checks can target a separate local server with `UI_BASE_URL` to avoid interfering with the usual dev port.
