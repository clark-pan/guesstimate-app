import {typeSafeEq, allPresent} from './utils'

const equalsProp = (propValue, propName) => e => typeSafeEq(_.get(e, propName), propValue)
const nullFn = x => null

export const get = (collection, id, prop='id') => allPresent(collection, id) ? collection.find(equalsProp(id, prop)) : null
export const getFn = (coll, getProp='id', inProp='id') => !coll ? nullFn : e => get(coll, _.get(e, inProp), getProp)

export const filter = (collection, id, prop='id') => allPresent(collection, id) ? collection.filter(equalsProp(id, prop)) : []

export const isPresent = e => !!e && !_.isEmpty(e)
