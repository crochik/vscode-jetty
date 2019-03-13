'use strict';

import { SpawnOptions } from 'child_process';
import * as fse from 'fs-extra';
import * as _ from "lodash";
import * as opn from 'opn';
import * as path from "path";
import * as portfinder from 'portfinder';
import * as vscode from "vscode";
import * as Constants from './Constants';
import { JettyServer } from "./JettyServer";
import { JettyServerModel } from "./JettyServerModel";
import * as Utility from './Utility';

export class JettyServerController {
    private _outputChannel: vscode.OutputChannel;
    constructor(private _jettyServerModel: JettyServerModel, private _extensionPath: string) {
        this._outputChannel = vscode.window.createOutputChannel('ProgramInterface.com - Jetty');
    }

    public async getRootPath(): Promise<string | undefined> {
        if (!vscode.workspace.rootPath) {
            vscode.window.showErrorMessage('First load your workspace.');
            return;
        }
        const jettyBase: string = path.join(vscode.workspace.rootPath, '/.jetty');
        const exists: boolean = fse.existsSync(jettyBase);
        if (!exists) {
            // create webapp
            const webAppsPath: string = path.join(jettyBase, 'webapps');
            await fse.mkdirs(webAppsPath);

            // crate standard config
            const startIni: string = `--module=server
--module=jsp
--module=resources
--module=deploy
--module=jstl
--module=websocket
--module=http
`;
            await this.createAndOpenAsync(path.join(jettyBase, '/start.ini'), startIni);
        } else {
            const stat: fse.Stat = await fse.statSync(jettyBase);
            if (!stat.isDirectory()) {
                vscode.window.showErrorMessage(`${jettyBase} is not a directory`);
                return;
            }
        }

        return jettyBase;
    }

    public async addServer(): Promise<JettyServer> {
        const existingServer: JettyServer | undefined = await this._jettyServerModel.getJettyServer();
        const defaultUri: vscode.Uri = existingServer ? vscode.Uri.file(existingServer.installPath) :
            (vscode.workspace.rootPath ? vscode.Uri.file(vscode.workspace.rootPath) : undefined);

        const pathPick: vscode.Uri[] = await vscode.window.showOpenDialog({
            defaultUri,
            canSelectFiles: false,
            canSelectFolders: true,
            openLabel: Constants.SELECT_JETTY_DIRECTORY
        });
        if (_.isEmpty(pathPick) || !pathPick[0].fsPath) {
            return;
        }
        const installPath: string = pathPick[0].fsPath;
        if (!await Utility.validateInstallPath(installPath)) {
            vscode.window.showErrorMessage('The selected directory is not a valid Jetty server direcotry');
            return;
        }

        const newServer: JettyServer = new JettyServer(installPath);
        await this._jettyServerModel.addServer(newServer);

        return newServer;
    }

    public async startServer(): Promise<void> {
        let server: JettyServer | undefined = await this._jettyServerModel.getJettyServer();
        if (!server) {
            server = await this.addServer();
            if (!server) {
                // operation aborted
                return;
            }
        }

        if (server.isRunning()) {
            vscode.window.showInformationMessage(Constants.SERVER_RUNNING);
            return;
        }
        try {
            const debugPort: number = await server.getDebugPort();
            const stopPort: number = await portfinder.getPortPromise({ port: debugPort + 1, host: '127.0.0.1' });
            const rootPath: string = await this.getRootPath();
            if (!rootPath) {
                return;
            }

            server.startArguments = ['-jar', path.join(server.installPath, 'start.jar'), `"jetty.base=${rootPath}"`, `"-DSTOP.PORT=${stopPort}"`, '"-DSTOP.KEY=STOP"'];

            // allow passing environment vars (from workspace)
            const options: SpawnOptions = {
                shell: true
            };
            const settings: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('pi.jetty');

            // tslint:disable-next-line:no-backbone-get-set-outside-model
            const envVars: string[] = settings.get('environmentVars');
            envVars.forEach((env: string) => {
                if (!options.env) {
                    options.env = {};
                }
                const index: number = env.indexOf('=');
                if (index > 0) {
                    options.env[env.substring(0, index)] = env.substring(index + 1);
                }
            });

            const args: string[] = debugPort ? ['-Xdebug', `-agentlib:jdwp=transport=dt_socket,address=${debugPort},server=y,suspend=n`].concat(server.startArguments) : server.startArguments;
            const javaProcess: Promise<void> = Utility.execute(this._outputChannel, 'jetty', 'java', options, ...args);
            server.setStarted(true);
            if (debugPort) {
                this.startDebugSession(server);
            }
            await javaProcess;
            server.setStarted(false);
            if (server.restart) {
                server.restart = false;
                await this.startServer();
            }
        } catch (err) {
            server.setStarted(false);
            vscode.window.showErrorMessage(err.toString());
        }

    }

    public async stopServer(restart?: boolean): Promise<void> {
        const server: JettyServer | undefined = await this._jettyServerModel.getJettyServer();

        if (server) {
            if (!server.isRunning()) {
                vscode.window.showInformationMessage(Constants.SERVER_STOPPED);
                return;
            }
            if (!restart) {
                server.clearDebugInfo();
            }
            server.restart = restart;
            await Utility.execute(this._outputChannel, 'jetty', 'java', { shell: true }, ...server.startArguments.concat('--stop'));
        }
    }

    public async runWarPackage(uri: vscode.Uri, debug?: boolean): Promise<void> {
        let server: JettyServer | undefined = await this._jettyServerModel.getJettyServer();
        if (!server) {
            server = await this.addServer();
            if (!server) {
                return;
            }
        }

        let packagePath: string | undefined;
        if (uri) {
            packagePath = uri.fsPath;
            await this.deployPackage(packagePath);
        }

        if (server.isRunning() && ((!server.isDebugging() && !debug) || server.isDebugging() === debug)) {
            return;
        }

        let port: number;
        let workspaceFolder: vscode.WorkspaceFolder | undefined;

        if (debug) {
            if (vscode.workspace.workspaceFolders) {
                if (packagePath) {
                    workspaceFolder = vscode.workspace.workspaceFolders.find((f: vscode.WorkspaceFolder): boolean => {
                        const relativePath: string = path.relative(f.uri.fsPath, packagePath);
                        return relativePath === '' || (!relativePath.startsWith('..') && relativePath !== packagePath);
                    });
                } else if (vscode.workspace.workspaceFolders.length === 1) {
                    workspaceFolder = vscode.workspace.workspaceFolders[0];
                }
            }
            if (!workspaceFolder) {
                vscode.window.showErrorMessage(Constants.NO_PACKAGE);
                return;
            }
            port = await portfinder.getPortPromise({ host: '127.0.0.1' });
        }

        server.setDebugInfo(debug, port, workspaceFolder);
        if (server.isRunning()) {
            await this.stopServer(true);
        } else {
            await this.startServer();
        }
    }

    public dispose(): void {
        if (this._jettyServerModel.isServerRunning()) {
            this.stopServer();
        }
        this._outputChannel.dispose();
    }

    private startDebugSession(server: JettyServer): void {
        if (!server || !server.getDebugPort() || !server.getDebugWorkspace()) {
            return;
        }
        const config: vscode.DebugConfiguration = {
            type: 'java',
            name: `${Constants.DEBUG_SESSION_NAME}`, // basePathName
            request: 'attach',
            hostName: 'localhost',
            port: server.getDebugPort()
        };

        setTimeout(() => vscode.debug.startDebugging(server.getDebugWorkspace(), config), 500);
    }

    private async deployPackage(packagePath: string): Promise<void> {
        const appName: string = path.basename(packagePath, path.extname(packagePath));

        const folder: string = packagePath.substring(0, packagePath.length - 4);
        const fsStats: fse.Stat = fse.statSync(folder);
        if (fsStats.isDirectory) {
            // FC: use folder directly (instead of copying war and exploding it)
            await this.createWebAppDescriptorAsync(folder, appName);

        } else {
            // FC: original: copy/explode war inside jetty folder
            const rootPath: string | undefined = await this.getRootPath();
            if (!rootPath) {
                return;
            }
            const appPath: string = path.join(rootPath, 'webapps', appName);
            await fse.remove(appPath);
            await fse.mkdirs(appPath);
            await Utility.execute(this._outputChannel, 'jetty', 'jar', { cwd: appPath }, 'xvf', `${packagePath}`);
        }
    }

    private async createWebAppDescriptorAsync(packagePath: string, appName: string): Promise<void> {
        const contextPath: string = await vscode.window.showInputBox({
            prompt: 'context path',
            value: `/${appName}`,
            validateInput: (name: string): string => {
                if (!name.match(/^\/[\w.-]*$/)) {
                    return 'please input a valid context path';
                }
                return null;
            }
        });

        const content: string = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<!DOCTYPE Configure PUBLIC "-//Jetty//Configure//EN" "http://www.eclipse.org/jetty/configure_9_3.dtd">
<Configure class="org.eclipse.jetty.webapp.WebAppContext">
    <Set name="contextPath">${contextPath}</Set>
    <Set name="war">${packagePath}</Set>
</Configure>
`;

        const rootPath: string | undefined = await this.getRootPath();
        if (!rootPath) {
            return;
        }
        const appPath: string = path.join(rootPath, 'webapps', `${appName}.xml`);
        await this.createAndOpenAsync(appPath, content);
    }

    private async createAndOpenAsync(filePath: string, content: string): Promise<void> {

        fse.outputFileSync(filePath, content);
        const textDocument: vscode.TextDocument = await vscode.workspace.openTextDocument(filePath);
        if (!textDocument) {
            throw new Error('Could not open file!');
        }
        const editor: Thenable<vscode.TextEditor> = vscode.window.showTextDocument(textDocument);
        if (!editor) {
            throw new Error('Could not show document!');
        }
    }
}
