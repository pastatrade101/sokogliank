# UI Component Library

`src/components/ui` is the centralized component set for the web app.

## Layout
- `AppShell`: Topbar + sidebar + content layout with keyboard shortcuts and theme toggle.

## Inputs
- `Button`: `primary | secondary | ghost | danger`, `sm` and icon-only support.
- `Input`, `Select`, `Textarea`: labeled, token-styled form fields.
- `Toggle`: accessible switch component.
- `Tabs`: segmented tab navigation.

## Data + Surfaces
- `Card`: generic surface container.
- `StatCard`: KPI card on top of `Card`.
- `Table`: sortable + paginated table with row click callback.

## Overlays + Feedback
- `Modal`: center dialog.
- `Drawer`: side panel dialog.
- `ToastProvider` + `useToast`: top-right notifications.

## Navigation + Progress
- `Breadcrumbs`: route context.
- `Stepper`: linear progress checkpoints.

## States
- `EmptyState`: next best action for empty views.
- `ErrorState`: error + retry helper.
- `SkeletonLoader`: loading placeholder.

## Search + Filter
- `FiltersPanel`: filter layout wrapper.
- `SearchBar`: icon + input search field.
