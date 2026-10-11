import type { SendResult } from "@qqbot/sdk";
import type { Outcome } from "../data/deliveries.js";
export function resultStatus(result: SendResult): Pick<Outcome, "status" | "error" | "messageId"> {
    return {
        status: result.ok ? "success" : result.status === 0 || result.status >= 500 ? "uncertain" : "failed_api",
        error: result.ok
            ? null
            : JSON.stringify({
                  code: result.code,
                  status: result.status,
                  traceId: result.traceId,
                  error: result.error?.slice(0, 300),
              }),
        messageId: result.messageId ?? null,
    };
}
