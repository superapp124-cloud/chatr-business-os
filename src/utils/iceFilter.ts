// CHATR+ ICE Candidate Filter
// Prunes bad ICE candidates before they are sent to signaling.
// Drops VPN, virtual adapter, and loopback candidates that only slow ICE down.
// Always keeps TURN relay candidates — critical for NAT traversal.

export interface ICEFilterOptions {
  dropVPN?: boolean;      // remove tun/utun/wg/proton/nord interfaces
  dropVirtual?: boolean;  // remove vmnet/docker/veth/virbr
  dropLoopback?: boolean; // remove 127.x, ::1
  dropLinkLocal?: boolean;// remove 169.254.x.x
}

const VPN_PATTERNS = [/^tun\d/i, /^utun\d/i, /^wg\d/i, /^proton/i, /^nord/i, /^vpn/i];
const VIRT_PATTERNS = [/^vmnet/i, /^docker/i, /^veth/i, /^virbr/i, /^vboxnet/i];

/** Returns true if this candidate should be sent to the remote peer. */
export function shouldKeepCandidate(
  candidate: RTCIceCandidate,
  opts: ICEFilterOptions = {},
): boolean {
  const { type, address, relatedAddress, protocol } = candidate;

  // Always keep TURN relay — without it, symmetric NAT fails
  if (type === 'relay') return true;

  const addr = address ?? '';

  // Drop loopback (default: yes)
  if (opts.dropLoopback !== false) {
    if (addr.startsWith('127.') || addr === '::1') {
      console.debug(`[ICE] 🗑️ Pruned loopback: ${addr}`);
      return false;
    }
  }

  // Drop link-local (default: yes)
  if (opts.dropLinkLocal !== false) {
    if (addr.startsWith('169.254.') || addr.startsWith('fe80:')) {
      console.debug(`[ICE] 🗑️ Pruned link-local: ${addr}`);
      return false;
    }
  }

  // Use relatedAddress (the actual interface IP) for interface pattern matching
  const iface = relatedAddress ?? addr;

  if (opts.dropVPN !== false) {
    const isVPN = VPN_PATTERNS.some(p => p.test(iface));
    if (isVPN) {
      console.debug(`[ICE] 🗑️ Pruned VPN candidate: ${type} ${addr}`);
      return false;
    }
  }

  if (opts.dropVirtual !== false) {
    const isVirtual = VIRT_PATTERNS.some(p => p.test(iface));
    if (isVirtual) {
      console.debug(`[ICE] 🗑️ Pruned virtual adapter: ${type} ${addr}`);
      return false;
    }
  }

  return true;
}

/**
 * Sort candidates: relay > srflx > prflx > host
 * Also prefers UDP over TCP (lower latency).
 */
export function rankCandidates(
  candidates: RTCIceCandidate[],
): RTCIceCandidate[] {
  const typeOrder: Record<string, number> = {
    relay:  0,
    srflx:  1,
    prflx:  2,
    host:   3,
  };
  return [...candidates].sort((a, b) => {
    const typeDiff =
      (typeOrder[a.type ?? 'host'] ?? 4) -
      (typeOrder[b.type ?? 'host'] ?? 4);
    if (typeDiff !== 0) return typeDiff;
    // Prefer UDP
    const aUdp = (a.protocol ?? 'udp') === 'udp' ? 0 : 1;
    const bUdp = (b.protocol ?? 'udp') === 'udp' ? 0 : 1;
    return aUdp - bUdp;
  });
}
