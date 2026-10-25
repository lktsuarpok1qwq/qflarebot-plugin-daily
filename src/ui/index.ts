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
    <body class="qb-page" aria-label="每日助手">
    <nav id="nav" role="tablist" aria-label="功能导航"></nav>

    <main id="app" role="tabpanel" aria-busy="false" tabindex="-1"></main>
    <dialog id="decision" aria-labelledby="decisionTitle" aria-describedby="decisionText">
        <h2 id="decisionTitle">确认操作</h2><p id="decisionText"></p>
        <div class="actions"><button id="decisionCancel">取消</button><button id="decisionAccept" class="primary">确定</button></div>
    </dialog>
    <script type="module">${client}  </script>
    </body>
</html>
`;
