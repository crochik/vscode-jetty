'use strict';
import * as vscode from "vscode";
import * as Constants from './Constants';

export class JettyServer  {
    public startArguments: string[];
    public state: Constants.SERVER_STATE;
    public restart: boolean = false;
    private _isDebugging: boolean = false;
    private _debugPort: number;
    private _debugWorkspace: vscode.WorkspaceFolder;

    constructor(public installPath: string) {
        this.state = Constants.SERVER_STATE.IdleServer;
    }

    public setStarted(running: boolean): void {
        this.state = running ? Constants.SERVER_STATE.RunningServer : Constants.SERVER_STATE.IdleServer;
    }

    public isRunning(): boolean {
        return this.state === Constants.SERVER_STATE.RunningServer;
    }

    public isDebugging(): boolean {
        return this._isDebugging;
    }

    public setDebugInfo(debugging: boolean, port: number, workspace: vscode.WorkspaceFolder): void {
        this._isDebugging = debugging;
        this._debugPort = port;
        this._debugWorkspace = workspace;
    }

    public getDebugWorkspace(): vscode.WorkspaceFolder {
        return this._debugWorkspace;
    }

    public clearDebugInfo(): void {
        this._isDebugging = false;
        this._debugPort = undefined;
        this._debugWorkspace = undefined;
    }

    public getDebugPort(): number {
        return this._debugPort;
    }
}
