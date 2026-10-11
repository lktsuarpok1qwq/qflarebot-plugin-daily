import { components } from "./components.js";
import { application } from "./application.js";
import { tasksPage } from "./pages/tasks.js";
import { recipientsPage } from "./pages/recipients.js";
import { copyPage } from "./pages/copy.js";
import { calendarPage } from "./pages/calendar.js";
import { statusPage } from "./pages/status.js";
// Keep browser code as source strings so the SDK can build this plugin without a separate frontend pipeline.
export const client = [
    String.raw`
import { createBridge } from "/bridge.js";
`,
    components,
    tasksPage,
    recipientsPage,
    copyPage,
    calendarPage,
    statusPage,
    application,
    String.raw`
const bridge = await createBridge();
await createApp(bridge, createUI(), {
    tasks: createTasksPage,
    recipients: createRecipientsPage,
    copy: createCopyPage,
    calendar: createCalendarPage,
    status: createStatusPage,
}).start();
`,
].join("\n");
