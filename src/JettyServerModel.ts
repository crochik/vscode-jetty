'use strict';

import * as fse from "fs-extra";
import * as _ from "lodash";
import * as os from 'os';
import * as path from "path";
import * as vscode from "vscode";
import * as Constants from './Constants';
import { JettyServer } from "./JettyServer";
import * as Utility from './Utility';

export class JettyServerModel {
    private _server?: JettyServer;

    constructor(public defaultStoragePath: string) {
        vscode.debug.onDidTerminateDebugSession((session: vscode.DebugSession) => {
            if (session && session.name && session.name.startsWith(Constants.DEBUG_SESSION_NAME)) {
                if (this._server && this._server.isDebugging) {
                    this._server.clearDebugInfo();
                }
            }
        });
    }

    public async getJettyServer(): Promise<JettyServer | undefined> {
        if (!this._server) {
            const settings: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('pi.jetty.server');

            // tslint:disable-next-line:no-backbone-get-set-outside-model
            const installPath: string | undefined = settings.get('installPath');
            if (installPath) {
                const isValid: boolean = await Utility.validateInstallPath(installPath);
                if (isValid) {
                    this._server = new JettyServer(installPath);
                }
            }
        }

        return this._server;
    }

    public isServerRunning(): boolean {
        return this._server && this._server.isRunning();
    }

    public async addServer(server: JettyServer): Promise<void> {
        this._server = server;

        await vscode.workspace.getConfiguration().update('pi.jetty.server.installPath', server.installPath, vscode.ConfigurationTarget.Global);
    }
}
