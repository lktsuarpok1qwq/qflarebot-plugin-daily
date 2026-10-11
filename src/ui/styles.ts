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
    font:
        14px/1.6 system-ui,
        sans-serif;
    background: var(--qb-bg);
    color: var(--qb-fg);
}
header {
    padding: 20px 24px 12px;
}
h1 {
    margin: 0;
    font-size: 22px;
    font-weight: 650;
}
header p {
    margin: 4px 0 0;
    color: var(--qb-fg-muted);
}
nav {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    padding: 0 24px 16px;
    border-bottom: 1px solid var(--qb-border);
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
    border-radius: 6px;
    padding: 6px 10px;
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
    background: var(--qb-accent);
    color: var(--qb-on-accent);
    border-color: var(--qb-accent);
}
nav button {
    border-color: transparent;
    background: transparent;
}
button.danger {
    color: var(--qb-danger);
}
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
:where(button, input, select, textarea, summary, a):focus-visible {
    outline: 2px solid var(--qb-accent);
    outline-offset: 3px;
}
input[readonly] {
    background: var(--qb-surface-muted);
    color: var(--qb-fg-muted);
}
main,
.page-status {
    max-width: 1300px;
    margin: 0 auto;
    padding: 0 24px;
}
main {
    padding-bottom: 24px;
}
.page-status {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 60px;
    padding-top: 12px;
    padding-bottom: 12px;
}
.page-status button {
    flex-shrink: 0;
    margin-left: auto;
}
#status {
    min-width: 0;
    overflow-wrap: anywhere;
    color: var(--qb-fg-muted);
}
#dirty {
    flex-shrink: 0;
    color: var(--qb-warning);
    font-size: 13px;
}
section {
    background: var(--qb-surface);
    border: 1px solid var(--qb-border);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 16px;
    min-width: 0;
    scroll-margin-top: 16px;
}
h2 {
    font-size: 17px;
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
.copy-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
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
select[multiple] {
    min-height: 110px;
}
#busy {
    display: none;
}
body.busy #busy {
    display: inline;
}
dialog {
    border: 1px solid var(--qb-border);
    border-radius: 8px;
    padding: 20px;
    width: min(520px, 90vw);
    max-height: 85vh;
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
    header,
    nav,
    main,
    .page-status {
        padding-left: 12px;
        padding-right: 12px;
    }
    section {
        padding: 12px;
    }
    .copy-grid {
        grid-template-columns: minmax(0, 1fr);
    }
    .page-status {
        flex-wrap: wrap;
        gap: 8px;
    }
    #status {
        flex: 1 1 180px;
    }
    button,
    input,
    select {
        min-height: 40px;
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
        min-height: 36px;
    }
}
.markdown-workspace {
    margin: 16px 0;
}
.markdown-editor {
    min-width: 0;
}
.markdown-editor :focus-visible {
    outline-offset: -2px;
}
.local-preview {
    margin: 12px 0;
    min-width: 0;
}
@media (min-width: 900px) {
    .markdown-workspace {
        display: grid;
        grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
        gap: 20px;
        height: 480px;
    }
    .markdown-editor {
        overflow: auto;
        scrollbar-gutter: stable;
        padding-right: 8px;
    }
    .markdown-editor textarea {
        min-height: 160px;
    }
    .markdown-editor > label:only-of-type textarea {
        min-height: 340px;
    }
    .markdown-workspace > .local-preview {
        margin: 0;
        display: flex;
        flex-direction: column;
    }
    .markdown-workspace > .local-preview .message-preview {
        flex: 1;
        min-height: 0;
    }
}
.local-preview h3 {
    font-size: 14px;
    margin: 0;
}
.local-preview .message-preview {
    margin-top: 8px;
    height: 160px;
    overflow: auto;
}
.variable-reference h4 {
    margin: 12px 0 0;
    font-size: 13px;
}
.variable-reference {
    margin: 16px 0;
}
.variable-reference h3 {
    margin: 0;
    font-size: 14px;
}
.variable-reference code {
    overflow-wrap: anywhere;
}
.subnav {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0 0 16px;
}
`;
