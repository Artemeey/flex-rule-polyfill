/** Read the supported parts of the computed `rule` shorthand. */
const readRule = (style) => {
    const rule = style.getPropertyValue('rule').trim();
    if (!rule)
        return {};
    const widthMatch = rule.match(/(?:^|\s)(\d*\.?\d+)px(?:\s|$)/);
    const width = widthMatch ? Number.parseFloat(widthMatch[1]) : undefined;
    const color = rule
        .replace(widthMatch?.[0] ?? '', ' ')
        .replace(/\b(?:none|hidden|dotted|dashed|solid|double|groove|ridge|inset|outset)\b/, '')
        .trim();
    return {
        color: color || undefined,
        width: Number.isFinite(width) ? width : undefined,
    };
};
/**
 * Read visible, in-flow flex items in their actual CSS order.
 */
const measureItems = (flex, canvas, style) => {
    const origin = canvas.getBoundingClientRect();
    const scaleX = origin.width / (canvas.clientWidth || 1);
    const scaleY = origin.height / (canvas.clientHeight || 1);
    const horizontal = style.flexDirection.startsWith('row');
    const reverse = style.flexDirection.endsWith('reverse');
    const forward = horizontal ? ((style.direction === 'rtl') === reverse) : !reverse;
    return Array.from(flex.children)
        .filter((child) => child instanceof HTMLElement && child !== canvas)
        .flatMap((child, index) => {
        const itemStyle = getComputedStyle(child);
        if (itemStyle.display === 'none'
            || itemStyle.position === 'absolute'
            || itemStyle.position === 'fixed') {
            return [];
        }
        const rect = child.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0)
            return [];
        const box = {
            left: (rect.left - origin.left) / scaleX,
            right: (rect.right - origin.left) / scaleX,
            top: (rect.top - origin.top) / scaleY,
            bottom: (rect.bottom - origin.top) / scaleY,
        };
        const start = horizontal ? box.left : box.top;
        const end = horizontal ? box.right : box.bottom;
        return [
            {
                index,
                order: Number.parseInt(itemStyle.order, 10) || 0,
                box,
                mainStart: forward ? start : -end,
                mainEnd: forward ? end : -start,
                crossStart: horizontal ? box.top : box.left,
                crossEnd: horizontal ? box.bottom : box.right,
            },
        ];
    })
        .sort((a, b) => a.order - b.order || a.index - b.index);
};
/**
 * Separate flex lines by the reset of the main-axis position, not shared grid tracks.
 */
const collectLines = (items, wrap) => {
    const lines = [];
    for (const item of items) {
        const line = lines[lines.length - 1];
        if (!line || (wrap !== 'nowrap' && item.mainStart < line.lastMainEnd - 0.5)) {
            lines.push({
                items: [item],
                crossStart: item.crossStart,
                crossEnd: item.crossEnd,
                lastMainEnd: item.mainEnd,
            });
            continue;
        }
        line.items.push(item);
        line.crossStart = Math.min(line.crossStart, item.crossStart);
        line.crossEnd = Math.max(line.crossEnd, item.crossEnd);
        line.lastMainEnd = item.mainEnd;
    }
    return lines;
};
/**
 * Render both within-line and between-line rules without drawing empty columns.
 */
const paint = (flex, canvas, context, options) => {
    const style = getComputedStyle(flex);
    const rule = readRule(style);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    const bitmapWidth = Math.round(width * dpr);
    const bitmapHeight = Math.round(height * dpr);
    if (canvas.width !== bitmapWidth || canvas.height !== bitmapHeight) {
        canvas.width = bitmapWidth;
        canvas.height = bitmapHeight;
    }
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    if (width === 0 || height === 0)
        return;
    const items = measureItems(flex, canvas, style);
    const lines = collectLines(items, style.flexWrap);
    const horizontal = style.flexDirection.startsWith('row');
    const contentStart = Number.parseFloat(horizontal ? style.paddingLeft : style.paddingTop) || 0;
    const contentEnd = (horizontal ? width : height)
        - (Number.parseFloat(horizontal ? style.paddingRight : style.paddingBottom) || 0);
    // Укорачивать концы каждой линии на величину общего отступа.
    const insetValue = style.getPropertyValue('rule-inset').trim()
        || style.getPropertyValue('--flex-rule-inset').trim();
    const insetParts = insetValue.match(/^(-?\d*\.?\d+)(?:px)?(?:\s+(-?\d*\.?\d+)(?:px)?)?$/);
    const insetStart = insetParts ? Number(insetParts[1]) : 0;
    const insetEnd = insetParts ? Number(insetParts[2] ?? insetParts[1]) : 0;
    // Явное отключение нельзя отличить от значения column-rule по умолчанию без маркера.
    const hideColumnRules = style.getPropertyValue('--flex-column-rule-style').trim() === 'none';
    context.strokeStyle = options.color
        ?? rule.color
        ?? (style.getPropertyValue('--flex-rule-color').trim() || style.color);
    context.lineWidth = options.width
        ?? rule.width
        ?? (Number.parseFloat(style.getPropertyValue('--flex-rule-width')) || 1);
    context.beginPath();
    for (const line of lines) {
        for (let i = 1; i < line.items.length; i++) {
            const before = line.items[i - 1];
            const after = line.items[i];
            if (after.mainStart < before.mainEnd - 0.5)
                continue;
            const middle = (before.mainEnd + after.mainStart) / 2;
            const reversedMainAxis = horizontal
                ? (style.direction === 'rtl') !== style.flexDirection.endsWith('reverse')
                : style.flexDirection.endsWith('reverse');
            const position = reversedMainAxis ? -middle : middle;
            const start = line.crossStart + insetStart;
            const end = line.crossEnd - insetEnd;
            if (start >= end)
                continue;
            if (horizontal) {
                if (hideColumnRules)
                    continue;
                context.moveTo(position, start);
                context.lineTo(position, end);
            }
            else {
                context.moveTo(start, position);
                context.lineTo(end, position);
            }
        }
    }
    for (let i = 1; i < lines.length; i++) {
        const a = lines[i - 1];
        const b = lines[i];
        const previousBeforeNext = a.crossEnd <= b.crossStart;
        const nextBeforePrevious = b.crossEnd <= a.crossStart;
        if (!previousBeforeNext && !nextBeforePrevious)
            continue;
        const middle = previousBeforeNext ? (a.crossEnd + b.crossStart) / 2 : (b.crossEnd + a.crossStart) / 2;
        const start = contentStart + insetStart;
        const end = contentEnd - insetEnd;
        if (start >= end)
            continue;
        if (horizontal) {
            context.moveTo(start, middle);
            context.lineTo(end, middle);
        }
        else {
            if (hideColumnRules)
                continue;
            context.moveTo(middle, start);
            context.lineTo(middle, end);
        }
    }
    context.stroke();
};
/**
 * Draw solid `rule` gap decorations on a flex container in browsers without native support.
 * The returned cleanup function disconnects observers and removes the canvas.
 * Supports flex-wrap, row/column directions, reverse directions, and changing item sizes.
 * Does not implement every CSS Gaps feature (lists, dashed, writing modes).
 */
export const polyfillFlexRule = (flex, options = {}) => {
    if (!options.force && CSS.supports('rule', '1px solid'))
        return () => {
        };
    if (!['flex', 'inline-flex'].includes(getComputedStyle(flex).display)) {
        throw new TypeError('polyfillFlexRule expects display: flex or inline-flex');
    }
    const canvas = document.createElement('canvas');
    canvas.dataset.flexRuleOverlay = '';
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, {
        position: 'absolute',
        inset: '0',
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: '1',
    });
    const previousPosition = flex.style.position;
    const adjustedPosition = getComputedStyle(flex).position === 'static';
    if (adjustedPosition)
        flex.style.position = 'relative';
    flex.append(canvas);
    const context = canvas.getContext('2d');
    if (!context) {
        canvas.remove();
        if (adjustedPosition)
            flex.style.position = previousPosition;
        throw new Error('Canvas 2D is unavailable');
    }
    let frame = 0;
    let destroyed = false;
    /**
     * Coalesce observer events into a single repaint on the next frame.
     */
    const schedule = () => {
        if (!frame && !destroyed) {
            frame = requestAnimationFrame(() => {
                frame = 0;
                paint(flex, canvas, context, options);
            });
        }
    };
    const resizeObserver = new ResizeObserver(schedule);
    /**
     * Reattach observers only when the direct item list has changed.
     */
    const observeItems = () => {
        resizeObserver.disconnect();
        resizeObserver.observe(flex);
        for (const child of Array.from(flex.children)) {
            if (child instanceof HTMLElement && child !== canvas)
                resizeObserver.observe(child);
        }
        schedule();
    };
    const mutationObserver = new MutationObserver((records) => {
        if (records.some((record) => record.type === 'childList' && record.target === flex)) {
            observeItems();
            return;
        }
        schedule();
    });
    mutationObserver.observe(flex, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'hidden', 'dir'],
    });
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    flex.addEventListener('scroll', schedule);
    flex.addEventListener('transitionend', schedule, true);
    flex.addEventListener('animationend', schedule, true);
    observeItems();
    /**
     * Stop painting and restore any positioning overridden for the overlay.
     */
    return () => {
        destroyed = true;
        cancelAnimationFrame(frame);
        mutationObserver.disconnect();
        resizeObserver.disconnect();
        window.removeEventListener('resize', schedule);
        window.removeEventListener('scroll', schedule, true);
        flex.removeEventListener('scroll', schedule);
        flex.removeEventListener('transitionend', schedule, true);
        flex.removeEventListener('animationend', schedule, true);
        canvas.remove();
        if (adjustedPosition)
            flex.style.position = previousPosition;
    };
};
//# sourceMappingURL=flex-rule-polyfill.js.map