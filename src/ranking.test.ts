import { describe, expect, it } from 'vitest'
import { ALGORITHMS, createRunner, type AlgorithmId, type Scenario } from './pathfinding'
import { appendFinishedAlgorithms, orderAlgorithmsByFinish } from './ranking'

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
