'use strict';
const ApiClient = require('./apiClient');
const Util = require('./util');

/**
 * @class BlueGreenConfigRestWorker
 * @mixes RestWorker
 *
 * @description A simple worker that outlines functions that
 * can be defined and when and how they are called
 *
 * Called when the worker is loaded from disk and first
 * instantiated by the @LoaderWorker
 * @constructor
 */
class BlueGreenConfigRestWorker {
  constructor () {
    this.apiClient = new ApiClient();
    this.util = new Util('BlueGreenConfigRestWorker', false);
    this.WORKER_URI_PATH = 'shared/blue-green/config';
    this.isPublic = true;
    this.isPassThrough = true;
  }

  /*****************
   * http handlers *
   *****************/

  /**
   * optional
   * handle onGet HTTP request
   * @param {Object} restOperation
   */
  onGet (restOperation) {
    const workerContext = this;
    const objectId = restOperation.getUri().pathname.split('/')[4];
    this.apiClient.getBlueGreenConfig(restOperation, workerContext, objectId)
      .then((config) => {
        if (config) {
          restOperation.setBody(config);
          this.completeRestOperation(restOperation);
        } else {
          const err = new Error(`declaration '${objectId}' does not exist`);
          err.code = 404;
          this.completeError(restOperation, err);
        }
      })
      .catch((err) => {
        this.completeError(restOperation, err);
      });
  }

  completeError (restOperation, error) {
    const err = {
      code: error.code || 500,
      error: error.message
    };
    this.util.logError(this.restHelper.jsonPrinter(err));

    restOperation.setStatusCode(err.code);
    restOperation.setBody(err);
    restOperation.complete();
  }
}

module.exports = BlueGreenConfigRestWorker;
