export const cardStyles = `
.card-editor-grid { display:grid;grid-template-columns:minmax(250px,1fr) minmax(280px,540px);gap:var(--qb-space-6,24px);align-items:start }
.card-editor-controls { min-width:0 }
.card-toolbar { max-width:540px }
.card-numbers { display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:end }
.card-features { margin-top:0 }
.card-control-group { padding:16px 0;border-bottom:1px solid var(--qb-border);margin-bottom:12px }
.card-control-group h3 { margin-top:0 }
.card-editor-controls label { display:flex;flex-direction:column;gap:6px;margin:8px 0 }
.card-toggle { display:flex;flex-direction:row;align-items:center;gap:8px;min-height:44px }
.card-toggle input { width:auto }
.card-preview-column { position:sticky;top:16px;min-width:0 }
.card-stage { position:relative;width:100%;max-width:540px;touch-action:none;outline:1px solid var(--qb-border);border-radius:10px;isolation:isolate }
.card-stage canvas,.card-stage #card-regions { position:absolute;inset:0;width:100%;height:100% }
.card-stage canvas { border-radius:10px }
.card-region-box { position:absolute;box-sizing:border-box;outline:1px dashed var(--qb-border-strong);outline-offset:-1px;cursor:move;touch-action:none }
.card-region-box.selected { outline:2px solid var(--qb-accent);outline-offset:-2px;background:color-mix(in srgb,var(--qb-accent) 6%,transparent) }
.card-region-box:focus-visible { box-shadow:inset 0 0 0 3px var(--qb-ring) }
.card-region-box span { position:absolute;top:0;left:0;font-size:12px;line-height:18px;padding:0 4px;color:var(--qb-on-accent);background:var(--qb-accent);pointer-events:none }
.card-region-box i { position:absolute;right:0;bottom:0;width:20px;height:20px;cursor:nwse-resize;border-right:4px solid var(--qb-accent);border-bottom:4px solid var(--qb-accent) }
.card-real-image { display:block;max-width:100%;height:auto;border-radius:10px }
#card-overflow { min-height:1.5em }
@media(max-width:760px) { .card-editor-grid { grid-template-columns:1fr }.card-preview-column { position:static }.card-toolbar { grid-template-columns:1fr } }
`;
