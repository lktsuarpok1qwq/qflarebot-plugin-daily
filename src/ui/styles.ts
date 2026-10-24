export const styles = String.raw`
* {
    box-sizing: border-box;
    scrollbar-width: thin;
    scrollbar-color: var(--qb-fg-muted) transparent;
}
::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}
::-webkit-scrollbar-track {
    background: transparent;
}
::-webkit-scrollbar-thumb {
    background: var(--qb-fg-muted);
    border-radius: 6px;
}
::-webkit-scrollbar-corner {
    background: transparent;
}
body {
    margin: 0;
    font: var(--qb-text-base) / var(--qb-leading) var(--qb-font-sans);
    background: var(--qb-bg);
    color: var(--qb-fg);
}
nav {
    display: flex;
    gap: 12px 8px;
    flex-wrap: wrap;
    padding: 0 24px 16px;
    border-bottom: 1px solid var(--qb-border);
}
body > #nav {
    max-width: 1300px;
    margin-inline: auto;
    padding-top: var(--qb-space-4);
}
button,
input,
select,
textarea {
    font: inherit;
    max-width: 100%;
    min-width: 0;
    min-height: 36px;
    background: var(--qb-input);
    color: var(--qb-fg);
    border: 1px solid var(--qb-border-strong);
    border-radius: var(--qb-radius);
    padding: 6px 10px;
}
button {
    border-radius: var(--qb-radius-full);
}
.select-picker-slot {
    display: block;
    min-width: 0;
}
.select-picker-slot > select {
    width: 100%;
}
.select-picker-slot.picker-open {
    height: var(--picker-height);
}
.picker-open > select {
    position: fixed;
    top: var(--picker-top);
    left: var(--picker-left);
    width: var(--picker-width);
    margin: 0;
    z-index: 20;
}
button {
    cursor: pointer;
    background: var(--qb-surface);
    overflow-wrap: anywhere;
}
button:hover:not(:disabled) {
    border-color: var(--qb-accent);
}
button.primary,
nav button.active {
    background: var(--qb-primary);
    color: var(--qb-on-primary);
    border-color: var(--qb-border-strong);
}
nav button {
    border-color: transparent;
    background: transparent;
}
button.danger { color: var(--qb-danger); background: var(--qb-danger-bg); }
button.destructive { color: var(--qb-on-danger, white); background: var(--qb-danger); }
button.primary:hover:not(:disabled) { background: var(--qb-primary-hover); }
[aria-invalid="true"] { border-color: var(--qb-danger); }
.field-error { display: block; color: var(--qb-danger); font-size: var(--qb-text-sm); margin: 6px 0 0; }
.field-error[hidden] { display: none; }
.setting-fields { display: grid; gap: var(--qb-space-4); }
.setting-field { display: grid; grid-template-columns: minmax(0, 1fr) minmax(200px, 380px); gap: 6px var(--qb-space-6); align-items: center; }
.setting-meta { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.setting-control { min-width: 0; }
.setting-control > input:not([type="checkbox"]), .setting-control > select { width: 100%; }
.setting-check .setting-control { display: flex; justify-content: flex-end; align-items: center; min-height: var(--qb-control-height); }
.setting-field > .field-error { grid-column: 1 / -1; margin: 0; }
.setting-field label { margin: 0; }
.setting-field small { line-height: var(--qb-leading); }
@media (max-width: 760px) { .setting-field { grid-template-columns: minmax(0, 1fr); }.setting-check .setting-control { justify-content: flex-start; } }
.section-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.section-header h2, .section-header h3, .section-header .actions { margin: 0; }
.skeleton-line { height: var(--qb-control-height); background: var(--qb-border); border-radius: var(--qb-radius); margin-top: 12px; }
.loading-placeholder { padding: 16px; color: var(--qb-fg-muted); background: var(--qb-surface-muted); border-radius: var(--qb-radius); }
.toast-stack { position: fixed; right: 16px; bottom: 16px; z-index: 100; display: flex; flex-direction: column; gap: 8px; max-width: min(380px, calc(100vw - 32px)); pointer-events: none; }
.toast { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: var(--qb-surface); border: 1px solid var(--qb-border); border-radius: var(--qb-radius-lg); box-shadow: var(--qb-shadow); pointer-events: auto; overflow-wrap: anywhere; }
.toast span { min-width: 0; flex: 1; white-space: pre-wrap; }
.toast.error { border-color: var(--qb-danger); }
.toast button { background: transparent; border: 0; padding: 0 4px; }
@media (max-width: 600px) { .toast-stack { top: 16px; bottom: auto; left: 16px; right: 16px; max-width: none; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; } }
button:disabled,
input:disabled,
select:disabled,
textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}
body.busy button:disabled {
    cursor: wait;
}
.qb-page :where(button, input, select, textarea, summary, a):focus-visible {
    outline: 2px solid var(--qb-ring);
    outline-offset: -3px;
}
.qb-page button.primary:focus-visible,
.qb-page nav button.active:focus-visible {
    outline-color: var(--qb-ring);
}
.variable-composition {
    min-width: 0;
    overflow-wrap: anywhere;
    margin-top: 4px;
}
.variable-composition summary {
    cursor: pointer;
}
.variable-composition dl {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: 6px 12px;
    margin: 8px 0;
}
.variable-composition dd {
    margin: 0;
    overflow-wrap: anywhere;
}
input[readonly] {
    background: var(--qb-surface-muted);
    color: var(--qb-fg-muted);
}
main {
    max-width: 1300px;
    margin: 0 auto;
    padding: 16px 24px 24px;
}
#dirty {
    flex-shrink: 0;
    color: var(--qb-warning);
    font-size: 13px;
}
section {
    background: var(--qb-surface);
    border: 1px solid var(--qb-border);
    border-radius: var(--qb-radius-lg);
    padding: 16px;
    margin-bottom: 16px;
    min-width: 0;
    scroll-margin-top: 16px;
}
h2 {
    font-size: var(--qb-text-lg);
    margin: 0 0 12px;
    overflow-wrap: anywhere;
}
p {
    margin: 8px 0 12px;
    overflow-wrap: anywhere;
}
.grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr));
    gap: 12px 16px;
    align-items: start;
}
#weeklyFields {
    grid-column: 1 / -1;
    order: 1;
}
.grid > * {
    min-width: 0;
}
label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    color: var(--qb-fg);
    margin-bottom: 12px;
    overflow-wrap: anywhere;
}
.grid label {
    margin-bottom: 0;
}
label.check {
    flex-direction: row;
    align-items: center;
    min-height: 36px;
    gap: 8px;
}
input[type="checkbox"] {
    width: 16px;
    height: 16px;
    min-height: 0;
    flex-shrink: 0;
    margin: 0;
    accent-color: var(--qb-accent);
}
textarea {
    width: 100%;
    min-height: 104px;
    resize: vertical;
}
fieldset {
    margin: 16px 0 0;
    padding: 12px;
    border: 1px solid var(--qb-border);
    border-radius: 6px;
    min-width: 0;
}
.weekdays {
    margin-top: 0;
}
legend {
    padding: 0 6px;
    font-weight: 600;
}
.actions,
.row-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
}
.actions {
    margin: 12px 0;
}
.actions:last-child {
    margin-bottom: 0;
}
.row-actions {
    gap: 6px;
    min-width: 160px;
}
.row-actions button {
    min-height: 32px;
    padding: 4px 8px;
    font-size: 13px;
}
section > button + button {
    margin-left: 8px;
}
section > button {
    margin-block: 8px;
}
.table {
    overflow: auto;
    margin-top: 12px;
}
table {
    width: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
}
th,
td {
    text-align: left;
    border-bottom: 1px solid var(--qb-border);
    padding: 10px 12px;
    vertical-align: top;
    overflow-wrap: anywhere;
}
th {
    font-weight: 500;
    font-size: 13px;
    color: var(--qb-fg-muted);
    background: var(--qb-surface-muted);
    white-space: nowrap;
}
tr:last-child td {
    border-bottom: 0;
}
.empty {
    padding: 24px 12px;
    color: var(--qb-fg-muted);
    text-align: center;
}
small,
.muted {
    color: var(--qb-fg-muted);
}
small {
    font-size: 12px;
}
a {
    color: var(--qb-accent);
    overflow-wrap: anywhere;
}
pre {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    background: var(--qb-surface-muted);
    padding: 12px;
    border-radius: 6px;
}
.error {
    color: var(--qb-danger) !important;
}
.notice {
    border-left: 3px solid var(--qb-warning);
    padding: 8px 12px;
    background: var(--qb-warning-bg);
    margin: 12px 0;
}
details {
    margin: 12px 0;
}
summary {
    cursor: pointer;
    color: var(--qb-fg-muted);
    padding: 4px 0;
}
.viewport-probe {
    position: fixed;
    inset: 0;
    pointer-events: none;
}
dialog {
    position: fixed;
    inset: auto;
    top: var(--decision-top);
    left: var(--decision-left);
    transform: translate(-50%, -50%);
    margin: 0;
    border: 1px solid var(--qb-border);
    border-radius: var(--qb-radius-xl);
    padding: 20px;
    width: min(520px, calc(var(--decision-width) - 32px));
    max-height: calc(var(--decision-height) - 32px);
    overflow: auto;
    color: var(--qb-fg);
    background: var(--qb-surface);
}
dialog::backdrop {
    background: var(--qb-overlay);
}
.message-preview {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    padding: 16px;
    margin-top: 16px;
    border: 1px solid var(--qb-border);
    border-radius: 6px;
}
[hidden] {
    display: none !important;
}
@media (max-width: 600px) {
    nav,
    main {
        padding-left: 12px;
        padding-right: 12px;
    }
    section {
        padding: 12px;
    }
    button,
    input,
    select {
        min-height: var(--qb-touch-min);
    }
    table,
    tbody,
    tr,
    td {
        display: block;
        width: 100%;
    }
    thead {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
    }
    tr {
        padding: 12px 0;
        border-bottom: 1px solid var(--qb-border);
    }
    tr:last-child {
        border-bottom: 0;
    }
    td {
        display: grid;
        grid-template-columns: 88px minmax(0, 1fr);
        gap: 12px;
        border: 0;
        padding: 4px 0;
    }
    td::before {
        content: attr(data-label);
        color: var(--qb-fg-muted);
        font-size: 13px;
    }
    td.empty {
        display: block;
    }
    .row-actions {
        min-width: 0;
    }
    .row-actions button {
        min-height: var(--qb-touch-min);
    }
}
.markdown-workspace {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-areas: "source-tools preview-tools" "source preview";
    grid-template-rows: auto var(--editor-height, 320px);
    gap: 12px 24px;
    margin: 20px 0 16px;
}
.markdown-workspace > * { min-width: 0; }
.markdown-workspace h3 { margin: 0 0 8px; font-size: var(--qb-text-base); }
.markdown-source-tools { grid-area: source-tools; }
.markdown-preview-tools { grid-area: preview-tools; }
.markdown-source-tools .actions, .markdown-preview-tools .actions { margin: 8px 0; }
.markdown-source-tools label { margin: 0; }
.markdown-preview-tools label, .markdown-preview-tools p { margin-bottom: 0; }
.markdown-editor { grid-area: source; min-height: 0; }
.markdown-editor textarea { height: 320px; min-height: 160px; margin: 0; font-family: var(--qb-font-mono); }
.local-preview { display: flex; flex-direction: column; grid-area: preview; min-height: 0; overflow: hidden; background: var(--qb-surface-muted); border: 1px solid var(--qb-border); border-radius: var(--qb-radius); }
.local-preview .copy-layout { flex: 1; min-height: 0; overflow: auto; }
.local-preview .message-preview { margin: 0; border: 0; border-radius: 0; }
.markdown-preview-tools [aria-pressed="true"] { background: var(--qb-primary); color: var(--qb-on-primary); }
.variable-reference { margin: 16px 0; }
.variable-reference h3 { margin: 0 0 12px; font-size: var(--qb-text-base); }
.variable-reference h4 { margin: 12px 0; font-size: var(--qb-text-sm); }
.variable-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 12px; align-items: start; }
.variable-row { display: grid; grid-template-columns: max-content minmax(0, 1fr); align-items: center; gap: 8px; min-width: 0; }
.variable-row > .variable-composition { grid-column: 1 / -1; margin: 0; }
.variable-row > button { flex: none; font-family: var(--qb-font-mono); }
.variable-row > .hint { margin: 0; min-width: 0; line-height: 1.6; overflow-wrap: anywhere; }
.preview-image, .preview-image [data-image-content] { display: inline-block; max-width: 100%; overflow-wrap: anywhere; }
.preview-image img, .message-preview img { display: block; max-width: 100%; height: auto; }
.message-preview mark, .message-preview .sample-highlight { background: var(--qb-warning-bg); color: inherit; outline: 1px solid var(--qb-warning); border-radius: 2px; }
.message-preview .sample-break { background: transparent; outline: none; box-shadow: inset 0 -2px var(--qb-accent); }
.message-preview ul, .message-preview ol { padding-left: 24px; }
@media (max-width: 899px) {
    .markdown-workspace {
        grid-template-columns: minmax(0, 1fr);
        grid-template-areas: "source-tools" "source" "preview-tools" "preview";
        grid-template-rows: auto var(--editor-height, 320px) auto var(--editor-height, 320px);
        gap: 12px;
    }
}
.subnav {
    padding: 0;
    border-bottom: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 12px 8px;
    margin: 0 0 16px;
}

.message-buttons { margin-top: 20px; }
.reply-button-row { padding: 12px; border: 1px solid var(--qb-border); border-radius: 8px; margin: 12px 0; }
.reply-button-item { padding: 12px 0; }
.reply-button-item + .reply-button-item { border-top: 1px solid var(--qb-border); }
.message-buttons-preview { flex: none; display: grid; gap: 8px; padding: 0 16px 12px; max-height: 50%; overflow: auto; }
.message-buttons-preview:empty { display: none; }
.message-buttons-preview .actions { margin: 8px 0 0; }
@media (any-pointer: coarse) {
    .qb-page button, .qb-page input:not([type="checkbox"]), .qb-page select, .qb-page label.check, .qb-page summary, .qb-page .card-toggle {
        min-height: var(--qb-touch-min);
    }
}
`;
