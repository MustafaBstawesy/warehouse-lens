import { getSession } from '../Shared/Session';
import { relativeTime, materialImage } from '../Shared/Format';

/** Recent scans (server-side history: deduplicated, bounded, user-scoped). */
export default function RecentScanItems() {
    const scans = getSession().recentScans || [];
    return scans
        .filter(function (r) { return r && r.material; })
        .map(function (r) {
            return {
                key: r.material.ID,
                image: materialImage(r.material.imagePath),
                title: r.material.name,
                subhead: r.material.materialCode,
                footnote: relativeTime(r.scannedAt),
                accessory: 'disclosureIndicator'
            };
        });
}
