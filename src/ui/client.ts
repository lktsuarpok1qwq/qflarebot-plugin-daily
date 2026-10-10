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
  editingContent,
  editingRecipient,
  editingHoliday,
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
  contents: "内容与模板",
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
      '<section><h2>发送计划</h2><p class="muted">独立任务选择一项内容；汇总按列表顺序拼接。修改内容后请保存，再执行真实测试；无需先启用任务。</p>' +
      btn("新建任务", "new-task", "", "primary");
    html +=
      table(
        ["任务", "周期 / 北京时间", "目标 / 状态", "操作"],
        config.tasks.map(
          (t) =>
            "<tr><td>" +
            esc(t.name) +
            "<br><small>" +
            esc(t.mode === "digest" ? "每日汇总" : "独立消息") +
            "</small></td><td>" +
            esc(t.schedule.kind) +
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
            btn(t.enabled ? "暂停" : "启用", "toggle-task", t.id) +
            btn("复制", "copy-task", t.id) +
            btn("删除", "delete-task", t.id, "danger") +
            "</td></tr>",
        ),
      ) + "</section>";
    if (editingTask) {
      const t = editingTask,
        s = t.schedule;
      html +=
        '<section><h2>编辑任务</h2><div class="grid">' +
        field("名称", "taskName", t.name) +
        '<label>模式<select id="taskMode"><option value="standalone" ' +
        (t.mode === "standalone" ? "selected" : "") +
        '>独立</option><option value="digest" ' +
        (t.mode === "digest" ? "selected" : "") +
        '>汇总</option></select></label><label>周期<select id="kind">' +
        ["daily", "weekly", "once", "yearly", "holiday_event"]
          .map(
            (k, i) =>
              '<option value="' +
              k +
              '" ' +
              (s.kind === k ? "selected" : "") +
              ">" +
              ["每日", "每周", "一次", "每年", "假期事件"][i] +
              "</option>",
          )
          .join("") +
        "</select></label>" +
        field("北京时间", "scheduleTime", s.time, "time") +
        field(
          "每周星期（1–7，逗号分隔）",
          "weekdays",
          (s.weekdays || [1]).join(","),
        ) +
        field("一次性日期", "onceDate", s.date || "", "date") +
        field("每年月日（例如 02-29）", "monthDay", s.monthDay || "01-01") +
        '<label>事件类别<select id="eventKind"><option value="holiday">放假开始</option><option value="makeup" ' +
        (s.eventKind === "makeup" ? "selected" : "") +
        ">调休上班日</option></select></label>" +
        field("提前天数", "offset", s.offset || 0, "number") +
        field("汇总标题", "taskTitle", t.title) +
        field(
          "分隔符（输入 \\n 表示换行）",
          "separator",
          t.separator.replace(/\n/g, "\\n"),
        ) +
        check("启用任务", "taskEnabled", t.enabled) +
        '</div><label>内容顺序（勾选后用 ↑ ↓ 调整）</label><div id="contentOrder">' +
        [
          ...t.contentIds,
          ...config.contents
            .filter((c) => !t.contentIds.includes(c.id))
            .map((c) => c.id),
        ]
          .map((id) => {
            const c = config.contents.find((c) => c.id === id);
            return c
              ? '<div class="row" data-content="' +
                  esc(id) +
                  '"><label class="check"><input type="checkbox" ' +
                  (t.contentIds.includes(id) ? "checked" : "") +
                  ">" +
                  esc(c.name) +
                  "</label>" +
                  btn("↑", "up-content", id) +
                  btn("↓", "down-content", id) +
                  "</div>"
              : "";
          })
          .join("") +
        '</div><div class="actions">' +
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
            btn("真实测试", "test", id) +
            btn(b.enabled ? "停用" : "启用", "toggle-binding", id) +
            btn("解绑", "unbind", id) +
            "</td></tr>"
          );
        }),
      ) + '<pre id="previewResult" hidden></pre></section>';
    const repeated = config.contents.filter(
      (c) =>
        config.tasks.filter((t) => t.enabled && t.contentIds.includes(c.id))
          .length > 1,
    );
    if (repeated.length)
      html +=
        '<div class="notice">内容用于多个启用任务，将分别发送：' +
        repeated.map((c) => esc(c.name)).join("、") +
        "</div>";
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
  if (page === "contents") {
    html +=
      "<section><h2>共享内容</h2>" +
      btn("新增内容", "new-content", "", "primary") +
      table(
        ["名称", "类型", "状态", "操作"],
        config.contents.map(
          (c) =>
            "<tr><td>" +
            esc(c.name) +
            "</td><td>" +
            esc(c.kind) +
            "</td><td>" +
            (c.enabled ? "启用" : "停用") +
            "</td><td>" +
            btn("编辑", "edit-content", c.id) +
            btn("复制", "copy-content", c.id) +
            btn("删除", "delete-content", c.id) +
            "</td></tr>",
        ),
      ) +
      "</section>";
    if (editingContent) {
      const c = editingContent;
      html +=
        '<section><h2>编辑内容</h2><div class="grid">' +
        field("名称", "contentName", c.name) +
        '<label>类型<select id="contentKind">' +
        ["text", "date", "holiday"]
          .map(
            (v, i) =>
              '<option value="' +
              v +
              '" ' +
              (c.kind === v ? "selected" : "") +
              ">" +
              ["文字", "日期", "假期"][i] +
              "</option>",
          )
          .join("") +
        '</select></label><label>适用日期<select id="contentOnly">' +
        ["always", "holiday", "makeup"]
          .map(
            (v, i) =>
              '<option value="' +
              v +
              '" ' +
              ((c.only || "always") === v ? "selected" : "") +
              ">" +
              ["每天", "仅放假日", "仅调休上班日"][i] +
              "</option>",
          )
          .join("") +
        "</select></label>" +
        check("启用", "contentEnabled", c.enabled) +
        '</div><label>正文<textarea id="contentBody">' +
        esc(c.body) +
        '</textarea></label><div class="actions">' +
        [
          "date.today",
          "date.weekday",
          "holiday.next_name",
          "holiday.days_until",
          "holiday.start_date",
          "holiday.end_date",
        ]
          .map((v) => btn("{{" + v + "}}", "insert-variable", v))
          .join("") +
        "</div>" +
        btn("保存内容", "save-content", "", "primary") +
        "</section>";
    }
    html +=
      '<section><h2>中文帮助</h2><div class="grid"><label>每日帮助<textarea id="dailyHelp">' +
      esc(config.help.daily) +
      '</textarea></label><label>假期帮助<textarea id="holidayHelp">' +
      esc(config.help.holiday) +
      '</textarea></label></div><details open><summary>实时预览</summary><pre id="helpPreview">' +
      esc(config.help.daily + "\n\n" + config.help.holiday) +
      "</pre></details>" +
      btn("保存帮助", "save-help", "", "primary") +
      btn("恢复默认帮助", "reset-help") +
      "</section>";
  }
  if (page === "holidays") {
    html +=
      '<section><h2>年度数据</h2><p class="muted">只同步当年和明年的数据，自动生成放假区间和调休上班日；自动清理往年已结束的记录。录入或导入后直接生效，人工修改不会被后续同步覆盖。</p>' +
      btn("立即同步", "sync", "", "primary") +
      table(
        ["年份", "可信数据版本时间", "状态", "远程数据源"],
        state.sources.map(
          (s) =>
            "<tr><td>" +
            s.year +
            "</td><td>" +
            time(s.updated_at) +
            "</td><td>" +
            esc(s.error === "not_published" ? "尚未公布" : s.error || (s.hasData ? "已有数据" : "尚未公布或未同步")) +
            '</td><td><a target="_blank" rel="noopener noreferrer" href="https://github.com/NateScarlet/holiday-cn/blob/master/' +
            s.year +
            '.json">查看来源</a></td></tr>',
        ),
      ) +
      "</section>";
    html +=
      "<section><h2>放假与调休</h2>" +
      btn("新增假期", "new-holiday", "", "primary") +
      table(
        ["名称", "日期", "类别", "操作"],
        config.holidays.map(
          (h) =>
            "<tr><td>" +
            esc(h.name) +
            "</td><td>" +
            esc(h.start + " 至 " + h.end) +
            "</td><td>" +
            (h.kind === "holiday" ? "放假" : "调休上班") +
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
        field("来源 / 备注（可选）", "holidaySource", h.source) +
        "</div>" +
        btn("保存假期", "save-holiday", "", "primary") +
        "</section>";
    }
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
      field(
        "应用消息长度上限（100–500）",
        "textLimit",
        config.textLimit,
        "number",
      ) +
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
    editingTask = editingContent = editingRecipient = editingHoliday = null;
    page = id;
    render();
    return;
  }
  if (a === "new-task") {
    editingTask = {
      id: uid(),
      name: "新任务",
      mode: "standalone",
      enabled: false,
      schedule: { kind: "daily", time: "09:00" },
      contentIds: [],
      title: "",
      separator: "\n\n",
    };
    render();
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
    if (s.kind === "yearly") s.monthDay = $("monthDay").value;
    if (s.kind === "holiday_event")
      Object.assign(s, {
        eventKind: $("eventKind").value,
        offset: +$("offset").value,
      });
    put(config.tasks, {
      ...editingTask,
      name: $("taskName").value,
      mode: $("taskMode").value,
      enabled: $("taskEnabled").checked,
      schedule: s,
      contentIds: [...$("contentOrder").children]
        .filter((el) => el.querySelector("input").checked)
        .map((el) => el.dataset.content),
      title: $("taskTitle").value,
      separator: $("separator").value.replace(/\\n/g, "\n"),
    });
    await save();
    editingTask = null;
    render();
    return;
  }
  if (a === "up-content" || a === "down-content") {
    const el = [...$("contentOrder").children].find(
      (x) => x.dataset.content === id,
    );
    if (a === "up-content" && el.previousElementSibling)
      el.previousElementSibling.before(el);
    if (a === "down-content" && el.nextElementSibling)
      el.nextElementSibling.after(el);
    return;
  }
  if (a === "copy-task") {
    const t = structuredClone(config.tasks.find((t) => t.id === id));
    t.id = uid();
    t.name += " 副本";
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
          overrideText: $("override").value.trim() || null,
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
        b.overrideText = text.trim() || null;
        await save();
      }
    } else {
      if (a === "test" && !testRequests.has(id)) testRequests.set(id, uid());
      const result = await api(a, {
        taskId,
        recipientId,
        ...(a === "test" ? { requestId: testRequests.get(id) } : { config }),
      });
      if (a === "test" && !["sending", "uncertain"].includes(result.status))
        testRequests.delete(id);
      $("previewResult").hidden = false;
      $("previewResult").textContent =
        a === "preview"
          ? result.text + "\n\n" + JSON.stringify(result.items, null, 2)
          : JSON.stringify(result, null, 2);
    }
    return;
  }
  if (a === "new-recipient") {
    editingRecipient = {
      id: uid(),
      scene: "group",
      openid: "",
      name: "",
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
  if (a === "new-content") {
    editingContent = {
      id: uid(),
      name: "新内容",
      kind: "text",
      enabled: true,
      body: "",
      only: "always",
    };
    render();
    return;
  }
  if (a === "edit-content") {
    editingContent = structuredClone(config.contents.find((c) => c.id === id));
    render();
    return;
  }
  if (a === "copy-content") {
    const c = structuredClone(config.contents.find((c) => c.id === id));
    c.id = uid();
    c.name += " 副本";
    config.contents.push(c);
    await save();
    return;
  }
  if (a === "delete-content") {
    if (!(await confirmAction("删除这项内容？"))) return;
    if (config.tasks.some((t) => t.contentIds.includes(id)))
      throw Error("内容仍被任务引用，请先从任务移除");
    config.contents = config.contents.filter((c) => c.id !== id);
    await save();
    return;
  }
  if (a === "insert-variable") {
    $("contentBody").setRangeText(
      "{{" + id + "}}",
      $("contentBody").selectionStart,
      $("contentBody").selectionEnd,
      "end",
    );
    return;
  }
  if (a === "save-content") {
    put(config.contents, {
      ...editingContent,
      name: $("contentName").value,
      kind: $("contentKind").value,
      body: $("contentBody").value,
      enabled: $("contentEnabled").checked,
      only: $("contentOnly").value,
    });
    await save();
    editingContent = null;
    render();
    return;
  }
  if (a === "save-help") {
    config.help = {
      daily: $("dailyHelp").value,
      holiday: $("holidayHelp").value,
    };
    await save();
    return;
  }
  if (a === "reset-help") {
    config.help = {
      daily:
        "📅 每日助手 · 使用帮助\n\n/每日 帮助    查看使用帮助\n\n自动发送由机器人所有者在管理后台设置。",
      holiday:
        "📅 假期助手 · 使用帮助\n\n/假期 下一个  查询下一个假期\n/假期 剩余    查询今年剩余假期\n/假期 帮助    查看使用帮助。",
    };
    await save();
    return;
  }
  if (a === "sync" || a === "cleanup") {
    await api("maintenance", { job: a });
    await load();
    status("维护已执行，详见最新状态");
    return;
  }
  if (a === "new-holiday") {
    editingHoliday = {
      id: uid(),
      name: "",
      start: "",
      end: "",
      kind: "holiday",
      source: "",
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
      source: $("holidaySource").value || "manual",
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
    config.textLimit = +$("textLimit").value;
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
document.addEventListener("input", (e) => {
  if (e.target.closest("#app")) dirty = true;
  if (["dailyHelp", "holidayHelp"].includes(e.target.id))
    $("helpPreview").textContent =
      $("dailyHelp").value + "\n\n" + $("holidayHelp").value;
});
document.addEventListener("change", (e) => {
  if (e.target.closest("#app")) dirty = true;
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
