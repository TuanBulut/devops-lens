import * as vscode from 'vscode';
import { DevOpsLensProvider } from './devopsLensProvider';

let refreshInterval: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('DevOps Lens is now active!');

    // Create the tree data provider
    const devopsLensProvider = new DevOpsLensProvider();

    // Register the tree view
    const treeView = vscode.window.createTreeView('devopsLensView', {
        treeDataProvider: devopsLensProvider,
        showCollapseAll: false
    });

    // Register refresh command
    const refreshCommand = vscode.commands.registerCommand('devopsLens.refresh', () => {
        devopsLensProvider.refresh();
    });

    // Auto-refresh every 30 seconds
    refreshInterval = setInterval(() => {
        devopsLensProvider.refresh();
    }, 30000);

    // Clean up on deactivation
    context.subscriptions.push(treeView);
    context.subscriptions.push(refreshCommand);
    context.subscriptions.push({
        dispose: () => {
            if (refreshInterval) {
                clearInterval(refreshInterval);
            }
        }
    });

    // Initial refresh
    devopsLensProvider.refresh();
}

export function deactivate() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
}
