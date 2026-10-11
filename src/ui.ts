import { styles } from "./ui/styles.js";
import { client } from "./ui/client.js";
export const HTML = `<!doctype html>
<html lang="zh-CN">
    <meta charset="utf-8" /><meta
        name="viewport"
        content="width=device-width,initial-scale=1"
    /><title>每日助手</title>
    <link rel="stylesheet" href="/tokens.css" /><style>${styles}</style>
    <header>
        <h1>每日助手</h1>
        <p>
            北京时间 · 每个目标独立发送 · 过期不补发 <span id="busy">正在处理…</span>
        </p>
    </header>
    <nav id="nav"></nav>
    <div id="status" role="status" aria-live="polite"></div>
    <main id="app"></main>
    <dialog id="decision" aria-labelledby="decisionTitle">
        <h2 id="decisionTitle">确认操作</h2><p id="decisionText"></p>
        <div class="actions"><button id="decisionCancel">取消</button><button id="decisionAccept" class="primary">确定</button></div>
    </dialog>
    <script type="module">${client}  </script>
</html>
`;
