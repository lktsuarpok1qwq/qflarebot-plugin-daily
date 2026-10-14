import { createT2I, type T2IAssets } from "../../../shared/t2i/index.js";
import backgrounds from "./generated/backgrounds.js";
import fonts from "./generated/glyphs.json";
import emoji from "./generated/emoji.js";
import icons from "./generated/icons.js";
export const fortuneAssets: T2IAssets = { backgrounds, fonts: fonts as T2IAssets["fonts"], emoji, icons };
export const renderer = createT2I(fortuneAssets);
