import type { ModuleDefinition } from "../../shared/modules.js";
import { api } from "./admin.js";
import { copyContract, sample } from "./definition.js";
import { MURMUR_COPY, murmurVariables } from "./copy.js";
import { install } from "./repository.js";
import { createResolver, render } from "./service.js";
import { murmurPage } from "./ui/page.js";

export const murmur: ModuleDefinition = {
    id: "murmur", title: "絮语", permissions: ["db"], install, copy: copyContract,
    variables: {
        ...murmurVariables,
        sampleVariables: () => ({ "絮语.今日": render({ copy: MURMUR_COPY }, sample.text) }),
        createResolver,
    },
    admin: api,
    ui: {
        source: murmurPage,
        sections: [
            { id: "library", title: "文案库", factory: "createMurmurLibrary" },
            { id: "copy", title: "公告格式", factory: "createCopyEditor" },
        ],
    },
};
