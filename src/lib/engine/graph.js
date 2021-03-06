import * as _metric from './metric'
import * as _dgraph from './dgraph'
import * as _space from './space'
import * as _collections from './collections'

import BasicGraph from 'lib/basic_graph/basic-graph'
import {INFINITE_LOOP_ERROR} from 'lib/errors/modelErrors'

export const INTERMEDIATE = 'INTERMEDIATE'
export const OUTPUT = 'OUTPUT'
export const INPUT = 'INPUT'
export const NOEDGE = 'NOEDGE'

export function relationshipType(edges) {
  if (!_.isEmpty(edges.inputs) && !_.isEmpty(edges.outputs)) { return INTERMEDIATE }
  if (!_.isEmpty(edges.inputs)) { return OUTPUT }
  if (!_.isEmpty(edges.outputs)) { return INPUT }
  return NOEDGE
}

export const denormalize = graph => ({metrics: graph.metrics.map(_metric.denormalizeFn(graph)).filter(_collections.isPresent)})
export const runSimulation = (graph, metricId, n) => _dgraph.runSimulation(denormalize(graph), metricId, n)

function basicGraph(graph) {
  const dGraph = denormalize(graph)
  const edges = _dgraph.dependencyMap(dGraph)
  return new BasicGraph(_.map(graph.metrics, m => m.id), edges)
}

// This could be optimized for filtering the graph by the space subset
export function dependencyTree(oGraph, graphFilters) {
  const {spaceId, metricId, onlyHead, notHead, onlyUnsimulated} = graphFilters

  if (onlyHead) {
    const existingErrors = _.get(oGraph.simulations.find(s => s.metric === metricId), 'sample.errors')
    // This is a hack to prevent the error type from changing while editing metrics with infinite loops.
    // TODO(matthew): Store denormalized check so this hack is not necessary.
    if (!_.some(existingErrors, e => e.type === INFINITE_LOOP_ERROR)) { return [[metricId, 0]] }
  }

  let graph = oGraph
  if (spaceId) { graph = _space.subset(oGraph, spaceId) }

  let bGraph = basicGraph(graph)
  if (metricId) {
    bGraph = bGraph.subsetFrom([metricId]) 
  } else if (onlyUnsimulated) {
    const {metrics, simulations} = oGraph
    const unsimulatedIds = metrics.
      filter(m => !_.some(simulations, s => s.metric === m.id)).
      map(m => m.id)

    bGraph = bGraph.subsetFrom(unsimulatedIds)
  }

  const nodes = bGraph.nodes.map(n => [n.id, n.maxDistanceFromRoot])

  if (notHead) {
    const head = nodes.find(e => (e[0] === metricId))
    const rest = nodes.filter(e => (e[0] !== metricId))
    if (!_.isFinite(head[1])) {
      return [head,...rest]
    }
    return rest
  } else {
    return nodes
  }
}
