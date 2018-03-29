'use strict';

import * as fse from "fs-extra";
import * as _ from "lodash";
import * as path from "path";
import * as vscode from "vscode";
import * as Utility from "./Utility";
import { JettyServer } from "./JettyServer";

export class JettyServerModel {
    private _serverList: JettyServer[] = [];
    private _serversJsonFile: string;

    constructor(public defaultStoragePath: string) {
        this._serversJsonFile = path.join(defaultStoragePath, 'servers.json');
        this.initServerListSync();
    }

    public getServerSet(): JettyServer[] {
        return this._serverList;
    }

    public getJettyServer(serverName: string): JettyServer | undefined {
        return this._serverList.find((item: JettyServer) => item.name === serverName);
    }

    public async saveServerList(): Promise<void> {
        try {
            await fse.outputJson(this._serversJsonFile, this._serverList.map((s: JettyServer) => {
                return { _name: s.name, _installPath: s.installPath, _storagePath: s.storagePath };
            }));
            vscode.commands.executeCommand('jetty.tree.refresh');
        } catch (err) {
            console.error(err.toString());
        }
    }

    public deleteServer(JettyServer: JettyServer): boolean {
        const index: number = this._serverList.findIndex((item: JettyServer) => item.name === JettyServer.name);
        if (index > -1) {
            const oldServer: JettyServer[] = this._serverList.splice(index, 1);
            if (!_.isEmpty(oldServer)) {
                fse.remove(JettyServer.storagePath);
                this.saveServerList();
                JettyServer.outputChannel.dispose();
                return true;
            }
        }

        return false;
    }

    public addServer(JettyServer: JettyServer): void {
        const index: number = this._serverList.findIndex((item: JettyServer) => item.name === JettyServer.name);
        if (index > -1) {
            this._serverList.splice(index, 1);
        }
        this._serverList.push(JettyServer);
        this.saveServerList();
    }

    public saveServerListSync(): void {
        try {
            fse.outputJsonSync(this._serversJsonFile, this._serverList.map((s: JettyServer) => {
                return { _name: s.name, _installPath: s.installPath, _storagePath: s.storagePath };
            }));
        } catch (err) {
            console.error(err.toString());
        }
    }

    private initServerListSync(): void {
        try {
            if (fse.existsSync(this._serversJsonFile)) {
                const objArray: {}[] = fse.readJsonSync(this._serversJsonFile);
                if (!_.isEmpty(objArray)) {
                    this._serverList = this._serverList.concat(objArray.map(
                        (obj: { _name: string, _installPath: string, _storagePath: string }) => {
                            return new JettyServer(obj._name, obj._installPath, obj._storagePath);
                        }));
                }
            }
        } catch (err) {
            console.error(err);
        }
    }
}