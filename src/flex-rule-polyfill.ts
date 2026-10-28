/**
 * Options for solid gap decorations on a flex container.
 */
export interface FlexRuleOptions {
    /**
     * Render the canvas even if the browser supports native `rule` (useful for testing).
     */
    force?: boolean;
    color?: string;
    width?: number;

}

interface Box {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

interface FlexItem {
    index: number;
    order: number;
    box: Box;
    mainStart: number;
    mainEnd: number;
    crossStart: number;
    crossEnd: number;
}

interface FlexLine {
    items: FlexItem[];
    crossStart: number;
    crossEnd: number;
    lastMainEnd: number;
}

interface RuleValues {
    color?: string;
    width?: number;
}

/** Read the supported parts of the computed `rule` shorthand. */
const readRule = (style: CSSStyleDeclaration): RuleValues => {
    const rule = style.getPropertyValue('rule').trim();
    if (!rule) return {};

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
const measureItems = (
    flex: HTMLElement,
    canvas: HTMLCanvasElement,
    style: CSSStyleDeclaration,
): FlexItem[] => {
    const origin = canvas.getBoundingClientRect();
    const scaleX = origin.width / (canvas.clientWidth || 1);
    const scaleY = origin.height / (canvas.clientHeight || 1);
    const horizontal = style.flexDirection.startsWith('row');
    const reverse = style.flexDirection.endsWith('reverse');
    const forward = horizontal ? ((style.direction === 'rtl') === reverse) : !reverse;

    return Array.from(flex.children)
        .filter((child: Element): child is HTMLElement => child instanceof HTMLElement && child !== canvas)
        .flatMap((child: HTMLElement, index: number): FlexItem[] => {
            const itemStyle = getComputedStyle(child);
            if (
                itemStyle.display === 'none'
                || itemStyle.position === 'absolute'
                || itemStyle.position === 'fixed'
            ) {
                return [];
            }

            const rect = child.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return [];

            const box: Box = {
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
        .sort((a: FlexItem, b: FlexItem): number => a.order - b.order || a.index - b.index);
};

/**
 * Separate flex lines by the reset of the main-axis position, not shared grid tracks.
 */
const collectLines = (items: FlexItem[], wrap: string): FlexLine[] => {
    const lines: FlexLine[] = [];

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
const paint = (
    flex: HTMLElement,
    canvas: HTMLCanvasElement,
    context: CanvasRenderingContext2D,
    options: FlexRuleOptions,
): void => {
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
    if (width === 0 || height === 0) return;

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
    // Сохранять прежнюю отрисовку обоих направлений, пока не задано отдельное правило.
    const columnOverride = style.getPropertyValue('--flex-column-rule-style').trim();
    const rowOverride = style.getPropertyValue('--flex-row-rule-style').trim();
    const columnStyle = columnOverride || style.columnRuleStyle;
    const rowStyle = rowOverride || style.getPropertyValue('row-rule-style').trim();
    const axisStylesSpecified = Boolean(columnOverride || rowOverride
        || (columnStyle && columnStyle !== 'none') || (rowStyle && rowStyle !== 'none'));
    const drawColumns = !axisStylesSpecified || Boolean(columnStyle && columnStyle !== 'none' && columnStyle !== 'hidden');
    const drawRows = !axisStylesSpecified || Boolean(rowStyle && rowStyle !== 'none' && rowStyle !== 'hidden');

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
            if (after.mainStart < before.mainEnd - 0.5) continue;

            const middle = (before.mainEnd + after.mainStart) / 2;
            const reversedMainAxis = horizontal
                ? (style.direction === 'rtl') !== style.flexDirection.endsWith('reverse')
                : style.flexDirection.endsWith('reverse');
            const position = reversedMainAxis ? -middle : middle;
            const start = line.crossStart + insetStart;
            const end = line.crossEnd - insetEnd;
            if (start >= end) continue;

            if (horizontal) {
                if (!drawColumns) continue;
                context.moveTo(position, start);
                context.lineTo(position, end);
            } else {
                if (!drawRows) continue;
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
        if (!previousBeforeNext && !nextBeforePrevious) continue;

        const middle = previousBeforeNext ? (a.crossEnd + b.crossStart) / 2 : (b.crossEnd + a.crossStart) / 2;
        const start = contentStart + insetStart;
        const end = contentEnd - insetEnd;
        if (start >= end) continue;

        if (horizontal) {
            if (!drawRows) continue;
            context.moveTo(start, middle);
            context.lineTo(end, middle);
        } else {
            if (!drawColumns) continue;
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
export const polyfillFlexRule = (flex: HTMLElement, options: FlexRuleOptions = {}): (() => void) => {
    if (!options.force && CSS.supports('rule', '1px solid')) return (): void => {
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
    if (adjustedPosition) flex.style.position = 'relative';
    flex.append(canvas);

    const context = canvas.getContext('2d');
    if (!context) {
        canvas.remove();
        if (adjustedPosition) flex.style.position = previousPosition;
        throw new Error('Canvas 2D is unavailable');
    }

    let frame = 0;
    let destroyed = false;

    /**
     * Coalesce observer events into a single repaint on the next frame.
     */
    const schedule = (): void => {
        if (!frame && !destroyed) {
            frame = requestAnimationFrame((): void => {
                frame = 0;
                paint(flex, canvas, context, options);
            });
        }
    };

    const resizeObserver = new ResizeObserver(schedule);

    /**
     * Reattach observers only when the direct item list has changed.
     */
    const observeItems = (): void => {
        resizeObserver.disconnect();
        resizeObserver.observe(flex);
        for (const child of Array.from(flex.children)) {
            if (child instanceof HTMLElement && child !== canvas) resizeObserver.observe(child);
        }

        schedule();
    };

    const mutationObserver = new MutationObserver((records: MutationRecord[]): void => {
        if (records.some((record: MutationRecord): boolean => record.type === 'childList' && record.target === flex)) {
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
    return (): void => {
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
        if (adjustedPosition) flex.style.position = previousPosition;
    };
};
