'use strict';
const jsonata = require('jsonata');
const Util = require('./util');

const DEFAULT_PARTITION = 'Common';
const DATA_GROUP_PREFIX = '____bg_';
const SHIM_IRULE_NAME = '_bigip_blue_green';
const SHIM_IRULE_FULLPATH = `/${DEFAULT_PARTITION}/${SHIM_IRULE_NAME}`;
const PARTITION_FILTER = `$filter=partition%20eq%20`;
// const DEFAULT_PARTITION_FILTER = `${PARTITION_FILTER}${DEFAULT_PARTITION}`;

class ApiClient {
  constructor () {
    this.util = new Util('ApiClient', false);
  }

  getAllData (originalRestOp, workerContext) {
    return this.getPartitions(originalRestOp, workerContext)
      .then((partitions) => {
        const bigIpDataPromises = partitions.map(p => {
          const getVsPromise = this.getVirtualServersByPartition(originalRestOp, workerContext, p);
          const getPoolsPromise = this.getPoolsByPartition(originalRestOp, workerContext, p);
          return Promise.all([getVsPromise, getPoolsPromise])
            .then((values) => {
              return { name: p, virtualServers: values[0], pools: values[1] };
            });
        });
        return Promise.all(bigIpDataPromises);
      })
      .catch((err) => {
        this.util.logError(`getAllData() Error: ${err}`);
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
        this.util.logError(`getPartitions() Error: ${err}`);
      });
  }

  /** GET virtual servers by partition from the big-ip */
  getVirtualServersByPartition (originalRestOp, workerContext, partition) {
    const uri = workerContext.restHelper.makeRestjavadUri('/mgmt/tm/ltm/virtual', `${PARTITION_FILTER}${partition}&$select=name,fullPath`);
    return workerContext.restRequestSender.sendGet(this.getRestOperationInstance(originalRestOp, workerContext, uri))
      .then((response) => {
        const body = response.getBody();
        const items = body.items || [];
        return items.map(v => { return { name: v.name, fullPath: v.fullPath }; });
      })
      .catch((err) => {
        this.util.logError(`getVirtualServersByPartition() Error: ${err}`);
      });
  }

  /** GET pools by partition from the big-ip */
  getPoolsByPartition (originalRestOp, workerContext, partition) {
    const uri = workerContext.restHelper.makeRestjavadUri('/mgmt/tm/ltm/pool', `${PARTITION_FILTER}${partition}&$select=name,fullPath`);
    return workerContext.restRequestSender.sendGet(this.getRestOperationInstance(originalRestOp, workerContext, uri))
      .then((response) => {
        const body = response.getBody();
        const items = body.items || [];
        return items.map(v => { return { name: v.name, fullPath: v.fullPath }; });
      })
      .catch((err) => {
        this.util.logError(`getPoolsByPartition() Error: ${err}`);
      });
  }

  // *********************** START BUILDERS ***************************************

  /** build blue-green objects on the big-ip */
  buildBlueGreenObjects (originalRestOp, workerContext, declaration) {
    this.util.logDebug(`buildBlueGreenObjects(): Declaration: ${workerContext.restHelper.jsonPrinter(declaration)}`);
    return this.setDataGroup(originalRestOp, workerContext, declaration)
      .then(() => {
        // check if the irule is present, and plug it in!
        this.util.logDebug(`buildBlueGreenObjects(): Ready to shim`);
        return this.shimIRule(originalRestOp, workerContext, declaration.virtualServerFullPath);
      })
      .catch((err) => {
        this.util.logError(`buildBlueGreenObjects() Error: ${err}`);
      });
  }

  /** GET datagroups by partition from the big-ip */
  getDataGroup (originalRestOp, workerContext, partition, objectId) {
    const uri = workerContext.restHelper.makeRestjavadUri(`/mgmt/tm/ltm/data-group/internal/~${DEFAULT_PARTITION}~${DATA_GROUP_PREFIX}${objectId}`);
    return workerContext.restRequestSender.sendGet(this.getRestOperationInstance(originalRestOp, workerContext, uri))
      .then((response) => {
        const d = response['records'].filter(v => v.name === 'distribution')[0]['data'];
        const dArray = d.split(',');
        return { ratio: Number(dArray[0]), bluePool: dArray[1], greenPool: dArray[2] };
      })
      .catch((err) => {
        this.util.logError(`getDataGroup() Error: ${err}`);
      });
  }

  /** PUT datagroup values to the big-ip if exists. If not, create it first with a POST */
  setDataGroup (originalRestOp, workerContext, declaration) {
    const baseDataGroupUri = '/mgmt/tm/ltm/data-group/internal';

    const putUri = workerContext.restHelper.makeRestjavadUri(`${baseDataGroupUri}/~${DEFAULT_PARTITION}~${DATA_GROUP_PREFIX}${this.convertPathForObjectName(declaration.virtualServerFullPath)}`);
    const postUri = workerContext.restHelper.makeRestjavadUri(baseDataGroupUri);
    this.util.logDebug(`setDataGroup(): uri ${workerContext.restHelper.jsonPrinter(putUri)}`);

    return this.blueGreenConfigExists(originalRestOp, workerContext, declaration.name)
      .then((exists) => {
        if (exists) {
          return workerContext.restRequestSender.sendPut(this.getRestOperationInstance(originalRestOp, workerContext, putUri, this.buildDataGroupBody(declaration)))
            .then((resp) => {
              this.util.logDebug(`setDataGroup(): PUT response ${workerContext.restHelper.jsonPrinter(resp.body)}`);
            })
            .catch((err) => {
              this.util.logError(`setDataGroup() PUT Error: ${err}`);
            });
        } else {
          return workerContext.restRequestSender.sendPost(this.getRestOperationInstance(originalRestOp, workerContext, postUri, this.buildDataGroupBody(declaration, true)))
            .then((resp) => {
              this.util.logDebug(`setDataGroup(): POST response ${workerContext.restHelper.jsonPrinter(resp.body)}`);
            })
            .catch((err) => {
              this.util.logError(`setDataGroup() POST Error: ${err}`);
            });
        }
      })
      .catch((err) => {
        this.util.logError(`setDataGroup() Error: ${err}`);
      });
  }

  shimIRule (originalRestOp, workerContext, virtualServerFullPath) {
    // Check to make sure the shim irule exists first
    return this.shimIRuleExists(originalRestOp, workerContext)
      .then((exists) => {
        this.util.logDebug(`shimIRule(): in first then() ${exists}`);
        if (!exists) {
          return this.createShimIRule(originalRestOp, workerContext);
        }
      })
      .then(() => {
        this.util.logDebug(`shimIRule(): in second then() vsfullpath: ${workerContext.restHelper.jsonPrinter(virtualServerFullPath)}`);
        return this.getIRulesByVirtualServer(originalRestOp, workerContext, virtualServerFullPath);
      })
      .then((rules) => {
        this.util.logDebug(`shimIRule(): in third then()`);
        let existingIRules = rules || [];
        this.util.logDebug(`shimIRule(): getIRulesByVirtualServer response ${workerContext.restHelper.jsonPrinter(existingIRules)}`);
        if (existingIRules.indexOf(SHIM_IRULE_FULLPATH) === -1) {
          existingIRules.push(SHIM_IRULE_FULLPATH);
          this.util.logDebug(`shimIRule(): after irule push ${workerContext.restHelper.jsonPrinter(existingIRules)}`);
          return this.setIRulesByVirtualServer(originalRestOp, workerContext, virtualServerFullPath, existingIRules);
        }
        return existingIRules;
      })
      .catch((err) => {
        this.util.logError(`shimIRule() Error: ${err}`);
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
        this.util.logError(`createShimIRule() POST Error: ${err}`);
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
        this.util.logError(`shimIRuleExists() Error: ${err}`);
      });
  }

  /** GET irules bound to a virtual server from the big-ip */
  getIRulesByVirtualServer (originalRestOp, workerContext, virtualServerFullPath) {
    const uri = workerContext.restHelper.makeRestjavadUri(`/mgmt/tm/ltm/virtual/${this.convertPathForQuery(virtualServerFullPath)}`, '$select=rules');
    this.util.logDebug(`getIRulesByVirtualServer(): uri ${workerContext.restHelper.jsonPrinter(uri)}`);
    return workerContext.restRequestSender.sendGet(this.getRestOperationInstance(originalRestOp, workerContext, uri))
      .then((data) => data.body['rules'])
      .catch((err) => {
        this.util.logError(`getIRulesByVirtualServer() Error: ${err}`);
      });
  }

  /** PATCH irules bound to a virtual server from the big-ip */
  setIRulesByVirtualServer (originalRestOp, workerContext, virtualServerFullPath, iRules) {
    const uri = workerContext.restHelper.makeRestjavadUri(`/mgmt/tm/ltm/virtual/${this.convertPathForQuery(virtualServerFullPath)}`);
    const rules = { rules: iRules };
    this.util.logDebug(`setIRulesByVirtualServer(): uri ${workerContext.restHelper.jsonPrinter(uri)} rules ${workerContext.restHelper.jsonPrinter(rules)}`);
    return workerContext.restRequestSender.sendPatch(this.getRestOperationInstance(originalRestOp, workerContext, uri, rules))
      .then((data) => {
        this.util.logDebug(`setIRulesByVirtualServer(): PATCH response ${workerContext.restHelper.jsonPrinter(data.body)}`);
        return data.body['rules'];
      })
      .catch((err) => {
        this.util.logError(`setIRulesByVirtualServer() Error: ${err}`);
      });
  }

  unShimIRuleAndDeleteDatagroup (originalRestOp, workerContext, objectId) {
    return this.getBlueGreenConfig(originalRestOp, workerContext, objectId)
      .then((config) => {
        const virtualServerFullPath = config.records.filter(f => f.name === 'virtualServerFullPath')[0].data;
        const deleteDataGroupPromise = this.deleteDataGroup(originalRestOp, workerContext, DEFAULT_PARTITION, virtualServerFullPath);
        const unShimIRulePromise = this.unShimIRule(originalRestOp, workerContext, virtualServerFullPath);
        return Promise.all([deleteDataGroupPromise, unShimIRulePromise]);
      })
      .catch((err) => {
        this.util.logError(`unShimIRuleAndDeleteDatagroup() Error: ${err}`);
      });
  }

  /** DELETE datagroup by partition from the big-ip */
  deleteDataGroup (originalRestOp, workerContext, partition, virtualServerFullPath) {
    const uri = workerContext.restHelper.makeRestjavadUri(`/mgmt/tm/ltm/data-group/internal/~${partition}~${DATA_GROUP_PREFIX}${this.convertPathForObjectName(virtualServerFullPath)}`);
    return workerContext.restRequestSender.sendDelete(this.getRestOperationInstance(originalRestOp, workerContext, uri));
  }

  unShimIRule (originalRestOp, workerContext, virtualServerFullPath) {
    this.util.logDebug(`unShimIRule(): virtualServer ${virtualServerFullPath}`);
    return this.getIRulesByVirtualServer(originalRestOp, workerContext, virtualServerFullPath)
      .then((data) => {
        let iRules = data || [];
        if (iRules.indexOf(SHIM_IRULE_FULLPATH) !== -1) {
          iRules = iRules.filter(v => v !== SHIM_IRULE_FULLPATH);
          return this.setIRulesByVirtualServer(originalRestOp, workerContext, virtualServerFullPath, iRules);
        }
        return iRules;
      })
      .catch((err) => {
        this.util.logError(`unShimIRule() Error: ${err}`);
      });
  }

  /** check if bluegreen datagroup exists on big-ip */
  blueGreenConfigExists (originalRestOp, workerContext, blueGreenConfigName) {
    return this.getBlueGreenConfig(originalRestOp, workerContext, blueGreenConfigName)
      .then((data) => {
        this.util.logDebug(`blueGreenConfigExists(): GET data returned: ${workerContext.restHelper.jsonPrinter(data)}`);
        return data !== undefined;
      })
      .catch((err) => {
        this.util.logError(`blueGreenConfigExists() Error: ${err}`);
      });
  }

  /** GET bluegreen datagroup from the big-ip */
  getBlueGreenConfig (originalRestOp, workerContext, blueGreenConfigName) {
    const uri = workerContext.restHelper.makeRestjavadUri(`/mgmt/tm/ltm/data-group/internal`);
    this.util.logDebug(`getBlueGreenConfig(): configname '${blueGreenConfigName}' uri ${workerContext.restHelper.jsonPrinter(uri)}`);
    return workerContext.restRequestSender.sendGet(this.getRestOperationInstance(originalRestOp, workerContext, uri))
      .then((data) => {
        this.util.logDebug(`getBlueGreenConfig(): GET data returned: ${workerContext.restHelper.jsonPrinter(data)}`);
        const expression = jsonata(`items[records[name='name' and data='${blueGreenConfigName}']]`);
        const queryResult = expression.evaluate(data.body);
        this.util.logDebug(`getBlueGreenConfig(): jsonata query result: ${workerContext.restHelper.jsonPrinter(queryResult)}`);
        return queryResult;
      })
      .catch((err) => {
        this.util.logError(`getBlueGreenConfig() Error: ${err}`);
      });
  }

  buildIRuleBody (shimIRuleFullPath) {
    return {
      'kind': 'tm:ltm:rule:rulestate',
      'name': SHIM_IRULE_NAME,
      'fullPath': shimIRuleFullPath,
      'apiAnonymous': `proc get_datagroup_name v_name  {\n    return "${DATA_GROUP_PREFIX}[string trimleft [string map {/ _} $v_name] _ ]"\n}\n\n\nwhen HTTP_REQUEST {\n    # use this to set the cookie name as well as to look up the ratio and pool name settings from the datagroup\n    set blue_green_datagroup [call get_datagroup_name [virtual name]]\n\n    #log local0. "datagroup name $blue_green_datagroup"\n    \n    if { [class exists $blue_green_datagroup] } { \n    \n        set str [class match -value "distribution" equals $blue_green_datagroup]\n        \n        set fields [split $str ","]\n        \n        # get this from the datagroup\n        set ratio [lindex $fields 0]\n        set blue_pool [lindex $fields 1]\n        set green_pool [lindex $fields 2]\n    }\n \n    # Check if there is a pool selector cookie in the request\n    if { [HTTP::cookie exists $blue_green_datagroup] } {\n    \n        # Select the pool from the cookie\n        pool [HTTP::cookie $blue_green_datagroup]\n        set selected ""\n    } else {\n    \n        # No pool selector cookie, so choose a pool based on the datargroup ratio\n        set rand [expr { rand() }]\n    \n        if { $rand < $ratio } { \n            pool $blue_pool\n            set selected $blue_pool\n        } else {\n            pool $green_pool\n            set selected $green_pool\n        }\n        #log local0. "pool $selected"\n    }\n}\n\nwhen HTTP_RESPONSE {\n \n    # Set a pool selector cookie from the pool that was was selected for this request\n    if {$selected ne ""}{\n        HTTP::cookie insert name $blue_green_datagroup value $selected path "/"\n    }\n}`
    };
  }

  buildDataGroupBody (declaration, create) {
    const body = {
      'name': `${DATA_GROUP_PREFIX}${this.convertPathForObjectName(declaration.virtualServerFullPath)}`,
      'partition': DEFAULT_PARTITION,
      'records': [
        {
          'name': 'name',
          'data': `${declaration.name}`
        },
        {
          'name': 'virtualServerFullPath',
          'data': `${declaration.virtualServerFullPath}`
        },
        {
          'name': 'distribution',
          'data': `${declaration.distribution.ratio},${declaration.distribution.bluePool},${declaration.distribution.greenPool}`
        }
      ]
    };
    if (create) {
      body['type'] = 'string';
    }
    return body;
  }

  convertPathForQuery (path) {
    return path.replace(/\//g, '~');
  }

  // trim off leading character, and convert the rest of the slashes to make a legal object name
  convertPathForObjectName (path) {
    return path.substring(1).replace(/\//g, '_');
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
}

module.exports = ApiClient;
