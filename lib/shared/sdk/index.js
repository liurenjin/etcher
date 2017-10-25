/*
 * Copyright 2017 resin.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict'

const EventEmitter = require('events')
const _ = require('lodash')
const SDK = module.exports
const debug = require('debug')('sdk')

debug.enabled = true

/**
 * @summary The list of loaded adapters
 * @type {Object[]}
 * @constant
 */
const ADAPTERS = [
  require('./standard'),
  require('./usbboot')
]

/**
 * @summary Initialised adapters
 * @type {Object<String,Adapter>}
 * @constant
 */
SDK.adapters = _.reduce(ADAPTERS, (adapters, Adapter) => {
  adapters[Adapter.id] = new Adapter()
  return adapters
}, {})

/**
 * Adapter Scanner
 * @class Scanner
 */
SDK.Scanner = class Scanner extends EventEmitter {

  constructor(options = {}) {

    // Inherit from EventEmitter
    super()

    this.options = options
    this.isScanning = false
    this.adapters = new Map()

    // Bind event handlers to own context to facilitate
    // removing listeners by reference
    this._onResults = this._onResults.bind(this)
    this._onError = this._onError.bind(this)

    this._init()

  }

  _init() {
    debug('scanner:init', this)
    _.map(_.keys(this.options), (adapterId) => {
      const adapter = SDK.adapters[adapterId] ||
        _.get(this.options[ 'adapters', adapterId ])

      if (adapter == null) {
        throw new Error( `Unknown adapter "${adapterId}"` )
      }

      this.subsribe(adapter)
    })
  }

  _onResults(results) {
    this.emit('results', results)
  }

  _onError(error) {
    this.emit('error', error)
  }

  start() {
    debug('start', !this.isScanning)
    if (this.isScanning) {
      return this
    }

    this.adapters.forEach((adapter) => {
      const options = this.options[adapter.id]

      adapter.startScan(options)
        .on( 'results', this._onResults )
        .on( 'error', this._onError )
    })

    this.emit('start')
    this.isScanning = true

    return this
  }

  stop() {
    debug('start', this.isScanning)
    if (!this.isScanning) {
      return this
    }

    this.adapters.forEach((adapter) => {
      adapter.stopScan()
      adapter.removeListener( 'results', this._onResults )
      adapter.removeListener( 'error', this._onError )
    })

    this.isScanning = false
    this.emit('stop')

    return this
  }

  subsribe(adapter) {
    debug('subsribe', adapter)

    if (this.adapters.get(adapter.id)) {
      throw new Error( `Scanner: Already subsribed to ${adapter.id}` )
    }

    this.adapters.set(adapter.id, adapter)
    this.emit('subsribe', adapter)

    return this
  }

  unsubscribe(adapter) {
    debug('unsubsribe', adapter)
    const instance = typeof adapter === 'string' ?
      this.adapters.get(adapter) :
      this.adapters.get(adapter.id)

    if (instance == null) {
      // Not subscribed
      return this
    }

    this.adapters.delete(instance.name)
    this.emit('unsubsribe', adapter)

    return this
  }

}

SDK.createScanner = (options) => {
  return new SDK.Scanner(options)
}
