export interface AllocationFlowInput {
  round: 'spread' | 'append';
  candidates: { ipId: string; projectId: string; timing: 'within' | 'after' }[];
  groups: { id: string; existingCount: number; vacantCount: number }[];
  rowCount: number;
}

/** Integral min-cost flow, with residual edges allowing earlier choices to be reassigned. */
export function solveAllocationFlow(input: AllocationFlowInput): number[] {
  const { candidates, groups, rowCount, round } = input;
  const ips = [...new Set(candidates.map((item) => item.ipId))];
  const source = 0;
  const budget = 1 + ips.length + groups.length;
  const sink = budget + 1;
  type Edge = { to: number; reverse: number; capacity: number; cost: number };
  const graph: Edge[][] = Array.from({ length: sink + 1 }, () => []);
  const add = (from: number, to: number, capacity: number, cost: number) => {
    const edge = { to, reverse: graph[to].length, capacity, cost };
    graph[from].push(edge);
    graph[to].push({ to: from, reverse: graph[from].length - 1, capacity: 0, cost: -cost });
    return edge;
  };
  // Lexicographic costs: allocate feasible IPs first, prefer within-period pairs,
  // then (append only) minimize squared final counts, and finally prefer earlier RDs.
  // Bounds use marginal count increases, avoiding huge constant historical costs.
  const orderBound = ips.length * Math.max(0, groups.length - 1);
  const balanceScale = orderBound + 1;
  const maximumExisting = Math.max(0, ...groups.map((group) => group.existingCount));
  const balanceBound = round === 'append' ? ips.length * (2 * maximumExisting + ips.length) * balanceScale : 0;
  const timingScale = balanceBound + orderBound + 1;
  const unassignedCost = ips.length * timingScale + balanceBound + orderBound + 1;
  if (!Number.isSafeInteger(unassignedCost)) throw new Error('Allocation cost limit exceeded');
  const ipNodes = new Map(ips.map((id, index) => [id, index + 1]));
  const rdNodes = new Map(groups.map((group, index) => [group.id, ips.length + index + 1]));
  for (const node of ipNodes.values()) {
    add(source, node, 1, 0);
    add(node, sink, 1, unassignedCost); // An IP may remain unassigned when no feasible slot exists.
  }
  const allocationEdges = candidates.map((item) => add(
    ipNodes.get(item.ipId)!, rdNodes.get(item.projectId)!, 1,
    item.timing === 'after' ? timingScale : 0,
  ));
  for (const [index, group] of groups.entries()) {
    const count = candidates.filter((item) => item.projectId === group.id).length;
    const roundLimit = round === 'spread' ? (group.existingCount ? 0 : 1) : count;
    const slots = Math.min(roundLimit, count, group.vacantCount + 200 - rowCount);
    for (let slot = 0; slot < slots; slot++) {
      // Empty-RD spreading has one slot. Appending counts old and first-round IPs.
      const balanceCost = round === 'append' ? (2 * (group.existingCount + slot) + 1) * balanceScale : 0;
      add(rdNodes.get(group.id)!, slot < group.vacantCount ? sink : budget, 1, balanceCost + index);
    }
  }
  add(budget, sink, 200 - rowCount, 0);
  const potential = Array(graph.length).fill(0) as number[];
  for (let flow = 0; flow < ips.length; flow++) {
    const distance = Array(graph.length).fill(Infinity) as number[];
    const visited = Array(graph.length).fill(false) as boolean[];
    const previous: { node: number; edge: Edge }[] = [];
    distance[source] = 0;
    // At most 403 nodes. O(V² + E) avoids a heap and remains bounded at 200 IPs.
    for (let iteration = 0; iteration < graph.length; iteration++) {
      let node = -1;
      for (let index = 0; index < graph.length; index++) {
        if (!visited[index] && Number.isFinite(distance[index]) && (node < 0 || distance[index] < distance[node])) node = index;
      }
      if (node < 0) break;
      visited[node] = true;
      for (const edge of graph[node]) {
        if (!edge.capacity || visited[edge.to]) continue;
        const next = distance[node] + edge.cost + potential[node] - potential[edge.to];
        if (next < distance[edge.to]) {
          distance[edge.to] = next;
          previous[edge.to] = { node, edge };
        }
      }
    }
    if (!previous[sink]) throw new Error('No feasible allocation flow');
    for (let node = 0; node < graph.length; node++) if (Number.isFinite(distance[node])) potential[node] += distance[node];
    for (let node = sink; node !== source;) {
      const step = previous[node];
      step.edge.capacity--;
      graph[node][step.edge.reverse].capacity++;
      node = step.node;
    }
  }
  return allocationEdges.flatMap((edge, index) => edge.capacity === 0 ? [index] : []);
}
