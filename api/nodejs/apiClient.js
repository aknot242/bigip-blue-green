'use strict';
const Util = require('./util');

const DEFAULT_PARTITION = 'Common';
const DATA_GROUP = '____bigip_blue_green';
const BASE_DATA_GROUP_URI = '/mgmt/tm/ltm/data-group/internal';
const DATA_GROUP_URI = `${BASE_DATA_GROUP_URI}/~${DEFAULT_PARTITION}~${DATA_GROUP}`;
const SHIM_IRULE_NAME = '_bigip_blue_green';
const SHIM_IRULE_FULLPATH = `/${DEFAULT_PARTITION}/${SHIM_IRULE_NAME}`;
const COOKIE_PREFIX = 'bg';

class ApiClient {
  constructor () {
    this.util = new Util('ApiClient', false);
  }

  getAllBigIpConfigData (originalRestOp, workerContext) {
    const getVsPromise = this.getVirtualServers(originalRestOp, workerContext);
    const getPoolsPromise = this.getPools(originalRestOp, workerContext);
    return Promise.all([getVsPromise, getPoolsPromise])
      .then((values) => {
        return { virtualServers: values[0], pools: values[1] };
      })
      .catch((err) => {
        this.util.logError(`getAllBigIpConfigData(): ${err}`);
        throw err;
      });
  }

  /** partitions from the big-ip */
  getPartitions (originalRestOp, workerContext) {
    const uri = workerContext.restHelper.makeRestjavadUri('/mgmt/tm/auth/partition', '$select=fullPath');
    return workerContext.restRequestSender.sendGet(this.getRestOperationInstance(originalRestOp, workerContext, uri))
      .then((response) => {
        const body = response.getBody();
        const items = body.items || [];
        return items.map(v => v.fullPath);
      })
      .catch((err) => {
        this.util.logError(`getPartitions(): ${err}`);
        throw err;
      });
  }

  /** GET virtual servers from the big-ip */
  getVirtualServers (originalRestOp, workerContext) {
    const uri = workerContext.restHelper.makeRestjavadUri('/mgmt/tm/ltm/virtual', 'expandSubcollections=true&$select=name,fullPath,profilesReference/items/nameReference/link');
    return workerContext.restRequestSender.sendGet(this.getRestOperationInstance(originalRestOp, workerContext, uri))
      .then((response) => {
        const body = response.getBody();
        const items = body.items || [];
        return items.map(v => { return { name: v.name, fullPath: v.fullPath, hasHttpProfile: this.virtualServerHasHttpProfile(v) }; });
      })
      .catch((err) => {
        this.util.logError(`getVirtualServers(): ${err}`);
        throw err;
      });
  }

  /** GET virtual server by full path from the big-ip */
  getVirtualServer (originalRestOp, workerContext, virtualServer) {
    const vsNamePath = this.convertPathForQuery(virtualServer);
    const uri = workerContext.restHelper.makeRestjavadUri(`/mgmt/tm/ltm/virtual/${vsNamePath}`, 'expandSubcollections=true&$select=name,fullPath,profilesReference/items/nameReference/link');
    return workerContext.restRequestSender.sendGet(this.getRestOperationInstance(originalRestOp, workerContext, uri))
      .then((response) => {
        const body = response.getBody();
        return { name: body.name, fullPath: body.fullPath, hasHttpProfile: this.virtualServerHasHttpProfile(body) };
      })
      .catch((err) => {
        const errorStatusCode = err.getResponseOperation().getStatusCode();
        // virtual server does not exist
        if (errorStatusCode === 404) {
          return {};
        }
        this.util.logError(`getVirtualServer(): ${err}`);
        throw err;
      });
  }

  /** GET pools from the big-ip */
  getPools (originalRestOp, workerContext) {
    const uri = workerContext.restHelper.makeRestjavadUri('/mgmt/tm/ltm/pool', '$select=name,fullPath');
    return workerContext.restRequestSender.sendGet(this.getRestOperationInstance(originalRestOp, workerContext, uri))
      .then((response) => {
        const body = response.getBody();
        const items = body.items || [];
        return items.map(v => { return { name: v.name, fullPath: v.fullPath }; });
      })
      .catch((err) => {
        this.util.logError(`getPools(): ${err}`);
        throw err;
      });
  }

  /** GET pool by full path from the big-ip */
  getPool (originalRestOp, workerContext, poolFullPath) {
    const poolNamePath = this.convertPathForQuery(poolFullPath);
    const uri = workerContext.restHelper.makeRestjavadUri(`/mgmt/tm/ltm/pool/${poolNamePath}`, '$select=name,fullPath');
    return workerContext.restRequestSender.sendGet(this.getRestOperationInstance(originalRestOp, workerContext, uri))
      .then((response) => {
        const body = response.getBody();
        return { name: body.name, fullPath: body.fullPath };
      })
      .catch((err) => {
        const errorStatusCode = err.getResponseOperation().getStatusCode();
        // pool does not exist
        if (errorStatusCode === 404) {
          return {};
        }
        this.util.logError(`getPool(): ${err}`);
        throw err;
      });
  }

  // *********************** START BUILDERS ***************************************

  /** build blue-green objects on the big-ip */
  buildBlueGreenObjects (originalRestOp, workerContext, declaration) {
    this.util.logDebug(`buildBlueGreenObjects(): Declaration: ${workerContext.restHelper.jsonPrinter(declaration)}`);
    return this.getBlueGreenDeclaration(originalRestOp, workerContext, declaration.name)
      .then((originalDeclaration) => {
        // if the virtual server is changing for this declaration, unshim the iRule from the previous virtual server
        if (!this.util.isEmptyObject(originalDeclaration) && originalDeclaration.virtualServer.toLowerCase() !== declaration.virtualServer.toLowerCase()) {
          return this.unShimIRule(originalRestOp, workerContext, originalDeclaration.virtualServer)
        }
      })
      .then(() => this.setBlueGreenDeclaration(originalRestOp, workerContext, declaration))
      .then(() => {
        // check if the irule is present, and plug it in!
        this.util.logDebug(`buildBlueGreenObjects(): Ready to shim`);
        return this.shimIRule(originalRestOp, workerContext, declaration.virtualServer);
      })
      .catch((err) => {
        this.util.logError(`buildBlueGreenObjects(): ${err}`);
        throw err;
      });
  }

  /** GET all bluegreen declarations from datagroups from the big-ip */
  getAllBlueGreenDeclarations (originalRestOp, workerContext) {
    const uri = workerContext.restHelper.makeRestjavadUri(DATA_GROUP_URI);
    this.util.logDebug(`getAllBlueGreenDeclarations(): uri ${workerContext.restHelper.jsonPrinter(uri)}`);
    return workerContext.restRequestSender.sendGet(this.getRestOperationInstance(originalRestOp, workerContext, uri))
      .then((response) => {
        this.util.logDebug(`getAllBlueGreenDeclarations(): GET data returned: ${workerContext.restHelper.jsonPrinter(response)}`);
        const records = response.body.records || [];
        const recordObjects = records.map(record => {
          return this.buildDeclarationFromDGRecord(record);
        });
        this.util.logDebug(`getAllBlueGreenDeclarations(): result: ${workerContext.restHelper.jsonPrinter(recordObjects)}`);
        return recordObjects;
      })
      .catch((err) => {
        const errorStatusCode = err.getResponseOperation().getStatusCode();
        // datagroup does not yet exist until declarations are set
        if (errorStatusCode === 404) {
          return [];
        }
        this.util.logError(`getAllBlueGreenDeclarations(): ${err}`);
        throw err;
      });
  }

  /** GET specific bluegreen declaration from datagroups from the big-ip */
  getBlueGreenDeclaration (originalRestOp, workerContext, declarationName) {
    return this.getAllBlueGreenDeclarations(originalRestOp, workerContext)
      .then((declarations) => {
        return declarations.find(declaration => declaration.name === declarationName) || {};
      })
      .catch((err) => {
        this.util.logError(`getBlueGreenDeclaration(): ${err}`);
        throw err;
      });
  }

  /** Checks to see if a declaration by another name already exists for a virtual server on the big-ip */
  isDeclarationConflicting (originalRestOp, workerContext, declarationToCheck) {
    return this.getAllBlueGreenDeclarations(originalRestOp, workerContext)
      .then((declarations) => {
        const conflictingDeclaration = declarations.find(declaration =>
          declaration.name.toLowerCase() !== declarationToCheck.name.toLowerCase() &&
          declaration.virtualServer.toLowerCase() === declarationToCheck.virtualServer.toLowerCase());
        return { conflict: conflictingDeclaration !== undefined, reference: conflictingDeclaration };
      })
      .catch((err) => {
        this.util.logError(`isDeclarationConflicting(): ${err}`);
        throw err;
      });
  }

  /** check if bluegreen declaration exists on big-ip */
  blueGreenDeclarationExists (originalRestOp, workerContext, declarationName) {
    return this.getBlueGreenDeclaration(originalRestOp, workerContext, declarationName)
      .then((declaration) => {
        this.util.logDebug(`blueGreenDeclarationExists(): GET data returned: ${workerContext.restHelper.jsonPrinter(declaration)}`);
        return !this.util.isEmptyObject(declaration);
      })
      .catch((err) => {
        this.util.logError(`blueGreenDeclarationExists(): ${err}`);
        throw err;
      });
  }

  /** Save declaration in a datagroup with a PATCH. If the datagroup doesn't exist create it first with a POST */
  setBlueGreenDeclaration (originalRestOp, workerContext, declaration) {
    const patchUri = workerContext.restHelper.makeRestjavadUri(`${DATA_GROUP_URI}`);
    this.util.logDebug(`setBlueGreenDeclaration(): uri ${workerContext.restHelper.jsonPrinter(patchUri)}`);
    return this.ensureDataGroupExists(originalRestOp, workerContext)
      .then(() => this.getAllBlueGreenDeclarations(originalRestOp, workerContext))
      .then((records) => {
        // if a declaration (by name) already exists, always replace it
        const newRecordsArray = records.filter(f => f.name !== declaration.name);
        newRecordsArray.push(declaration);
        this.util.logDebug(`setBlueGreenDeclaration(): new records array ${workerContext.restHelper.jsonPrinter(newRecordsArray)}`);

        return workerContext.restRequestSender.sendPatch(this.getRestOperationInstance(originalRestOp, workerContext, patchUri, this.buildDataGroupBody(newRecordsArray)))
          .then((resp) => {
            this.util.logDebug(`setBlueGreenDeclaration(): PATCH response ${workerContext.restHelper.jsonPrinter(resp.body)}`);
          })
          .catch((err) => {
            this.util.logError(`setBlueGreenDeclaration() PATCH: ${err}`);
            throw err;
          });
      })
      .catch((err) => {
        this.util.logError(`setBlueGreenDeclaration(): ${err}`);
        throw err;
      });
  }

  /** DELETE bluegreen declaration in on the big-ip */
  deleteBlueGreenDeclaration (originalRestOp, workerContext, declarationName) {
    const patchUri = workerContext.restHelper.makeRestjavadUri(`${DATA_GROUP_URI}`);
    this.util.logDebug(`deleteBlueGreenDeclaration(): uri ${workerContext.restHelper.jsonPrinter(patchUri)}`);
    return this.ensureDataGroupExists(originalRestOp, workerContext)
      .then(() => this.getAllBlueGreenDeclarations(originalRestOp, workerContext))
      .then((records) => {
        // if a declaration (by name) already exists, always replace it
        const newRecordsArray = records.filter(f => f.name !== declarationName);
        this.util.logDebug(`deleteBlueGreenDeclaration(): new records array ${workerContext.restHelper.jsonPrinter(newRecordsArray)}`);

        return workerContext.restRequestSender.sendPatch(this.getRestOperationInstance(originalRestOp, workerContext, patchUri, this.buildDataGroupBody(newRecordsArray)))
          .then((resp) => {
            this.util.logDebug(`deleteBlueGreenDeclaration(): PATCH response ${workerContext.restHelper.jsonPrinter(resp.body)}`);
          })
          .catch((err) => {
            this.util.logError(`deleteBlueGreenDeclaration() PATCH: ${err}`);
            throw err;
          });
      })
      .catch((err) => {
        this.util.logError(`deleteBlueGreenDeclaration(): ${err}`);
        throw err;
      });
  }

  /** GET to see if the declaration datagroup exists on the big-ip and create it if not */
  ensureDataGroupExists (originalRestOp, workerContext) {
    const uri = workerContext.restHelper.makeRestjavadUri(DATA_GROUP_URI);
    return workerContext.restRequestSender.sendGet(this.getRestOperationInstance(originalRestOp, workerContext, uri))
      .then(() => true)
      .catch((err) => {
        const errorStatusCode = err.getResponseOperation().getStatusCode();
        if (errorStatusCode === 404) {
          return this.createDataGroup(originalRestOp, workerContext);
        }
        this.util.logError(`ensureDataGroupExists(): ${err}`);
        throw err;
      });
  }

  /** Create the declaration datagroup */
  createDataGroup (originalRestOp, workerContext) {
    const uri = workerContext.restHelper.makeRestjavadUri(BASE_DATA_GROUP_URI);
    this.util.logDebug(`createDataGroup(): at start`);
    return workerContext.restRequestSender.sendPost(this.getRestOperationInstance(originalRestOp, workerContext, uri, this.buildDataGroupBody()))
      .then((resp) => {
        this.util.logDebug(`createDataGroup(): POST response ${workerContext.restHelper.jsonPrinter(resp.body)}`);
        return resp.body;
      })
      .catch((err) => {
        this.util.logError(`createDataGroup() POST: ${err}`);
        throw err;
      });
  }

  createShimIRule (originalRestOp, workerContext) {
    const uri = workerContext.restHelper.makeRestjavadUri('/mgmt/tm/ltm/rule/');
    this.util.logDebug(`createShimIRule(): at start`);
    return workerContext.restRequestSender.sendPost(this.getRestOperationInstance(originalRestOp, workerContext, uri, this.buildIRuleBody(SHIM_IRULE_FULLPATH)))
      .then((resp) => {
        this.util.logDebug(`createShimIRule(): POST response ${workerContext.restHelper.jsonPrinter(resp.body)}`);
        return resp.body;
      })
      .catch((err) => {
        this.util.logError(`createShimIRule() POST: ${err}`);
        throw err;
      });
  }

  /** GET to see if the shim irule exists on the big-ip */
  shimIRuleExists (originalRestOp, workerContext) {
    const uri = workerContext.restHelper.makeRestjavadUri(`/mgmt/tm/ltm/rule/${this.convertPathForQuery(SHIM_IRULE_FULLPATH)}`, '$select=fullPath');
    return workerContext.restRequestSender.sendGet(this.getRestOperationInstance(originalRestOp, workerContext, uri))
      .then(() => true)
      .catch((err) => {
        const errorStatusCode = err.getResponseOperation().getStatusCode();
        if (errorStatusCode === 404) {
          return false;
        }
        this.util.logError(`shimIRuleExists(): ${err}`);
        throw err;
      });
  }

  shimIRule (originalRestOp, workerContext, virtualServer) {
    // Check to make sure the shim irule exists first
    return this.shimIRuleExists(originalRestOp, workerContext)
      .then((exists) => {
        this.util.logDebug(`shimIRule(): in first then() ${exists}`);
        if (!exists) {
          return this.createShimIRule(originalRestOp, workerContext);
        }
      })
      .then(() => {
        this.util.logDebug(`shimIRule(): in second then() vsfullpath: ${workerContext.restHelper.jsonPrinter(virtualServer)}`);
        return this.getIRulesByVirtualServer(originalRestOp, workerContext, virtualServer);
      })
      .then((rules) => {
        this.util.logDebug(`shimIRule(): in third then()`);
        let existingIRules = rules || [];
        this.util.logDebug(`shimIRule(): getIRulesByVirtualServer response ${workerContext.restHelper.jsonPrinter(existingIRules)}`);
        if (existingIRules.indexOf(SHIM_IRULE_FULLPATH) === -1) {
          existingIRules.push(SHIM_IRULE_FULLPATH);
          this.util.logDebug(`shimIRule(): after irule push ${workerContext.restHelper.jsonPrinter(existingIRules)}`);
          return this.setIRulesByVirtualServer(originalRestOp, workerContext, virtualServer, existingIRules);
        }
        return existingIRules;
      })
      .catch((err) => {
        this.util.logError(`shimIRule(): ${err}`);
        throw err;
      });
  }

  /** GET irules bound to a virtual server from the big-ip */
  getIRulesByVirtualServer (originalRestOp, workerContext, virtualServer) {
    const uri = workerContext.restHelper.makeRestjavadUri(`/mgmt/tm/ltm/virtual/${this.convertPathForQuery(virtualServer)}`, '$select=rules');
    this.util.logDebug(`getIRulesByVirtualServer(): uri ${workerContext.restHelper.jsonPrinter(uri)}`);
    return workerContext.restRequestSender.sendGet(this.getRestOperationInstance(originalRestOp, workerContext, uri))
      .then((data) => data.body['rules'])
      .catch((err) => {
        this.util.logError(`getIRulesByVirtualServer(): ${err}`);
        throw err;
      });
  }

  /** PATCH irules bound to a virtual server from the big-ip */
  setIRulesByVirtualServer (originalRestOp, workerContext, virtualServer, iRules) {
    const uri = workerContext.restHelper.makeRestjavadUri(`/mgmt/tm/ltm/virtual/${this.convertPathForQuery(virtualServer)}`);
    const rules = { rules: iRules };
    this.util.logDebug(`setIRulesByVirtualServer(): uri ${workerContext.restHelper.jsonPrinter(uri)} rules ${workerContext.restHelper.jsonPrinter(rules)}`);
    return workerContext.restRequestSender.sendPatch(this.getRestOperationInstance(originalRestOp, workerContext, uri, rules))
      .then((data) => {
        this.util.logDebug(`setIRulesByVirtualServer(): PATCH response ${workerContext.restHelper.jsonPrinter(data.body)}`);
        return data.body['rules'];
      })
      .catch((err) => {
        this.util.logError(`setIRulesByVirtualServer(): ${err}`);
        throw err;
      });
  }

  unShimIRuleAndDeleteDeclaration (originalRestOp, workerContext, declarationName) {
    return this.getBlueGreenDeclaration(originalRestOp, workerContext, declarationName)
      .then((declaration) => {
        const deleteBlueGreenDeclarationPromise = this.deleteBlueGreenDeclaration(originalRestOp, workerContext, declaration.name);
        const unShimIRulePromise = this.unShimIRule(originalRestOp, workerContext, declaration.virtualServer);
        return Promise.all([deleteBlueGreenDeclarationPromise, unShimIRulePromise]);
      })
      .catch((err) => {
        this.util.logError(`unShimIRuleAndDeleteDeclaration(): ${err}`);
        throw err;
      });
  }

  /** DELETE datagroup by partition from the big-ip */
  deleteDataGroup (originalRestOp, workerContext) {
    const uri = workerContext.restHelper.makeRestjavadUri(DATA_GROUP_URI);
    return workerContext.restRequestSender.sendDelete(this.getRestOperationInstance(originalRestOp, workerContext, uri));
  }

  unShimIRule (originalRestOp, workerContext, virtualServer) {
    this.util.logDebug(`unShimIRule(): virtualServer ${virtualServer}`);
    return this.getIRulesByVirtualServer(originalRestOp, workerContext, virtualServer)
      .then((data) => {
        let iRules = data || [];
        if (iRules.indexOf(SHIM_IRULE_FULLPATH) !== -1) {
          iRules = iRules.filter(v => v !== SHIM_IRULE_FULLPATH);
          return this.setIRulesByVirtualServer(originalRestOp, workerContext, virtualServer, iRules);
        }
        return iRules;
      })
      .catch((err) => {
        this.util.logError(`unShimIRule(): ${err}`);
        throw err;
      });
  }

  buildIRuleBody (shimIRuleFullPath) {
    return {
      'kind': 'tm:ltm:rule:rulestate',
      'name': SHIM_IRULE_NAME,
      'fullPath': shimIRuleFullPath,
      'apiAnonymous': `# API Version ${this.util.getApiVersion()}\nproc get_datagroup_value {dg_name vs_full_path} {\n    set dg [class get $dg_name]\n    foreach x $dg {\n        if { $x starts_with $vs_full_path} {\n            return $x\n            break\n        }\n    }\n}\n\nproc get_cookie_name {vs_full_path}   {\n    return "${COOKIE_PREFIX}[string map "/ _" $vs_full_path]"\n}\n\nwhen HTTP_REQUEST {\n    # Use this to set the cookie name as well as to look up the distribution and pool name settings from the datagroup\n    set traffic_dist_rule [call get_datagroup_value "${DATA_GROUP}" [virtual name]]\n    set fields [split $traffic_dist_rule ","]\n    set vs [lindex $fields 0]\n    set distribution [lindex $fields 1]\n    set blue_pool [lindex $fields 2]\n    set green_pool [lindex $fields 3]\n    set blue_green_cookie [call get_cookie_name $vs]\n\n    # Check if there is a pool selector cookie in the request\n    if { [HTTP::cookie exists $blue_green_cookie] } {\n    \n        # Select the pool from the cookie\n        pool [HTTP::cookie $blue_green_cookie]\n        set selected ""\n    } else {\n    \n        # No pool selector cookie, so choose a pool based on the datagroup distribution\n        set rand [expr { rand() }]\n    \n        if { $rand < $distribution } { \n            pool $blue_pool\n            set selected $blue_pool\n        } else {\n            pool $green_pool\n            set selected $green_pool\n        }\n    }\n}\n\nwhen HTTP_RESPONSE {\n     # Set a pool selector cookie from the pool that was was selected for this request\n    if {$selected ne ""}{\n        HTTP::cookie insert name $blue_green_cookie value $selected path "/"\n    }\n}`
    };
  }

  buildDataGroupBody (records) {
    const body = {
      'name': DATA_GROUP,
      'partition': DEFAULT_PARTITION
    };
    if (records) {
      body['records'] = records.map(record => this.buildDGRecordFromDeclaration(record));
    } else {
      body['type'] = 'string';
    }
    return body;
  }

  buildDGRecordFromDeclaration (declaration) {
    return {
      'name': declaration.name,
      'data': `${declaration.virtualServer},${declaration.distribution},${declaration.bluePool},${declaration.greenPool}`
    };
  }

  buildDeclarationFromDGRecord (record) {
    const dArray = record.data.split(',');
    return {
      name: record.name,
      virtualServer: dArray[0],
      distribution: Number(dArray[1]),
      bluePool: dArray[2],
      greenPool: dArray[3]
    };
  }

  convertPathForQuery (path) {
    return path.replace(/\//g, '~');
  }

  getRestOperationInstance (originalRestOp, workerContext, uri, body) {
    const restOp = workerContext.restOperationFactory.createRestOperationInstance()
      .setUri(uri)
      .setIsSetBasicAuthHeader(true)
      .setBasicAuthorization(originalRestOp.getBasicAuthorization());
    if (body !== undefined) {
      restOp.setBody(body);
    }
    return restOp;
  }

  virtualServerHasHttpProfile (virtualServer) {
    const profilesArray = virtualServer.profilesReference.items || [];
    this.util.logDebug(`virtualServerHasHttpProfile(): virtualServer ${JSON.stringify(virtualServer)}`);
    // eslint-disable-next-line no-useless-escape
    const pattern = new RegExp('\/ltm\/profile\/http\/');
    return profilesArray.filter(p => this.util.safeAccess(() => p.nameReference.link, false) && pattern.test(p.nameReference.link.toLowerCase())).length > 0;
  }
}

module.exports = ApiClient;
