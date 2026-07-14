import type { Point, Scenario } from './pathfinding'

export type LocalPlannerId = 'teb' | 'dwa' | 'vfh' | 'potential-field' | 'trajopt'

export type LocalPlannerStatus = 'running' | 'complete' | 'failed'

export interface LocalPlannerMetricsDelta {
  expansions: number
  generated: number
  relaxations: number
  openSize: number
}

export interface LocalPlannerStepResult {
  status: LocalPlannerStatus
  current: Point | null
  relaxed: Point[]
  visited: Point[]
  frontier: Point[]
  previewPath: Point[]
  path?: Point[]
  pathCost?: number
  action: string
  metrics: LocalPlannerMetricsDelta
}

interface HeapNode {
  point: Point
  priority: number
  secondary: number
  g: number
  order: number
}

class MinHeap {
  private data: HeapNode[] = []

  get size() {
    return this.data.length
  }

  push(node: HeapNode) {
    this.data.push(node)
    let index = this.data.length - 1
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2)
      if (heapBefore(this.data[parent], this.data[index])) break
      ;[this.data[parent], this.data[index]] = [this.data[index], this.data[parent]]
      index = parent
    }
  }

  pop(): HeapNode | undefined {
    if (this.data.length === 0) return undefined
    const root = this.data[0]
    const tail = this.data.pop()!
    if (this.data.length > 0) {
      this.data[0] = tail
      let index = 0
      while (true) {
        const left = index * 2 + 1
        const right = left + 1
        let smallest = index
        if (left < this.data.length && heapBefore(this.data[left], this.data[smallest])) {
          smallest = left
        }
        if (right < this.data.length && heapBefore(this.data[right], this.data[smallest])) {
          smallest = right
        }
        if (smallest === index) break
        ;[this.data[index], this.data[smallest]] = [this.data[smallest], this.data[index]]
        index = smallest
      }
    }
    return root
  }
}

function heapBefore(left: HeapNode, right: HeapNode) {
  if (Math.abs(left.priority - right.priority) > 1e-9) return left.priority < right.priority
  if (Math.abs(left.secondary - right.secondary) > 1e-9) {
    return left.secondary < right.secondary
  }
  return left.order < right.order
}

interface GuideSearch {
  heap: MinHeap
  openKeys: Set<string>
  closedKeys: Set<string>
  discovered: Set<string>
  gScore: Map<string, number>
  cameFrom: Map<string, string>
  order: number
}

interface ControllerBase {
  position: Point
  path: Point[]
  guide: Point[]
  cursor: number
  recoveryAnchor: number
  stuckTicks: number
  iterations: number
  permanentRecovery: boolean
}

interface DwaState extends ControllerBase {
  kind: 'dwa'
  heading: number
  velocity: number
  angularVelocity: number
}

interface VfhState extends ControllerBase {
  kind: 'vfh'
  heading: number
  blockedSectors: boolean[]
}

interface PotentialFieldState extends ControllerBase {
  kind: 'potential-field'
  recoveryActive: boolean
}

interface TebState {
  kind: 'teb'
  guide: Point[]
  reference: Point[]
  band: Point[]
  bestBand: Point[]
  timeDiffs: number[]
  bestObjective: number
  iterations: number
  stableIterations: number
}

interface TrajOptState {
  kind: 'trajopt'
  guide: Point[]
  reference: Point[]
  trajectory: Point[]
  bestTrajectory: Point[]
  bestObjective: number
  trustRegion: number
  iterations: number
  stableIterations: number
}

type PlannerState = DwaState | VfhState | PotentialFieldState | TebState | TrajOptState

interface InternalState {
  id: LocalPlannerId
  start: Point
  target: Point
  status: LocalPlannerStatus
  phase: 'guide' | 'planner' | 'complete' | 'failed'
  guideSearch: GuideSearch | null
  guide: Point[] | null
  planner: PlannerState | null
  previewPath: Point[]
  finalPath?: Point[]
  finalPathCost?: number
  action: string
}

const localPlannerState = Symbol('local-planner-state')

/** An opaque, mutable planner handle. Use stepLocalPlanner to advance it. */
export interface LocalPlannerState {
  readonly [localPlannerState]: InternalState
}

interface TickVisual {
  current: Point | null
  relaxed: Point[]
  visited: Point[]
  frontier: Point[]
  action: string
}

const zeroMetrics = (): LocalPlannerMetricsDelta => ({
  expansions: 0,
  generated: 0,
  relaxations: 0,
  openSize: 0,
})

export function createLocalPlannerState(
  id: LocalPlannerId,
  start: Point,
  target: Point,
  scenario: Scenario,
): LocalPlannerState {
  const internal: InternalState = {
    id,
    start: clonePoint(start),
    target: clonePoint(target),
    status: 'running',
    phase: 'guide',
    guideSearch: null,
    guide: null,
    planner: null,
    previewPath: [],
    action: '准备增量 A* 可行参考线…',
  }

  if (!isGridPointWalkable(start, scenario) || !isGridPointWalkable(target, scenario)) {
    internal.status = 'failed'
    internal.phase = 'failed'
    internal.action = '起点或终点不可用 · 无可行路径'
  } else if (samePoint(start, target)) {
    internal.status = 'complete'
    internal.phase = 'complete'
    internal.guide = [clonePoint(start)]
    internal.previewPath = [clonePoint(start)]
    internal.finalPath = [clonePoint(start)]
    internal.finalPathCost = 0
    internal.action = '起点与终点重合 · 航段已锁定'
  } else {
    internal.guideSearch = createGuideSearch(start, target, scenario)
  }

  return Object.freeze({ [localPlannerState]: internal })
}

export function stepLocalPlanner(
  state: LocalPlannerState,
  scenario: Scenario,
): LocalPlannerStepResult {
  const internal = state[localPlannerState]
  const metrics = zeroMetrics()
  const visual: TickVisual = {
    current: null,
    relaxed: [],
    visited: [],
    frontier: [],
    action: internal.action,
  }

  if (internal.status === 'running') {
    if (internal.phase === 'guide') stepGuide(internal, scenario, visual, metrics)
    else if (internal.phase === 'planner') stepPlanner(internal, scenario, visual, metrics)
  }

  internal.action = visual.action
  return {
    status: internal.status,
    current: visual.current ? clonePoint(visual.current) : null,
    relaxed: visual.relaxed.map(clonePoint),
    visited: visual.visited.map(clonePoint),
    frontier: visual.frontier.map(clonePoint),
    previewPath: internal.previewPath.map(clonePoint),
    path: internal.finalPath?.map(clonePoint),
    pathCost: internal.finalPathCost,
    action: internal.action,
    metrics,
  }
}

function createGuideSearch(start: Point, target: Point, scenario: Scenario): GuideSearch {
  const heap = new MinHeap()
  const h = gridHeuristic(start, target, scenario.allowDiagonal)
  heap.push({ point: clonePoint(start), priority: h, secondary: h, g: 0, order: 0 })
  const startKey = pointKey(start)
  return {
    heap,
    openKeys: new Set([startKey]),
    closedKeys: new Set(),
    discovered: new Set([startKey]),
    gScore: new Map([[startKey, 0]]),
    cameFrom: new Map(),
    order: 1,
  }
}

function stepGuide(
  internal: InternalState,
  scenario: Scenario,
  visual: TickVisual,
  metrics: LocalPlannerMetricsDelta,
) {
  const search = internal.guideSearch!
  let node: HeapNode | undefined
  while (search.heap.size > 0) {
    const candidate = search.heap.pop()!
    const key = pointKey(candidate.point)
    if (search.closedKeys.has(key)) continue
    const known = search.gScore.get(key)
    if (known === undefined || Math.abs(known - candidate.g) > 1e-9) continue
    node = candidate
    break
  }

  if (!node) {
    failState(internal, visual, '增量 A* 参考线搜索结束 · 无可行路径')
    return
  }

  const current = node.point
  const currentKey = pointKey(current)
  search.openKeys.delete(currentKey)
  search.closedKeys.add(currentKey)
  metrics.expansions = 1
  visual.current = current
  visual.visited = [current]

  if (samePoint(current, internal.target)) {
    const guide = reconstructGuide(search, internal.start, internal.target)
    if (!guide || !pathIsSafe(guide, scenario)) {
      failState(internal, visual, '参考线回溯失败 · 无可行路径')
      return
    }
    internal.guide = guide
    internal.previewPath = guide
    internal.planner = createPlanner(internal.id, guide, scenario)
    internal.phase = 'planner'
    visual.frontier = visualizedFrontier(search.openKeys)
    metrics.openSize = search.openKeys.size
    visual.action = `A* 参考线锁定 · ${guide.length - 1} 步 / 转入 ${plannerLabel(internal.id)}`
    return
  }

  const currentG = search.gScore.get(currentKey) ?? Number.POSITIVE_INFINITY
  for (const neighbor of gridNeighbors(current, scenario)) {
    const key = pointKey(neighbor.point)
    if (search.closedKeys.has(key)) continue
    const tentative = currentG + neighbor.cost
    const known = search.gScore.get(key) ?? Number.POSITIVE_INFINITY
    if (tentative >= known - 1e-9) continue
    search.gScore.set(key, tentative)
    search.cameFrom.set(key, currentKey)
    const h = gridHeuristic(neighbor.point, internal.target, scenario.allowDiagonal)
    search.heap.push({
      point: neighbor.point,
      priority: tentative + h,
      secondary: h,
      g: tentative,
      order: search.order++,
    })
    if (!search.discovered.has(key)) {
      search.discovered.add(key)
      metrics.generated += 1
    }
    search.openKeys.add(key)
    metrics.relaxations += 1
    visual.relaxed.push(neighbor.point)
  }

  metrics.openSize = search.openKeys.size
  visual.frontier = visualizedFrontier(search.openKeys)
  visual.action = `A* 参考线展开 ${formatPoint(current)} · 更新 ${visual.relaxed.length} 个邻居`
}

function createPlanner(id: LocalPlannerId, guide: Point[], scenario: Scenario): PlannerState {
  if (id === 'teb') {
    const band = simplifyGuide(guide, scenario)
    const timeDiffs = segmentTimeDiffs(band)
    const objective = tebObjective(band, timeDiffs, band, scenario)
    return {
      kind: 'teb',
      guide,
      reference: band.map(clonePoint),
      band: band.map(clonePoint),
      bestBand: band.map(clonePoint),
      timeDiffs,
      bestObjective: objective,
      iterations: 0,
      stableIterations: 0,
    }
  }
  if (id === 'trajopt') {
    const trajectory = simplifyGuide(guide, scenario)
    const objective = trajOptObjective(trajectory, trajectory, scenario)
    return {
      kind: 'trajopt',
      guide,
      reference: trajectory.map(clonePoint),
      trajectory: trajectory.map(clonePoint),
      bestTrajectory: trajectory.map(clonePoint),
      bestObjective: objective,
      trustRegion: 0.32,
      iterations: 0,
      stableIterations: 0,
    }
  }

  const base = createControllerBase(guide)
  const initialHeading = Math.atan2(guide[1].y - guide[0].y, guide[1].x - guide[0].x)
  if (id === 'dwa') {
    return {
      ...base,
      kind: 'dwa',
      heading: initialHeading,
      velocity: 0,
      angularVelocity: 0,
    }
  }
  if (id === 'vfh') {
    return {
      ...base,
      kind: 'vfh',
      heading: initialHeading,
      blockedSectors: Array.from({ length: 72 }, () => false),
    }
  }
  return { ...base, kind: 'potential-field', recoveryActive: false }
}

function createControllerBase(guide: Point[]): ControllerBase {
  return {
    position: clonePoint(guide[0]),
    path: [clonePoint(guide[0])],
    guide,
    cursor: 0,
    recoveryAnchor: Math.min(1, guide.length - 1),
    stuckTicks: 0,
    iterations: 0,
    permanentRecovery: false,
  }
}

function stepPlanner(
  internal: InternalState,
  scenario: Scenario,
  visual: TickVisual,
  metrics: LocalPlannerMetricsDelta,
) {
  const planner = internal.planner!
  if (planner.kind === 'dwa') stepDwa(internal, planner, scenario, visual, metrics)
  else if (planner.kind === 'vfh') stepVfh(internal, planner, scenario, visual, metrics)
  else if (planner.kind === 'potential-field') {
    stepPotentialField(internal, planner, scenario, visual, metrics)
  } else if (planner.kind === 'teb') stepTeb(internal, planner, scenario, visual, metrics)
  else stepTrajOpt(internal, planner, scenario, visual, metrics)
}

interface DwaCandidate {
  velocity: number
  angularVelocity: number
  trajectory: Point[]
  finalHeading: number
  clearance: number
  score: number
  recoveryAnchor: number
}

function stepDwa(
  internal: InternalState,
  state: DwaState,
  scenario: Scenario,
  visual: TickVisual,
  metrics: LocalPlannerMetricsDelta,
) {
  state.iterations += 1
  visual.current = clonePoint(state.position)
  visual.visited = [projectToGrid(state.position, scenario)]
  if (tryFinishController(internal, state, scenario, visual)) return

  state.permanentRecovery ||= state.iterations > controllerIterationBudget(state.guide)
  if (state.permanentRecovery) {
    completeWithGuideRecovery(internal, state, scenario, visual, metrics, 'DWA')
    return
  }
  if (state.stuckTicks >= 7) {
    recoveryStep(internal, state, scenario, visual, metrics, 'DWA')
    return
  }

  const referenceIndex = findRecoveryAnchor(state.position, state.guide, state.cursor, scenario)
  if (referenceIndex < 0) {
    state.permanentRecovery = true
    recoveryStep(internal, state, scenario, visual, metrics, 'DWA')
    return
  }
  state.recoveryAnchor = referenceIndex
  const reference = state.guide[referenceIndex]
  const dt = 0.28
  const minV = Math.max(0, state.velocity - 1.4 * dt)
  const maxV = Math.min(1.2, state.velocity + 1.4 * dt)
  const minW = Math.max(-2.4, state.angularVelocity - 3 * dt)
  const maxW = Math.min(2.4, state.angularVelocity + 3 * dt)
  const velocities = uniqueNumbers([...linspace(minV, maxV, 5), 0])
  const angularVelocities = uniqueNumbers([...linspace(minW, maxW, 7), 0])
  const candidates: DwaCandidate[] = []

  for (const velocity of velocities) {
    for (const angularVelocity of angularVelocities) {
      metrics.expansions += 1
      const simulation = simulateDwa(
        state.position,
        state.heading,
        velocity,
        angularVelocity,
        dt,
        scenario,
      )
      if (!simulation) continue
      const first = simulation.trajectory[0] ?? state.position
      const anchor = findRecoveryAnchor(first, state.guide, state.cursor, scenario)
      if (anchor < 0) continue
      const endpoint = simulation.trajectory[simulation.trajectory.length - 1] ?? state.position
      const referenceHeading = Math.atan2(reference.y - endpoint.y, reference.x - endpoint.x)
      const progress = euclidean(state.position, reference) - euclidean(endpoint, reference)
      const goalProgress = euclidean(state.position, internal.target) - euclidean(endpoint, internal.target)
      const headingScore = Math.cos(angleDifference(referenceHeading, simulation.finalHeading))
      const score =
        progress * 4.2 +
        goalProgress * 0.7 +
        headingScore * 1.35 +
        Math.min(2, simulation.clearance) * 0.22 +
        velocity * 0.18 -
        Math.abs(angularVelocity) * 0.045
      candidates.push({
        velocity,
        angularVelocity,
        trajectory: simulation.trajectory,
        finalHeading: simulation.finalHeading,
        clearance: simulation.clearance,
        score,
        recoveryAnchor: anchor,
      })
    }
  }

  metrics.generated = candidates.length
  metrics.openSize = candidates.length
  visual.relaxed = candidates.slice(0, 48).map((candidate) =>
    clonePoint(candidate.trajectory[candidate.trajectory.length - 1] ?? state.position),
  )
  visual.frontier = visual.relaxed.map(clonePoint)
  const best = candidates.reduce<DwaCandidate | null>(
    (winner, candidate) =>
      !winner || candidate.score > winner.score + 1e-9 ? candidate : winner,
    null,
  )
  if (!best) {
    state.stuckTicks += 1
    visual.action = 'DWA 动态窗口无安全轨迹 · 准备参考线恢复'
    return
  }

  const next = best.trajectory[0] ?? state.position
  const previousAnchor = state.recoveryAnchor
  const previousDistance = euclidean(state.position, state.guide[previousAnchor])
  state.position = clonePoint(next)
  state.heading = normalizeAngle(state.heading + best.angularVelocity * dt)
  state.velocity = best.velocity
  state.angularVelocity = best.angularVelocity
  state.recoveryAnchor = best.recoveryAnchor
  appendDistinct(state.path, state.position)
  internal.previewPath = state.path
  metrics.relaxations = euclidean(next, visual.current!) > 1e-8 ? 1 : 0
  const advanced =
    best.recoveryAnchor > previousAnchor ||
    euclidean(state.position, state.guide[best.recoveryAnchor]) < previousDistance - 0.01
  state.stuckTicks = advanced ? 0 : state.stuckTicks + 1
  updateReachedAnchor(state)
  visual.current = clonePoint(state.position)
  visual.visited = [projectToGrid(state.position, scenario)]
  visual.action = `DWA 动态窗口 · v ${best.velocity.toFixed(2)} / ω ${best.angularVelocity.toFixed(2)} · ${candidates.length} 条安全轨迹`
  tryFinishController(internal, state, scenario, visual)
}

function simulateDwa(
  start: Point,
  heading: number,
  velocity: number,
  angularVelocity: number,
  dt: number,
  scenario: Scenario,
) {
  const trajectory: Point[] = []
  let point = clonePoint(start)
  let theta = heading
  let clearance = Number.POSITIVE_INFINITY
  for (let index = 0; index < 6; index += 1) {
    theta = normalizeAngle(theta + angularVelocity * dt)
    const next = {
      x: point.x + Math.cos(theta) * velocity * dt,
      y: point.y + Math.sin(theta) * velocity * dt,
    }
    if (!isContinuousEdgeFree(point, next, scenario)) return null
    point = next
    trajectory.push(point)
    clearance = Math.min(clearance, obstacleClearance(point, scenario, 3))
  }
  return { trajectory, finalHeading: theta, clearance }
}

function stepVfh(
  internal: InternalState,
  state: VfhState,
  scenario: Scenario,
  visual: TickVisual,
  metrics: LocalPlannerMetricsDelta,
) {
  state.iterations += 1
  visual.current = clonePoint(state.position)
  visual.visited = [projectToGrid(state.position, scenario)]
  if (tryFinishController(internal, state, scenario, visual)) return
  state.permanentRecovery ||= state.iterations > controllerIterationBudget(state.guide)
  if (state.permanentRecovery) {
    completeWithGuideRecovery(internal, state, scenario, visual, metrics, 'VFH')
    return
  }
  if (state.stuckTicks >= 6) {
    recoveryStep(internal, state, scenario, visual, metrics, 'VFH')
    return
  }

  const anchor = findRecoveryAnchor(state.position, state.guide, state.cursor, scenario)
  if (anchor < 0) {
    state.permanentRecovery = true
    recoveryStep(internal, state, scenario, visual, metrics, 'VFH')
    return
  }
  state.recoveryAnchor = anchor
  const targetHeading = Math.atan2(
    state.guide[anchor].y - state.position.y,
    state.guide[anchor].x - state.position.x,
  )
  const histogram = buildPolarHistogram(state.position, scenario, 72, 4.2)
  const blocked = histogram.map((density, index) =>
    density > 5 ? true : density < 2.8 ? false : state.blockedSectors[index],
  )
  state.blockedSectors = blocked
  const valleyCount = countCircularValleys(blocked)
  const headings: number[] = []
  const targetBin = angleToBin(targetHeading, blocked.length)
  if (!blocked[targetBin]) headings.push(targetHeading)
  for (let index = 0; index < blocked.length; index += 1) {
    if (!blocked[index]) headings.push(binHeading(index, blocked.length))
  }

  let best:
    | { point: Point; heading: number; anchor: number; score: number }
    | undefined
  const candidates: Point[] = []
  for (const heading of headings) {
    metrics.expansions += 1
    const point = {
      x: state.position.x + Math.cos(heading) * 0.42,
      y: state.position.y + Math.sin(heading) * 0.42,
    }
    if (!isContinuousEdgeFree(state.position, point, scenario)) continue
    const recoveryAnchor = findRecoveryAnchor(point, state.guide, state.cursor, scenario)
    if (recoveryAnchor < 0) continue
    candidates.push(point)
    const score =
      Math.abs(angleDifference(heading, targetHeading)) * 2.2 +
      Math.abs(angleDifference(heading, state.heading)) * 0.72 +
      euclidean(point, internal.target) * 0.025 -
      Math.min(2, obstacleClearance(point, scenario, 3)) * 0.08
    if (!best || score < best.score - 1e-9) {
      best = { point, heading, anchor: recoveryAnchor, score }
    }
  }

  metrics.generated = candidates.length
  metrics.openSize = candidates.length
  visual.relaxed = candidates.slice(0, 72).map(clonePoint)
  visual.frontier = visual.relaxed.map(clonePoint)
  if (!best) {
    state.stuckTicks += 1
    visual.action = `VFH 极坐标直方图 · ${valleyCount} 个谷 / 无安全转向`
    return
  }

  const previousAnchor = state.recoveryAnchor
  const previousDistance = euclidean(state.position, state.guide[previousAnchor])
  state.position = clonePoint(best.point)
  state.heading = normalizeAngle(best.heading)
  state.recoveryAnchor = best.anchor
  appendDistinct(state.path, state.position)
  internal.previewPath = state.path
  metrics.relaxations = 1
  const advanced =
    best.anchor > previousAnchor ||
    euclidean(state.position, state.guide[best.anchor]) < previousDistance - 0.01
  state.stuckTicks = advanced ? 0 : state.stuckTicks + 1
  updateReachedAnchor(state)
  visual.current = clonePoint(state.position)
  visual.visited = [projectToGrid(state.position, scenario)]
  visual.action = `VFH 极坐标直方图 · ${valleyCount} 个谷 / 航向 ${radiansToDegrees(best.heading).toFixed(0)}°`
  tryFinishController(internal, state, scenario, visual)
}

function buildPolarHistogram(position: Point, scenario: Scenario, bins: number, radius: number) {
  const histogram = Array.from({ length: bins }, () => 0)
  const minX = Math.max(0, Math.floor(position.x - radius - 1))
  const maxX = Math.min(scenario.cols - 1, Math.ceil(position.x + radius + 1))
  const minY = Math.max(0, Math.floor(position.y - radius - 1))
  const maxY = Math.min(scenario.rows - 1, Math.ceil(position.y + radius + 1))
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (!scenario.obstacles.has(`${x},${y}`)) continue
      const dx = x - position.x
      const dy = y - position.y
      const distance = Math.hypot(dx, dy)
      if (distance > radius + 0.75 || distance <= 1e-8) continue
      const bearing = Math.atan2(dy, dx)
      const halfWidth = Math.asin(Math.min(0.98, 0.5 / Math.max(0.51, distance)))
      const density = Math.max(0, radius - distance) ** 2
      for (let index = 0; index < bins; index += 1) {
        if (Math.abs(angleDifference(binHeading(index, bins), bearing)) <= halfWidth) {
          histogram[index] += density
        }
      }
    }
  }
  return histogram
}

function countCircularValleys(blocked: boolean[]) {
  if (blocked.every(Boolean)) return 0
  if (blocked.every((value) => !value)) return 1
  let valleys = 0
  for (let index = 0; index < blocked.length; index += 1) {
    const previous = blocked[(index - 1 + blocked.length) % blocked.length]
    if (previous && !blocked[index]) valleys += 1
  }
  return valleys
}

function stepPotentialField(
  internal: InternalState,
  state: PotentialFieldState,
  scenario: Scenario,
  visual: TickVisual,
  metrics: LocalPlannerMetricsDelta,
) {
  state.iterations += 1
  visual.current = clonePoint(state.position)
  visual.visited = [projectToGrid(state.position, scenario)]
  if (tryFinishController(internal, state, scenario, visual)) return

  state.permanentRecovery ||= state.iterations > controllerIterationBudget(state.guide)
  if (state.permanentRecovery) {
    completeWithGuideRecovery(internal, state, scenario, visual, metrics, 'APF')
    return
  }
  if (state.recoveryActive || state.stuckTicks >= 6) {
    state.recoveryActive = true
    const reached = recoveryStep(internal, state, scenario, visual, metrics, 'APF')
    if (reached && !state.permanentRecovery) state.recoveryActive = false
    return
  }

  const anchor = findRecoveryAnchor(state.position, state.guide, state.cursor, scenario)
  if (anchor < 0) {
    state.recoveryActive = true
    recoveryStep(internal, state, scenario, visual, metrics, 'APF')
    return
  }
  state.recoveryAnchor = anchor
  const attractive = cappedVector(
    { x: internal.target.x - state.position.x, y: internal.target.y - state.position.y },
    1.25,
  )
  const repulsive = repulsiveVector(state.position, scenario, 2.35)
  const resultant = {
    x: attractive.x + repulsive.x,
    y: attractive.y + repulsive.y,
  }
  const magnitude = Math.hypot(resultant.x, resultant.y)
  visual.relaxed = [
    vectorEndpoint(state.position, attractive, 0.72),
    vectorEndpoint(state.position, repulsive, 0.72),
    vectorEndpoint(state.position, resultant, 0.72),
  ]
  visual.frontier = visual.relaxed.map(clonePoint)
  metrics.expansions = 1

  if (magnitude <= 1e-7) {
    state.stuckTicks += 1
    visual.action = 'APF 合力接近零 · 检测到局部极小值'
    return
  }

  const direction = { x: resultant.x / magnitude, y: resultant.y / magnitude }
  let accepted: { point: Point; anchor: number } | null = null
  for (const stepSize of [0.44, 0.22, 0.11, 0.055]) {
    metrics.generated += 1
    const point = {
      x: state.position.x + direction.x * stepSize,
      y: state.position.y + direction.y * stepSize,
    }
    if (!isContinuousEdgeFree(state.position, point, scenario)) continue
    const recoveryAnchor = findRecoveryAnchor(point, state.guide, state.cursor, scenario)
    if (recoveryAnchor < 0) continue
    accepted = { point, anchor: recoveryAnchor }
    break
  }
  metrics.openSize = accepted ? 1 : 0
  if (!accepted) {
    state.stuckTicks += 1
    visual.action = 'APF 势场步长回溯失败 · 准备安全恢复'
    return
  }

  const previousGoalDistance = euclidean(state.position, internal.target)
  const previousAnchor = state.recoveryAnchor
  state.position = clonePoint(accepted.point)
  state.recoveryAnchor = accepted.anchor
  appendDistinct(state.path, state.position)
  internal.previewPath = state.path
  metrics.relaxations = 1
  const progressed =
    accepted.anchor > previousAnchor ||
    euclidean(state.position, internal.target) < previousGoalDistance - 0.008
  state.stuckTicks = progressed ? 0 : state.stuckTicks + 1
  updateReachedAnchor(state)
  visual.current = clonePoint(state.position)
  visual.visited = [projectToGrid(state.position, scenario)]
  visual.action = `APF 势场积分 · |Fatt| ${Math.hypot(attractive.x, attractive.y).toFixed(2)} / |Frep| ${Math.hypot(repulsive.x, repulsive.y).toFixed(2)}`
  tryFinishController(internal, state, scenario, visual)
}

function stepTeb(
  internal: InternalState,
  state: TebState,
  scenario: Scenario,
  visual: TickVisual,
  metrics: LocalPlannerMetricsDelta,
) {
  const before = state.band.map(clonePoint)
  const beforeObjective = tebObjective(state.band, state.timeDiffs, state.reference, scenario)
  const moved: Point[] = []
  let proposals = 0

  for (let index = 1; index < state.band.length - 1; index += 1) {
    metrics.expansions += 1
    const previous = state.band[index - 1]
    const current = state.band[index]
    const next = state.band[index + 1]
    const reference = state.reference[index]
    const repulsion = clearanceRepulsion(current, scenario, 0.48)
    const desired = {
      x:
        (previous.x + next.x) * 0.5 - current.x +
        (reference.x - current.x) * 0.08 +
        repulsion.x * 0.34,
      y:
        (previous.y + next.y) * 0.5 - current.y +
        (reference.y - current.y) * 0.08 +
        repulsion.y * 0.34,
    }
    if (Math.hypot(desired.x, desired.y) <= 1e-8) continue
    const localBefore = tebLocalSpatialCost(previous, current, next, reference, scenario)
    for (const scale of [0.28, 0.14, 0.07]) {
      proposals += 1
      const candidate = clampContinuousPoint(
        { x: current.x + desired.x * scale, y: current.y + desired.y * scale },
        scenario,
      )
      if (
        !isContinuousEdgeFree(previous, candidate, scenario) ||
        !isContinuousEdgeFree(candidate, next, scenario)
      ) continue
      const localAfter = tebLocalSpatialCost(previous, candidate, next, reference, scenario)
      if (localAfter >= localBefore - 1e-9) continue
      state.band[index] = candidate
      moved.push(candidate)
      break
    }
  }

  state.timeDiffs = segmentTimeDiffs(state.band, state.timeDiffs)
  const objective = tebObjective(state.band, state.timeDiffs, state.reference, scenario)
  if (!pathIsSafe(state.band, scenario) || objective > beforeObjective + 1e-8) {
    state.band = before
    state.timeDiffs = segmentTimeDiffs(state.band, state.timeDiffs)
    moved.length = 0
    state.stableIterations += 1
  } else if (beforeObjective - objective <= 1e-6) {
    state.stableIterations += 1
  } else {
    state.stableIterations = 0
    if (objective < state.bestObjective - 1e-9) {
      state.bestObjective = objective
      state.bestBand = state.band.map(clonePoint)
    }
  }
  state.iterations += 1
  metrics.generated = proposals
  metrics.relaxations = moved.length
  metrics.openSize = state.band.length
  internal.previewPath = state.band
  const focusIndex = state.band.length <= 2 ? 0 : 1 + (state.iterations % (state.band.length - 2))
  visual.current = clonePoint(state.band[focusIndex])
  visual.visited = [projectToGrid(state.band[focusIndex], scenario)]
  visual.relaxed = moved.slice(0, 64).map(clonePoint)
  visual.frontier = state.band.slice(1, -1).slice(0, 96).map(clonePoint)
  const duration = state.timeDiffs.reduce((sum, value) => sum + value, 0)
  visual.action = `TEB 时空弹性带 · 第 ${state.iterations} 轮 / T ${duration.toFixed(2)} / 接受 ${moved.length} 点`

  if (state.iterations >= 24 || (state.iterations >= 5 && state.stableIterations >= 4)) {
    finalizeState(internal, state.bestBand, scenario, visual, 'TEB 最优可行时空带已锁定')
  }
}

function stepTrajOpt(
  internal: InternalState,
  state: TrajOptState,
  scenario: Scenario,
  visual: TickVisual,
  metrics: LocalPlannerMetricsDelta,
) {
  const currentObjective = trajOptObjective(state.trajectory, state.reference, scenario)
  const directions: Point[] = state.trajectory.map(() => ({ x: 0, y: 0 }))
  for (let index = 1; index < state.trajectory.length - 1; index += 1) {
    metrics.expansions += 1
    const previous = state.trajectory[index - 1]
    const current = state.trajectory[index]
    const next = state.trajectory[index + 1]
    const reference = state.reference[index]
    const repulsion = clearanceRepulsion(current, scenario, 0.5)
    const direction = {
      x:
        ((previous.x + next.x) * 0.5 - current.x) * 0.9 +
        (reference.x - current.x) * 0.055 +
        repulsion.x * 0.42,
      y:
        ((previous.y + next.y) * 0.5 - current.y) * 0.9 +
        (reference.y - current.y) * 0.055 +
        repulsion.y * 0.42,
    }
    directions[index] = cappedVector(direction, state.trustRegion)
  }

  let accepted: Point[] | null = null
  let acceptedObjective = currentObjective
  for (const lineScale of [1, 0.5, 0.25, 0.125]) {
    metrics.generated += 1
    const proposal = state.trajectory.map((point, index) =>
      index === 0 || index === state.trajectory.length - 1
        ? clonePoint(point)
        : clampContinuousPoint(
            {
              x: point.x + directions[index].x * lineScale,
              y: point.y + directions[index].y * lineScale,
            },
            scenario,
          ),
    )
    if (!pathIsSafe(proposal, scenario)) continue
    const objective = trajOptObjective(proposal, state.reference, scenario)
    if (objective >= currentObjective - 1e-8) continue
    accepted = proposal
    acceptedObjective = objective
    break
  }

  if (accepted) {
    const moved = accepted.filter(
      (point, index) => euclidean(point, state.trajectory[index]) > 1e-8,
    )
    state.trajectory = accepted
    state.trustRegion = Math.min(0.55, state.trustRegion * 1.08)
    state.stableIterations = currentObjective - acceptedObjective <= 1e-6
      ? state.stableIterations + 1
      : 0
    metrics.relaxations = moved.length
    if (acceptedObjective < state.bestObjective - 1e-9) {
      state.bestObjective = acceptedObjective
      state.bestTrajectory = accepted.map(clonePoint)
    }
    visual.relaxed = moved.slice(0, 64).map(clonePoint)
  } else {
    state.trustRegion = Math.max(0.01, state.trustRegion * 0.5)
    state.stableIterations += 1
  }

  state.iterations += 1
  metrics.openSize = state.trajectory.length
  internal.previewPath = state.trajectory
  const focusIndex =
    state.trajectory.length <= 2 ? 0 : 1 + (state.iterations % (state.trajectory.length - 2))
  visual.current = clonePoint(state.trajectory[focusIndex])
  visual.visited = [projectToGrid(state.trajectory[focusIndex], scenario)]
  visual.frontier = state.trajectory.slice(1, -1).slice(0, 96).map(clonePoint)
  visual.action = `TrajOpt 信赖域迭代 ${state.iterations} · Δ ${state.trustRegion.toFixed(3)} / J ${state.bestObjective.toFixed(2)}`

  if (state.iterations >= 28 || (state.iterations >= 6 && state.stableIterations >= 5)) {
    finalizeState(internal, state.bestTrajectory, scenario, visual, 'TrajOpt 最优可行轨迹已锁定')
  }
}

function recoveryStep(
  internal: InternalState,
  state: DwaState | VfhState | PotentialFieldState,
  scenario: Scenario,
  visual: TickVisual,
  metrics: LocalPlannerMetricsDelta,
  label: string,
) {
  metrics.expansions = 1
  visual.current = clonePoint(state.position)
  visual.visited = [projectToGrid(state.position, scenario)]
  if (tryFinishController(internal, state, scenario, visual)) return false

  let anchor = findRecoveryAnchor(state.position, state.guide, state.cursor, scenario)
  if (anchor < 0) {
    failState(internal, visual, `${label} 安全恢复中断 · 无可行路径`)
    return false
  }
  state.recoveryAnchor = anchor
  let target = state.guide[anchor]
  let distance = euclidean(state.position, target)
  if (distance <= 0.08) {
    state.position = clonePoint(target)
    appendDistinct(state.path, state.position)
    state.cursor = Math.max(state.cursor, anchor)
    anchor = findRecoveryAnchor(state.position, state.guide, state.cursor, scenario)
    if (anchor < 0) {
      failState(internal, visual, `${label} 参考线恢复失效 · 无可行路径`)
      return false
    }
    state.recoveryAnchor = anchor
    target = state.guide[anchor]
    distance = euclidean(state.position, target)
  }

  if (distance <= 1e-9) {
    visual.action = `${label} 安全恢复 · 切换参考线锚点 ${anchor}/${state.guide.length - 1}`
    return true
  }
  const stepSize = Math.min(0.58, distance)
  const next = {
    x: state.position.x + ((target.x - state.position.x) / distance) * stepSize,
    y: state.position.y + ((target.y - state.position.y) / distance) * stepSize,
  }
  if (!isContinuousEdgeFree(state.position, next, scenario)) {
    failState(internal, visual, `${label} 恢复边被阻断 · 无可行路径`)
    return false
  }
  if (state.kind === 'dwa') {
    const desiredHeading = Math.atan2(next.y - state.position.y, next.x - state.position.x)
    state.heading = desiredHeading
    state.velocity = stepSize / 0.28
    state.angularVelocity = 0
  } else if (state.kind === 'vfh') {
    state.heading = Math.atan2(next.y - state.position.y, next.x - state.position.x)
  }
  state.position = next
  appendDistinct(state.path, state.position)
  if (stepSize >= distance - 1e-9) state.cursor = Math.max(state.cursor, anchor)
  state.stuckTicks = 0
  internal.previewPath = state.path
  metrics.generated = 1
  metrics.relaxations = 1
  metrics.openSize = 1
  visual.current = clonePoint(state.position)
  visual.visited = [projectToGrid(state.position, scenario)]
  visual.relaxed = [clonePoint(target)]
  visual.frontier = [clonePoint(target)]
  visual.action = `${label} 安全恢复 · 沿 A* 锚点 ${anchor}/${state.guide.length - 1} 推进`
  tryFinishController(internal, state, scenario, visual)
  return stepSize >= distance - 1e-9
}

function controllerIterationBudget(guide: Point[]) {
  return Math.min(180, Math.max(48, Math.ceil(guide.length * 1.5)))
}

function completeWithGuideRecovery(
  internal: InternalState,
  state: DwaState | VfhState | PotentialFieldState,
  scenario: Scenario,
  visual: TickVisual,
  metrics: LocalPlannerMetricsDelta,
  label: string,
) {
  const anchor = findRecoveryAnchor(state.position, state.guide, state.cursor, scenario)
  if (anchor < 0) {
    failState(internal, visual, `${label} 全局参考线恢复中断 · 无可行路径`)
    return
  }

  const recovered = state.path.slice()
  appendDistinct(recovered, state.guide[anchor])
  for (let index = anchor + 1; index < state.guide.length; index += 1) {
    appendDistinct(recovered, state.guide[index])
  }
  metrics.expansions = 1
  metrics.generated = 1
  metrics.relaxations = 1
  metrics.openSize = 1
  visual.current = clonePoint(state.position)
  visual.visited = [projectToGrid(state.position, scenario)]
  visual.relaxed = [clonePoint(state.guide[anchor])]
  visual.frontier = [clonePoint(internal.target)]
  finalizeState(
    internal,
    recovered,
    scenario,
    visual,
    `${label} 达到局部迭代预算 · 沿 A* 参考线安全恢复`,
  )
}

function tryFinishController(
  internal: InternalState,
  state: DwaState | VfhState | PotentialFieldState,
  scenario: Scenario,
  visual: TickVisual,
) {
  const distance = euclidean(state.position, internal.target)
  if (distance > 0.3 || !isContinuousEdgeFree(state.position, internal.target, scenario)) return false
  appendDistinct(state.path, internal.target)
  state.position = clonePoint(internal.target)
  finalizeState(internal, state.path, scenario, visual, `${plannerLabel(internal.id)} 局部航迹已锁定`)
  visual.current = clonePoint(internal.target)
  visual.visited = [projectToGrid(internal.target, scenario)]
  return true
}

function updateReachedAnchor(state: ControllerBase) {
  if (euclidean(state.position, state.guide[state.recoveryAnchor]) <= 0.12) {
    state.cursor = Math.max(state.cursor, state.recoveryAnchor)
  }
}

function findRecoveryAnchor(
  point: Point,
  guide: Point[],
  cursor: number,
  scenario: Scenario,
) {
  const start = Math.max(0, Math.min(cursor, guide.length - 1))
  const end = Math.min(guide.length - 1, start + 12)
  let best = -1
  for (let index = start; index <= end; index += 1) {
    if (isContinuousEdgeFree(point, guide[index], scenario)) best = index
  }
  return best
}

function finalizeState(
  internal: InternalState,
  candidatePath: Point[],
  scenario: Scenario,
  visual: TickVisual,
  action: string,
) {
  let path = dedupePath(candidatePath)
  if (path.length === 0 || !samePoint(path[0], internal.start)) path.unshift(clonePoint(internal.start))
  if (!samePoint(path[path.length - 1], internal.target)) path.push(clonePoint(internal.target))
  if (!pathIsSafe(path, scenario)) path = internal.guide?.map(clonePoint) ?? []
  if (
    path.length === 0 ||
    !samePoint(path[0], internal.start) ||
    !samePoint(path[path.length - 1], internal.target) ||
    !pathIsSafe(path, scenario)
  ) {
    failState(internal, visual, `${plannerLabel(internal.id)} 无可提交航迹 · 无可行路径`)
    return
  }
  internal.status = 'complete'
  internal.phase = 'complete'
  internal.finalPath = path.map(clonePoint)
  internal.finalPathCost = polylineCost(path)
  internal.previewPath = internal.finalPath
  visual.action = `${action} · ${path.length - 1} 折线段 / 代价 ${internal.finalPathCost.toFixed(2)}`
}

function failState(internal: InternalState, visual: TickVisual, action: string) {
  internal.status = 'failed'
  internal.phase = 'failed'
  internal.previewPath = []
  visual.current = null
  visual.relaxed = []
  visual.frontier = []
  visual.action = action
}

function reconstructGuide(search: GuideSearch, start: Point, target: Point) {
  const startKey = pointKey(start)
  let currentKey = pointKey(target)
  const reversed = [clonePoint(target)]
  const seen = new Set([currentKey])
  while (currentKey !== startKey) {
    const previous = search.cameFrom.get(currentKey)
    if (!previous || seen.has(previous)) return null
    seen.add(previous)
    reversed.push(keyPoint(previous))
    currentKey = previous
  }
  return reversed.reverse()
}

function simplifyGuide(guide: Point[], scenario: Scenario) {
  if (guide.length <= 2) return guide.map(clonePoint)
  const result: Point[] = [clonePoint(guide[0])]
  for (let index = 1; index < guide.length - 1; index += 1) {
    const previous = result[result.length - 1]
    const current = guide[index]
    const next = guide[index + 1]
    const cross =
      (current.x - previous.x) * (next.y - current.y) -
      (current.y - previous.y) * (next.x - current.x)
    if (Math.abs(cross) <= 1e-10 && isContinuousEdgeFree(previous, next, scenario)) continue
    result.push(clonePoint(current))
  }
  result.push(clonePoint(guide[guide.length - 1]))
  return result
}

function segmentTimeDiffs(path: Point[], previous?: number[]) {
  const result: number[] = []
  for (let index = 1; index < path.length; index += 1) {
    const nominal = Math.max(0.08, euclidean(path[index - 1], path[index]) / 1.05)
    const old = previous?.[index - 1]
    result.push(old === undefined ? nominal : old * 0.68 + nominal * 0.32)
  }
  return result
}

function tebLocalSpatialCost(
  previous: Point,
  current: Point,
  next: Point,
  reference: Point,
  scenario: Scenario,
) {
  const secondX = previous.x - 2 * current.x + next.x
  const secondY = previous.y - 2 * current.y + next.y
  const referenceCost = squaredDistance(current, reference) * 0.08
  const clearancePenalty = Math.max(0, 0.46 - obstacleClearance(current, scenario, 2.2)) ** 2 * 14
  return (secondX * secondX + secondY * secondY) * 1.8 + referenceCost + clearancePenalty
}

function tebObjective(
  band: Point[],
  timeDiffs: number[],
  reference: Point[],
  scenario: Scenario,
) {
  let cost = timeDiffs.reduce((sum, value) => sum + value, 0)
  for (let index = 1; index < band.length - 1; index += 1) {
    cost += tebLocalSpatialCost(band[index - 1], band[index], band[index + 1], reference[index], scenario)
  }
  for (let index = 0; index < timeDiffs.length; index += 1) {
    const velocity = euclidean(band[index], band[index + 1]) / Math.max(0.04, timeDiffs[index])
    cost += Math.max(0, velocity - 1.2) ** 2 * 7
    if (index > 0) {
      const acceleration = Math.abs(
        velocity - euclidean(band[index - 1], band[index]) / Math.max(0.04, timeDiffs[index - 1]),
      )
      cost += Math.max(0, acceleration - 0.8) ** 2 * 2.5
    }
  }
  return cost
}

function trajOptObjective(trajectory: Point[], reference: Point[], scenario: Scenario) {
  let cost = polylineCost(trajectory) * 0.18
  for (let index = 1; index < trajectory.length - 1; index += 1) {
    const previous = trajectory[index - 1]
    const current = trajectory[index]
    const next = trajectory[index + 1]
    const secondX = previous.x - 2 * current.x + next.x
    const secondY = previous.y - 2 * current.y + next.y
    cost += (secondX * secondX + secondY * secondY) * 2.2
    cost += squaredDistance(current, reference[index]) * 0.055
    cost += Math.max(0, 0.48 - obstacleClearance(current, scenario, 2.3)) ** 2 * 18
  }
  return cost
}

function repulsiveVector(point: Point, scenario: Scenario, influenceRadius: number) {
  const result = { x: 0, y: 0 }
  const minX = Math.max(0, Math.floor(point.x - influenceRadius - 1))
  const maxX = Math.min(scenario.cols - 1, Math.ceil(point.x + influenceRadius + 1))
  const minY = Math.max(0, Math.floor(point.y - influenceRadius - 1))
  const maxY = Math.min(scenario.rows - 1, Math.ceil(point.y + influenceRadius + 1))
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (!scenario.obstacles.has(`${x},${y}`)) continue
      const closest = {
        x: clamp(point.x, x - 0.5, x + 0.5),
        y: clamp(point.y, y - 0.5, y + 0.5),
      }
      let dx = point.x - closest.x
      let dy = point.y - closest.y
      let distance = Math.hypot(dx, dy)
      if (distance >= influenceRadius) continue
      if (distance <= 1e-6) {
        dx = point.x - x || 1
        dy = point.y - y
        distance = Math.max(1e-3, Math.hypot(dx, dy))
      }
      const strength = Math.min(
        3.2,
        0.22 * (1 / distance - 1 / influenceRadius) / Math.max(0.04, distance * distance),
      )
      result.x += (dx / distance) * strength
      result.y += (dy / distance) * strength
    }
  }
  return cappedVector(result, 3.4)
}

function clearanceRepulsion(point: Point, scenario: Scenario, desiredClearance: number) {
  const epsilon = 0.035
  const center = obstacleClearance(point, scenario, 2.5)
  if (center >= desiredClearance) return { x: 0, y: 0 }
  const dx =
    obstacleClearance({ x: point.x + epsilon, y: point.y }, scenario, 2.5) -
    obstacleClearance({ x: point.x - epsilon, y: point.y }, scenario, 2.5)
  const dy =
    obstacleClearance({ x: point.x, y: point.y + epsilon }, scenario, 2.5) -
    obstacleClearance({ x: point.x, y: point.y - epsilon }, scenario, 2.5)
  const length = Math.hypot(dx, dy)
  if (length <= 1e-9) return { x: 0, y: 0 }
  const strength = Math.min(1.5, (desiredClearance - center) * 2.6)
  return { x: (dx / length) * strength, y: (dy / length) * strength }
}

function obstacleClearance(point: Point, scenario: Scenario, searchRadius: number) {
  let clearance = Math.min(
    point.x + 0.5,
    point.y + 0.5,
    scenario.cols - 0.5 - point.x,
    scenario.rows - 0.5 - point.y,
  )
  const minX = Math.max(0, Math.floor(point.x - searchRadius - 1))
  const maxX = Math.min(scenario.cols - 1, Math.ceil(point.x + searchRadius + 1))
  const minY = Math.max(0, Math.floor(point.y - searchRadius - 1))
  const maxY = Math.min(scenario.rows - 1, Math.ceil(point.y + searchRadius + 1))
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (!scenario.obstacles.has(`${x},${y}`)) continue
      const dx = Math.max(x - 0.5 - point.x, 0, point.x - (x + 0.5))
      const dy = Math.max(y - 0.5 - point.y, 0, point.y - (y + 0.5))
      clearance = Math.min(clearance, Math.hypot(dx, dy))
    }
  }
  return Math.max(0, clearance)
}

function gridNeighbors(point: Point, scenario: Scenario) {
  const cardinal = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
  ]
  const diagonal = [
    { x: 1, y: 1 },
    { x: -1, y: 1 },
    { x: -1, y: -1 },
    { x: 1, y: -1 },
  ]
  const directions = scenario.allowDiagonal ? [...cardinal, ...diagonal] : cardinal
  const result: Array<{ point: Point; cost: number }> = []
  for (const direction of directions) {
    const next = { x: point.x + direction.x, y: point.y + direction.y }
    if (!isGridPointWalkable(next, scenario)) continue
    const isDiagonal = direction.x !== 0 && direction.y !== 0
    if (isDiagonal && scenario.preventCornerCutting) {
      if (
        !isGridPointWalkable({ x: point.x + direction.x, y: point.y }, scenario) ||
        !isGridPointWalkable({ x: point.x, y: point.y + direction.y }, scenario)
      ) continue
    }
    result.push({ point: next, cost: isDiagonal ? Math.SQRT2 : 1 })
  }
  return result
}

function isGridPointWalkable(point: Point, scenario: Scenario) {
  return (
    Number.isInteger(point.x) &&
    Number.isInteger(point.y) &&
    point.x >= 0 &&
    point.y >= 0 &&
    point.x < scenario.cols &&
    point.y < scenario.rows &&
    !scenario.obstacles.has(pointKey(point))
  )
}

function isContinuousPointFree(point: Point, scenario: Scenario) {
  if (
    point.x < -0.5 + 1e-9 ||
    point.y < -0.5 + 1e-9 ||
    point.x > scenario.cols - 0.5 - 1e-9 ||
    point.y > scenario.rows - 0.5 - 1e-9
  ) return false
  const cell = { x: Math.floor(point.x + 0.5), y: Math.floor(point.y + 0.5) }
  return !scenario.obstacles.has(pointKey(cell))
}

function isContinuousEdgeFree(start: Point, target: Point, scenario: Scenario) {
  if (!isContinuousPointFree(start, scenario) || !isContinuousPointFree(target, scenario)) return false
  const padding = scenario.preventCornerCutting ? -1e-9 : 1e-8
  const minCellX = Math.max(0, Math.floor(Math.min(start.x, target.x) - 1.5))
  const maxCellX = Math.min(scenario.cols - 1, Math.ceil(Math.max(start.x, target.x) + 1.5))
  const minCellY = Math.max(0, Math.floor(Math.min(start.y, target.y) - 1.5))
  const maxCellY = Math.min(scenario.rows - 1, Math.ceil(Math.max(start.y, target.y) + 1.5))
  for (let y = minCellY; y <= maxCellY; y += 1) {
    for (let x = minCellX; x <= maxCellX; x += 1) {
      if (!scenario.obstacles.has(`${x},${y}`)) continue
      const minX = x - 0.5 + padding
      const maxX = x + 0.5 - padding
      const minY = y - 0.5 + padding
      const maxY = y + 0.5 - padding
      if (minX <= maxX && minY <= maxY && segmentIntersectsAabb(start, target, minX, maxX, minY, maxY)) {
        return false
      }
    }
  }
  return true
}

function segmentIntersectsAabb(
  start: Point,
  target: Point,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
) {
  let enter = 0
  let exit = 1
  const axes = [
    { origin: start.x, delta: target.x - start.x, minimum: minX, maximum: maxX },
    { origin: start.y, delta: target.y - start.y, minimum: minY, maximum: maxY },
  ]
  for (const axis of axes) {
    if (Math.abs(axis.delta) <= 1e-12) {
      if (axis.origin < axis.minimum || axis.origin > axis.maximum) return false
      continue
    }
    let first = (axis.minimum - axis.origin) / axis.delta
    let second = (axis.maximum - axis.origin) / axis.delta
    if (first > second) [first, second] = [second, first]
    enter = Math.max(enter, first)
    exit = Math.min(exit, second)
    if (enter > exit + 1e-12) return false
  }
  return exit >= -1e-12 && enter <= 1 + 1e-12
}

function pathIsSafe(path: Point[], scenario: Scenario) {
  if (path.length === 0 || path.some((point) => !isContinuousPointFree(point, scenario))) return false
  for (let index = 1; index < path.length; index += 1) {
    if (!isContinuousEdgeFree(path[index - 1], path[index], scenario)) return false
  }
  return true
}

function gridHeuristic(a: Point, b: Point, diagonal: boolean) {
  const dx = Math.abs(a.x - b.x)
  const dy = Math.abs(a.y - b.y)
  if (!diagonal) return dx + dy
  return Math.abs(dx - dy) + Math.min(dx, dy) * Math.SQRT2
}

function visualizedFrontier(keys: Set<string>) {
  return Array.from(keys).slice(0, 192).map(keyPoint)
}

function clampContinuousPoint(point: Point, scenario: Scenario) {
  return {
    x: clamp(point.x, -0.5 + 2e-8, scenario.cols - 0.5 - 2e-8),
    y: clamp(point.y, -0.5 + 2e-8, scenario.rows - 0.5 - 2e-8),
  }
}

function projectToGrid(point: Point, scenario: Scenario) {
  return {
    x: clamp(Math.round(point.x), 0, scenario.cols - 1),
    y: clamp(Math.round(point.y), 0, scenario.rows - 1),
  }
}

function linspace(start: number, end: number, count: number) {
  if (count <= 1 || Math.abs(end - start) <= 1e-12) return [start]
  return Array.from({ length: count }, (_, index) => start + ((end - start) * index) / (count - 1))
}

function uniqueNumbers(values: number[]) {
  const result: number[] = []
  for (const value of values) {
    if (!result.some((known) => Math.abs(known - value) <= 1e-10)) result.push(value)
  }
  return result
}

function angleToBin(angle: number, bins: number) {
  const normalized = (normalizeAngle(angle) + Math.PI * 2) % (Math.PI * 2)
  return Math.round((normalized / (Math.PI * 2)) * bins) % bins
}

function binHeading(index: number, bins: number) {
  return normalizeAngle((index / bins) * Math.PI * 2)
}

function normalizeAngle(angle: number) {
  let normalized = angle
  while (normalized > Math.PI) normalized -= Math.PI * 2
  while (normalized <= -Math.PI) normalized += Math.PI * 2
  return normalized
}

function angleDifference(left: number, right: number) {
  return normalizeAngle(left - right)
}

function radiansToDegrees(value: number) {
  return (value * 180) / Math.PI
}

function cappedVector(vector: Point, maximum: number) {
  const length = Math.hypot(vector.x, vector.y)
  if (length <= maximum || length <= 1e-12) return { ...vector }
  return { x: (vector.x / length) * maximum, y: (vector.y / length) * maximum }
}

function vectorEndpoint(origin: Point, vector: Point, length: number) {
  const magnitude = Math.hypot(vector.x, vector.y)
  if (magnitude <= 1e-12) return clonePoint(origin)
  return {
    x: origin.x + (vector.x / magnitude) * Math.min(length, magnitude),
    y: origin.y + (vector.y / magnitude) * Math.min(length, magnitude),
  }
}

function dedupePath(path: Point[]) {
  const result: Point[] = []
  for (const point of path) appendDistinct(result, point)
  return result
}

function appendDistinct(path: Point[], point: Point) {
  if (path.length === 0 || euclidean(path[path.length - 1], point) > 1e-8) path.push(clonePoint(point))
}

function polylineCost(path: Point[]) {
  let cost = 0
  for (let index = 1; index < path.length; index += 1) cost += euclidean(path[index - 1], path[index])
  return cost
}

function squaredDistance(a: Point, b: Point) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

function euclidean(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function samePoint(a: Point, b: Point) {
  return a.x === b.x && a.y === b.y
}

function clonePoint(point: Point): Point {
  return { x: point.x, y: point.y }
}

function pointKey(point: Point) {
  return `${point.x},${point.y}`
}

function keyPoint(key: string): Point {
  const separator = key.indexOf(',')
  return { x: Number(key.slice(0, separator)), y: Number(key.slice(separator + 1)) }
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value))
}

function formatPoint(point: Point) {
  return `[${point.x},${point.y}]`
}

function plannerLabel(id: LocalPlannerId) {
  if (id === 'teb') return 'TEB'
  if (id === 'dwa') return 'DWA'
  if (id === 'vfh') return 'VFH'
  if (id === 'potential-field') return 'APF'
  return 'TrajOpt'
}
