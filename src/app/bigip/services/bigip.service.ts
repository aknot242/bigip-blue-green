import { Injectable, Inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { BigIpConfigService } from '../services/bigip-config.service'
import { tap, map, switchMap, catchError } from 'rxjs/operators';
import { Distribution } from '../models/distribution';
import { VirtualServerReference } from '../models/virtual-server-reference';

const dataGroupPrefix = 'blue_green_';
const shimIRuleName = 'f5_bigip_blue_green_irule';
const shimIRuleFullPath = '/Common/' + shimIRuleName;

@Injectable()
export class BigIpService {

    private token: string;

    constructor(private http: HttpClient,
        @Inject(BigIpConfigService) private bigIp) { }

    getAuthToken(): Observable<string> {
        const httpHeaders = this.createHttpOptions();
        return this.http.post<string>(`${this.bigIp.url}/mgmt/shared/authn/login`, {
            "username": `${this.bigIp.username}`,
            "password": `${this.bigIp.password}`,
            "loginProviderName": "tmos"
        }, { headers: httpHeaders }).pipe(tap(response => this.token = response['token']['token']));
    }

    /** GET partitions from the big-ip */
    getPartitions(): Observable<string[]> {
        const httpHeaders = this.createHttpOptions(this.token);
        return this.http.get<string[]>(`${this.bigIp.url}/mgmt/tm/auth/partition?$select=fullPath`, { headers: httpHeaders })
            .pipe(map(data => data['items'].map(v => v.fullPath as string)));
    }

    /** GET virtual servers by partition from the big-ip */
    getVirtualServersByPartition(partition: string): Observable<VirtualServerReference[]> {
        const httpHeaders = this.createHttpOptions(this.token);
        return this.http.get<string[]>(`${this.bigIp.url}/mgmt/tm/ltm/virtual?$filter=partition%20eq%20${partition}&$select=name,fullPath`, { headers: httpHeaders })
            .pipe(map(data => {
                return data['items'] !== undefined ? data['items'].map((v) => {
                    const virtualServerReference: VirtualServerReference = { name: v.name, fullPath: v.fullPath };
                    return virtualServerReference;
                }) : new Array<string>();
            }));
    }

    /** GET pools by partition from the big-ip */
    getPoolsByPartition(partition: string): Observable<string[]> {
        const httpHeaders = this.createHttpOptions(this.token);
        return this.http.get<string[]>(`${this.bigIp.url}/mgmt/tm/ltm/pool?$filter=partition%20eq%20${partition}&$select=name`, { headers: httpHeaders })
            .pipe(map(data => {
                return data['items'] !== undefined ? data['items'].map(v => v.name as string) : new Array<string>();
            }));
    }

    /** GET datagroups by partition from the big-ip */
    getDataGroupByPartition(partition: string, virtualServer: VirtualServerReference): Observable<Distribution> {
        const httpHeaders = this.createHttpOptions(this.token);
        return this.http.get<string[]>(`${this.bigIp.url}/mgmt/tm/ltm/data-group/internal/${dataGroupPrefix}${virtualServer.name}?$filter=partition%20eq%20${partition}`, { headers: httpHeaders })
            .pipe(map((data) => {
                const d: string = data['records'].filter(v => v.name === 'distribution')[0]['data'];
                const dArray = d.split(',');
                const dist: Distribution = { ratio: Number(dArray[0]), bluePool: dArray[1], greenPool: dArray[2] };
                return dist;
            }));
    }

    /** PUT datagroup values to the big-ip if exists. If not, create it first with a POST */
    setDataGroup(partition: string, virtualServer: VirtualServerReference, distribution: Distribution): Observable<any> {
        const httpHeaders = this.createHttpOptions(this.token);
        return this.http.get(`${this.bigIp.url}/mgmt/tm/ltm/data-group/internal/~${partition}~${dataGroupPrefix}${this.convertPathForObjectName(virtualServer.fullPath)}`, { headers: httpHeaders, observe: 'response' })
            .pipe(
                switchMap(res => {
                    return this.http.put(`${this.bigIp.url}/mgmt/tm/ltm/data-group/internal/${dataGroupPrefix}${this.convertPathForObjectName(virtualServer.fullPath)}`, this.buildDataGroupBody(partition, virtualServer, distribution), { headers: httpHeaders });
                }),
                catchError(err => {
                    if (err.status === 404) {
                        return this.http.post(`${this.bigIp.url}/mgmt/tm/ltm/data-group/internal`, this.buildDataGroupBody(partition, virtualServer, distribution), { headers: httpHeaders });
                    }
                })
            );
    }

    shimIRule(virtualServer: VirtualServerReference): Observable<string[]> {
        // Check to make sure the shim irule exists first
        return this.shimIRuleExists()
            .pipe(
                switchMap(exists => {
                    if (!exists) {
                        return this.createShimIRule();
                    }
                    return of(true);
                })
                , switchMap((res) => {
                    return this.getIRulesByVirtualServer(virtualServer).pipe(
                        switchMap(data => {
                            let existingIRules: string[] = data || new Array<string>();
                            if (!existingIRules.includes(shimIRuleFullPath)) {
                                existingIRules.push(shimIRuleFullPath);
                                return this.setIRulesByVirtualServer(virtualServer, existingIRules);
                            }
                            return of(existingIRules);
                        }))
                }));
    }

    private createShimIRule(): Observable<boolean> {
        const httpHeaders = this.createHttpOptions(this.token);
        return this.http.post(`${this.bigIp.url}/mgmt/tm/ltm/rule/`, this.buildIRuleBody(shimIRuleFullPath), { headers: httpHeaders })
            .pipe(switchMap(res => of(true)));
    }

    /** GET to see if the shim irule exists on the big-ip */
    private shimIRuleExists(): Observable<boolean> {
        const httpHeaders = this.createHttpOptions(this.token);
        return this.http.get(`${this.bigIp.url}/mgmt/tm/ltm/rule/${this.convertPathForQuery(shimIRuleFullPath)}?$select=fullPath`, { headers: httpHeaders })
            .pipe(
                switchMap(res => {
                    return of(true);
                }),
                catchError(err => {
                    if (err.status === 404) {
                        return of(false);
                    }
                })
            );
    }

    /** GET irules bound to a virtual server from the big-ip */
    private getIRulesByVirtualServer(virtualServer: VirtualServerReference): Observable<string[]> {
        const httpHeaders = this.createHttpOptions(this.token);
        return this.http.get<string[]>(`${this.bigIp.url}/mgmt/tm/ltm/virtual/${this.convertPathForQuery(virtualServer.fullPath)}?$select=rules`, { headers: httpHeaders })
            .pipe(map(data => data['rules']));
    }

    /** PATCH irules bound to a virtual server from the big-ip */
    private setIRulesByVirtualServer(virtualServer: VirtualServerReference, iRules: string[]): Observable<string[]> {
        const httpHeaders = this.createHttpOptions(this.token);
        return this.http.patch<string[]>(`${this.bigIp.url}/mgmt/tm/ltm/virtual/${this.convertPathForQuery(virtualServer.fullPath)}`, { rules: iRules }, { headers: httpHeaders })
            .pipe(map(data => data['rules']));
    }

    unShimIRuleAndDeleteDatagroup(partition: string, virtualServer: VirtualServerReference): Observable<[void, string[]]> {
        let deleteDataGroup$ = this.deleteDataGroup(partition, virtualServer);
        let unShimIRule$ = this.unShimIRule(virtualServer);
        return forkJoin([deleteDataGroup$, unShimIRule$]);
    }

    /** DELETE datagroup by partition from the big-ip */
    private deleteDataGroup(partition: string, virtualServer: VirtualServerReference): Observable<void> {
        const httpHeaders = this.createHttpOptions(this.token);
        return this.http.delete<void>(`${this.bigIp.url}/mgmt/tm/ltm/data-group/internal/~${partition}~${dataGroupPrefix}${this.convertPathForObjectName(virtualServer.fullPath)}`, { headers: httpHeaders });
    }

    private unShimIRule(virtualServer: VirtualServerReference): Observable<string[]> {
        return this.getIRulesByVirtualServer(virtualServer).pipe(
            switchMap(data => {
                let existingIRules: string[] = data || new Array<string>();
                if (existingIRules.includes(shimIRuleFullPath)) {
                    const newIRules = existingIRules.filter(v => v !== shimIRuleFullPath)
                    return this.setIRulesByVirtualServer(virtualServer, newIRules);
                }
                return of(existingIRules);
            }));

    }

    private buildIRuleBody(shimIRuleFullPath: string): Object {
        return {
            "kind": "tm:ltm:rule:rulestate",
            "name": shimIRuleName,
            "fullPath": shimIRuleFullPath,
            "apiAnonymous": "proc get_datagroup_name v_name  {\n    return \"blue_green_[string trimleft [string map {/ _} $v_name] _ ]\"\n}\n\n\nwhen HTTP_REQUEST {\n    # use this to set the cookie name as well as to look up the ratio and pool name settings from the datagroup\n    set blue_green_datagroup [call get_datagroup_name [virtual name]]\n\n    #log local0. \"datagroup name $blue_green_datagroup\"\n    \n    if { [class exists $blue_green_datagroup] } { \n    \n        set str [class match -value \"distribution\" equals $blue_green_datagroup]\n        \n        set fields [split $str \",\"]\n        \n        # get this from the datagroup\n        set ratio [lindex $fields 0]\n        set blue_pool [lindex $fields 1]\n        set green_pool [lindex $fields 2]\n    }\n \n    # Check if there is a pool selector cookie in the request\n    if { [HTTP::cookie exists $blue_green_datagroup] } {\n    \n        # Select the pool from the cookie\n        pool [HTTP::cookie $blue_green_datagroup]\n        set selected \"\"\n    } else {\n    \n        # No pool selector cookie, so choose a pool based on the datargroup ratio\n        set rand [expr { rand() }]\n    \n        if { $rand < $ratio } { \n            pool $blue_pool\n            set selected $blue_pool\n        } else {\n            pool $green_pool\n            set selected $green_pool\n        }\n        #log local0. \"pool $selected\"\n    }\n}\n\nwhen HTTP_RESPONSE {\n \n    # Set a pool selector cookie from the pool that was was selected for this request\n    if {$selected ne \"\"}{\n        HTTP::cookie insert name $blue_green_datagroup value $selected path \"/\"\n    }\n}"
        }
    }

    private buildDataGroupBody(partition: string, virtualServer: VirtualServerReference, distribution: Distribution): Object {
        return {
            "name": `${dataGroupPrefix}${this.convertPathForObjectName(virtualServer.fullPath)}`,
            "partition": partition,
            "type": "string",
            "records": [
                {
                    "name": "distribution",
                    "data": `${distribution.ratio},${distribution.bluePool},${distribution.greenPool}`
                }
            ]
        }
    }

    private convertPathForQuery(path: string) {
        return path.replace(/\//g, '~');
    }

    // trim off leading character, and convert the rest of the slashes to make a legal object name
    private convertPathForObjectName(path: string) {
        return path.substring(1).replace(/\//g, '_');
    }

    private createHttpOptions(token: string = null): any {
        let headers = new HttpHeaders().set('Content-Type', 'application/json; charset=utf-8'); // create header object
        if (token !== null) {
            headers = headers.append('X-F5-Auth-Token', token); // add a new header, creating a new object
        }
        return headers;
    }
}
