import * as THREE from 'three';
import { CONFIG } from './config.js';

/**
 * Create a safeOffset helper bound to a track instance.
 * Returns a function: (t, dist, side?) => { pos, angle, tangent, right }
 */
export function createSafeOffset(track) {
  return (t, dist, side = 1) => {
    const p = track.spline.getPointAt(t);
    const tangent = track.spline.getTangentAt(t);
    const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
    const pos = p.clone().add(right.clone().multiplyScalar(dist * side));
    const angle = Math.atan2(tangent.x, tangent.z);
    return { pos, angle, tangent, right };
  };
}

/**
 * Create an isSafe helper bound to a track instance.
 * Returns a function: (x, z, extraDist?) => boolean
 */
export function createIsSafe(track) {
  const hw = (track._trackWidth || CONFIG.trackWidth) / 2;
  return (x, z, extraDist = 0) => {
    return track.distToTrack(x, z) >= hw + 5 + extraDist;
  };
}

/**
 * Create a placeStand helper bound to a track instance.
 * Returns a function: (t, dist, side, width, height, depth, color, roofColor, seatColors?) => pos|null
 *
 * seatColors: optional array of 3+ colors for seating rows.
 *             Defaults to [0xcc0000, 0xffffff, 0x003399] if not provided.
 */
export function createPlaceStand(track) {
  const safeOffset = createSafeOffset(track);
  const isSafe = createIsSafe(track);

  return (t, dist, side, width, height, depth, color, roofColor, seatColors) => {
    const { pos, angle } = safeOffset(t, dist, side);
    if (!isSafe(pos.x, pos.z, width / 2)) return null;

    const standGeo = new THREE.BoxGeometry(width, height, depth);
    const standMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    const stand = new THREE.Mesh(standGeo, standMat);
    stand.position.set(pos.x, pos.y + height / 2, pos.z);
    stand.rotation.y = angle;
    stand.castShadow = true;
    stand.receiveShadow = true;
    track._add(stand);

    // Roof canopy
    const roofGeo = new THREE.BoxGeometry(width + 2, 0.4, depth + 2);
    const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.3, metalness: 0.3 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(pos.x, pos.y + height + 0.2, pos.z);
    roof.rotation.y = angle;
    roof.castShadow = true;
    track._add(roof);

    const colors = seatColors || [0xcc0000, 0xffffff, 0x003399];
    const rows = 3;
    const cols = Math.floor(width / 2);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const seatGeo = new THREE.BoxGeometry(0.5, 0.7, 0.5);
        const seatMat = new THREE.MeshStandardMaterial({ color: colors[r % colors.length] });
        const seat = new THREE.Mesh(seatGeo, seatMat);
        const localX = (c - cols / 2 + 0.5) * 1.8;
        const localZ = (r - 1) * (depth / 2.5);
        const cosA = Math.cos(angle), sinA = Math.sin(angle);
        seat.position.set(
          pos.x + localX * cosA + localZ * sinA,
          pos.y + 0.5 + r * 1.0,
          pos.z - localX * sinA + localZ * cosA
        );
        seat.rotation.y = angle;
        track._add(seat);
      }
    }
    return pos;
  };
}

/**
 * Create a placeBoard helper bound to a track instance.
 * Returns a function: (t, dist, side, sponsor) => void
 *
 * sponsor: { name: string, bg: string, fg: string }
 */
export function createPlaceBoard(track) {
  const safeOffset = createSafeOffset(track);
  const isSafe = createIsSafe(track);

  return (t, dist, side, sponsor) => {
    const { pos, angle } = safeOffset(t, dist, side);
    if (!isSafe(pos.x, pos.z, 3)) return;

    const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 3.5, 6);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.6 });
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(pos.x, pos.y + 1.5, pos.z);
    track._add(post);

    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = sponsor.bg;
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = sponsor.fg;
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(sponsor.name, 128, 64);
    const tex = new THREE.CanvasTexture(canvas);

    const boardGeo = new THREE.BoxGeometry(6, 3, 0.2);
    const boardMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3 });
    const board = new THREE.Mesh(boardGeo, boardMat);
    board.position.set(pos.x, pos.y + 4.5, pos.z);
    board.rotation.y = angle;
    board.castShadow = true;
    track._add(board);
  };
}
