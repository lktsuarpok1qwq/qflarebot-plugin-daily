import data from "./data/corpus.json";
import type { FortuneCorpus } from "./cards/types.js";

// 发布前校验完整语料，请求中不重复扫描固定资源
export const corpus = { data: data as FortuneCorpus, status: "900 套主签 · 120 条普通彩蛋 · 180 条节日彩蛋" };
