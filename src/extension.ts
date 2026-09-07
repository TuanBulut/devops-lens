import * as vscode from 'vscode';
import { DevOpsLensProvider } from './devopsLensProvider';
import { StatusBarHud } from './statusBarHud';
import { setupRealtimeWatchers } from './watchers';
import { registerHudCommands } from './commands/hudCommands';

let refreshIntervalTimer: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('DevOps Lens v2.0 is now active!');

    // 1. Create Tree Data Provider & Register TreeView
    const devopsLensProvider = new DevOpsLensProvider();
    const treeView = vscode.window.createTreeView('devopsLensView', {
        treeDataProvider: devopsLensProvider,
        showCollapseAll: true
    });
    context.subscriptions.push(treeView);

    // 2. Create Status Bar Heads-Up Display (HUD)
    const statusBarHud = new StatusBarHud();
    context.subscriptions.push(statusBarHud);

    // Whenever provider refreshes, sync with Status Bar HUD
    devopsLensProvider.onStatusUpdate(status => {
        statusBarHud.update(status);
    });

    // 3. Register Commands (HUD, Switchers, Docker lifecycle, Terminal)
    registerHudCommands(context, () => devopsLensProvider.refresh());

    const refreshCommand = vscode.commands.registerCommand('devopsLens.refresh', () => {
        devopsLensProvider.refresh();
    });
    context.subscriptions.push(refreshCommand);

    // 4. Set up zero-lag Real-Time Watchers (Kubeconfig, AWS, Git, .env)
    const watchers = setupRealtimeWatchers(() => {
        devopsLensProvider.refresh();
    });
    context.subscriptions.push(...watchers);

    // 5. Polling interval safety net
    const startPolling = () => {
        if (refreshIntervalTimer) {
            clearInterval(refreshIntervalTimer);
        }
        const config = vscode.workspace.getConfiguration('devopsLens');
        const intervalSec = Math.max(5, config.get<number>('refreshInterval', 30));
        refreshIntervalTimer = setInterval(() => {
            devopsLensProvider.refresh();
        }, intervalSec * 1000);
    };

    startPolling();

    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('devopsLens.refreshInterval')) {
            startPolling();
        }
    }));

    context.subscriptions.push({
        dispose: () => {
            if (refreshIntervalTimer) {
                clearInterval(refreshIntervalTimer);
            }
        }
    });

    // 6. Initial trigger
    devopsLensProvider.refresh();
}

export function deactivate() {
    if (refreshIntervalTimer) {
        clearInterval(refreshIntervalTimer);
    }
}
