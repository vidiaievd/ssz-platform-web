// Parallel-route fallback for the unnamed (children) slot. Next.js requires every
// slot to resolve on a direct/hard navigation to a deeper segment such as
// .../assign-teacher or .../add-students — those only exist inside @modals, so
// without this file the children slot has no match and the whole route 404s.
// Re-rendering the same page keeps the group detail visible behind the modal
// regardless of how the URL was reached (soft nav, hard reload, or a shared link).
export { default } from './page';
