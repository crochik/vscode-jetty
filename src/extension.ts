'use strict';

import * as vscode from 'vscode';
import { JettyServer } from './JettyServer';
import { JettyServerController } from './JettyServerController';
import { JettyServerModel } from './JettyServerModel';
import * as Utility from './Utility';

export function activate(context: vscode.ExtensionContext): void {
    const jettyServerModel: JettyServerModel = new JettyServerModel(context.storagePath ? context.storagePath : Utility.getTempStoragePath());
    const jettyServerController: JettyServerController = new JettyServerController(jettyServerModel, context.extensionPath);

    context.subscriptions.push(jettyServerController);

    context.subscriptions.push(vscode.commands.registerCommand('jetty.server.add', () => { jettyServerController.addServer(); }));
    context.subscriptions.push(vscode.commands.registerCommand('jetty.server.start', () => { jettyServerController.startServer(); }));
    context.subscriptions.push(vscode.commands.registerCommand('jetty.server.restart', () => { jettyServerController.stopServer(true); }));
    context.subscriptions.push(vscode.commands.registerCommand('jetty.server.stop', () => { jettyServerController.stopServer(); }));
    context.subscriptions.push(vscode.commands.registerCommand('jetty.server.debug', () => { jettyServerController.runWarPackage(undefined, true); }));

    context.subscriptions.push(vscode.commands.registerCommand('jetty.war.run', (uri: vscode.Uri) => { jettyServerController.runWarPackage(uri); }));
    context.subscriptions.push(vscode.commands.registerCommand('jetty.war.debug', (uri: vscode.Uri) => { jettyServerController.runWarPackage(uri, true); }));
}

// tslint:disable-next-line:no-empty
export function deactivate(): void { }
