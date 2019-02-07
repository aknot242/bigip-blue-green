/*
*   Util:
*     Collection of helper functions for BlueGreen modules.
*
*   D. Edgar, January 2019
*   http://github.com/aknot242
*
*/

'use strict';
const BlueGreenSchema = require('./schema.json');
const Ajv = require('ajv');
const F5Logger = require('f5-logger');

class Util {
  constructor (moduleName, debugEnabled) {
    this.moduleName = moduleName;
    this.debugEnabled = debugEnabled;
    this.loggerInstance = F5Logger.getInstance();
  }

  /**
   * Logging helper used to log info messages
   * @param {*} message The info message to log
   */
  logInfo (message) {
    this.loggerInstance.info(this.formatMessage(message));
  }

  /**
   * Logging helper used to log debug messages
   * @param {*} message The debug message to log
   */
  logDebug (message) {
    if (this.debugEnabled === true) {
      this.loggerInstance.info(this.formatMessage(message, 'DEBUG'));
    }
  }

  /**
   * Logging helper used to log error messages
   * @param {*} message The error message to log
   */
  logError (message) {
    this.loggerInstance.info(this.formatMessage(message, 'ERROR'));
  }

  /**
   * String formatting helper for log messages
   * @param {*} message The message to format
   */
  formatMessage (message, classifier) {
    classifier = typeof classifier !== 'undefined' ? ` - ${classifier}` : '';
    return `[${this.moduleName}${classifier}] - ${message}`;
  }

  /**
   * Safely access object and property values without having to stack up safety checks for undefined values
   * @param {*} func A function that encloses the value to check
   * @param {*} fallbackValue An optional default value that is returned if any of the values in the object heirarchy are undefined. If this parameter isn't supplied, undefined will be returned instead of a default fallback value.
   */
  safeAccess (func, fallbackValue) {
    try {
      var value = func();
      return (value === null || value === undefined) ? fallbackValue : value;
    } catch (e) {
      return fallbackValue;
    }
  }

  /**
   * Check for some values, enforce some defaults. Uses Ajv JSON schema validator.
   *
   * @param {(object|string)} input
   *
   * @return {boolean}
   */
  validateConfiguration (input) {
    let message = 'success';
    let jsonInput = this.isJson(input);
    // Validate the input against the schema
    let ajv = new Ajv({ jsonPointers: true, allErrors: false, verbose: true, useDefaults: false });
    let validate = ajv.compile(BlueGreenSchema);
    let valid = validate(jsonInput);
    if (valid === false) {
      const error = this.safeAccess(() => validate.errors[0].message, '');
      if (error !== '') {
        message = `Validation error: ${this.translateAjvError(validate.errors[0])}`;
      } else {
        message = 'Unknown validation error.';
      }
      this.logError(`validateConfiguration() Error: ${message}`);
      return { isValid: false, message: message, json: jsonInput };
    }
    this.logDebug(`validateConfiguration(): ${message}`);
    return { isValid: true, message: message, json: jsonInput };
  }

  /**
  * Format an Ajv schema validator message depending on category
  *
  * @param {*} errorDetail
  */
  translateAjvError (errorDetail) {
    switch (errorDetail.keyword) {
      case 'enum':
        return `${errorDetail.dataPath} ${errorDetail.message}. Specified value: ${errorDetail.data} (allowed value(s) are ${errorDetail.params.allowedValues}`;
      default:
        return `${errorDetail.dataPath} ${errorDetail.message}`;
    }
  }

  /**
  * If not an Object, can we parse it?
  *
  * @param {(object|string)} input
  *
  * @return {object}
  */
  isJson (input) {
    if (input && typeof input !== 'object') {
      try {
        input = JSON.parse(input);
      } catch (err) {
        this.logInfo(`Error: Unable to parse input: ${err}`);
        return;
      }
    }
    return input;
  }
}

module.exports = Util;