import type { ModuleDefinition } from "../../shared/modules.js";
import { copyContract, commands } from "./definition.js";
import { install } from "./repository.js";
import { checkin } from "./service.js";
import { api } from "./admin.js";
import { checkinPage } from "./ui/page.js";

export const checkinModule: ModuleDefinition = {
    id: "checkin", title: "签到", permissions: ["db"], install, copy: copyContract,
    commands: { definitions: commands, render: ({ ctx, session, args }, name) => checkin(ctx, session.userId, name === "签到" ? args : [name.slice(3), ...args], Date.now, { scene: session.scene, targetId: session.targetId, name: session.userName }) },
    admin: api,
    ui: { source: checkinPage, sections: [{ id: "settings", title: "设置", factory: "createCheckinSettings" }, { id: "copy", title: "文案", factory: "createCheckinCopyEditor" }] },
};
