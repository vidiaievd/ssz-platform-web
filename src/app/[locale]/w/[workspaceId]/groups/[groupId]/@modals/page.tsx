// The group page itself has no modal. Without this match a client-side navigation to
// `…/groups/<id>` keeps the slot's previous content — a modal closed by replacing its URL
// (opened by a direct link, П7-4) would stay on screen. `default.tsx` covers only hard loads.
export default function NoModal() {
  return null;
}
