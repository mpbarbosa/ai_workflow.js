/**
 * @fileoverview StreamViewer — re-exports StreamViewer and wrapText from pajussara_tui_comp
 * @module cli/tui/components/StreamViewer
 *
 * Imports {@link StreamViewer} and {@link wrapText} from the pajussara_tui_comp CDN
 * package and re-exports them. The API is identical to the previous local
 * implementation so no changes to callers are required.
 *
 * @version 2.0.0
 * @since 2026-04-04
 */

export { StreamViewer, wrapText } from 'pajussara_tui_comp';

export { StreamViewer as default } from 'pajussara_tui_comp';
