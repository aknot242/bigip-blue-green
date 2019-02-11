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
    const declarationName = restOperation.getUri().pathname.split('/')[4];
    if (!declarationName) {
      this.apiClient.getAllBlueGreenDeclarations(restOperation, workerContext)
        .then((declarations) => {
          this.completeSuccess(restOperation, declarations);
        })
        .catch((err) => {
          this.completeError(restOperation, err);
        });
    } else {
      this.apiClient.getBlueGreenDeclaration(restOperation, workerContext, declarationName)
        .then((declaration) => {
          if (!this.util.isEmptyObject(declaration)) {
            this.completeSuccess(restOperation, declaration);
          } else {
            const err = new Error(`declaration '${declarationName}' does not exist`);
            err.code = 404;
            this.completeError(restOperation, err);
          }
        })
        .catch((err) => {
          this.completeError(restOperation, err);
        });
    }
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

module.exports = BlueGreenConfigRestWorker;
