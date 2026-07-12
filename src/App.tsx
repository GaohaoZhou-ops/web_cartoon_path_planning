import { useEffect, useRef, useState } from 'react'
import {
  Activity,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Crosshair,
  Eraser,
  Flag,
  Gauge,
  Info,
  LockKeyhole,
  MapPin,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  Route,
  Shuffle,
  StepForward,
  Timer,
  Trash2,
  Undo2,
  Waypoints,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import GridCanvas, { isRoutePoint, type EditTool } from './GridCanvas'
import {
  ALGORITHMS,
  cloneScenario,
  createRunner,
  createSampleScenario,
  pointKey,
  randomizeObstacles,
  samePoint,
  stepRunner,
  type AlgorithmMeta,
  type Point,
  type Scenario,
  type SearchRunner,
} from './pathfinding'

type Phase = 'editing' | 'running' | 'paused' | 'complete'

const TOOL_DEFINITIONS: Array<{
  id: EditTool
  label: string
  hint: string
  icon: LucideIcon
}> = [
  { id: 'obstacle', label: '障碍画笔', hint: '1', icon: Pencil },
  { id: 'erase', label: '橡皮擦', hint: '2', icon: Eraser },
  { id: 'start', label: '设置起点', hint: '3', icon: Crosshair },
  { id: 'waypoint', label: '添加途径点', hint: '4', icon: MapPin },
  { id: 'end', label: '设置终点', hint: '5', icon: Flag },
]

const SPEEDS = [0.5, 1, 2, 4, 8]

export default function App() {
  const [scenario, setScenario] = useState<Scenario>(() => createSampleScenario())
  const [snapshot, setSnapshot] = useState<Scenario | null>(null)
  const [tool, setTool] = useState<EditTool>('obstacle')
  const [phase, setPhase] = useState<Phase>('editing')
  const [speed, setSpeed] = useState(2)
  const [visualTick, setVisualTick] = useState(0)
  const runnersRef = useRef<SearchRunner[]>([])
  const historyRef = useRef<Scenario[]>([])
  const schedulerRef = useRef({ lastTime: 0, accumulator: 0 })

  const activeScenario = snapshot ?? scenario
  const runners = runnersRef.current
  const routeLength = activeScenario.waypoints.length + 1
  const canRun = Boolean(scenario.start && scenario.end)

  useEffect(() => {
    if (phase !== 'editing') return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) return
      const shortcuts: Record<string, EditTool> = {
        '1': 'obstacle',
        '2': 'erase',
        '3': 'start',
        '4': 'waypoint',
        '5': 'end',
      }
      if (shortcuts[event.key]) setTool(shortcuts[event.key])
      if (event.key === 'Enter' && canRun) startPlanning()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  useEffect(() => {
    if (phase !== 'running' || !snapshot) return
    let animationFrame = 0
    schedulerRef.current = { lastTime: performance.now(), accumulator: 0 }

    const animate = (now: number) => {
      const scheduler = schedulerRef.current
      const delta = Math.min(100, now - scheduler.lastTime)
      scheduler.lastTime = now
      scheduler.accumulator += delta
      const tickDuration = 66 / speed
      const rounds = Math.min(32, Math.floor(scheduler.accumulator / tickDuration))

      if (rounds > 0) {
        scheduler.accumulator -= rounds * tickDuration
        for (let round = 0; round < rounds; round += 1) {
          runnersRef.current.forEach((runner) => stepRunner(runner, snapshot))
        }
        setVisualTick((tick) => tick + rounds)
      }

      const stillRunning = runnersRef.current.some((runner) => runner.status === 'running')
      if (!stillRunning) {
        setPhase('complete')
        setVisualTick((tick) => tick + 1)
        return
      }
      animationFrame = requestAnimationFrame(animate)
    }

    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [phase, snapshot, speed])

  const saveHistory = () => {
    historyRef.current = [...historyRef.current.slice(-19), cloneScenario(scenario)]
  }

  const updateScenario = (updater: (previous: Scenario) => Scenario, recordHistory = true) => {
    if (phase !== 'editing') return
    if (recordHistory) saveHistory()
    setScenario(updater)
  }

  const handleCellAction = (point: Point, selectedTool: EditTool) => {
    updateScenario((previous) => {
      const next = cloneScenario(previous)
      const key = pointKey(point)

      if (selectedTool === 'obstacle') {
        if (!isRoutePoint(previous, point)) next.obstacles.add(key)
      } else if (selectedTool === 'erase') {
        next.obstacles.delete(key)
        if (samePoint(next.start, point)) next.start = null
        if (samePoint(next.end, point)) next.end = null
        next.waypoints = next.waypoints.filter((waypoint) => !samePoint(waypoint, point))
      } else if (selectedTool === 'start') {
        next.obstacles.delete(key)
        next.waypoints = next.waypoints.filter((waypoint) => !samePoint(waypoint, point))
        if (samePoint(next.end, point)) next.end = null
        next.start = point
      } else if (selectedTool === 'end') {
        next.obstacles.delete(key)
        next.waypoints = next.waypoints.filter((waypoint) => !samePoint(waypoint, point))
        if (samePoint(next.start, point)) next.start = null
        next.end = point
      } else if (
        !samePoint(next.start, point) &&
        !samePoint(next.end, point) &&
        !next.waypoints.some((waypoint) => samePoint(waypoint, point))
      ) {
        next.obstacles.delete(key)
        next.waypoints.push(point)
      }
      return next
    })
  }

  const undo = () => {
    const previous = historyRef.current.pop()
    if (previous) setScenario(previous)
  }

  const loadSample = () => {
    updateScenario(() => createSampleScenario())
  }

  const clearObstacles = () => {
    updateScenario((previous) => ({ ...cloneScenario(previous), obstacles: new Set() }))
  }

  const randomize = () => {
    updateScenario((previous) => randomizeObstacles(cloneScenario(previous)))
  }

  const setScenarioOption = (option: 'allowDiagonal' | 'preventCornerCutting', value: boolean) => {
    updateScenario((previous) => ({ ...cloneScenario(previous), [option]: value }))
  }

  const removeWaypoint = (index: number) => {
    updateScenario((previous) => {
      const next = cloneScenario(previous)
      next.waypoints.splice(index, 1)
      return next
    })
  }

  const moveWaypoint = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= scenario.waypoints.length) return
    updateScenario((previous) => {
      const next = cloneScenario(previous)
      ;[next.waypoints[index], next.waypoints[nextIndex]] = [
        next.waypoints[nextIndex],
        next.waypoints[index],
      ]
      return next
    })
  }

  const startPlanning = () => {
    if (!scenario.start || !scenario.end) return
    const frozen = cloneScenario(scenario)
    runnersRef.current = ALGORITHMS.map((algorithm) => createRunner(algorithm.id, frozen))
    setSnapshot(frozen)
    setVisualTick(0)
    setPhase('running')
  }

  const restartPlanning = () => {
    if (!snapshot) return
    runnersRef.current = ALGORITHMS.map((algorithm) => createRunner(algorithm.id, snapshot))
    setVisualTick(0)
    setPhase('running')
  }

  const returnToEditor = () => {
    runnersRef.current = []
    setSnapshot(null)
    setPhase('editing')
    setVisualTick(0)
  }

  const togglePlayback = () => {
    if (phase === 'running') setPhase('paused')
    else if (phase === 'paused') setPhase('running')
    else if (phase === 'complete') restartPlanning()
  }

  const stepOnce = () => {
    if (!snapshot || phase === 'complete') return
    if (phase === 'running') setPhase('paused')
    runnersRef.current.forEach((runner) => stepRunner(runner, snapshot))
    setVisualTick((tick) => tick + 1)
    if (!runnersRef.current.some((runner) => runner.status === 'running')) setPhase('complete')
  }

  const completedCount = runners.filter((runner) => runner.status !== 'running').length

  return (
    <div className="app-shell">
      <Header
        phase={phase}
        scenario={activeScenario}
        canRun={canRun}
        onRun={startPlanning}
        onEdit={returnToEditor}
      />

      <div className={`workspace workspace--${phase === 'editing' ? 'editing' : 'running'}`}>
        {phase === 'editing' ? (
          <EditorSidebar
            scenario={scenario}
            tool={tool}
            canRun={canRun}
            historyCount={historyRef.current.length}
            onToolChange={setTool}
            onUndo={undo}
            onSample={loadSample}
            onRandomize={randomize}
            onClearObstacles={clearObstacles}
            onRun={startPlanning}
            onRemoveWaypoint={removeWaypoint}
            onMoveWaypoint={moveWaypoint}
            onSetOption={setScenarioOption}
          />
        ) : (
          <BenchmarkSidebar
            scenario={activeScenario}
            runners={runners}
            phase={phase}
            visualTick={visualTick}
          />
        )}

        <main className="main-stage">
          {phase === 'editing' ? (
            <EditorStage
              scenario={scenario}
              tool={tool}
              onCellAction={handleCellAction}
            />
          ) : (
            <ComparisonStage
              scenario={activeScenario}
              runners={runners}
              visualTick={visualTick}
              completedCount={completedCount}
            />
          )}
        </main>
      </div>

      {phase !== 'editing' && (
        <PlaybackBar
          phase={phase}
          speed={speed}
          completedCount={completedCount}
          routeLength={routeLength}
          visualTick={visualTick}
          onSpeedChange={setSpeed}
          onToggle={togglePlayback}
          onStep={stepOnce}
          onRestart={restartPlanning}
        />
      )}
    </div>
  )
}

function Header({
  phase,
  scenario,
  canRun,
  onRun,
  onEdit,
}: {
  phase: Phase
  scenario: Scenario
  canRun: boolean
  onRun: () => void
  onEdit: () => void
}) {
  const stateLabel =
    phase === 'editing' ? '场景配置' : phase === 'running' ? '同步运行' : phase === 'paused' ? '已暂停' : '分析完成'

  return (
    <header className="lab-header">
      <div className="brand-lockup">
        <div className="brand-sigil" aria-hidden="true">
          <span>R</span>
          <span>L</span>
        </div>
        <div>
          <div className="brand-name">ROUTE/LAB</div>
          <div className="brand-subtitle">路径规划 · 同步观测台</div>
        </div>
      </div>

      <div className="header-readouts" aria-label="当前场景信息">
        <div className="readout">
          <span>GRID</span>
          <strong>{scenario.cols}×{scenario.rows}</strong>
        </div>
        <div className="readout">
          <span>VIA</span>
          <strong>{String(scenario.waypoints.length).padStart(2, '0')}</strong>
        </div>
        <div className="readout">
          <span>BLOCK</span>
          <strong>{String(scenario.obstacles.size).padStart(3, '0')}</strong>
        </div>
      </div>

      <div className="header-actions">
        <div className={`phase-indicator phase-indicator--${phase}`}>
          <span className="phase-dot" />
          {stateLabel}
        </div>
        {phase === 'editing' ? (
          <button className="primary-action" disabled={!canRun} onClick={onRun}>
            <LockKeyhole size={17} />
            锁定并开始
          </button>
        ) : (
          <button className="secondary-action" onClick={onEdit}>
            <Undo2 size={16} />
            返回编辑
          </button>
        )}
      </div>
    </header>
  )
}

interface EditorSidebarProps {
  scenario: Scenario
  tool: EditTool
  canRun: boolean
  historyCount: number
  onToolChange: (tool: EditTool) => void
  onUndo: () => void
  onSample: () => void
  onRandomize: () => void
  onClearObstacles: () => void
  onRun: () => void
  onRemoveWaypoint: (index: number) => void
  onMoveWaypoint: (index: number, direction: -1 | 1) => void
  onSetOption: (option: 'allowDiagonal' | 'preventCornerCutting', value: boolean) => void
}

function EditorSidebar({
  scenario,
  tool,
  canRun,
  historyCount,
  onToolChange,
  onUndo,
  onSample,
  onRandomize,
  onClearObstacles,
  onRun,
  onRemoveWaypoint,
  onMoveWaypoint,
  onSetOption,
}: EditorSidebarProps) {
  return (
    <aside className="side-panel editor-panel">
      <section className="panel-section">
        <SectionTitle index="01" title="绘制场景" />
        <div className="tool-grid">
          {TOOL_DEFINITIONS.map((definition) => {
            const Icon = definition.icon
            return (
              <button
                key={definition.id}
                className={`tool-button ${tool === definition.id ? 'is-active' : ''}`}
                onClick={() => onToolChange(definition.id)}
                aria-pressed={tool === definition.id}
              >
                <Icon size={17} strokeWidth={1.8} />
                <span>{definition.label}</span>
                <kbd>{definition.hint}</kbd>
              </button>
            )
          })}
        </div>
        <div className="compact-actions">
          <button onClick={onUndo} disabled={historyCount === 0}>
            <Undo2 size={14} /> 撤销
          </button>
          <button onClick={onRandomize}>
            <Shuffle size={14} /> 随机障碍
          </button>
          <button onClick={onSample}>
            <RotateCcw size={14} /> 示例场景
          </button>
          <button onClick={onClearObstacles}>
            <Trash2 size={14} /> 清空障碍
          </button>
        </div>
      </section>

      <section className="panel-section route-section">
        <SectionTitle index="02" title="行程顺序" accessory={`${scenario.waypoints.length + 1} 段`} />
        <div className="route-list">
          <RouteNode type="start" label="起点 / START" point={scenario.start} />
          {scenario.waypoints.map((point, index) => (
            <RouteNode
              key={`${pointKey(point)}-${index}`}
              type="waypoint"
              label={`途径点 ${String(index + 1).padStart(2, '0')}`}
              point={point}
              actions={
                <div className="route-node-actions">
                  <button
                    aria-label={`上移途径点 ${index + 1}`}
                    disabled={index === 0}
                    onClick={() => onMoveWaypoint(index, -1)}
                  >
                    <ChevronUp size={13} />
                  </button>
                  <button
                    aria-label={`下移途径点 ${index + 1}`}
                    disabled={index === scenario.waypoints.length - 1}
                    onClick={() => onMoveWaypoint(index, 1)}
                  >
                    <ChevronDown size={13} />
                  </button>
                  <button aria-label={`删除途径点 ${index + 1}`} onClick={() => onRemoveWaypoint(index)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              }
            />
          ))}
          {scenario.waypoints.length === 0 && (
            <div className="empty-waypoint">选择“添加途径点”，可连续放置多个节点</div>
          )}
          <RouteNode type="end" label="终点 / END" point={scenario.end} />
        </div>
      </section>

      <section className="panel-section movement-section">
        <SectionTitle index="03" title="移动规则" />
        <ToggleRow
          label="允许斜向移动"
          description="八邻域 · 斜边代价 √2"
          checked={scenario.allowDiagonal}
          onChange={(checked) => onSetOption('allowDiagonal', checked)}
        />
        <ToggleRow
          label="禁止穿越墙角"
          description="斜移时两侧均须可通行"
          checked={scenario.preventCornerCutting}
          disabled={!scenario.allowDiagonal}
          onChange={(checked) => onSetOption('preventCornerCutting', checked)}
        />
      </section>

      <div className="panel-run-zone">
        {!canRun && <p>请先在网格中设置起点与终点</p>}
        <button className="run-button" disabled={!canRun} onClick={onRun}>
          <Play size={18} fill="currentColor" />
          开始四算法同步规划
        </button>
      </div>
    </aside>
  )
}

function EditorStage({
  scenario,
  tool,
  onCellAction,
}: {
  scenario: Scenario
  tool: EditTool
  onCellAction: (point: Point, tool: EditTool) => void
}) {
  const activeTool = TOOL_DEFINITIONS.find((definition) => definition.id === tool)
  return (
    <div className="editor-stage">
      <div className="stage-heading">
        <div>
          <span className="eyebrow">MISSION CANVAS / 任务画布</span>
          <h1>编排一条<span>必须依次经过</span>的航路</h1>
        </div>
        <div className="stage-hint">
          <CircleDot size={15} />
          当前工具 · {activeTool?.label}
        </div>
      </div>

      <div className="editor-map-frame">
        <div className="map-coordinates map-coordinates--top">
          {Array.from({ length: scenario.cols }, (_, index) => (
            <span key={index}>{index % 3 === 0 ? String(index).padStart(2, '0') : '·'}</span>
          ))}
        </div>
        <div className="map-coordinates map-coordinates--left">
          {Array.from({ length: scenario.rows }, (_, index) => (
            <span key={index}>{index % 2 === 0 ? String(index).padStart(2, '0') : '·'}</span>
          ))}
        </div>
        <GridCanvas
          scenario={scenario}
          editing
          tool={tool}
          onCellAction={onCellAction}
          className="editor-canvas"
        />
        <div className="map-overlay map-overlay--top">
          <span>LIVE EDIT</span>
          <strong>{scenario.obstacles.size} BLOCKS</strong>
        </div>
        <div className="map-overlay map-overlay--bottom">
          按住拖动连续绘制 · 右键临时擦除
        </div>
      </div>

      <div className="algorithm-manifest">
        <div className="manifest-intro">
          <span>算法编队</span>
          <strong>4 RUNNERS</strong>
        </div>
        {ALGORITHMS.map((algorithm, index) => (
          <div className="manifest-item" key={algorithm.id} style={{ '--accent': algorithm.accent } as React.CSSProperties}>
            <span className="manifest-index">0{index + 1}</span>
            <div>
              <strong>{algorithm.name}</strong>
              <small>{algorithm.description}</small>
            </div>
            <i />
          </div>
        ))}
      </div>
    </div>
  )
}

function ComparisonStage({
  scenario,
  runners,
  visualTick,
  completedCount,
}: {
  scenario: Scenario
  runners: SearchRunner[]
  visualTick: number
  completedCount: number
}) {
  return (
    <div className="comparison-stage">
      <div className="comparison-heading">
        <div>
          <span className="eyebrow">SYNCHRONIZED EXPANSION / 同步扩展</span>
          <h1>同一地图快照，同一逻辑时钟</h1>
        </div>
        <div className="sync-readout">
          <span className="sync-pulse" />
          TICK {String(visualTick).padStart(4, '0')} · {completedCount}/4 结束
        </div>
      </div>
      <div className="algorithm-grid">
        {ALGORITHMS.map((algorithm, index) => {
          const runner = runners.find((item) => item.id === algorithm.id)
          if (!runner) return null
          return (
            <AlgorithmCard
              key={algorithm.id}
              index={index}
              algorithm={algorithm}
              scenario={scenario}
              runner={runner}
              visualTick={visualTick}
            />
          )
        })}
      </div>
    </div>
  )
}

function AlgorithmCard({
  index,
  algorithm,
  scenario,
  runner,
  visualTick,
}: {
  index: number
  algorithm: AlgorithmMeta
  scenario: Scenario
  runner: SearchRunner
  visualTick: number
}) {
  const statusText =
    runner.status === 'complete' ? '已完成' : runner.status === 'failed' ? '无路径' : '搜索中'
  const totalSegments = runner.route.length - 1
  const activeSegment = Math.min(runner.segmentIndex + 1, totalSegments)

  return (
    <article
      className={`algorithm-card algorithm-card--${runner.status}`}
      style={{ '--accent': algorithm.accent, '--accent-rgb': algorithm.accentRgb } as React.CSSProperties}
    >
      <header className="algorithm-card-header">
        <div className="algorithm-identity">
          <span>0{index + 1}</span>
          <div>
            <h2>{algorithm.name}</h2>
            <p>{algorithm.description}</p>
          </div>
        </div>
        <div className={`runner-status runner-status--${runner.status}`}>
          <i />
          {statusText}
        </div>
      </header>

      <div className="algorithm-canvas-wrap">
        <GridCanvas
          scenario={scenario}
          runner={runner}
          algorithm={algorithm}
          visualTick={visualTick}
        />
        <div className="segment-badge">
          LEG {String(activeSegment).padStart(2, '0')} / {String(totalSegments).padStart(2, '0')}
        </div>
        <div className="canvas-legend">
          <span><i className="legend-frontier" /> 前沿</span>
          <span><i className="legend-visited" /> 已扩展</span>
          <span><i className="legend-path" /> 路径</span>
        </div>
      </div>

      <div className="metric-strip">
        <Metric label="扩展节点" value={runner.expansions.toLocaleString('zh-CN')} emphasize />
        <Metric label="计算耗时" value={formatCpu(runner.cpuMs)} unit="ms" />
        <Metric label="路径代价" value={runner.path.length ? runner.pathCost.toFixed(2) : '—'} />
        <Metric label="峰值队列" value={String(runner.openPeak)} />
      </div>
      <footer className="algorithm-action">
        <Activity size={13} />
        <span>{runner.action}</span>
        <small>{runner.generated} 已发现</small>
      </footer>
    </article>
  )
}

function BenchmarkSidebar({
  scenario,
  runners,
  phase,
  visualTick,
}: {
  scenario: Scenario
  runners: SearchRunner[]
  phase: Phase
  visualTick: number
}) {
  void visualTick
  const completed = runners.filter((runner) => runner.status === 'complete')
  const failed = runners.filter((runner) => runner.status === 'failed')
  const bestExpanded = completed.length
    ? completed.reduce((best, runner) => (runner.expansions < best.expansions ? runner : best))
    : null
  const bestCpu = completed.length
    ? completed.reduce((best, runner) => (runner.cpuMs < best.cpuMs ? runner : best))
    : null
  const maxExpanded = Math.max(1, ...runners.map((runner) => runner.expansions))

  return (
    <aside className="side-panel benchmark-panel">
      <section className="panel-section">
        <SectionTitle index="LIVE" title="性能观测" accessory={phase === 'complete' ? 'FINAL' : 'STREAM'} />
        <div className="telemetry-hero">
          <div>
            <span>逻辑调度</span>
            <strong>1 : 1 : 1 : 1</strong>
          </div>
          <Zap size={26} />
        </div>
        <p className="telemetry-note">每个逻辑 tick 为每个未结束算法分配一次有效节点扩展。</p>
      </section>

      <section className="panel-section">
        <SectionTitle index="ROUTE" title="任务序列" accessory={`${scenario.waypoints.length + 1} 段`} />
        <div className="compact-route">
          <span className="compact-route-node start">S</span>
          {scenario.waypoints.map((point, index) => (
            <span className="compact-route-group" key={pointKey(point)}>
              <i />
              <span className="compact-route-node waypoint">{index + 1}</span>
            </span>
          ))}
          <span className="compact-route-group">
            <i />
            <span className="compact-route-node end">E</span>
          </span>
        </div>
      </section>

      <section className="panel-section ranking-section">
        <SectionTitle index="RANK" title="扩展量对比" accessory="越少越好" />
        <div className="ranking-list">
          {ALGORITHMS.map((algorithm) => {
            const runner = runners.find((item) => item.id === algorithm.id)
            if (!runner) return null
            return (
              <div className="ranking-row" key={algorithm.id}>
                <div className="ranking-label">
                  <i style={{ backgroundColor: algorithm.accent }} />
                  <span>{algorithm.shortName}</span>
                  <strong>{runner.expansions.toLocaleString('zh-CN')}</strong>
                </div>
                <div className="ranking-track">
                  <span
                    style={{
                      width: `${Math.max(2, (runner.expansions / maxExpanded) * 100)}%`,
                      backgroundColor: algorithm.accent,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="panel-section live-table-section">
        <SectionTitle index="DATA" title="实时数据" />
        <div className="live-table" role="table" aria-label="算法实时统计">
          <div className="live-table-head" role="row">
            <span>算法</span><span>扩展</span><span>计算 ms</span><span>代价</span>
          </div>
          {ALGORITHMS.map((algorithm) => {
            const runner = runners.find((item) => item.id === algorithm.id)
            if (!runner) return null
            return (
              <div className="live-table-row" role="row" key={algorithm.id}>
                <span style={{ color: algorithm.accent }}>{algorithm.shortName}</span>
                <span>{runner.expansions}</span>
                <span>{formatCpu(runner.cpuMs)}</span>
                <span>{runner.path.length ? runner.pathCost.toFixed(2) : '—'}</span>
              </div>
            )
          })}
        </div>
      </section>

      <section className={`analysis-callout ${phase === 'complete' ? 'is-ready' : ''}`}>
        <div className="analysis-callout-title">
          <Gauge size={16} />
          {phase === 'complete' ? (completed.length ? '本轮观测' : '路线不可达') : '等待完整样本'}
        </div>
        {phase === 'complete' && bestExpanded && bestCpu ? (
          <p>
            本轮单次观测中，<strong>{algorithmName(bestExpanded.id)}</strong> 扩展节点最少；
            <strong>{algorithmName(bestCpu.id)}</strong> 累计计算耗时最低。
            {failed.length > 0 && ` ${failed.length} 个算法未找到完整路线。`}
          </p>
        ) : phase === 'complete' && failed.length > 0 ? (
          <p>四种算法均在第 {failed[0].segmentIndex + 1} 航段判定无可行路径，请返回编辑调整障碍或节点。</p>
        ) : (
          <p>算法完成后自动生成本轮对比摘要。</p>
        )}
      </section>

      <div className="method-note">
        <Info size={14} />
        <p><strong>统计口径</strong>耗时仅累计算法步骤与回溯计算，不含动画、暂停和 Canvas 绘制；单次结果可能受 JIT 与系统调度影响。</p>
      </div>
    </aside>
  )
}

function PlaybackBar({
  phase,
  speed,
  completedCount,
  routeLength,
  visualTick,
  onSpeedChange,
  onToggle,
  onStep,
  onRestart,
}: {
  phase: Phase
  speed: number
  completedCount: number
  routeLength: number
  visualTick: number
  onSpeedChange: (speed: number) => void
  onToggle: () => void
  onStep: () => void
  onRestart: () => void
}) {
  return (
    <div className="playback-dock">
      <div className="playback-context">
        <span>SYNC CONTROL</span>
        <strong>{completedCount}/4 结束 · {routeLength} 航段</strong>
      </div>
      <div className="transport-controls">
        <button onClick={onRestart} aria-label="重新运行">
          <RotateCcw size={17} />
        </button>
        <button className="transport-primary" onClick={onToggle} aria-label={phase === 'running' ? '暂停' : '播放'}>
          {phase === 'running' ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}
        </button>
        <button onClick={onStep} disabled={phase === 'complete'} aria-label="所有算法单步前进">
          <StepForward size={18} />
        </button>
      </div>
      <div className="timeline-readout">
        <span>TICK</span>
        <div className={`timeline-track ${phase === 'running' ? 'is-running' : ''}`}>
          <i />
        </div>
        <strong>{String(visualTick).padStart(4, '0')}</strong>
      </div>
      <div className="speed-control">
        <span><Gauge size={14} /> 速度</span>
        <div className="speed-options">
          {SPEEDS.map((option) => (
            <button
              key={option}
              className={speed === option ? 'is-active' : ''}
              onClick={() => onSpeedChange(option)}
            >
              {option}×
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function SectionTitle({ index, title, accessory }: { index: string; title: string; accessory?: string }) {
  return (
    <div className="section-title">
      <span>{index}</span>
      <h2>{title}</h2>
      {accessory && <small>{accessory}</small>}
    </div>
  )
}

function RouteNode({
  type,
  label,
  point,
  actions,
}: {
  type: 'start' | 'waypoint' | 'end'
  label: string
  point: Point | null
  actions?: React.ReactNode
}) {
  return (
    <div className={`route-node route-node--${type} ${!point ? 'is-missing' : ''}`}>
      <span className="route-node-marker">
        {type === 'start' ? 'S' : type === 'end' ? 'E' : <MapPin size={12} fill="currentColor" />}
      </span>
      <div>
        <strong>{label}</strong>
        <small>{point ? `X ${String(point.x).padStart(2, '0')} · Y ${String(point.y).padStart(2, '0')}` : '尚未设置'}</small>
      </div>
      {actions}
    </div>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  disabled = false,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className={`toggle-row ${disabled ? 'is-disabled' : ''}`}>
      <div>
        <strong>{label}</strong>
        <small>{description}</small>
      </div>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="toggle-visual"><i /></span>
    </label>
  )
}

function Metric({ label, value, unit, emphasize = false }: { label: string; value: string; unit?: string; emphasize?: boolean }) {
  return (
    <div className={`metric ${emphasize ? 'metric--emphasize' : ''}`}>
      <span>{label}</span>
      <strong>{value}{unit && <small>{unit}</small>}</strong>
    </div>
  )
}

function formatCpu(value: number) {
  if (value === 0) return '0.00'
  if (value < 0.01) return '<0.01'
  return value.toFixed(2)
}

function algorithmName(id: SearchRunner['id']) {
  return ALGORITHMS.find((algorithm) => algorithm.id === id)?.shortName ?? id
}
