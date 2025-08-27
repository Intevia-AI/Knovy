import { EventEmitter } from 'events'

// Internal event bus for the main process to decouple modules
const internalBridge = new EventEmitter()

export default internalBridge
