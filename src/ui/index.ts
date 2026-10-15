import { cardStyles } from "../shared/ui/cards/styles.js";
import { styles } from "./styles.js";
import { client } from "./client.js";
export const HTML = `<!doctype html>
<html lang="zh-CN">
    <meta charset="utf-8" /><meta
        name="viewport"
        content="width=device-width,initial-scale=1"
    /><title>每日助手</title>
    <link rel="stylesheet" href="/tokens.css" /><style>${styles}${cardStyles}</style>
    <body class="qb-page">
    <header>
        <h1>每日助手</h1>
        <p>
            定时通知与模块查询
        </p>
    </header>
    <nav id="nav" aria-label="功能导航"></nav>
    <div class="page-status"><div id="status" role="status" aria-live="polite">正在加载配置…</div><span id="busy" role="status">正在处理…</span><span id="dirty" role="status" hidden>有未保存的修改</span><button data-action="reload">刷新配置</button></div>
    <main id="app" tabindex="-1"></main>
    <dialog id="decision" aria-labelledby="decisionTitle">
        <h2 id="decisionTitle">确认操作</h2><p id="decisionText"></p>
        <div class="actions"><button id="decisionCancel">取消</button><button id="decisionAccept" class="primary">确定</button></div>
    </dialog>
    <script type="module">${client}  </script>
    </body>
</html>
`;
