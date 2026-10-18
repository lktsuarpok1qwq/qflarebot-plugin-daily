import { configAdmin } from "../../shared/admin.js";
import { copyContract, settings } from "./definition.js";
import { snapshot, save } from "./repository.js";
import { wallet, SOURCE } from "./service.js";
export const api = configAdmin({
    label: "签到", snapshot, save, present: state => state, declaration: () => ({ settings, copyEditor: copyContract.editor }),
    actions: {
        connect: async ({ ctx }) => {
            const points = wallet(ctx);

            if (!points) { return Response.json({ message: "未接入积分，签到可正常使用；已完成的签到不补发积分" }); }

            let policy = await points.getSourcePolicy({ source: SOURCE });

            if (!policy.ok) { throw new Error(policy.message); }

            if (!policy.data.registered) {
                const registered = await points.registerSource({ source: SOURCE });

                if (!registered.ok) { throw new Error(registered.message); }

                policy = await points.getSourcePolicy({ source: SOURCE });

                if (!policy.ok) { throw new Error(policy.message); }
            }

            return Response.json({ message: policy.data.registered && policy.data.enabled ? "积分已接入，签到按设置发放奖励" : "来源 daily 已登记，请在积分管理的来源权限中启用" });
        },
    },
});
