// 应用输入边界，不代表 Workers Free 的 CPU 预算保证
export const LIMITS = Object.freeze({
    maxDimension: 2048,
    maxPixels: 2_000_000,
    maxInputBytes: 100 * 1024,
    maxElements: 512,
    maxTextLength: 10_000,
    maxFontSize: 256,
    maxPendingRenders: 4
});
