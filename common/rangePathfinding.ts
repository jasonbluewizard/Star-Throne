export interface Position { x: number; y: number; }

/** Build a full distance matrix for all planets */
export function buildDistanceMatrix(planets: Position[]): Float32Array[] {
  const n = planets.length;
  const matrix: Float32Array[] = new Array(n);
  for (let i = 0; i < n; i++) {
    matrix[i] = new Float32Array(n);
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = planets[i].x - planets[j].x;
      const dy = planets[i].y - planets[j].y;
      const d = Math.hypot(dx, dy);
      matrix[i][j] = d;
      matrix[j][i] = d;
    }
  }
  return matrix;
}

/** Build adjacency list based on jump range */
export function buildAdjacencyList(range: number, matrix: Float32Array[]): Int16Array[] {
  const n = matrix.length;
  const adj: Int16Array[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const neighbors: number[] = [];
    for (let j = 0; j < n; j++) {
      if (i !== j && matrix[i][j] <= range) neighbors.push(j);
    }
    adj[i] = Int16Array.from(neighbors);
  }
  return adj;
}

/** Breadth first search returning path or null */
export function findPath(adj: Int16Array[], start: number, target: number): number[] | null {
  if (start === target) return [start];
  const n = adj.length;
  const visited = new Array<boolean>(n).fill(false);
  const prev = new Int16Array(n).fill(-1);
  const queue: number[] = [];
  queue.push(start);
  visited[start] = true;
  while (queue.length) {
    const v = queue.shift()!;
    for (const nb of adj[v]) {
      if (!visited[nb]) {
        visited[nb] = true;
        prev[nb] = v;
        if (nb === target) {
          const path: number[] = [];
          for (let cur = nb; cur !== -1; cur = prev[cur]) path.push(cur);
          return path.reverse();
        }
        queue.push(nb);
      }
    }
  }
  return null;
}

/** Update player range and rebuild adjacency list */
export function updatePlayerRange(range: number, matrix: Float32Array[]): Int16Array[] {
  return buildAdjacencyList(range, matrix);
}