export const styles = String.raw`
* {
  box-sizing: border-box;
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
  background: var(--qb-surface);
  border-bottom: 1px solid var(--qb-border);
  padding: 22px 28px;
}
h1 {
  margin: 0;
  font-size: 24px;
}
header p {
  margin: 4px 0;
  color: var(--qb-fg-muted);
}
nav {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  padding: 16px 28px;
}
button,
input,
select,
textarea {
  font: inherit;
  background: var(--qb-input);
  color: var(--qb-fg);
  border: 1px solid var(--qb-border-strong);
  border-radius: 7px;
  padding: 8px 11px;
}
button {
  cursor: pointer;
  background: var(--qb-surface);
  color: var(--qb-fg);
}
button:hover {
  border-color: var(--qb-accent);
}
button.primary,
nav button.active {
  background: var(--qb-accent);
  color: var(--qb-on-accent);
  border-color: var(--qb-accent);
}
button.danger {
  color: var(--qb-danger);
}
button:disabled {
  opacity: 0.5;
  cursor: wait;
}
main {
  padding: 0 28px 32px;
  max-width: 1300px;
}
section,
.card {
  background: var(--qb-surface);
  border: 1px solid var(--qb-border);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 14px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  color: var(--qb-fg-muted);
}
label.check {
  flex-direction: row;
  align-items: center;
}
input[type="checkbox"] {
  width: 18px;
  height: 18px;
}
textarea {
  width: 100%;
  min-height: 100px;
  resize: vertical;
}
h2 {
  font-size: 18px;
  margin-top: 0;
}
.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 14px 0;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th,
td {
  text-align: left;
  border-bottom: 1px solid var(--qb-border);
  padding: 10px 8px;
  vertical-align: top;
}
th {
  font-weight: 500;
  color: var(--qb-fg-muted);
}
.table {
  overflow: auto;
}
small,
.muted {
  color: var(--qb-fg-muted);
}
pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background: var(--qb-surface-muted);
  padding: 12px;
  border-radius: 7px;
}
.pill {
  background: var(--qb-success-bg);
  color: var(--qb-success);
  padding: 2px 8px;
  border-radius: 20px;
}
#status {
  padding: 0 28px 14px;
  color: var(--qb-accent);
}
.error {
  color: var(--qb-danger) !important;
}
.notice {
  border-left: 3px solid var(--qb-warning);
  padding: 9px 14px;
  background: var(--qb-warning-bg);
  margin: 12px 0;
}
details {
  margin: 10px 0;
}
summary {
  cursor: pointer;
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
.row {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}
.wide {
  grid-column: 1/-1;
}
@media (max-width: 600px) {
  main,
  nav {
    padding-left: 12px;
    padding-right: 12px;
  }
  header {
    padding: 18px 12px;
  }
}
dialog {
  border: 1px solid var(--qb-border);
  border-radius: 12px;
  padding: 22px;
  width: min(520px, 90vw);
  color: var(--qb-fg);
  background: var(--qb-surface);
}
dialog::backdrop {
  background: var(--qb-overlay);
}
dialog textarea {
  width: 100%;
  min-height: 130px;
  margin: 12px 0;
}
[hidden] {
  display: none !important;
}
`;
