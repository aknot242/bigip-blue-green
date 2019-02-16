'use strict';
const ApiClient = require('./apiClient');
const Util = require('./util');

/**
 * @class DeclarationRestWorker
 * @mixes RestWorker
 *
 * @description A simple worker that outlines functions that
 * can be defined and when and how they are called
 *
 * Called when the worker is loaded from disk and first
 * instantiated by the @LoaderWorker
 * @constructor
 */
class DeclarationRestWorker {
  constructor () {
    this.apiClient = new ApiClient();
    this.util = new Util('DeclarationRestWorker', false);
    this.WORKER_URI_PATH = 'shared/blue-green/declare';
    this.isPublic = true;
    this.isPassThrough = true;
  }

  /**
 * handle onPost HTTP request
 * @param {Object} restOperation
 */
  onPost (restOperation) {
    const workerContext = this;
    this.util.logDebug('blue-green declaration POST request');

    let declaration = restOperation.getBody();

    this.util.validateDeclaration(declaration)
      .then((validatedDeclaration) => {
        if (validatedDeclaration.isValid) {
          this.util.logInfo('Schema valid blue-green declaration');
          declaration = validatedDeclaration.json;
        } else {
          throw new Error(`Schema invalid blue-green declaration: ${validatedDeclaration.message}`);
        }
      })
      .then(() => this.apiClient.getVirtualServer(restOperation, workerContext, declaration.virtualServerFullPath))
      .then((vs) => {
        if (this.util.isEmptyObject(vs)) {
          throw new Error('Virtual Server does not exist.');
        } else if (!vs.hasHttpProfile) {
          throw new Error('Virtual Server has no Http Profile.');
        }
      })
      .then(() => this.apiClient.getPools(restOperation, workerContext))
      .then((pools) => {
        if (!pools.find(p => p.fullPath === declaration.bluePool)) throw new Error(`Blue pool '${declaration.bluePool}' does not exist.`);
        if (!pools.find(p => p.fullPath === declaration.greenPool)) throw new Error(`Green pool '${declaration.greenPool}' does not exist.`);
      })
      .then(() => this.apiClient.isDeclarationConflicting(restOperation, workerContext, declaration))
      .then((result) => {
        if (result.conflict) {
          throw new Error(`Virtual Server in declaration '${declaration.name}' conflicts with existing declaration '${result.reference.name}'`);
        }
      })
      .then(() => {
        this.util.logInfo(`No existing declaration conflicts with provided blue-green declaration`);
        return this.apiClient.buildBlueGreenObjects(restOperation, workerContext, declaration);
      })
      .then(() => {
        restOperation.setBody(declaration);
        this.completeRestOperation(restOperation);
      })
      .catch((err) => {
        err.code = 422;
        this.util.logError(`declarationRestWorker onPost(): ${err}`);
        this.completeError(restOperation, err);
      });
  }

  /**
  * Handle HTTP DELETE method
  * @param {object} restOperation
  * @returns {void}
  */
  onDelete (restOperation) {
    const workerContext = this;
    const objectId = restOperation.getUri().pathname.split('/')[4];

    this.util.logDebug(`blue-green declaration DELETE request ${objectId}`);

    this.apiClient.blueGreenDeclarationExists(restOperation, workerContext, objectId)
      .then((exists) => {
        if (exists) {
          return this.apiClient.unShimIRuleAndDeleteDeclaration(restOperation, workerContext, objectId);
        } else {
          const err = new Error(`declaration '${objectId}' does not exist`);
          err.code = 404;
          throw err;
        }
      })
      .then(() => {
        this.completeSuccess(restOperation, `{"message": "declaration '${objectId}' successfully deleted"}`);
      })
      .catch((err) => {
        this.completeError(restOperation, err);
      });
  }

  /**
  * Create a handler for requests to/example
  * @return {Object} example of the object model for this worker
  */
  getExampleState () {
    const example = {
      'name': 'My_BlueGreen_Declaration',
      'virtualServerFullPath': '/MyPartition/Application_1/serviceMain',
      'ratio': 0.5,
      'bluePool': 'blue_pool',
      'greenPool': 'green_pool'
    };
    return example;
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

module.exports = DeclarationRestWorker;
