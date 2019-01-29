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
    let validatedDeclaration = this.util.validateConfiguration(declaration);
    if (validatedDeclaration.isValid) {
      this.util.logInfo('Valid blue-green declaration');
      this.apiClient.buildBlueGreenObjects(restOperation, workerContext, validatedDeclaration.json)
        .then(() => {
          restOperation.setBody(validatedDeclaration.json);
          this.completeRestOperation(restOperation);
        })
        .catch((err) => {
          this.completeError(restOperation, err);
        });
    } else {
      const err = new Error(`Invalid blue-green configuration: ${validatedDeclaration.message}`);
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

    this.apiClient.blueGreenConfigExists(restOperation, workerContext, objectId)
      .then((configExists) => {
        if (configExists) {
          this.apiClient.unShimIRuleAndDeleteDatagroup(restOperation, workerContext, objectId)
            .then(() => {
              this.completeSuccess(restOperation, `declaration '${objectId}' successfully deleted`);
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
      'name': 'My_BlueGreen_Config',
      'partition': 'MyPartition',
      'virtualServerFullPath': '/MyPartition/Application_1/serviceMain',
      'distribution': {
        'ratio': 0.5,
        'bluePool': 'blue_pool',
        'greenPool': 'green_pool'
      }
    };
    example.kind = this.restHelper.makeKind(this.WORKER_URI_PATH, this);
    example.selfLink = this.restHelper.makePublicUri(this.getUri()).href;
    return example;
  }

  completeSuccess (restOperation, output) {
    if (typeof output === 'string') {
      output = { message: output };
    }
    restOperation.setStatusCode(200);
    restOperation.setBody(output);
    restOperation.complete();
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

module.exports = DeclarationRestWorker;
