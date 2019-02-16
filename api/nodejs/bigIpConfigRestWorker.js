'use strict';
const ApiClient = require('./apiClient');
const Util = require('./util');

/**
 * @class BigIpConfigRestWorker
 * @mixes RestWorker
 *
 * @description A simple worker that outlines functions that
 * can be defined and when and how they are called
 *
 * Called when the worker is loaded from disk and first
 * instantiated by the @LoaderWorker
 * @constructor
 */
class BigIpConfigRestWorker {
  constructor () {
    this.apiClient = new ApiClient();
    this.util = new Util('BigIpConfigRestWorker', false);
    this.WORKER_URI_PATH = 'shared/blue-green/bigip-config';
    this.isPublic = true;
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
    this.apiClient.getAllBigIpConfigData(restOperation, workerContext)
      .then((items) => {
        this.completeSuccess(restOperation, items);
      })
      .catch((err) => {
        this.completeError(restOperation, err);
      });
  }

  completeSuccess (restOperation, output) {
    restOperation.setStatusCode(200);
    restOperation.setBody(output);
    restOperation.complete();
  }

  completeError (restOperation, error) {
    const code = error.code || 500;
    this.util.logError(this.restHelper.jsonPrinter(error));
    restOperation.setStatusCode(code);
    restOperation.setBody(error.message);
    restOperation.complete();
  }
}

module.exports = BigIpConfigRestWorker;
