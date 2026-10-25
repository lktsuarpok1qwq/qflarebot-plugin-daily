export const feedback = String.raw`
function createFeedback(bridge) {
    let stack;

    return (message, error = false) => {
        if (bridge.embedded) {
            bridge.toast(message, error ? 'error' : 'success');

            return;
        }

        if (!stack) {
            stack = document.createElement('div');
            stack.className = 'toast-stack';
            document.body.append(stack);
        }

        while (stack.children.length >= 4) { stack.firstElementChild.remove(); }

        const toast = document.createElement('div'), text = document.createElement('span'), close = document.createElement('button');
        toast.className = 'toast' + (error ? ' error' : '');
        toast.setAttribute('role', 'status');
        text.textContent = message;
        close.textContent = '×';
        close.setAttribute('aria-label', '关闭提醒');
        close.onclick = () => toast.remove();
        toast.append(text, close);
        stack.append(toast);
        setTimeout(() => toast.remove(), error ? 6000 : 3000);
    };
}
`;
