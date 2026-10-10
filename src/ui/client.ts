export const client = String.raw`
import { createBridge } from "/bridge.js";
const bridge = await createBridge();
let state,
  config,
  page = "tasks",
  backup,
  imported,
  restoreRevision,
  editingTask,
  testingTask,
  editingRecipient,
  editingHoliday,
  selectedCommand = "每日",
  logsOffset = 0,
  testRequests = new Map(),
  running = false,
  dirty = false,
  synchronized = false;
const $ = (id) => document.getElementById(id),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    ),
  uid = () => crypto.randomUUID();
const pages = {
  tasks: "任务管理",
  recipients: "发送对象",
  replies: "命令回复",
  holidays: "假期管理",
  status: "运行状态与备份",
};
const time = (n) =>
  n
    ? new Date(n).toLocaleString("zh-CN", {
        timeZone: "Asia/Shanghai",
        hour12: false,
      })
    : "无未来计划";
async function api(action, data) {
  const res = await bridge.fetch(
    "/api/" + action,
    data === undefined
      ? {}
      : {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(data),
        },
  );
  const value = await res.json();
  if (!res.ok) throw Error(value.error || "请求失败");
  return value;
}
function status(text, error = false) {
  $("status").textContent = text;
  $("status").className = error ? "error" : "";
}
function decide(message, value) {
  const dialog = $("decision"),
    input = $("decisionValue"),
    editing = value !== undefined;
  $("decisionText").textContent = message;
  $("decisionTitle").textContent = editing ? "编辑覆盖文本" : "确认操作";
  input.hidden = !editing;
  input.value = value ?? "";
  input.disabled = false;
  $("decisionAccept").disabled = false;
  $("decisionCancel").disabled = false;
  return new Promise((resolve) => {
    const close = (accepted) => {
      dialog.close();
      resolve(editing ? (accepted ? input.value : null) : accepted);
    };
    $("decisionAccept").onclick = () => close(true);
    $("decisionCancel").onclick = () => close(false);
    dialog.oncancel = (event) => {
      event.preventDefault();
      close(false);
    };
    dialog.showModal();
    (editing ? input : $("decisionCancel")).focus();
  });
}
const confirmAction = (message) => decide(message);
const promptText = (message, value) => decide(message, value);
async function run(fn) {
  if (running) return;
  running = true;
  document.body.classList.add("busy");
  document
    .querySelectorAll("button,input,select,textarea")
    .forEach((b) => (b.disabled = true));
  try {
    await fn();
  } catch (e) {
    status(e.message, true);
  } finally {
    running = false;
    document.body.classList.remove("busy");
    document
      .querySelectorAll("button,input,select,textarea")
      .forEach((b) => (b.disabled = false));
  }
}
async function load() {
  const fresh = await api("state");
  state = fresh;
  config = structuredClone(state.config);
  synchronized = true;
  dirty = false;
  render();
}
async function sendTest(taskId, recipientId, previewId, resultId) {
  if (dirty) throw Error("请先保存文案，再测试发送");
  const id = taskId + ":" + recipientId;
  if (!testRequests.has(id)) testRequests.set(id, uid());
  const box = $(resultId);
  box.hidden = false;
  box.textContent = "正在发送…";
  try {
    const result = await api("test", {
      taskId,
      recipientId,
      requestId: testRequests.get(id),
    });
    if (!["sending", "uncertain"].includes(result.status))
      testRequests.delete(id);
    if (result.text !== undefined) showMessage(previewId, result);
    const label = result.ok
      ? "发送成功"
      : result.status === "sending"
        ? "发送处理中"
        : result.status === "uncertain"
          ? "发送结果不确定，请到 QQ 查看"
          : "发送失败";
    box.textContent =
      label +
      (result.error ? "：" + result.error : "") +
      "\n\n" +
      JSON.stringify(result, null, 2);
    status(label, !result.ok);
  } catch (error) {
    box.textContent =
      "未获得发送结果：" + error.message + "。再次点击将查询同一次测试结果。";
    throw error;
  }
}
async function save(message = "已保存") {
  if (!synchronized) throw Error("配置状态未确认，请先刷新配置");
  const candidate = structuredClone(config),
    wasDirty = dirty;
  const draft = wasDirty
    ? [
        ...document.querySelectorAll(
          "#app input[id],#app textarea[id],#app select[id]",
        ),
      ]
        .filter((el) => el.type !== "file")
        .map((el) => ({
          id: el.id,
          value: el.value,
          checked: el.checked,
          selected: el.multiple
            ? [...el.selectedOptions].map((o) => o.value)
            : null,
        }))
    : [];
  // Do not let a rejected edit leak into a later unrelated save.
  config = structuredClone(state.config);
  try {
    await api("config", { revision: state.revision, config: candidate });
    synchronized = false;
    await load();
    status(message);
  } catch (error) {
    // A lost response can hide a successful save. Reconcile before more mutations.
    try {
      await load();
    } catch {
      synchronized = false;
    }
    for (const field of draft) {
      const el = $(field.id);
      if (!el) continue;
      if (field.selected)
        for (const option of el.options)
          option.selected = field.selected.includes(option.value);
      else el.value = field.value;
      if (field.checked !== undefined) el.checked = field.checked;
    }
    dirty = wasDirty;
    throw error;
  }
}
function options(items, selected) {
  return items
    .map(
      (x) =>
        '<option value="' +
        esc(x.id) +
        '" ' +
        ((Array.isArray(selected) ? selected.includes(x.id) : selected === x.id)
          ? "selected"
          : "") +
        ">" +
        esc(x.name || x.id) +
        "</option>",
    )
    .join("");
}
function field(label, id, value = "", type = "text") {
  return (
    "<label>" +
    label +
    '<input id="' +
    id +
    '" type="' +
    type +
    '" value="' +
    esc(value) +
    '"></label>'
  );
}
function check(label, id, value) {
  return (
    '<label class="check"><input id="' +
    id +
    '" type="checkbox" ' +
    (value ? "checked" : "") +
    ">" +
    label +
    "</label>"
  );
}
function btn(text, action, id = "", cls = "") {
  return (
    '<button class="' +
    cls +
    '" data-action="' +
    action +
    '" data-id="' +
    esc(id) +
    '">' +
    text +
    "</button>"
  );
}
function table(head, rows) {
  return (
    '<div class="table"><table><thead><tr>' +
    head.map((h) => "<th>" + h + "</th>").join("") +
    "</tr></thead><tbody>" +
    rows.join("") +
    "</tbody></table></div>"
  );
}

function markdown(text) {
  const inline = (line) => {
    const literals = [];
    const hold = (html) => "\u0000" + (literals.push(html) - 1) + "\u0000";
    return esc(
      line.replace(/\\([\\\x60*_{}[\]()<>#+.!|~-])/g, (_, c) => hold(esc(c))),
    )
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) =>
        hold(
          '<a href="' +
            url +
            '" target="_blank" rel="noopener noreferrer">' +
            label +
            "</a>",
        ),
      )
      .replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/~~([^~]+)~~/g, "<del>$1</del>")
      .replace(
        /\u0000(\d+)\u0000/g,
        (_, index) => literals[Number(index)] || "",
      );
  };
  return text
    .split("\n")
    .map((line) => {
      if (/^---+$/.test(line)) return "<hr>";
      const heading = line.match(/^(#{1,2})\s+(.*)/);
      if (heading)
        return (
          "<h" +
          heading[1].length +
          ">" +
          inline(heading[2]) +
          "</h" +
          heading[1].length +
          ">"
        );
      if (/^>\s?/.test(line))
        return (
          "<blockquote>" + inline(line.replace(/^>\s?/, "")) + "</blockquote>"
        );
      if (/^[-*]\s+/.test(line))
        return "<ul><li>" + inline(line.replace(/^[-*]\s+/, "")) + "</li></ul>";
      if (/^\d+\.\s+/.test(line))
        return (
          "<ol><li>" + inline(line.replace(/^\d+\.\s+/, "")) + "</li></ol>"
        );
      return "<div>" + inline(line || " ") + "</div>";
    })
    .join("");
}
function showMessage(id, result) {
  const el = $(id);
  el.hidden = false;
  el.innerHTML = markdown(result.text);
}
const toolbar = (id) =>
  '<div class="actions">' +
  [
    ["标题", "# ", ""],
    ["加粗", "**", "**"],
    ["斜体", "*", "*"],
    ["删除线", "~~", "~~"],
    ["链接", "[", "](https://example.com)"],
    ["列表", "- ", ""],
    ["引用", "> ", ""],
  ]
    .map(([label, before, after]) =>
      btn(label, "markup", JSON.stringify({ id, before, after })),
    )
    .join("") +
  "</div>";
const replyLabels = {
  body: "完整回复 / 外层模板",
  item: "放假安排条目",
  empty: "没有剩余记录",
  unknown: "没有可靠数据",
  stale: "旧数据提示",
  ongoing: "进行中提示",
  makeupEmpty: "没有调休上班日时的文字",
  error: "查询失败提示",
  tooLong: "平台返回超限时的提示",
};
function captureReply() {
  if (!$("reply-body")) return;
  const reply = config.replies[selectedCommand];
  for (const key of Object.keys(replyLabels))
    if ($("reply-" + key)) reply[key] = $("reply-" + key).value;
}
function render() {
  $("nav").innerHTML = Object.entries(pages)
    .map(([id, name]) => btn(name, "page", id, id === page ? "active" : ""))
    .join("");
  let html = '<div class="actions">' + btn("刷新配置", "reload") + "</div>";
  if (!synchronized)
    html += '<div class="notice">配置状态未确认，请刷新后继续。</div>';
  if (config.paused)
    html +=
      '<div class="notice">全局紧急暂停中。查询、预览和每日维护仍可运行。</div>';
  if (page === "tasks") {
    html +=
      '<section><h2>发送计划</h2><p class="muted">任务使用 Markdown 文案，通过占位符组合模块信息。先建立任务，再绑定发送对象。</p>' +
      btn("新建任务", "new-task", "", "primary");
    html +=
      table(
        ["任务", "周期 / 北京时间", "目标 / 状态", "操作"],
        config.tasks.map(
          (t) =>
            "<tr><td>" +
            esc(t.name) +
            "<br><small>" +
            esc(t.origin === "system" ? "系统自带" : "人工添加") +
            "</small></td><td>" +
            esc(
              { daily: "每日", weekly: "每周", once: "一次性" }[
                t.schedule.kind
              ],
            ) +
            " " +
            esc(t.schedule.time) +
            "</td><td>" +
            config.bindings.filter((b) => b.taskId === t.id).length +
            " 个 · " +
            (t.enabled
              ? t.schedule.kind === "once" &&
                Date.parse(
                  t.schedule.date + "T" + t.schedule.time + ":00+08:00",
                ) < Date.now() &&
                state.cursors.filter((c) => c.task_id === t.id).length &&
                state.cursors
                  .filter((c) => c.task_id === t.id)
                  .every((c) => c.due_at === null)
                ? "已结束"
                : "启用"
              : "暂停") +
            "</td><td>" +
            btn("编辑", "edit-task", t.id) +
            btn("立即测试", "test-task", t.id) +
            btn(t.enabled ? "暂停" : "启用", "toggle-task", t.id) +
            btn("复制", "copy-task", t.id) +
            btn("删除", "delete-task", t.id, "danger") +
            "</td></tr>",
        ),
      ) + "</section>";
    if (testingTask) {
      const task = config.tasks.find((t) => t.id === testingTask);
      const targets = config.bindings
        .filter((b) => b.taskId === testingTask)
        .map((b) => config.recipients.find((r) => r.id === b.recipientId))
        .filter(Boolean);
      if (task)
        html +=
          '<section id="eventTest"><h2>事件测试：' +
          esc(task.name) +
          '</h2><p class="muted">立即向选中的对象发送已保存的文案，包含该对象的覆盖内容。无需启用任务，不改变定时计划。</p>' +
          '<label>测试对象<select id="testRecipient">' +
          options(targets) +
          "</select></label>" +
          btn("发送测试消息", "send-task-test", task.id, "primary") +
          '<div id="testMessage" class="message-preview" hidden></div><pre id="testResult" role="status" hidden></pre></section>';
    }
    if (editingTask) {
      const t = editingTask,
        s = t.schedule;
      html +=
        '<section><h2>编辑任务</h2><div class="grid">' +
        field("名称", "taskName", t.name) +
        '<label>重复方式<select id="kind">' +
        ["daily", "weekly", "once"]
          .map(
            (k, i) =>
              '<option value="' +
              k +
              '" ' +
              (s.kind === k ? "selected" : "") +
              ">" +
              ["每日", "每周", "一次性"][i] +
              "</option>",
          )
          .join("") +
        "</select></label>" +
        field("北京时间", "scheduleTime", s.time, "time") +
        '<div id="weeklyFields"' +
        (s.kind === "weekly" ? "" : " hidden") +
        ">" +
        field(
          "每周星期（1–7，逗号分隔）",
          "weekdays",
          (s.weekdays || [1]).join(","),
        ) +
        "</div>" +
        '<div id="onceFields"' +
        (s.kind === "once" ? "" : " hidden") +
        ">" +
        field("一次性日期", "onceDate", s.date || "", "date") +
        "</div>" +
        check("启用任务", "taskEnabled", t.enabled) +
        '</div><label>消息内容（Markdown）<textarea id="taskBody">' +
        esc(t.body) +
        "</textarea></label>" +
        toolbar("taskBody") +
        '<div class="actions">' +
        state.variables
          .map((v) => btn("{{" + v + "}}", "insert-variable", v))
          .join("") +
        '</div><p class="muted">标题、换行和模块顺序直接写在文案中。预览使用本地缓存，不发送消息。</p>' +
        btn("预览公告", "preview-task") +
        '<div id="taskPreview" class="message-preview" hidden></div><div class="actions">' +
        btn("保存任务", "save-task", "", "primary") +
        btn("取消", "cancel-task") +
        "</div></section>";
    }
    html +=
      '<section><h2>绑定目标与整条覆盖</h2><div class="grid"><label>任务<select id="bindTask">' +
      options(config.tasks) +
      '</select></label><label>发送对象（可多选）<select id="bindRecipient" multiple>' +
      options(config.recipients) +
      '</select></label></div><label>最终整条消息覆盖，留空使用共享内容<textarea id="override"></textarea></label>' +
      btn("绑定选中对象", "bind", "", "primary");
    html +=
      table(
        ["任务 → 对象", "覆盖", "下次发送", "操作"],
        config.bindings.map((b) => {
          const id = b.taskId + ":" + b.recipientId,
            p = state.cursors.find((p) => p.id === id);
          return (
            "<tr><td>" +
            esc(config.tasks.find((t) => t.id === b.taskId)?.name) +
            " → " +
            esc(config.recipients.find((r) => r.id === b.recipientId)?.name) +
            "</td><td>" +
            esc(b.overrideText || "共享内容") +
            "</td><td>" +
            time(p?.enabled ? p.due_at : null) +
            "</td><td>" +
            btn("预览", "preview", id) +
            btn("修改覆盖", "edit-override", id) +
            btn("立即测试", "test", id) +
            btn(b.enabled ? "停用" : "启用", "toggle-binding", id) +
            btn("解绑", "unbind", id) +
            "</td></tr>"
          );
        }),
      ) +
      '<div id="messagePreview" class="message-preview" hidden></div><pre id="previewResult" hidden></pre></section>';
  }
  if (page === "recipients") {
    html +=
      '<section><h2>发送对象</h2><p class="muted">在目标群聊或私聊中发送官方 /sid，复制会话 ID 填入 OpenID。OpenID 与机器人绑定，不能用 QQ 号码替代。</p>' +
      btn("新增对象", "new-recipient", "", "primary");
    html +=
      table(
        ["名称", "场景 / ID", "状态", "操作"],
        config.recipients.map(
          (r) =>
            "<tr><td>" +
            esc(r.name) +
            "</td><td>" +
            esc(r.scene) +
            " · " +
            esc(r.openid) +
            "</td><td>" +
            (r.enabled ? "启用" : "禁用") +
            "</td><td>" +
            btn("编辑", "edit-recipient", r.id) +
            btn(r.enabled ? "禁用" : "启用", "toggle-recipient", r.id) +
            btn("删除", "delete-recipient", r.id) +
            "</td></tr>",
        ),
      ) + "</section>";
    if (editingRecipient) {
      const r = editingRecipient;
      html +=
        '<section><h2>对象配置</h2><div class="grid">' +
        field("名称", "recipientName", r.name) +
        '<label>场景<select id="scene"><option value="group">群聊</option><option value="c2c" ' +
        (r.scene === "c2c" ? "selected" : "") +
        ">私聊</option></select></label>" +
        field("OpenID", "openid", r.openid) +
        check("启用", "recipientEnabled", r.enabled) +
        "</div>" +
        btn("保存对象", "save-recipient", "", "primary") +
        "</section>";
    }
  }
  if (page === "replies") {
    const reply = config.replies[selectedCommand];
    html +=
      '<section><h2>命令回复</h2><label>命令<select id="commandName">' +
      Object.keys(config.replies)
        .map(
          (name) =>
            "<option " +
            (name === selectedCommand ? "selected" : "") +
            ">" +
            esc(name) +
            "</option>",
        )
        .join("") +
      "</select></label>";
    for (const [key, label] of Object.entries(replyLabels)) {
      if (
        !["假期 下一个", "假期 剩余"].includes(selectedCommand) &&
        !["body", "error", "tooLong"].includes(key)
      )
        continue;
      html +=
        "<label>" +
        label +
        '<textarea id="reply-' +
        key +
        '">' +
        esc(reply[key]) +
        "</textarea></label>" +
        toolbar("reply-" + key);
    }
    html +=
      '<div class="actions" id="replyVariables">' +
      state.replyVariables[selectedCommand].body
        .map((v) => btn("{{" + v + "}}", "reply-variable", v))
        .join("") +
      '</div><p class="muted">变量插入当前编辑框；items 用于完整回复，条目中使用 name、start/end 等变量。条目之间的换行请直接写在条目模板末尾。</p>' +
      btn("保存回复", "save-reply", "", "primary") +
      btn("恢复当前命令默认", "reset-reply") +
      btn("使用本地数据预览", "preview-reply") +
      '<div id="replyPreview" class="message-preview">' +
      markdown(reply.body) +
      "</div></section>";
  }

  if (page === "holidays") {
    html +=
      '<section><h2>年度数据</h2><p class="muted">只同步当年和明年的数据。UAPI 仅查询法定放假与调休。自动清理往年已结束的记录；人工修改不会被同步覆盖。</p>' +
      btn("立即同步", "sync", "", "primary") +
      table(
        ["年份", "数据版本时间", "状态", "来源"],
        state.sources.map(
          (s) =>
            "<tr><td>" +
            s.year +
            "</td><td>" +
            (s.updated_at ? time(s.updated_at) : "尚未同步") +
            "</td><td>" +
            esc(
              s.error === "not_published"
                ? "接口暂未提供安排"
                : s.error || (s.hasData ? "已有数据" : "暂未获取安排"),
            ) +
            '</td><td><a target="_blank" rel="noopener noreferrer" href="' +
            "https://uapis.cn/docs/api-reference/get-misc-holiday-calendar" +
            '">查看来源</a></td></tr>',
        ),
      ) +
      "</section>";
    html +=
      "<section><h2>放假与调休</h2>" +
      btn("新增假期", "new-holiday", "", "primary") +
      table(
        ["名称", "日期", "类别", "来源", "操作"],
        config.holidays.map(
          (h) =>
            "<tr><td>" +
            esc(h.name) +
            "</td><td>" +
            esc(h.start + " 至 " + h.end) +
            "</td><td>" +
            (h.kind === "holiday" ? "放假" : "调休上班") +
            "</td><td>" +
            (h.manual || h.source !== "uapi" ? "人工" : "UAPI") +
            "</td><td>" +
            btn("编辑", "edit-holiday", h.id) +
            btn("删除", "delete-holiday", h.id) +
            "</td></tr>",
        ),
      ) +
      "</section>";
    if (editingHoliday) {
      const h = editingHoliday;
      html +=
        '<section><h2>编辑假期</h2><div class="grid">' +
        field("名称", "holidayName", h.name) +
        field("开始", "holidayStart", h.start, "date") +
        field("结束", "holidayEnd", h.end, "date") +
        '<label>类别<select id="holidayKind"><option value="holiday">放假</option><option value="makeup" ' +
        (h.kind === "makeup" ? "selected" : "") +
        ">调休上班</option></select></label>" +
        "</div>" +
        btn("保存假期", "save-holiday", "", "primary") +
        "</section>";
    }

    html +=
      '<section><h2>公告占位符文案</h2><p class="muted">概览用于 {{假期.概览}}，今日文案用于 {{假期.今日}}。概览支持 {{name}}、{{start}}、{{end}}、{{days_until}}、{{days_off}}、{{ongoing}}；放假与调休今日文案支持 {{name}}。</p>' +
      Object.entries({
        summary: "假期概览",
        today: "今日放假",
        makeupToday: "今日调休上班",
        ordinary: "普通日期",
        unknown: "暂无数据",
        none: "已无剩余假期",
        ongoing: "进行中",
        stale: "缓存提示",
      })
        .map(
          ([key, label]) =>
            "<label>" +
            label +
            '<textarea id="holiday-copy-' +
            key +
            '">' +
            esc(config.holidayCopy[key]) +
            "</textarea></label>",
        )
        .join("") +
      btn("保存占位符文案", "save-holiday-copy") +
      "</section>";
    html +=
      '<section><h2>CSV / JSON 导入</h2><label>文件内容（CSV 表头 name,start,end）<textarea id="importText"></textarea></label><input id="importFile" type="file" accept=".csv,.json"><div class="actions">' +
      btn("预览导入", "preview-import") +
      btn("确认预览批次", "apply-import") +
      '</div><pre id="importPreview" hidden></pre><label>回滚导入批次<select id="batchId">' +
      [...new Set(config.holidays.map((h) => h.batchId).filter(Boolean))]
        .map((id) => "<option>" + esc(id) + "</option>")
        .join("") +
      "</select></label>" +
      btn("回滚批次", "rollback-import", "", "danger") +
      "</section>";
  }
  if (page === "status") {
    html +=
      '<section><h2>运行控制</h2><div class="actions">' +
      btn(
        config.paused ? "解除全局暂停" : "全局紧急暂停",
        "pause",
        "",
        "danger",
      ) +
      btn("立即清理过期日志", "cleanup") +
      '</div><p>维护任务不追加插件运行日志；框架自身可能输出 Cron 完成信息。发送采用 SDK 预算预留，临近窗口结束会跳过。</p><div class="grid"><label>日志保留<select id="retention">' +
      [7, 30, 90]
        .map(
          (v) =>
            "<option " +
            (v === config.retentionDays ? "selected" : "") +
            ">" +
            v +
            "</option>",
        )
        .join("") +
      "</select></label>" +
      "</div>" +
      btn("保存设置", "save-settings") +
      "<pre>" +
      esc(JSON.stringify(state.jobs, null, 2)) +
      '</pre><p class="muted">单轮最多 ' +
      state.limits.batch +
      " 个目标，并发 " +
      state.limits.concurrency +
      "；请尽量错开发送时间，超出容量或发送窗口的计划会跳过。</p></section>";
    html +=
      '<section><h2>执行日志</h2><div class="grid"><label>任务<select id="logTask"><option value="">全部</option>' +
      options(config.tasks) +
      '</select></label><label>目标<select id="logRecipient"><option value="">全部</option>' +
      options(config.recipients) +
      '</select></label><label>状态<select id="logStatus"><option value="">全部</option>' +
      [
        "success",
        "failed_api",
        "failed_validation",
        "uncertain",
        "skipped_empty",
        "skipped_expired",
        "skipped_budget",
        "skipped_disabled",
        "skipped_duplicate",
      ]
        .map((v) => "<option>" + v + "</option>")
        .join("") +
      "</select></label></div>" +
      btn("查询", "load-logs") +
      btn("上一页", "logs-prev") +
      btn("下一页", "logs-next") +
      '<div id="logs"></div></section>';
    html +=
      "<section><h2>备份与恢复</h2><p>恢复保留原启用状态，并从恢复完成后的未来时间重新排程。</p>" +
      btn("导出 JSON", "export-backup") +
      '<label>选择备份<input id="backupFile" type="file" accept=".json"></label><div class="actions">' +
      btn("预览恢复", "preview-restore") +
      btn("确认恢复", "restore", "", "danger") +
      '</div><pre id="backupPreview" hidden></pre></section>';
  }
  $("app").innerHTML = html;
}
const put = (list, item) => {
  const i = list.findIndex((x) => x.id === item.id);
  if (i < 0) list.push(item);
  else list[i] = item;
};
async function action(a, id) {
  if (a === "reload") {
    await load();
    return;
  }
  if (a === "page") {
    if (dirty && !(await confirmAction("有未保存的编辑，放弃并切换页面？")))
      return;
    dirty = false;
    editingTask = editingRecipient = editingHoliday = null;
    page = id;
    render();
    return;
  }
  if (a === "new-task") {
    editingTask = {
      ...structuredClone(state.draftDefaults.task),
      id: uid(),
      origin: "manual",
      enabled: false,
      schedule: { kind: "daily", time: "09:00" },
    };
    render();
    return;
  }
  if (a === "test-task") {
    if (dirty) throw Error("请先保存文案，再测试发送");
    if (!config.bindings.some((b) => b.taskId === id))
      throw Error("请先为该任务绑定发送对象");
    testingTask = id;
    render();
    $("eventTest").scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  if (a === "send-task-test") {
    await sendTest(id, $("testRecipient").value, "testMessage", "testResult");
    return;
  }
  if (a === "edit-task") {
    editingTask = structuredClone(config.tasks.find((t) => t.id === id));
    render();
    return;
  }
  if (a === "cancel-task") {
    editingTask = null;
    render();
    return;
  }
  if (a === "save-task") {
    const s = { kind: $("kind").value, time: $("scheduleTime").value };
    if (s.kind === "weekly")
      s.weekdays = $("weekdays").value.split(",").map(Number);
    if (s.kind === "once") s.date = $("onceDate").value;
    put(config.tasks, {
      ...editingTask,
      name: $("taskName").value,
      enabled: $("taskEnabled").checked,
      schedule: s,
      body: $("taskBody").value,
    });
    await save();
    editingTask = null;
    render();
    return;
  }
  if (a === "preview-task") {
    const draft = structuredClone(config);
    const task = {
      ...editingTask,
      name: $("taskName").value,
      body: $("taskBody").value,
    };
    put(draft.tasks, task);
    showMessage(
      "taskPreview",
      await api("preview", { config: draft, taskId: task.id }),
    );
    return;
  }
  if (a === "copy-task") {
    const t = structuredClone(config.tasks.find((t) => t.id === id));
    t.id = uid();
    t.origin = "manual";
    t.name += state.draftDefaults.copySuffix;
    t.enabled = false;
    config.tasks.push(t);
    await save();
    return;
  }
  if (a === "toggle-task") {
    const t = config.tasks.find((t) => t.id === id);
    t.enabled = !t.enabled;
    await save();
    return;
  }
  if (a === "delete-task") {
    if (!(await confirmAction("删除任务及其绑定？"))) return;
    config.tasks = config.tasks.filter((t) => t.id !== id);
    config.bindings = config.bindings.filter((b) => b.taskId !== id);
    await save();
    return;
  }
  if (a === "bind") {
    const taskId = $("bindTask").value;
    for (const o of $("bindRecipient").selectedOptions) {
      const value = {
          taskId,
          recipientId: o.value,
          enabled: true,
          overrideText: $("override").value.trim() ? $("override").value : null,
        },
        i = config.bindings.findIndex(
          (b) => b.taskId === taskId && b.recipientId === o.value,
        );
      if (i < 0) config.bindings.push(value);
      else config.bindings[i] = value;
    }
    await save();
    return;
  }
  if (
    ["preview", "test", "unbind", "edit-override", "toggle-binding"].includes(a)
  ) {
    const [taskId, recipientId] = id.split(":"),
      b = config.bindings.find(
        (b) => b.taskId === taskId && b.recipientId === recipientId,
      );
    if (a === "unbind") {
      if (!(await confirmAction("解除这个任务与目标的绑定？"))) return;
      config.bindings = config.bindings.filter((x) => x !== b);
      await save();
    } else if (a === "toggle-binding") {
      b.enabled = !b.enabled;
      await save();
    } else if (a === "edit-override") {
      const text = await promptText(
        "覆盖该任务的最终整条消息；留空恢复共享内容",
        b.overrideText || "",
      );
      if (text !== null) {
        b.overrideText = text.trim() ? text : null;
        await save();
      }
    } else {
      if (a === "test")
        await sendTest(taskId, recipientId, "messagePreview", "previewResult");
      else {
        const result = await api("preview", { taskId, recipientId, config });
        showMessage("messagePreview", result);
        $("previewResult").hidden = false;
        $("previewResult").textContent = result.text;
      }
    }
    return;
  }
  if (a === "new-recipient") {
    editingRecipient = {
      ...structuredClone(state.draftDefaults.recipient),
      id: uid(),
      scene: "group",
      openid: "",
      enabled: false,
      botId: state.currentBotId,
    };
    render();
    return;
  }
  if (a === "edit-recipient") {
    editingRecipient = structuredClone(
      config.recipients.find((r) => r.id === id),
    );
    render();
    return;
  }
  if (a === "save-recipient") {
    put(config.recipients, {
      ...editingRecipient,
      name: $("recipientName").value,
      scene: $("scene").value,
      openid: $("openid").value.trim(),
      enabled: $("recipientEnabled").checked,
    });
    await save();
    editingRecipient = null;
    render();
    return;
  }
  if (a === "toggle-recipient") {
    const r = config.recipients.find((r) => r.id === id);
    r.enabled = !r.enabled;
    await save();
    return;
  }
  if (a === "delete-recipient") {
    if (!(await confirmAction("删除对象及其全部绑定？"))) return;
    config.recipients = config.recipients.filter((r) => r.id !== id);
    config.bindings = config.bindings.filter((b) => b.recipientId !== id);
    await save();
    return;
  }
  if (a === "insert-variable") {
    const area = $("taskBody");
    area.setRangeText(
      "{{" + id + "}}",
      area.selectionStart,
      area.selectionEnd,
      "end",
    );
    area.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }
  if (a === "markup") {
    const { id: target, before, after } = JSON.parse(id),
      el = $(target);
    const selected =
      el.value.slice(el.selectionStart, el.selectionEnd) || "文字";
    el.setRangeText(
      before + selected + after,
      el.selectionStart,
      el.selectionEnd,
      "end",
    );
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.focus();
    return;
  }
  if (a === "reply-variable") {
    const el = $(lastReplyField) || $("reply-body");
    el.setRangeText(
      "{{" + id + "}}",
      el.selectionStart,
      el.selectionEnd,
      "end",
    );
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }
  if (a === "save-reply") {
    captureReply();
    await save();
    return;
  }
  if (a === "reset-reply") {
    config.replies[selectedCommand] = structuredClone(
      state.replyDefaults[selectedCommand],
    );
    await save();
    return;
  }
  if (a === "preview-reply") {
    captureReply();
    showMessage(
      "replyPreview",
      await api("command-preview", { config, command: selectedCommand }),
    );
    return;
  }
  if (a === "save-holiday-copy") {
    for (const key of Object.keys(config.holidayCopy))
      config.holidayCopy[key] = $("holiday-copy-" + key).value;
    await save();
    return;
  }
  if (a === "sync" || a === "cleanup") {
    if (dirty && !(await confirmAction("有未保存的编辑，放弃并刷新数据？")))
      return;
    const result = await api("maintenance", { job: a });
    await load();
    status(result.message, !result.ok);
    return;
  }
  if (a === "new-holiday") {
    editingHoliday = {
      ...structuredClone(state.draftDefaults.holiday),
      id: uid(),
      start: "",
      end: "",
      kind: "holiday",
    };
    render();
    return;
  }
  if (a === "edit-holiday") {
    editingHoliday = structuredClone(config.holidays.find((h) => h.id === id));
    render();
    return;
  }
  if (a === "save-holiday") {
    put(config.holidays, {
      ...editingHoliday,
      name: $("holidayName").value,
      start: $("holidayStart").value,
      end: $("holidayEnd").value || $("holidayStart").value,
      kind: $("holidayKind").value,
      source: "manual",
      manual: true,
    });
    await save();
    editingHoliday = null;
    render();
    return;
  }
  if (a === "delete-holiday") {
    if (!(await confirmAction("删除这个假期？"))) return;
    config.holidays = config.holidays.filter((h) => h.id !== id);
    await save();
    return;
  }
  if (a === "preview-import") {
    imported = await api("import-preview", {
      text: $("importText").value,
    });
    imported.revision = state.revision;
    $("importPreview").hidden = false;
    $("importPreview").textContent = JSON.stringify(imported, null, 2);
    return;
  }
  if (a === "apply-import") {
    if (!imported || imported.revision !== state.revision)
      throw Error("请先重新预览导入");
    if (
      imported.conflicts.length &&
      !(await confirmAction("存在重叠假期，仍保留为独立条目？"))
    )
      return;
    config.holidays.push(...imported.items);
    await save();
    imported = null;
    return;
  }
  if (a === "rollback-import") {
    const batch = $("batchId").value;
    if (!batch || !(await confirmAction("删除该批次导入的所有假期？"))) return;
    config.holidays = config.holidays.filter((h) => h.batchId !== batch);
    await save();
    return;
  }
  if (a === "pause") {
    config.paused = !config.paused;
    await save(config.paused ? "已暂停主动发送" : "已恢复，只执行未来计划");
    return;
  }
  if (a === "save-settings") {
    config.retentionDays = +$("retention").value;
    await save();
    return;
  }
  if (["load-logs", "logs-prev", "logs-next"].includes(a)) {
    logsOffset =
      a === "load-logs"
        ? 0
        : Math.max(0, logsOffset + (a === "logs-next" ? 50 : -50));
    const qs = new URLSearchParams({
        task: $("logTask").value,
        recipient: $("logRecipient").value,
        status: $("logStatus").value,
        offset: String(logsOffset),
      }),
      logs = await api("logs?" + qs);
    $("logs").innerHTML = table(
      ["计划时间", "任务 / 目标", "状态", "详情"],
      logs.map(
        (l) =>
          "<tr><td>" +
          time(l.due_at) +
          "</td><td>" +
          esc(config.tasks.find((t) => t.id === l.task_id)?.name || l.task_id) +
          " / " +
          esc(
            config.recipients.find((r) => r.id === l.recipient_id)?.name ||
              l.recipient_id,
          ) +
          "</td><td>" +
          esc(l.status) +
          "</td><td><details><summary>展开</summary><pre>" +
          esc(JSON.stringify(l, null, 2)) +
          "</pre></details></td></tr>",
      ),
    );
    return;
  }
  if (a === "export-backup") {
    const b = await api("backup"),
      url = URL.createObjectURL(
        new Blob([JSON.stringify(b)], {
          type: "application/json",
        }),
      ),
      link = document.createElement("a");
    link.href = url;
    link.download =
      "daily-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.append(link);
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      link.remove();
    }, 1000);
    return;
  }
  if (a === "preview-restore") {
    if (!backup) throw Error("请先选择备份");
    const p = await api("restore-preview", { backup });
    restoreRevision = p.revision;
    $("backupPreview").hidden = false;
    $("backupPreview").textContent = JSON.stringify(p, null, 2);
    return;
  }
  if (a === "restore") {
    if (
      restoreRevision === undefined ||
      !(await confirmAction("使用预览的备份替换当前配置，并保留原启用状态？"))
    )
      return;
    await api("restore", {
      backup,
      revision: restoreRevision,
      confirm: true,
    });
    restoreRevision = undefined;
    await load();
    status("恢复完成，已重算未来计划");
    return;
  }
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-action]");
  if (b) run(() => action(b.dataset.action, b.dataset.id));
});

let lastReplyField = "reply-body";
document.addEventListener("focusin", (e) => {
  if (e.target.id.startsWith("reply-")) {
    lastReplyField = e.target.id;
    $("replyVariables").innerHTML = state.replyVariables[selectedCommand][
      e.target.id.slice(6)
    ]
      .map((v) => btn("{{" + v + "}}", "reply-variable", v))
      .join("");
  }
});
document.addEventListener("input", (e) => {
  if (e.target.closest("#app") && e.target.id !== "testRecipient") dirty = true;
  if (e.target.id.startsWith("reply-")) {
    captureReply();
    showMessage("replyPreview", {
      text: config.replies[selectedCommand].body,
    });
  }
});
document.addEventListener("change", (e) => {
  if (e.target.closest("#app") && e.target.id !== "testRecipient") dirty = true;
  if (e.target.id === "commandName") {
    captureReply();
    selectedCommand = e.target.value;
    render();
  }
  if (e.target.id === "kind") {
    $("weeklyFields").hidden = e.target.value !== "weekly";
    $("onceFields").hidden = e.target.value !== "once";
  }
  if (e.target.id === "importFile")
    run(async () => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 128000) throw Error("导入文件超过128KB");
      $("importText").value = await file.text();
      imported = null;
    });
  if (e.target.id === "backupFile")
    run(async () => {
      backup = undefined;
      restoreRevision = undefined;
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > state.limits.backupBytes) throw Error("备份文件过大");
      backup = JSON.parse(await file.text());
      status("备份已读取，请预览");
    });
});
bridge.resize();
await run(load);
`;
