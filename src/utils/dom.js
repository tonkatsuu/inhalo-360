export function isFromOverlayElement(target) {
    return target instanceof Element && target.closest('[data-ui-overlay="true"]') !== null
}
