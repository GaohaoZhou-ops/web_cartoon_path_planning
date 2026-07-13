import { describe, expect, it } from 'vitest'
import {
  ALGORITHMS,
  createRunner,
  type AlgorithmId,
  type RunnerStatus,
  type Scenario,
} from './pathfinding'
import {
  appendFinishedAlgorithms,
  orderAlgorithmsByFinish,
  orderMetricResultsBestFirst,
} from './ranking'

const map: Scenario = {
  cols: 2,
  rows: 2,
  start: { x: 0, y: 0 },
  waypoints: [],
  end: { x: 1, y: 1 },
  obstacles: new Set(),
  allowDiagonal: true,
  preventCornerCutting: true,
}

describe('algorithm card finish order', () => {
  it('keeps finish ranks stable while unfinished cards retain registration order', () => {
    const runners = ALGORITHMS.map((algorithm) => createRunner(algorithm.id, map))
    let finishOrder: AlgorithmId[] = []

    runners.find((runner) => runner.id === 'greedy')!.status = 'complete'
    finishOrder = appendFinishedAlgorithms(finishOrder, runners)
    expect(orderAlgorithmsByFinish(ALGORITHMS, finishOrder).map((algorithm) => algorithm.id)).toEqual([
      'greedy',
      ...ALGORITHMS.map((algorithm) => algorithm.id).filter((id) => id !== 'greedy'),
    ])

    runners.find((runner) => runner.id === 'jps')!.status = 'complete'
    finishOrder = appendFinishedAlgorithms(finishOrder, runners)
    finishOrder = appendFinishedAlgorithms(finishOrder, runners)
    expect(finishOrder).toEqual(['greedy', 'jps'])
    expect(orderAlgorithmsByFinish(ALGORITHMS, finishOrder).map((algorithm) => algorithm.id)).toEqual([
      'greedy',
      'jps',
      ...ALGORITHMS.map((algorithm) => algorithm.id).filter(
        (id) => id !== 'greedy' && id !== 'jps',
      ),
    ])
  })
})

interface MetricFixture {
  id: string
  status: RunnerStatus
  value: number | null
}

describe('final chart metric order', () => {
  it('places successful results first and orders each status group from low to high', () => {
    const results: MetricFixture[] = [
      { id: 'failed-fast', status: 'failed', value: 1 },
      { id: 'successful-slow', status: 'complete', value: 12 },
      { id: 'failed-missing', status: 'failed', value: null },
      { id: 'successful-fast', status: 'complete', value: 4 },
      { id: 'failed-slow', status: 'failed', value: 9 },
    ]

    expect(
      orderMetricResultsBestFirst(results, ({ status, value }) => ({ status, value })).map(
        ({ id }) => id,
      ),
    ).toEqual([
      'successful-fast',
      'successful-slow',
      'failed-fast',
      'failed-slow',
      'failed-missing',
    ])
  })

  it('keeps the existing finish order when metric values are tied or unavailable', () => {
    const results: MetricFixture[] = [
      { id: 'first-tie', status: 'complete', value: 5 },
      { id: 'second-tie', status: 'complete', value: 5 },
      { id: 'first-missing', status: 'failed', value: null },
      { id: 'second-missing', status: 'failed', value: null },
    ]

    expect(
      orderMetricResultsBestFirst(results, ({ status, value }) => ({ status, value })).map(
        ({ id }) => id,
      ),
    ).toEqual(results.map(({ id }) => id))
  })
})
