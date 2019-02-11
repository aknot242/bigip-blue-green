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
    let validatedDeclaration = this.util.validateDeclaration(declaration);
    if (validatedDeclaration.isValid) {
      this.util.logInfo('Valid blue-green declaration');
      this.apiClient.isDeclarationConflicting(restOperation, workerContext, validatedDeclaration.json)
        .then((result) => {
          if (!result.conflict) {
            this.util.logInfo(`No existing declaration conflicts with provided blue-green declaration`);
            this.apiClient.buildBlueGreenObjects(restOperation, workerContext, validatedDeclaration.json)
              .then(() => {
                restOperation.setBody(validatedDeclaration.json);
                this.completeRestOperation(restOperation);
              })
              .catch((err) => {
                this.completeError(restOperation, err);
              });
          } else {
            const err = new Error(`Virtual Server in declaration '${validatedDeclaration.json.name}' conflicts with existing declaration '${result.reference.name}'`);
            err.code = 422;
            this.completeError(restOperation, err);
          }
        });
    } else {
      const err = new Error(`Invalid blue-green declaration: ${validatedDeclaration.message}`);
      err.code = 422;
      this.completeError(restOperation, err);
    }
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
      .then((declarationExists) => {
        if (declarationExists) {
          this.apiClient.unShimIRuleAndDeleteDeclaration(restOperation, workerContext, objectId)
            .then(() => {
              this.completeSuccess(restOperation, `{"message": "declaration '${objectId}' successfully deleted"}`);
            })
            .catch((err) => {
              this.completeError(restOperation, err);
            });
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
